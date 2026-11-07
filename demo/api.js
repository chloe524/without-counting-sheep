// 공개 시연판의 서버 역할. src/app.js의 응답 형식을 따른다. 화면은 브라우저 저장소로 동작하고,
// 바뀐 자료를 저장소(cloud)로 보내 개발자 모드에서 모든 참가자의 자료를 볼 수 있게 한다. AI 계획, 푸시, 이메일은 없다.
import { offlineCloud } from './cloud.js';
import { study } from '../src/content/study.js';
import { allConsentIds, consentCopyText, consentDocument, requiredConsentIds } from '../src/content/consent.js';
import { durationOptions, frequencyOptions, isiItems, safetyItems, susItems } from '../src/content/survey.js';
import { educationIds, educationModules } from '../src/content/education.js';
import { fallbackPlan } from '../src/content/fallback-plans.js';
import {
  addDays, classifyTrack, computeSleepWindow, countedSeconds, diaryMetrics, evaluateSafety, kstDate, kstTime, nextOccurrenceIso, parseTime,
  programPosition, resolveBedtimeReminder, scoreIsi, scoreSus, sleepPattern, summarizeDiary,
} from '../src/rules.js';

const KEY = 'without-counting-sheep-demo-v1';
const REMEMBER_MS = 28 * 24 * 3600 * 1000;
const SESSION_MS = 12 * 3600 * 1000;
const STALE_SLEEP_MS = 16 * 3600 * 1000;
const SLEEP_LOOKBACK_MS = 18 * 3600 * 1000;
const USERNAME = /^[a-zA-Z0-9_]{4,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+][0-9\s-]{8,19}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)));
}

