// 기초 설문 채점과 개인 맞춤 기준표. 서버(src/app.js)와 시연판(demo/api.js)이 함께 쓴다.
import { arousalDomains, beliefItems, durationOptions, firstItems, frequencyOptions, psqiItems, safetyItems } from './content/survey.js';
import { parseTime, scoreIsi } from './rules.js';

const isScale = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const band = (value, cuts) => cuts.findIndex((limit) => value <= limit);

// PSQI 표준 채점(Buysse 1989). 7개 요인 각 0~3점, 총점 0~21점.
export function scorePsqi(psqi) {
  const { bedtime, latencyMin, wake, sleepHours, q5, q6, q7, q8, q9 } = psqi ?? {};
  const bed = parseTime(bedtime);
  const up = parseTime(wake);
  if (!Number.isInteger(latencyMin) || latencyMin < 0 || latencyMin > 600) throw new Error('잠들기까지 걸린 시간을 확인해 주세요.');
  if (typeof sleepHours !== 'number' || !(sleepHours > 0 && sleepHours <= 16)) throw new Error('실제로 잔 시간을 확인해 주세요.');
  if (!Array.isArray(q5) || q5.length !== psqiItems.disturbances.length || !q5.every((v) => isScale(v, 0, 3))) throw new Error('수면 방해 문항에 모두 답해 주세요.');
  if (![q6, q7, q8, q9].every((v) => isScale(v, 0, 3))) throw new Error('피츠버그 설문 문항에 모두 답해 주세요.');
  const inBedMin = (up - bed + 1440) % 1440;
  if (inBedMin === 0) throw new Error('잠자리에 든 시간과 일어난 시간을 확인해 주세요.');

  const latencyScore = band(latencyMin, [15, 30, 60, Infinity]);
  const efficiency = Math.min(100, (sleepHours * 60 / inBedMin) * 100);
  const components = {
    quality: q6,
    latency: band(latencyScore + q5[0], [0, 2, 4, 6]),
    duration: sleepHours > 7 ? 0 : sleepHours >= 6 ? 1 : sleepHours >= 5 ? 2 : 3,
    efficiency: efficiency >= 85 ? 0 : efficiency >= 75 ? 1 : efficiency >= 65 ? 2 : 3,
    disturbance: band(q5.slice(1).reduce((a, b) => a + b, 0), [0, 9, 18, 27]),
    medication: q7,
    daytime: band(q8 + q9, [0, 2, 4, 6]),
  };
  return { total: Object.values(components).reduce((a, b) => a + b, 0), components, efficiencyPct: Math.round(efficiency * 10) / 10 };
}

// FIRST는 9문항, 각 1~4점이다.
export function scoreFirst(first) {
  if (!Array.isArray(first) || first.length !== firstItems.length || !first.every((v) => isScale(v, 1, 4))) throw new Error('스트레스 문항에 모두 답해 주세요.');
  const total = first.reduce((a, b) => a + b, 0);
  return { total, group: total >= 18 ? 'high' : total >= 16 ? 'moderate' : 'nonreactive' };
}

export function scoreArousal(arousal) {
  const scores = {};
  for (const domain of arousalDomains) {
    const values = arousal?.[domain.id];
    if (!Array.isArray(values) || values.length !== domain.items.length || !values.every((v) => isScale(v, 1, 4))) throw new Error('과각성 문항에 모두 답해 주세요.');
    scores[domain.id] = values.reduce((a, b) => a + b, 0);
  }
  return scores;
}

export function scoreBeliefs(beliefs) {
  if (!Array.isArray(beliefs)) throw new Error('잘못된 믿음 문항을 확인해 주세요.');
  const known = beliefItems.map((b) => b.id);
  const chosen = [...new Set(beliefs)].filter((id) => known.includes(id));
  return { chosen, count: chosen.length };
}

