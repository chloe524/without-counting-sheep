// 기초 설문 채점과 개인 맞춤 기준표. 서버(src/app.js)와 시연판(demo/api.js)이 함께 쓴다.
import { durationOptions, firstItems, frequencyOptions, psqiItems, safetyItems } from './content/survey.js?v=da6b196a09';
import { AROUSAL_BANDS, arousalSurvey } from './content/arousal.js?v=da6b196a09';
import { dbasSurvey } from './content/dbas.js?v=da6b196a09';
import { moduleContent } from './content/modules.js?v=da6b196a09';
import { parseTime, scoreIsi } from './rules.js?v=da6b196a09';

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

// 과각성 20문항 [설계안, 타당도 미검증]. 하위척도마다 합산하고 전체 총점은 쓰지 않는다. 20문항 모두 답해야 채점한다.
export function scoreArousal(answers) {
  const scores = {};
  const bands = {};
  for (const sub of arousalSurvey.subscales) {
    const values = sub.items.map((item) => answers?.[item.id]);
    if (!values.every((v) => isScale(v, 0, 4))) throw new Error('과각성 문항 20개에 모두 답해 주세요.');
    scores[sub.id] = values.reduce((a, b) => a + b, 0);
    const [low, mid] = AROUSAL_BANDS[sub.id];
    bands[sub.id] = scores[sub.id] <= low ? 'low' : scores[sub.id] <= mid ? 'moderate' : 'high';
  }
  return { scores, bands };
}

const LEVEL = { low: 'optional', moderate: 'recommended', high: 'required' };
const RANK = { optional: 0, recommended: 1, required: 2 };
const stronger = (a, b) => (RANK[a] >= RANK[b] ? a : b);

// 모듈 배정 규칙 R1~R8 [설계안]. 한 모듈에 연결된 두 하위척도의 구간이 다르면 더 강한 쪽을 쓴다.
export function assignArousalModules({ bands }) {
  const modules = {
    worry: stronger(LEVEL[bands.A], LEVEL[bands.C]),
    relax: stronger(LEVEL[bands.B], LEVEL[bands.D]),
  };
  const rules = [];
  if (bands.A === 'high' || bands.C === 'high') rules.push('R1');
  if (bands.B === 'high' || bands.D === 'high') rules.push('R2');
  if (Object.values(modules).includes('recommended')) rules.push('R3');
  if (Object.values(modules).includes('optional')) rules.push('R4');
  if (bands.C === 'high') rules.push('R5');
  if (bands.D === 'high') rules.push('R6');
  const allLow = Object.values(bands).every((b) => b === 'low');
  if (allLow) rules.push('R7');
  if (bands.B === 'high') rules.push('R8');
  return { modules, rules, group: allLow ? 'non_hyperarousal' : 'hyperarousal' };
}

// DBAS-16은 문항 평균(0~10)으로 본다.
export function scoreDbas(answers) {
  if (!Array.isArray(answers) || answers.length !== dbasSurvey.items.length || !answers.every((v) => isScale(v, 0, 10))) throw new Error('수면에 대한 생각 문항 16개에 모두 답해 주세요.');
  const mean = (values) => Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const subscales = {};
  for (const key of Object.keys(dbasSurvey.subscales)) {
    subscales[key] = mean(dbasSurvey.items.map((item, i) => (item.subscale === key ? answers[i] : null)).filter((v) => v !== null));
  }
  const total = mean(answers);
  return { mean: total, subscales, high: total >= dbasSurvey.highMean };
}

// 침대에 머무는 시간 = 잠들기까지의 시간 + 수면 시간 + 깬 뒤 침대에 있는 시간
export const timeInBedMin = ({ latencyMin, sleepHours, afterWakeMin }) => latencyMin + Math.round(sleepHours * 60) + afterWakeMin;

// 만 14세 미만을 어린이로 본다. 보호자와 함께 설문하고, DBAS-16은 하지 않는다.
export const CHILD_AGE = 14;
export const GUARDIAN_AGE = CHILD_AGE;

