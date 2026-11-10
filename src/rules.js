// 점수 계산, 안전 판정, 수면 시간 규칙. AI 응답은 이 값들을 바꿀 수 없다.
import { isiItems, safetyItems, susItems } from './content/survey.js?v=a24e33003c';

export const PROGRAM_DAYS = 21;
// 의료진 감독이 없는 환경이라 보수적으로 잡은 하한. 근거 확인 전까지 study.sleepFloorConfirmed는 false다.
export const SLEEP_FLOOR_MIN = 360;
const STEP_MIN = 15;

export function scoreIsi(answers) {
  if (!Array.isArray(answers) || answers.length !== isiItems.length) throw new RangeError('ISI 문항 수가 맞지 않습니다.');
  if (!answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 4)) throw new RangeError('ISI 응답은 0~4점이어야 합니다.');
  return answers.reduce((sum, a) => sum + a, 0);
}

export function scoreSus(answers) {
  if (!Array.isArray(answers) || answers.length !== susItems.length) throw new RangeError('사용성 문항 수가 맞지 않습니다.');
  if (!answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5)) throw new RangeError('사용성 응답은 1~5점이어야 합니다.');
  return answers.reduce((sum, a, i) => sum + (i % 2 === 0 ? a - 1 : 5 - a), 0) * 2.5;
}

// ISI는 최근 2주의 심각도만 재므로, 기간과 빈도 문항으로 플랜을 나눈다.
export function classifyTrack({ isiTotal, duration, frequency }) {
  return duration === 'months' && frequency === 'high' && isiTotal >= 8 ? 'long' : 'short';
}

export function evaluateSafety(answers, { age }) {
  const hit = safetyItems.filter((item) => answers?.[item.id] === true);
  const minor = age < 18;
  const senior = age >= 65;
  return {
    excluded: hit.some((i) => i.effect === 'stop'),
    crisis: hit.some((i) => i.crisis),
    noRestriction: minor || senior || hit.some((i) => i.effect === 'noRestriction' || i.effect === 'fallRisk'),
    fallRisk: senior || hit.some((i) => i.effect === 'fallRisk'),
    relaxCaution: hit.some((i) => i.effect === 'relaxCaution'),
    pregnant: answers?.pregnant === true,
    // 정신질환 문항에 '예'로 답한 경우. 참여 제외(stop)면 치료 우선 안내, 아니면 주의 안내를 보여 준다.
    mentalHealth: hit.some((i) => i.mental) ? (hit.some((i) => i.mental && i.effect === 'stop') ? 'priority' : 'caution') : null,
  };
}