// 침대에 머무는 시간 = 잠들기까지의 시간 + 수면 시간 + 깬 뒤 침대에 있는 시간
export const timeInBedMin = ({ latencyMin, sleepHours, afterWakeMin }) => latencyMin + Math.round(sleepHours * 60) + afterWakeMin;

const ISI_AT_RISK = 2;
const AROUSAL_HIGH = 9; // 3문항 평균 3점(꽤 그렇다) 이상
const BELIEFS_HIGH = 3;
const EXCESS_BED_MIN = 60;

// ISI와 PSQI 문항을 보고 어느 부분이 취약한지 나눈다. 진단이 아니라 과제를 고르는 기준이다.
export function buildProfile({ age, sex, isi, psqiResult, firstResult, arousalScores, beliefResult, sleepMin, tibMin }) {
  const c = psqiResult.components;
  const areas = [];
  if (isi[0] >= ISI_AT_RISK || c.latency >= 2) areas.push('onset');
  if (isi[1] >= ISI_AT_RISK || c.disturbance >= 2) areas.push('maintenance');
  if (isi[2] >= ISI_AT_RISK) areas.push('earlyWaking');
  if (c.efficiency >= 2 || tibMin - sleepMin >= EXCESS_BED_MIN) areas.push('timeInBed');
  if (isi[4] >= ISI_AT_RISK || c.daytime >= 2) areas.push('daytime');
  if (isi[6] >= ISI_AT_RISK || arousalScores.psychological >= AROUSAL_HIGH) areas.push('worry');
  if (arousalScores.somatic >= AROUSAL_HIGH) areas.push('somatic');
  if (arousalScores.cognitive >= AROUSAL_HIGH) areas.push('cognitive');
  if (firstResult.group !== 'nonreactive') areas.push('stress');
  if (beliefResult.count >= BELIEFS_HIGH) areas.push('beliefs');
  if (c.medication >= 1) areas.push('medication');
  return {
    age, sex, areas,
    isiItems: { onset: isi[0], maintenance: isi[1], earlyWaking: isi[2], satisfaction: isi[3], daytime: isi[4], noticeable: isi[5], worry: isi[6] },
    psqiComponents: c,
    firstTotal: firstResult.total,
    firstGroup: firstResult.group,
    arousal: arousalScores,
    beliefs: beliefResult,
    tibMin,
  };
}

// 요청 본문을 검사해 저장할 값으로 바꾼다. 문제가 있으면 안내 문구로 Error를 던진다.
export function parseBaseline(body, { age }) {
  const { isi, duration, frequency, safety, sex, psqi, first, arousal, beliefs } = body ?? {};
  const isiTotal = scoreIsi(isi);
  if (!durationOptions.some((o) => o.value === duration) || !frequencyOptions.some((o) => o.value === frequency)) throw new Error('기간과 빈도를 선택해 주세요.');
  if (safetyItems.some((item) => typeof safety?.[item.id] !== 'boolean')) throw new Error('건강 상태 문항에 모두 답해 주세요.');
  if (sex !== 'male' && sex !== 'female') throw new Error('생물학적 성을 선택해 주세요.');
  const psqiResult = scorePsqi(psqi);
  if (!Number.isInteger(psqi.afterWakeMin) || psqi.afterWakeMin < 0 || psqi.afterWakeMin > 300) throw new Error('깬 뒤 침대에 있는 시간을 확인해 주세요.');
  const firstResult = scoreFirst(first);
  const arousalScores = scoreArousal(arousal);
  const beliefResult = scoreBeliefs(beliefs);
  const sleepMin = Math.round(psqi.sleepHours * 60);
  const tibMin = timeInBedMin(psqi);
  if (tibMin > 960) throw new Error('침대에 머무는 시간이 너무 깁니다. 입력한 시간을 확인해 주세요.');
  return {
    isi, isiTotal, duration, frequency, safety, sex, psqi, psqiResult, first, firstResult, arousal, arousalScores, beliefResult,
    wake: psqi.wake, sleepMin, tibMin,
    profile: buildProfile({ age, sex, isi, psqiResult, firstResult, arousalScores, beliefResult, sleepMin, tibMin }),
  };
}