const ISI_AT_RISK = 2;
const EXCESS_BED_MIN = 60;

// ISI와 PSQI 문항을 보고 어느 부분이 취약한지 나눈다. 진단이 아니라 과제를 고르는 기준이다.
// 과각성은 따로 모듈 배정(arousal.assignment)으로 다룬다.
export function buildProfile({ age, sex, isi, psqiResult, firstResult, arousal, dbas, sleepMin, tibMin }) {
  const c = psqiResult.components;
  const areas = [];
  if (isi[0] >= ISI_AT_RISK || c.latency >= 2) areas.push('onset');
  if (isi[1] >= ISI_AT_RISK || c.disturbance >= 2) areas.push('maintenance');
  if (isi[2] >= ISI_AT_RISK) areas.push('earlyWaking');
  if (c.efficiency >= 2 || tibMin - sleepMin >= EXCESS_BED_MIN) areas.push('timeInBed');
  if (isi[4] >= ISI_AT_RISK || c.daytime >= 2) areas.push('daytime');
  if (isi[6] >= ISI_AT_RISK) areas.push('worry');
  if (firstResult.group !== 'nonreactive') areas.push('stress');
  if (dbas?.high) areas.push('beliefs');
  if (c.medication >= 1) areas.push('medication');
  return {
    age, sex, child: age < CHILD_AGE, areas,
    isiItems: { onset: isi[0], maintenance: isi[1], earlyWaking: isi[2], satisfaction: isi[3], daytime: isi[4], noticeable: isi[5], worry: isi[6] },
    psqiComponents: c,
    firstTotal: firstResult.total,
    firstGroup: firstResult.group,
    arousal: { ...arousal, assignment: assignArousalModules(arousal) },
    dbas,
    tibMin,
  };
}

// 요청 본문을 검사해 저장할 값으로 바꾼다. 문제가 있으면 안내 문구로 Error를 던진다.
export function parseBaseline(body, { age }) {
  const { isi, duration, frequency, safety, sex, psqi, first, arousal, dbas } = body ?? {};
  const isiTotal = scoreIsi(isi);
  if (!durationOptions.some((o) => o.value === duration) || !frequencyOptions.some((o) => o.value === frequency)) throw new Error('기간과 빈도를 선택해 주세요.');
  if (safetyItems.some((item) => typeof safety?.[item.id] !== 'boolean')) throw new Error('건강 상태 문항에 모두 답해 주세요.');
  if (sex !== 'male' && sex !== 'female') throw new Error('생물학적 성을 선택해 주세요.');
  const psqiResult = scorePsqi(psqi);
  if (!Number.isInteger(psqi.afterWakeMin) || psqi.afterWakeMin < 0 || psqi.afterWakeMin > 300) throw new Error('깬 뒤 침대에 있는 시간을 확인해 주세요.');
  const firstResult = scoreFirst(first);
  const arousalResult = scoreArousal(arousal);
  // 어린이(만 14세 미만)는 수면에 대한 잘못된 믿음(DBAS-16) 설문을 하지 않는다.
  const child = age < CHILD_AGE;
  const dbasResult = child ? null : scoreDbas(dbas);
  const sleepMin = Math.round(psqi.sleepHours * 60);
  const tibMin = timeInBedMin(psqi);
  if (tibMin > 960) throw new Error('침대에 머무는 시간이 너무 깁니다. 입력한 시간을 확인해 주세요.');
  return {
    isi, isiTotal, duration, frequency, safety, sex, psqi, psqiResult, first, firstResult, arousal, arousalResult, dbas: child ? null : dbas, dbasResult,
    wake: psqi.wake, sleepMin, tibMin,
    profile: buildProfile({ age, sex, isi, psqiResult, firstResult, arousal: arousalResult, dbas: dbasResult, sleepMin, tibMin }),
  };
}