export const parseTime = (hhmm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? '');
  if (!m) throw new RangeError(`시간 형식이 잘못되었습니다: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
};

export const formatTime = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const nightSpan = (from, to) => ((parseTime(to) - parseTime(from) + 1440) % 1440);

export const DIARY_NOTES_MAX = 500;

// 합의 수면일지(CSD) 7번 "최종적으로 깨어난 후 침대에 있던 시간"으로 침대에서 나온 시각을 구하고, 9번 특이사항을 정리한다.
export function diaryExtras({ finalWake, outOfBed, afterWakeMin, notes }) {
  let result = { outOfBed, afterWakeMin: null, notes: null };
  if (afterWakeMin !== undefined && afterWakeMin !== null) {
    if (!Number.isInteger(afterWakeMin) || afterWakeMin < 0 || afterWakeMin > 300) throw new Error('최종적으로 깬 뒤 침대에 있던 시간을 확인해 주세요.');
    result = { ...result, afterWakeMin, outOfBed: formatTime(parseTime(finalWake) + afterWakeMin) };
  }
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string' || notes.length > DIARY_NOTES_MAX) throw new Error(`특이사항은 ${DIARY_NOTES_MAX}자 이내로 적어 주세요.`);
    result.notes = notes.trim() || null;
  }
  return result;
}

export function diaryMetrics({ bedtime, sleepTry, latencyMin, wasoMin, finalWake, outOfBed }) {
  const tib = nightSpan(bedtime, outOfBed);
  const tryDelay = nightSpan(bedtime, sleepTry);
  const lingering = nightSpan(finalWake, outOfBed);
  if (tib === 0 || tib > 960) throw new RangeError('침대에 있던 시간을 확인해 주세요.');
  if (tryDelay + lingering > tib) throw new RangeError('시간의 순서를 확인해 주세요.');
  const tst = tib - tryDelay - latencyMin - wasoMin - lingering;
  if (tst < 0) throw new RangeError('잠든 시간이 0보다 작아요. 입력한 시간을 확인해 주세요.');
  return { tibMin: tib, tstMin: tst, sePct: Math.round((tst / tib) * 1000) / 10 };
}

export function summarizeDiary(entries) {
  if (!entries.length) return { nights: 0 };
  const avg = (key) => entries.reduce((s, e) => s + e[key], 0) / entries.length;
  const tst = avg('tst_min');
  const tib = avg('tib_min');
  return {
    nights: entries.length,
    avgTstMin: Math.round(tst),
    avgTibMin: Math.round(tib),
    avgLatencyMin: Math.round(avg('latency_min')),
    avgWasoMin: Math.round(avg('waso_min')),
    sePct: Math.round((tst / tib) * 1000) / 10,
  };
}

const toStep = (min) => Math.round(min / STEP_MIN) * STEP_MIN;

export const RESTRICTION_MIN_NIGHTS = 7;
export const RESTRICTION_SE_MAX = 85;
export const PREGNANCY_FLEX_MIN = 60;

// 수면 제한 게이트: 안전 문진 통과 + 일지 7일 이상 + 수면 효율 85% 미만을 모두 충족해야 시작한다(빨라야 2주차).
// 시작한 뒤에는 수면 효율 90% 이상이면 15분 늘리고, 85% 미만이면 15분 줄인다(하한 6시간 유지).
// 임신 중에는 같은 하한을 지키고 취침·기상 시간에 30~60분의 여유를 둔다.
export function computeSleepWindow({ track, safety, wake, previousTibMin = null, summary = { nights: 0 }, dangerFlag = false, totalNights = 0 }) {
  const wakeMin = parseTime(wake);
  const result = (mode, tib, reason) => ({
    mode,
    wake,
    tibMin: tib,
    bedtime: tib ? formatTime(wakeMin - tib) : null,
    reason,
    sePct: summary.sePct ?? null,
    nights: summary.nights,
    flexMin: safety?.pregnant ? PREGNANCY_FLEX_MIN : 0,
  });

  if (track !== 'long' || safety.noRestriction || dangerFlag) {
    const reason = dangerFlag
      ? '낮 졸림으로 위험했다고 기록하셔서 수면 시간 조절을 멈췄어요. 기상 시간만 지켜 주세요.'
      : '수면 시간 조절 없이, 기상 시간을 일정하게 지키는 데 집중해요.';
    return result('wake-only', null, reason);
  }
  if (previousTibMin === null) {
    if (totalNights < RESTRICTION_MIN_NIGHTS) {
      return result('wake-only', null, `수면 일지가 ${RESTRICTION_MIN_NIGHTS}일 이상 쌓이기 전까지는 기상 시간만 지켜요. 지금까지 ${totalNights}일 적었어요.`);
    }
    if (!summary.nights || summary.sePct >= RESTRICTION_SE_MAX) {
      return result('wake-only', null, '지난주 수면 효율이 85% 이상이라 수면 시간 조절 없이 기상 시간을 지켜요.');
    }
    const start = Math.max(SLEEP_FLOOR_MIN, toStep(summary.avgTstMin));
    return result('window', start, '지난주 일지에서 실제로 잔 시간을 기준으로 수면 시간을 정했어요.');
  }
  if (summary.nights < 3) return result('window', previousTibMin, '일지가 3일 미만이라 지난주 시간을 유지해요.');
  if (summary.sePct >= 90) return result('window', previousTibMin + STEP_MIN, '수면 효율이 90% 이상이라 15분 늘렸어요.');
  if (summary.sePct < RESTRICTION_SE_MAX) {
    const next = Math.max(SLEEP_FLOOR_MIN, previousTibMin - STEP_MIN);
    return result('window', next, next === previousTibMin ? '하한(6시간)에 도달해 더 줄이지 않고 유지해요.' : '수면 효율이 85% 미만이라 15분 줄였어요.');
  }
  return result('window', previousTibMin, '수면 효율이 85~90%라 지난주 시간을 유지해요.');
}

export const kstDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

export const kstTime = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);

export const daysBetween = (fromDate, toDate) => Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);

export function programPosition(startDate, today) {
  const elapsed = daysBetween(startDate, today);
  return {
    dayIndex: elapsed + 1,
    week: Math.min(3, Math.floor(elapsed / 7) + 1),
    finished: elapsed >= PROGRAM_DAYS,
  };
}

export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// 정해진 시각 뒤 1시간 안일 때만 알린다. 자정을 넘겨도 원래 날짜로 한 번만 보내도록 그 날짜를 함께 준다.
const REMINDER_WINDOW_MIN = 60;
export function reminderOccurrence(hhmm, date = new Date()) {
  const scheduled = parseTime(hhmm);
  const current = parseTime(kstTime(date));
  const today = kstDate(date);
  return {
    due: (current - scheduled + 1440) % 1440 < REMINDER_WINDOW_MIN,
    date: current >= scheduled ? today : addDays(today, -1),
  };
}

export function nextOccurrenceIso(hhmm, date = new Date()) {
  const midnight = Date.parse(`${kstDate(date)}T00:00:00+09:00`);
  const at = midnight + parseTime(hhmm) * 60000;
  return new Date(at > date.getTime() ? at : at + 86400000).toISOString();
}

// 취침 준비 알림: 직접 정한 시각, 없으면 오늘의 수면 시간 30분 전, 그것도 없으면 22:30.
export const BEDTIME_LEAD_MIN = 30;
export function resolveBedtimeReminder(customTime, planBedtime) {
  if (customTime) return customTime;
  return planBedtime ? formatTime(parseTime(planBedtime) - BEDTIME_LEAD_MIN) : '22:30';
}

// 하트비트 간격이 이보다 길면 화면이 꺼져 있던 것으로 보고 세지 않는다.
export const HEARTBEAT_GAP_MAX_SEC = 150;
export const countedSeconds = (fromIso, toDate) => {
  const gap = Math.round((toDate.getTime() - Date.parse(fromIso)) / 1000);
  return gap > 0 && gap <= HEARTBEAT_GAP_MAX_SEC ? gap : 0;
};

// 수면 유형은 AI 플랜 방향을 정하는 데만 쓴다.
export function sleepPattern(isiAnswers) {
  const [onset, maintain, early] = isiAnswers;
  if (onset >= 2 && maintain < 2 && early < 2) return 'onset';
  if (onset < 2 && (maintain >= 2 || early >= 2)) return 'maintenance';
  return 'mixed';
}