const AREA_INFO = {
  onset: { reason: '잠들기 어려움', title: '졸릴 때만 눕기', detail: '오늘은 눈꺼풀이 무겁고 고개가 떨어질 때 누워 보세요. 피곤함과 졸림은 달라요.', minutes: 3 },
  maintenance: { reason: '자다가 깸', title: '깼을 때 시계 보지 않기', detail: '밤에 깨도 시간을 확인하지 마세요. 시계와 휴대폰을 손이 닿지 않는 곳에 둬요.', minutes: 2 },
  earlyWaking: { reason: '너무 일찍 깸', title: '일어나는 시간 지키기', detail: '일찍 깨도 정한 기상 시간을 바꾸지 말고, 아침 빛을 보며 하루를 시작해요.', minutes: 5 },
  timeInBed: { reason: '침대에 머무는 시간이 김', title: '깬 뒤 바로 침대에서 나오기', detail: '아침에 눈을 뜨면 침대에 더 있지 말고 일어나요. 침대에서 쉬는 시간을 줄이는 연습이에요.', minutes: 2 },
  daytime: { reason: '낮 시간 피로', title: '낮 활동 하나 넣기', detail: '졸릴 때 눕는 대신 가볍게 걷거나 바깥 빛을 봐요. 위험한 작업과 운전은 졸릴 때 피해요.', minutes: 10 },
  worry: { reason: '수면에 대한 걱정', title: '걱정을 적어 두기', detail: '저녁 이른 시간에 잠에 관한 걱정을 적고, 내일 할 일 한 가지를 옆에 써요.', minutes: 10 },
  somatic: { reason: '신체적 과각성', title: '몸의 긴장 풀기', detail: '잠들기 전 천천히 내쉬는 호흡이나 어깨 힘 빼기를 해 보세요.', minutes: 10 },
  cognitive: { reason: '인지적 과각성', title: '생각 내려놓는 시간 갖기', detail: '생각을 억지로 막지 말고, 떠오른 생각을 종이에 옮긴 뒤 내일 다시 보기로 해요.', minutes: 10 },
  stress: { reason: '스트레스에 잠이 민감함', title: '스트레스 받은 날 저녁 루틴', detail: '힘든 일이 있었던 날은 잠들기 1시간 전부터 화면을 끄고 조용한 활동을 해요.', minutes: 15 },
  beliefs: { reason: '수면에 대한 잘못된 믿음', title: '믿음 하나 다시 보기', detail: '설문에서 고른 생각 하나를 떠올리고, 그 생각과 다른 경험이 있었는지 적어 보세요.', minutes: 5 },
  medication: { reason: '수면을 위한 약 사용', title: '약은 의사와 상의하기', detail: '이 프로그램 때문에 약을 스스로 줄이거나 끊지 마세요. 궁금한 점은 담당 의사와 상의해 주세요.', minutes: 2 },
};

// 플랜 본문을 만든 뒤 맞춤 과제를 붙인다. AI로 보내는 항목은 그대로이고, 이 단계는 이 서버 안에서만 일어난다.
export function personalizeContent(content, profile, safety = {}) {
  if (!content || !profile?.areas?.length) return content;
  const areas = profile.areas.filter((id) => AREA_INFO[id]);
  const usable = areas.filter((id) => !(id === 'timeInBed' && safety.fallRisk));
  const days = content.days.map((day, i) => {
    if (!usable.length) return day;
    const { title, detail, minutes } = AREA_INFO[usable[i % usable.length]];
    return { ...day, tasks: [...day.tasks, { title: `맞춤: ${title}`, detail, minutes }] };
  });
  return { ...content, days, personal: areas.map((id) => AREA_INFO[id].reason) };
}