const AREA_INFO = {
  onset: { reason: '잠들기 어려움', title: '졸릴 때만 눕기', detail: '오늘은 눈꺼풀이 무겁고 고개가 떨어질 때 누워 보세요. 피곤함과 졸림은 달라요.', minutes: 3 },
  maintenance: { reason: '자다가 깸', title: '깼을 때 시계 보지 않기', detail: '밤에 깨도 시간을 확인하지 마세요. 시계와 휴대폰을 손이 닿지 않는 곳에 둬요.', minutes: 2 },
  earlyWaking: { reason: '너무 일찍 깸', title: '일어나는 시간 지키기', detail: '일찍 깨도 정한 기상 시간을 바꾸지 말고, 아침 빛을 보며 하루를 시작해요.', minutes: 5 },
  timeInBed: { reason: '침대에 머무는 시간이 김', title: '깬 뒤 바로 침대에서 나오기', detail: '아침에 눈을 뜨면 침대에 더 있지 말고 일어나요. 침대에서 쉬는 시간을 줄이는 연습이에요.', minutes: 2 },
  daytime: { reason: '낮 시간 피로', title: '낮 활동 하나 넣기', detail: '졸릴 때 눕는 대신 가볍게 걷거나 바깥 빛을 봐요. 위험한 작업과 운전은 졸릴 때 피해요.', minutes: 10 },
  worry: { reason: '수면에 대한 걱정', title: '걱정을 적어 두기', detail: '저녁 이른 시간에 잠에 관한 걱정을 적고, 내일 할 일 한 가지를 옆에 써요.', minutes: 10 },
  stress: { reason: '스트레스에 잠이 민감함', title: '스트레스 받은 날 저녁 루틴', detail: '힘든 일이 있었던 날은 잠들기 1시간 전부터 화면을 끄고 조용한 활동을 해요.', minutes: 15 },
  beliefs: { reason: '수면에 대한 잘못된 믿음(DBAS-16)', title: '믿음 하나 다시 보기', detail: '"8시간은 꼭 자야 한다"처럼 잠에 대한 생각 하나를 골라, 그 생각과 다른 경험이 있었는지 적어 보세요.', minutes: 5 },
  medication: { reason: '수면을 위한 약 사용', title: '약은 의사와 상의하기', detail: '이 프로그램 때문에 약을 스스로 줄이거나 끊지 마세요. 궁금한 점은 담당 의사와 상의해 주세요.', minutes: 2 },
};

const assignmentOf = (profile) => profile?.arousal?.assignment ?? null;

// R5: 스트레스 반응성이 높으면 일지에 낮 스트레스 점수를 꼭 적는다.
export const needsStressScore = (profile) => Boolean(assignmentOf(profile)?.rules.includes('R5'));

// 플랜 본문을 만든 뒤 맞춤 과제를 붙인다. AI로 보내는 항목은 그대로이고, 이 단계는 이 서버 안에서만 일어난다.
export function personalizeContent(content, profile, safety = {}) {
  if (!content || !profile?.areas) return content;
  const areas = profile.areas.filter((id) => AREA_INFO[id]);
  const usable = areas.filter((id) => !(id === 'timeInBed' && safety.fallRisk));
  // 4-4: A가 높으면 침대 밖 활동을 걱정 정리·이완과 연결한다.
  const linkLeaveBed = profile.arousal?.bands?.A === 'high';
  const days = content.days.map((day, i) => {
    const tasks = day.tasks.map((t) => (linkLeaveBed && /침대(에서 나오기|에 앉아)/.test(t.title) ? { ...t, detail: `${t.detail} ${moduleContent.leaveBedLink}` } : t));
    if (!usable.length) return { ...day, tasks };
    const { title, detail, minutes } = AREA_INFO[usable[i % usable.length]];
    return { ...day, tasks: [...tasks, { title: `맞춤: ${title}`, detail, minutes }] };
  });
  return { ...content, days, personal: areas.map((id) => AREA_INFO[id].reason) };
}