export function createDemoApi({ storage, now = () => new Date(), cloud = offlineCloud }) {
  const today = () => kstDate(now());
  const iso = () => now().toISOString();
  const elapsedOf = (body) => {
    const v = Number(body?.elapsedSec);
    return Number.isFinite(v) && v >= 0 && v < 86400 ? Math.round(v) : null;
  };

  const startSession = (db, user, remember) => {
    db.session = { userId: user.id, expiresAt: now().getTime() + (remember ? REMEMBER_MS : SESSION_MS) };
  };

  const startProgram = (u) => {
    u.stage = 'program';
    u.program_start = today();
  };

  const advanceIfFinished = (u) => {
    if (u.stage === 'program' && programPosition(u.program_start, today()).finished) u.stage = 'final-survey';
  };

  const diaryRange = (u, from, to) => Object.values(u.diary).filter((d) => d.night >= from && d.night < to).sort((a, b) => a.night.localeCompare(b.night));

  function ensurePlan(db, u, week) {
    const existing = u.plans.find((p) => p.week === week);
    if (existing) return existing;
    const safety = { ...u.safety };
    if (u.restriction_stopped_at) safety.noRestriction = true;
    const weekStart = addDays(u.program_start, (week - 1) * 7);
    const summary = summarizeDiary(diaryRange(u, addDays(weekStart, -7), weekStart));
    const window = computeSleepWindow({
      track: u.track,
      safety,
      wake: u.wake_time,
      baselineSleepMin: u.baseline_sleep_min,
      baselineTibMin: u.baseline_tib_min,
      previousTibMin: u.plans.find((p) => p.week === week - 1)?.window.tibMin ?? null,
      summary,
      dangerFlag: Boolean(u.restriction_stopped_at),
    });
    const content = fallbackPlan({ track: u.track, week, safety, pattern: u.sleep_pattern });
    db.nextId += 1;
    const plan = { id: db.nextId, week, status: 'ready', window, content, checks: [] };
    u.plans.push(plan);
    return plan;
  }

  const closeStaleSleep = (u) => {
    const cutoff = new Date(now().getTime() - STALE_SLEEP_MS).toISOString();
    for (const s of u.sleep) {
      if (s.status === 'active' && s.started_at < cutoff) {
        s.status = 'abandoned';
        s.ended_at = s.last_seen_at;
      }
    }
  };

  const serializeSleep = (row) => row && ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    alarmAt: row.alarm_at,
    startTime: kstTime(new Date(row.started_at)),
    endTime: row.ended_at ? kstTime(new Date(row.ended_at)) : null,
    night: row.ended_at ? kstDate(new Date(row.ended_at)) : null,
    onMin: Math.round(row.on_seconds / 60),
    totalMin: row.ended_at ? Math.round((Date.parse(row.ended_at) - Date.parse(row.started_at)) / 60000) : null,
    perceivedMin: row.perceived_min,
  });

  const finishedSleep = (u) => u.sleep.filter((s) => s.status === 'ended' || s.status === 'abandoned').sort((a, b) => b.id - a.id);

  function sleepStatus(u) {
    closeStaleSleep(u);
    const since = new Date(now().getTime() - SLEEP_LOOKBACK_MS).toISOString();
    const last = finishedSleep(u).find((s) => s.ended_at >= since);
    return {
      active: serializeSleep(u.sleep.find((s) => s.status === 'active')) ?? null,
      last: serializeSleep(last) ?? null,
      pending: last && last.perceived_min === null ? serializeSleep(last) : null,
    };
  }

  const activeSleep = (u) => {
    closeStaleSleep(u);
    const row = u.sleep.find((s) => s.status === 'active');
    if (!row) throw new HttpError(409, '켜져 있는 수면 화면이 없습니다.');
    return row;
  };

  const latestPlanWindow = (u) => [...u.plans].sort((a, b) => b.week - a.week)[0]?.window ?? null;

  const routes = [
    ['GET', /^\/public\/config$/, null, () => ({
      name: study.name,
      signupOpen: true,
      draft: true,
      researcher: study.researcher,
    })],

    ['GET', /^\/public\/consent$/, null, () => consentDocument()],

    ['GET', /^\/auth\/check-username$/, null, async ({ db, query }) => {
      const username = query.get('username') ?? '';
      if (!USERNAME.test(username)) return { valid: false, available: false };
      const remote = await cloud.check(username, null);
      return { valid: true, available: !remote?.usernameTaken && !db.users.some((a) => a.username.toLowerCase() === username.toLowerCase()) };
    }],

    ['POST', /^\/auth\/signup$/, null, async ({ db, body }) => {
      const { username, email, password, nickname, fullName, age, phone, consents, remember } = body ?? {};
      const accepted = Array.isArray(consents) ? consents.filter((c) => allConsentIds().includes(c)) : [];
      if (requiredConsentIds().some((id) => !accepted.includes(id))) throw new HttpError(400, '필수 동의 항목에 모두 동의해 주세요.');
      if (!USERNAME.test(username ?? '')) throw new HttpError(400, '아이디는 영문, 숫자, 밑줄로 4~20자여야 합니다.');
      if (!EMAIL.test(email ?? '')) throw new HttpError(400, '이메일 형식을 확인해 주세요.');
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw new HttpError(400, '비밀번호는 8자 이상이어야 합니다.');
      if (!nickname?.trim() || nickname.length > 20) throw new HttpError(400, '닉네임을 20자 이내로 입력해 주세요.');
      if (!fullName?.trim() || fullName.length > 50) throw new HttpError(400, '성명을 입력해 주세요.');
      if (!Number.isInteger(age) || age > 120) throw new HttpError(400, '연령을 숫자로 입력해 주세요.');
      if (age < 14) throw new HttpError(400, '만 14세 이상만 참여할 수 있습니다.');
      if (accepted.includes('III-6') !== accepted.includes('AI-NOTICE')) throw new HttpError(400, 'AI 전송에 동의하려면 전송 내용 확인과 Ⅲ-6에 함께 표시해 주세요.');
      const wantsPhone = accepted.includes('II-3');
      if (wantsPhone && !PHONE.test(phone?.trim() ?? '')) throw new HttpError(400, '전화번호를 확인해 주세요.');
      if (db.users.some((a) => a.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, '이미 쓰고 있는 아이디입니다.');
      if (db.users.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new HttpError(409, '이미 가입한 이메일입니다.');
      // 다른 사람의 브라우저에서 가입한 아이디와 이메일도 막는다.
      const remote = await cloud.check(username, email);
      if (remote?.usernameTaken) throw new HttpError(409, '이미 쓰고 있는 아이디입니다.');
      if (remote?.emailTaken) throw new HttpError(409, '이미 가입한 이메일입니다.');

      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      db.nextId += 1;
      const user = {
        id: db.nextId, username, email, nickname: nickname.trim(), fullName: fullName.trim(), phone: wantsPhone ? phone.trim() : null,
        salt, hash: await hashPassword(password, salt),
        age, consent_items: accepted, consent_at: iso(), stage: 'survey', track: null, safety: {},
        excluded_at: null, program_start: null, wake_time: null, baseline_sleep_min: null, baseline_tib_min: null,
        sleep_pattern: null, restriction_stopped_at: null, withdrawn_at: null,
        surveys: {}, education: {}, plans: [], diary: {}, sleep: [],
        prefs: { reminder_time: '08:30', morning_enabled: true, bedtime_enabled: true, bedtime_time: null },
      };
      db.users.push(user);
      startSession(db, user, Boolean(remember));
      return { status: 201, data: { ok: true } };
    }],

    ['POST', /^\/auth\/login$/, null, async ({ db, body }) => {
      const { username, password, remember } = body ?? {};
      const user = typeof username === 'string' && db.users.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (!user || typeof password !== 'string' || await hashPassword(password, user.salt) !== user.hash) {
        throw new HttpError(401, '아이디 또는 비밀번호가 맞지 않습니다.');
      }
      startSession(db, user, Boolean(remember));
      return { ok: true };
    }],

    ['POST', /^\/auth\/logout$/, 'auth', ({ db }) => {
      db.session = null;
      return { ok: true };
    }],

    ['GET', /^\/me$/, 'auth', ({ u }) => {
      advanceIfFinished(u);
      return {
        nickname: u.nickname,
        stage: u.withdrawn_at ? 'withdrawn' : u.excluded_at ? 'excluded' : u.stage,
        track: u.track,
        position: u.program_start ? programPosition(u.program_start, today()) : null,
        today: today(),
        crisis: Boolean(u.safety.crisis),
        relaxCaution: Boolean(u.safety.relaxCaution),
        pregnant: Boolean(u.safety.pregnant),
        restrictionStopped: Boolean(u.restriction_stopped_at),
        sleep: u.withdrawn_at || u.excluded_at ? null : sleepStatus(u),
      };
    }],

    ['GET', /^\/survey\/questions$/, 'auth', () => ({
      isi: isiItems, duration: durationOptions, frequency: frequencyOptions, safety: safetyItems.map(({ id, text }) => ({ id, text })), sus: susItems,
    })],

    ['POST', /^\/survey\/baseline$/, 'active', ({ u, body }) => {
      if (u.stage !== 'survey') throw new HttpError(409, '이미 기초 설문을 마쳤습니다.');
      const { isi, duration, frequency, safety, wake, sleepHours, inBedHours } = body ?? {};
      let isiTotal;
      try {
        isiTotal = scoreIsi(isi);
        parseTime(wake);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
      if (!durationOptions.some((o) => o.value === duration) || !frequencyOptions.some((o) => o.value === frequency)) throw new HttpError(400, '기간과 빈도를 선택해 주세요.');
      if (safetyItems.some((item) => typeof safety?.[item.id] !== 'boolean')) throw new HttpError(400, '건강 상태 문항에 모두 답해 주세요.');
      const sleepMin = Math.round(Number(sleepHours) * 60);
      const tibMin = Math.round(Number(inBedHours) * 60);
      if (!(sleepMin > 0 && sleepMin <= 960) || !(tibMin >= sleepMin && tibMin <= 960)) throw new HttpError(400, '평소 수면 시간과 침대에 있는 시간을 확인해 주세요.');

      const verdict = evaluateSafety(safety, { age: u.age });
      const track = classifyTrack({ isiTotal, duration, frequency });
      u.surveys['baseline-isi'] = { answers: { isi, duration, frequency, sleepHours, inBedHours, wake }, score: isiTotal, elapsed_sec: elapsedOf(body), created_at: iso() };
      u.surveys.safety = { answers: safety, score: null, created_at: iso() };
      Object.assign(u, {
        track, safety: verdict, wake_time: wake, baseline_sleep_min: sleepMin, baseline_tib_min: tibMin, sleep_pattern: sleepPattern(isi),
        stage: track === 'long' ? 'education' : 'program', excluded_at: verdict.excluded ? iso() : null,
      });
      if (track === 'short' && !verdict.excluded) startProgram(u);
      return { track, excluded: verdict.excluded, crisis: verdict.crisis };
    }],

    ['GET', /^\/education$/, 'active', ({ u }) => ({
      modules: educationModules.map((m) => ({ ...m, done: m.id in u.education, answers: u.education[m.id]?.answers ?? null })),
      wake: u.wake_time,
    })],

    ['POST', /^\/education\/([\w-]+)\/complete$/, 'active', ({ u, body, params }) => {
      if (!educationIds.includes(params[0])) throw new HttpError(404, '없는 교육입니다.');
      if (u.stage !== 'education') throw new HttpError(409, '교육 단계가 아닙니다.');
      const answers = body?.answers ?? null;
      if (params[0] === 'sleep-time') {
        try {
          parseTime(answers?.wake);
        } catch {
          throw new HttpError(400, '기상 시간을 정해 주세요.');
        }
        u.wake_time = answers.wake;
      }
      u.education[params[0]] = { answers, elapsed_sec: elapsedOf(body), completed_at: iso() };
      const finished = Object.keys(u.education).length >= educationIds.length;
      if (finished) startProgram(u);
      return { finished };
    }],

    ['GET', /^\/plan\/current$/, 'active', ({ db, u }) => {
      advanceIfFinished(u);
      if (!u.program_start || u.stage !== 'program') throw new HttpError(409, '플랜 진행 단계가 아닙니다.');
      const position = programPosition(u.program_start, today());
      return { plan: ensurePlan(db, u, position.week), position, track: u.track };
    }],

    ['GET', /^\/plan\/history$/, 'active', ({ u }) => ({ plans: [...u.plans].sort((a, b) => a.week - b.week) })],

    ['POST', /^\/plan\/(\d+)\/check$/, 'active', ({ u, body, params }) => {
      const plan = u.plans.find((p) => p.id === Number(params[0]));
      if (!plan) throw new HttpError(404, '플랜을 찾을 수 없습니다.');
      const { day, task, done } = body ?? {};
      if (!Number.isInteger(day) || !Number.isInteger(task) || day < 0 || task < 0) throw new HttpError(400, '과제 번호가 잘못되었습니다.');
      plan.checks = plan.checks.filter((c) => c.day !== day || c.task !== task);
      if (done) plan.checks.push({ day, task });
      return { ok: true };
    }],

    ['GET', /^\/diary$/, 'auth', ({ u }) => ({
      entries: Object.values(u.diary).sort((a, b) => b.night.localeCompare(a.night)).slice(0, 28),
      today: today(),
    })],

    ['POST', /^\/diary$/, 'active', ({ u, body }) => {
      const b = body ?? {};
      const nights = [today(), addDays(today(), -1), addDays(today(), -2)];
      if (!nights.includes(b.night)) throw new HttpError(400, '오늘부터 이틀 전까지의 일지만 쓸 수 있습니다.');
      const ints = { latencyMin: [0, 600], awakenings: [0, 30], wasoMin: [0, 600], quality: [1, 5], sleepiness: [1, 5], napMin: [0, 300] };
      for (const [key, [min, max]] of Object.entries(ints)) {
        if (!Number.isInteger(b[key]) || b[key] < min || b[key] > max) throw new HttpError(400, '입력한 숫자를 확인해 주세요.');
      }
      let m;
      try {
        m = diaryMetrics(b);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
      const danger = b.danger === true;
      u.diary[b.night] = {
        night: b.night, bedtime: b.bedtime, sleep_try: b.sleepTry, latency_min: b.latencyMin, awakenings: b.awakenings, waso_min: b.wasoMin,
        final_wake: b.finalWake, out_of_bed: b.outOfBed, quality: b.quality, sleepiness: b.sleepiness, danger: danger ? 1 : 0, nap_min: b.napMin,
        tib_min: m.tibMin, tst_min: m.tstMin, se_pct: m.sePct, elapsed_sec: elapsedOf(b), saved_at: iso(),
      };
      let restrictionStopped = false;
      if (danger && !u.restriction_stopped_at) {
        u.restriction_stopped_at = iso();
        const latest = [...u.plans].sort((x, y) => y.week - x.week)[0];
        if (latest) latest.window = { mode: 'wake-only', wake: u.wake_time, tibMin: null, bedtime: null, reason: '낮 졸림으로 위험했다고 기록하셔서 수면 시간 조절을 멈췄어요. 기상 시간만 지켜 주세요.', sePct: null, nights: 0 };
        restrictionStopped = true;
      }
      return { ...m, danger, restrictionStopped };
    }],

    ['POST', /^\/survey\/final$/, 'active', ({ u, body }) => {
      advanceIfFinished(u);
      if (u.stage !== 'final-survey') throw new HttpError(409, '아직 수면 설문을 다시 쓸 단계가 아닙니다.');
      let score;
      try {
        score = scoreIsi(body?.isi);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
      u.surveys['final-isi'] = { answers: { isi: body.isi }, score, elapsed_sec: elapsedOf(body), created_at: iso() };
      u.stage = 'usability';
      return { ok: true };
    }],

    ['POST', /^\/survey\/usability$/, 'active', ({ u, body }) => {
      if (u.stage !== 'usability') throw new HttpError(409, '사용성 설문 단계가 아닙니다.');
      let score;
      try {
        score = scoreSus(body?.sus);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
      const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 2000) : '';
      u.surveys.usability = { answers: { sus: body.sus, comment }, score, elapsed_sec: elapsedOf(body), created_at: iso() };
      u.stage = 'done';
      return { ok: true };
    }],

    ['GET', /^\/results$/, 'auth', ({ u }) => {
      if (u.stage !== 'done') throw new HttpError(409, '설문을 모두 마치면 결과를 볼 수 있습니다.');
      const before = u.surveys['baseline-isi'].score;
      const after = u.surveys['final-isi'].score;
      const end = addDays(u.program_start, 21);
      const first = summarizeDiary(diaryRange(u, u.program_start, addDays(u.program_start, 7)));
      const last = summarizeDiary(diaryRange(u, addDays(u.program_start, 14), end));
      const rated = u.sleep.filter((s) => s.perceived_min !== null);
      const average = (values) => (rated.length ? Math.round(values.reduce((a, b) => a + b, 0) / rated.length) : null);
      return {
        isiBefore: before,
        isiAfter: after,
        isiChange: after - before,
        isiMax: isiItems.length * 4,
        diaryNights: diaryRange(u, u.program_start, end).length,
        programDays: 21,
        sePctWeek1: first.sePct ?? null,
        sePctWeek3: last.sePct ?? null,
        suggestConsult: after >= 15,
        sleepNights: rated.length,
        avgOnMin: average(rated.map((s) => s.on_seconds / 60)),
        avgPerceivedMin: average(rated.map((s) => s.perceived_min)),
      };
    }],

    ['GET', /^\/consent\/copy$/, 'auth', ({ u }) => ({ text: consentCopyText(consentDocument(), u.consent_items, u.consent_at) })],

    ['GET', /^\/notifications$/, 'auth', ({ u }) => ({
      reminderTime: u.prefs.reminder_time,
      morningEnabled: u.prefs.morning_enabled,
      bedtimeEnabled: u.prefs.bedtime_enabled,
      bedtimeAuto: !u.prefs.bedtime_time,
      bedtimeTime: resolveBedtimeReminder(u.prefs.bedtime_time, latestPlanWindow(u)?.bedtime ?? null),
      wroteToday: today() in u.diary,
      sleeping: u.sleep.some((s) => s.status === 'active'),
      emailEnabled: false,
      pushEnabled: false,
      emailAvailable: false,
      vapidPublicKey: null,
    })],

    ['POST', /^\/notifications$/, 'active', ({ u, body }) => {
      const { reminderTime, morningEnabled, bedtimeEnabled, bedtimeAuto, bedtimeTime } = body ?? {};
      try {
        parseTime(reminderTime);
        if (!bedtimeAuto) parseTime(bedtimeTime);
      } catch {
        throw new HttpError(400, '알림 시간을 확인해 주세요.');
      }
      u.prefs = { reminder_time: reminderTime, morning_enabled: Boolean(morningEnabled), bedtime_enabled: Boolean(bedtimeEnabled), bedtime_time: bedtimeAuto ? null : bedtimeTime };
      return { ok: true };
    }],

    ['POST', /^\/notifications\/test$/, 'active', () => ({ push: 0, email: false })],

    ['GET', /^\/sleep\/status$/, 'active', ({ u }) => ({
      ...sleepStatus(u),
      defaultAlarm: latestPlanWindow(u)?.wake ?? u.wake_time,
      recent: finishedSleep(u).slice(0, 14).map(serializeSleep),
    })],

    ['POST', /^\/sleep\/start$/, 'active', ({ db, u, body }) => {
      if (u.stage !== 'program') throw new HttpError(409, '플랜 진행 중에만 수면 화면을 켤 수 있습니다.');
      closeStaleSleep(u);
      if (u.sleep.some((s) => s.status === 'active')) throw new HttpError(409, '이미 수면 화면이 켜져 있습니다.');
      const alarm = body?.alarm ?? null;
      let alarmAt = null;
      if (alarm !== null) {
        try {
          alarmAt = nextOccurrenceIso(alarm, now());
        } catch {
          throw new HttpError(400, '알람 시간을 확인해 주세요.');
        }
      }
      db.nextId += 1;
      const row = { id: db.nextId, status: 'active', started_at: iso(), last_seen_at: iso(), ended_at: null, on_seconds: 0, alarm_at: alarmAt, perceived_min: null };
      u.sleep.push(row);
      return { status: 201, data: serializeSleep(row) };
    }],

    ['POST', /^\/sleep\/heartbeat$/, 'active', ({ u }) => {
      const row = activeSleep(u);
      row.on_seconds += countedSeconds(row.last_seen_at, now());
      row.last_seen_at = iso();
      return { ok: true };
    }],

    ['POST', /^\/sleep\/end$/, 'active', ({ u }) => {
      const row = activeSleep(u);
      row.on_seconds += countedSeconds(row.last_seen_at, now());
      Object.assign(row, { status: 'ended', last_seen_at: iso(), ended_at: iso() });
      return serializeSleep(row);
    }],

    ['POST', /^\/sleep\/cancel$/, 'active', ({ u }) => {
      Object.assign(activeSleep(u), { status: 'cancelled', ended_at: iso() });
      return { ok: true };
    }],

    ['POST', /^\/sleep\/(\d+)\/perceived$/, 'active', ({ u, body, params }) => {
      const { perceivedMin } = body ?? {};
      if (!Number.isInteger(perceivedMin) || perceivedMin < 0 || perceivedMin > 960) throw new HttpError(400, '느낀 수면 시간을 확인해 주세요.');
      const row = finishedSleep(u).find((s) => s.id === Number(params[0]));
      if (!row) throw new HttpError(404, '수면 기록을 찾을 수 없습니다.');
      row.perceived_min = perceivedMin;
      return { ok: true };
    }],

    ['POST', /^\/withdraw$/, 'auth', async ({ u, body }) => {
      if (typeof body?.password !== 'string' || await hashPassword(body.password, u.salt) !== u.hash) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
      u.withdrawn_at = iso();
      return { ok: true };
    }],
  ];

  const loadDb = () => JSON.parse(storage.getItem(KEY) ?? 'null') ?? { nextId: 0, users: [], session: null };
  const randomHex = (bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes)));

  // 저장소 연결 전에 만든 계정에도 코드와 토큰을 주어 다음 접속 때 함께 보낸다.
  const prepareForCloud = (u) => {
    if (u.cloudToken) return;
    u.code = `P-${randomHex(5).toUpperCase()}`;
    u.cloudToken = randomHex(32);
    u.dirty = true;
    u.rev = (u.rev ?? 0) + 1;
  };

  // 식별 정보와 연구 자료를 나누어 보낸다. 비밀번호 해시와 토큰은 연구 자료에 넣지 않는다.
  const cloudPayload = (u) => {
    const { id, username, email, nickname, fullName, phone, salt, hash, code, cloudToken, dirty, rev, ...record } = u;
    return { code, token: cloudToken, identity: { username, email, nickname, fullName, phone }, record };
  };

  let flushing = null;
  const flush = (userId) => {
    flushing ??= (async () => {
      try {
        for (;;) {
          const u = loadDb().users.find((a) => a.id === userId);
          if (!u?.dirty) return;
          if (!await cloud.sync(cloudPayload(u))) return;
          const db = loadDb();
          const fresh = db.users.find((a) => a.id === userId);
          if (fresh?.rev === u.rev) {
            fresh.dirty = false;
            storage.setItem(KEY, JSON.stringify(db));
            return;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  };

  async function handle(method, url, body) {
    const { pathname, searchParams } = new URL(url, 'http://demo.invalid');
    if (pathname.startsWith('/admin')) return cloud.admin(pathname, body);
    const db = loadDb();
    try {
      db.users.forEach(prepareForCloud);
      for (const [routeMethod, pattern, guard, action] of routes) {
        const match = routeMethod === method && pattern.exec(pathname);
        if (!match) continue;
        const u = db.session && db.session.expiresAt >= now().getTime() ? db.users.find((a) => a.id === db.session.userId) : null;
        if (guard && !u) throw new HttpError(401, '다시 로그인해 주세요.');
        if (guard === 'active') {
          if (u.withdrawn_at) throw new HttpError(403, '참여를 그만둔 계정입니다.');
          if (u.excluded_at) throw new HttpError(403, '이 프로그램에 참여할 수 없는 계정입니다.');
        }
        const before = u ? JSON.stringify(u) : null;
        const result = await action({ db, u, body, query: searchParams, params: match.slice(1) });
        // 개발자 모드에서 볼 사용 기록. 입력 내용은 남기지 않고 어떤 동작을 했는지만 남긴다.
        const acting = db.users.find((x) => x.id === db.session?.userId);
        if (acting) {
          const isVisit = pathname === '/me';
          const seenToday = (acting.usage ?? []).some((e) => e.event === 'visit' && e.occurred_on === today());
          if ((method === 'POST' && !isVisit) || (isVisit && !seenToday)) {
            acting.usage = [...(acting.usage ?? []), { event: isVisit ? 'visit' : pathname.slice(1), elapsed_sec: elapsedOf(body), occurred_on: today() }].slice(-500);
          }
          prepareForCloud(acting);
          if (JSON.stringify(acting) !== before) {
            acting.dirty = true;
            acting.rev = (acting.rev ?? 0) + 1;
          }
        }
        // 오류가 나면 저장하지 않으므로 절반만 바뀐 자료가 남지 않는다.
        storage.setItem(KEY, JSON.stringify(db));
        // 수면 화면이 켜져 있는 동안 1분마다 보내지 않도록 하트비트는 다음 동작 때 함께 보낸다.
        if (acting?.dirty && pathname !== '/sleep/heartbeat') flush(acting.id);
        return result?.status ? result : { status: 200, data: result };
      }
      throw new HttpError(404, '없는 주소입니다.');
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, data: { error: err.message } };
      console.error(err);
      return { status: 500, data: { error: '이 브라우저에 저장하지 못했어요. 비공개 창이라면 일반 창에서 다시 열어 주세요.' } };
    }
  }

  return { handle, idle: () => flushing ?? Promise.resolve() };
}