// 모듈 화면에 쓰는 배정 결과. 시작·완료 기록은 사용 기록에서 읽는다.
export function moduleView(profile, events, week) {
  const assignment = assignmentOf(profile);
  if (!assignment) return null;
  const done = (id, event) => events.includes(`module-${id}-${event}`);
  const status = (id) => ({ started: done(id, 'start'), completed: done(id, 'complete') });
  const r = new Set(assignment.rules);
  return {
    group: assignment.group,
    rules: assignment.rules,
    scores: profile.arousal.scores,
    bands: profile.arousal.bands,
    basicOnly: r.has('R7'),
    modules: r.has('R7') ? [] : ['worry', 'relax'].map((id) => ({ id, level: assignment.modules[id], ...status(id) })),
    emergency: r.has('R5') ? status('emergency') : null,
    daytimeRelax: r.has('R6'),
    somaticNotice: r.has('R8'),
    stressDiary: r.has('R5'),
    relapse: r.has('R5') && week === 3,
    restrictionCaution: profile.arousal.bands.A === 'high',
  };
}

export const MODULE_IDS = ['worry', 'relax', 'emergency'];

const BAND_LABEL = { low: '낮음', moderate: '중간', high: '높음' };
const FIRST_LABEL = { nonreactive: '수면 비반응성 집단', moderate: '중간 수면 반응성 집단', high: '높은 수면 반응성 집단' };

// 결과 화면의 변수별 결괏값. 진단이 아니라 응답과 기록을 정리한 것이다.
export function resultVariables(profile, events, entries) {
  if (!profile?.arousal?.assignment) return null;
  const stressDays = entries.filter((e) => Number.isInteger(e.stress));
  const avgSe = (rows) => (rows.length ? Math.round((rows.reduce((a, e) => a + e.se_pct, 0) / rows.length) * 10) / 10 : null);
  const high = stressDays.filter((e) => e.stress >= 3);
  const low = stressDays.filter((e) => e.stress <= 1);
  const view = moduleView(profile, events, null);
  return {
    age: profile.age,
    sex: profile.sex === 'female' ? '여성' : '남성',
    arousal: Object.entries(profile.arousal.scores).map(([id, score]) => ({ id, score, band: BAND_LABEL[profile.arousal.bands[id]] })),
    arousalGroup: profile.arousal.assignment.group,
    rules: profile.arousal.assignment.rules,
    modules: view.modules.map((m) => ({ id: m.id, level: m.level, started: m.started, completed: m.completed })),
    first: { total: profile.firstTotal, group: FIRST_LABEL[profile.firstGroup] },
    tibMin: profile.tibMin,
    dbasMean: profile.dbas?.mean ?? null,
    areas: profile.areas,
    stress: high.length >= 2 && low.length >= 2 ? { highSe: avgSe(high), lowSe: avgSe(low), highDays: high.length, lowDays: low.length } : null,
  };
}


// 만 14세 미만은 법정대리인(보호자)의 성명, 연락처, 동의 확인이 있어야 가입한다.
export function parseGuardian({ age, guardianName, guardianContact, guardianConsent }) {
  if (age >= GUARDIAN_AGE) return null;
  if (typeof guardianName !== 'string' || !guardianName.trim() || guardianName.length > 50) throw new Error('보호자 성명을 입력해 주세요.');
  if (typeof guardianContact !== 'string' || !/^[0-9+][0-9\s-]{8,19}$/.test(guardianContact.trim())) throw new Error('보호자 연락처(전화번호)를 확인해 주세요.');
  if (guardianConsent !== true) throw new Error('보호자가 설명을 함께 읽고 동의했는지 확인해 주세요.');
  return { name: guardianName.trim(), contact: guardianContact.trim(), confirmedAt: null };
}

const MODULE_NAME = { worry: '걱정 정리', relax: '이완' };

// 설문을 마친 뒤 보여 주는 "개인 맞춤형 플랜" 요약. 변수 6개가 플랜과 일지를 어떻게 바꾸는지 문장으로 정리한다.
export function personalizationSummary(profile, verdict, track) {
  const view = moduleView(profile, [], 1);
  const a = profile.arousal;
  const bands = Object.entries(a.scores).map(([id, score]) => `${id} ${score}점(${BAND_LABEL[a.bands[id]]})`).join(', ');
  const ageEffect = profile.child
    ? '어린이(만 14세 미만)라 보호자와 함께 진행하고, 수면 시간 조절 없이 기상 시간을 지키는 데 집중해요.'
    : profile.age < 18
    ? '만 18세 미만이라 수면 시간 조절 대신 기상 시간을 지키는 데 집중해요.'
    : profile.age >= 65
      ? '만 65세 이상이라 수면 시간 조절 대신 기상 시간을 지키고, 밤에 일어나 걷는 안내를 빼요.'
      : '나이에 따른 제한 없이 진행해요.';
  const sexEffect = verdict.pregnant
    ? '임신 중이라고 답해서 수면 시간을 6시간 미만으로 줄이지 않고, 취침·기상 시간에 30~60분 여유를 둬요.'
    : '분석에 쓰는 변수예요. 플랜 내용은 바꾸지 않아요.';
  const arousalEffect = view.basicOnly
    ? '과각성이 두드러지지 않아 기본 자극 조절과 수면 위생에 집중해요.'
    : view.modules.map((m) => `${MODULE_NAME[m.id]} 모듈 ${{ required: '필수', recommended: '권장', optional: '선택' }[m.level]}`).join(', ')
      + (view.emergency ? ', 스트레스 날 비상 루틴 제공' : '') + (view.daytimeRelax ? ', 낮 시간 이완 추가' : '') + '.';
  const variables = [
    { name: '나이', value: `만 ${profile.age}세`, effect: ageEffect },
    { name: '생물학적 성', value: profile.sex === 'female' ? '여성' : '남성', effect: sexEffect },
    { name: '과각성', value: bands, effect: arousalEffect },
    { name: '스트레스 반응(FIRST)', value: `${profile.firstTotal}점, ${FIRST_LABEL[profile.firstGroup]}`, effect: profile.firstGroup === 'nonreactive' ? '스트레스 관련 과제를 따로 넣지 않아요.' : '스트레스 받은 날 저녁 루틴 과제를 넣어요.' },
    { name: '침대에 머무는 시간', value: `${Math.floor(profile.tibMin / 60)}시간 ${profile.tibMin % 60}분`, effect: profile.areas.includes('timeInBed') ? '깬 뒤 바로 침대에서 나오는 과제를 넣어요.' : '수면 일지가 7일 쌓이면 실제 기록을 기준으로 다시 봐요.' },
    profile.dbas
      ? { name: '수면에 대한 잘못된 믿음(DBAS-16)', value: `평균 ${profile.dbas.mean}점(0~10)`, effect: profile.dbas.high ? '잠에 대한 생각을 다시 보는 과제를 넣어요.' : '믿음 관련 과제는 넣지 않아요.' }
      : { name: '수면에 대한 잘못된 믿음(DBAS-16)', value: '설문하지 않음', effect: '어린이는 이 설문을 하지 않아요.' },
  ];
  const diary = ['합의 수면일지 9개 항목은 모든 참가자가 같아요.'];
  if (view.stressDiary) diary.push('스트레스에 잠이 민감하게 반응하는 편이라, 매일 낮 스트레스 점수(0~4)도 함께 적어요.');
  if (verdict.noRestriction || track !== 'long') diary.push('일지는 수면 시간 조절이 아니라 기상 시간과 수면 패턴을 살피는 데 써요.');
  else diary.push('일지가 7일 이상 쌓이고 수면 효율이 85% 미만이면 2주차부터 수면 시간 조절을 시작해요.');
  return {
    variables,
    areas: profile.areas.map((id) => AREA_INFO[id]?.reason ?? id),
    diary,
    next: track === 'long' ? '기초 교육을 마치면 이 기준으로 1주차 플랜이 만들어져요.' : '오늘부터 이 기준으로 만든 1주차 플랜을 시작해요.',
  };
}
