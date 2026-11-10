let root = null;
let homeHref = null;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    viewLogin('다시 로그인해 주세요.');
    throw new Error('expired');
  }
  if (!res.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  return data;
}

const show = (...nodes) => {
  root.replaceChildren(...nodes);
  window.scrollTo(0, 0);
};

const text = (v) => (v === null || v === undefined ? '' : String(v));

// 행 배열을 그대로 표로 그린다. 새 열이 생겨도 빠지지 않게 키에서 열을 만든다.
function rowsTable(rows, columns) {
  if (!rows.length) return el('p', { class: 'muted' }, '기록 없음');
  const cols = columns ?? Object.keys(rows[0]).map((key) => [key, key]);
  return el('div', { class: 'scroll' }, el('table', { class: 'data' },
    el('thead', {}, el('tr', {}, cols.map(([, label]) => el('th', { scope: 'col' }, label)))),
    el('tbody', {}, rows.map((row) => el('tr', {}, cols.map(([key]) => el('td', {}, row[key] instanceof Node ? row[key] : text(row[key]))))))));
}

function section(title, ...content) {
  return el('section', { class: 'stack' }, el('h2', {}, title), ...content);
}

function viewLogin(message = '') {
  const error = el('p', { class: 'error', role: 'alert' }, message);
  // 입력한 글자를 그대로 보여 준다. 폰 키보드가 글자를 바꾸지 않도록 자동 수정을 끈다.
  const input = el('input', { type: 'text', name: 'password', required: true, autocomplete: 'off' });
  for (const [name, value] of [['autocapitalize', 'none'], ['autocorrect', 'off'], ['spellcheck', 'false']]) input.setAttribute(name, value);
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '개발자 모드'),
    el('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        try {
          await api('/login', { method: 'POST', body: { password: input.value } });
          await viewList();
        } catch (err) {
          error.textContent = err.message;
        }
      },
    },
    el('label', { class: 'field' }, el('span', {}, '비밀번호'), input),
    error,
    el('button', { class: 'btn', type: 'submit' }, '들어가기')),
    homeHref ? el('a', { href: homeHref }, '처음으로') : null));
  input.focus();
}

const logout = () => el('button', {
  class: 'link', type: 'button',
  onclick: async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    viewLogin();
  },
}, '로그아웃');

const statusOf = (p) => {
  if (p.withdrawnAt) return '철회';
  if (p.excludedAt) return '제외';
  return p.stage;
};

async function viewList() {
  const { participants, accessLog } = await api('/participants');
  const search = el('input', { type: 'text', placeholder: '이름, 아이디, 이메일, 전화번호, 코드', 'aria-label': '참가자 검색' });
  const holder = el('div');
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const hits = participants.filter((p) => !q || [p.fullName, p.username, p.email, p.phone, p.nickname, p.code].some((v) => text(v).toLowerCase().includes(q)));
    holder.replaceChildren(rowsTable(hits.map((p) => ({
      ...p,
      status: statusOf(p),
      open: el('button', { class: 'link', type: 'button', onclick: () => viewDetail(p.code) }, p.code),
      name: el('button', { class: 'link', type: 'button', onclick: () => viewDetail(p.code) }, p.fullName || p.username),
    })), [
      ['name', '성명'], ['open', '코드'], ['username', '아이디'], ['nickname', '닉네임'], ['email', '이메일'], ['phone', '전화번호'], ['age', '나이'],
      ['status', '상태'], ['track', '플랜'], ['isiBefore', 'ISI 시작'], ['isiAfter', 'ISI 종료'], ['diaryNights', '일지 수'], ['lastActive', '최근 접속'], ['createdAt', '가입 시각'],
    ]));
  };
  search.addEventListener('input', render);
  render();
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'actions' }, el('h1', {}, '개발자 모드'), logout()),
    el('p', { class: 'notice' }, '참가자의 개인정보와 건강정보입니다. 연구 목적으로만 열람하고, 화면을 켜 둔 채 자리를 비우지 마세요. 30분 뒤 자동으로 로그아웃됩니다.'),
    section(`참가자 ${participants.length}명`, search, holder),
    el('details', {}, el('summary', {}, '최근 개발자 모드 사용 기록'), el('div', { class: 'stack' }, rowsTable(accessLog)))));
}

// ---------- 참가자 상세: 저장된 값을 사람이 읽는 문장으로 바꾼다 ----------
let contentCache = null;
const loadContent = async () => {
  if (contentCache) return contentCache;
  const base = new URL('./src/content/', import.meta.url);
  const [survey, consent, education, arousal] = await Promise.all(
    ['survey.js', 'consent.js', 'education.js', 'arousal.js'].map((f) => import(new URL(f, base).href)));
  contentCache = { survey, consent, education, arousal };
  return contentCache;
};

const parse = (v) => {
  if (typeof v !== 'string') return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
const kst = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
};
const minutes = (m) => {
  if (m === null || m === undefined || m === '') return '';
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
};
const yes = (v) => (v ? '예' : '아니요');

const STAGE = { survey: '기초 설문 전', education: '기초 교육 중', program: '플랜 진행 중', 'final-survey': '재설문 단계', usability: '사용성 설문 단계', done: '모두 마침' };
const TRACK = { long: '만성 불면(3주 플랜)', short: '일시·단기 불면(6일 플랜)' };
const PATTERN = { onset: '잠들기 어려운 유형', maintenance: '자다가 깨는 유형', mixed: '복합 유형' };
const BAND = { low: '낮음', moderate: '중간', high: '높음' };
const LEVEL = { required: '필수', recommended: '권장', optional: '선택' };
const FIRST_GROUP = { nonreactive: '수면 비반응성 집단', moderate: '중간 수면 반응성 집단', high: '높은 수면 반응성 집단' };
const AREA = {
  onset: '잠들기 어려움', maintenance: '자다가 깸', earlyWaking: '너무 일찍 깸', timeInBed: '침대에 머무는 시간이 김', daytime: '낮 시간 피로',
  worry: '수면에 대한 걱정', stress: '스트레스에 잠이 민감함', beliefs: '수면에 대한 잘못된 믿음', medication: '수면을 위한 약 사용',
};
const SLEEP_STATUS = { active: '켜져 있음', ended: '정상 종료', abandoned: '끄지 않아 자동 종료', cancelled: '잘못 켜서 취소' };
const QUALITY = ['', '매우 별로', '별로', '보통', '좋음', '매우 좋음'];
const isiBand = (t) => (t <= 7 ? '임상적으로 유의한 불면 없음' : t <= 14 ? '경계 수준' : t <= 21 ? '중등도' : '심함');
const EVENT = {
  visit: '사이트 접속', login: '로그인', signup: '가입', 'auth/signup': '가입', 'auth/login': '로그인', 'auth/logout': '로그아웃',
  'survey/baseline': '기초 설문 제출', 'survey-baseline-saved': '기초 설문 제출', 'survey/final': '재설문 제출', 'survey-final-saved': '재설문 제출',
  'survey/usability': '사용성 설문 제출', 'survey-usability-saved': '사용성 설문 제출', diary: '수면 일지 저장', 'diary-saved': '수면 일지 저장',
  'sleep/start': '수면 화면 켬', 'sleep-started': '수면 화면 켬', 'sleep/end': '수면 화면 끔(일어남)', 'sleep-ended': '수면 화면 끔(일어남)',
  'sleep/cancel': '수면 화면 취소', 'sleep-cancelled': '수면 화면 취소', 'sleep-perceived-saved': '느낀 수면 시간 저장', notifications: '알림 설정 저장',
  withdraw: '참여 그만두기', withdrawn: '참여 그만두기', 'task-checked': '과제 완료 표시', 'consent-copy': '동의서 사본 내려받기',
};
const eventText = (e) => {
  if (EVENT[e]) return EVENT[e];
  let m = /^module-(\w+)-(start|complete)$/.exec(e);
  if (m) return `${{ worry: '걱정 정리', relax: '이완', emergency: '스트레스 날 비상 루틴' }[m[1]] ?? m[1]} 모듈 ${m[2] === 'start' ? '시작' : '완료'}`;
  m = /^education[-/]([\w-]+)/.exec(e);
  if (m) return `기초 교육 완료(${m[1]})`;
  m = /^plan[-/]/.exec(e);
  if (m) return /check$/.test(e) ? '과제 완료 표시' : '플랜 생성';
  if (/^sleep\/\d+\/perceived$/.test(e)) return '느낀 수면 시간 저장';
  return e;
};

const sentence = (...parts) => el('p', {}, parts.filter(Boolean).join(' '));
const facts = (rows) => el('table', { class: 'kv' }, el('tbody', {}, rows.filter(Boolean).map(([k, v]) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, v instanceof Node ? v : text(v))))));
const listOf = (items) => (items.length ? el('ul', {}, items.map((t) => el('li', {}, t))) : el('p', { class: 'muted' }, '없음'));

function surveySections(d, c) {
  const S = c.survey;
  const byKind = Object.fromEntries(d.surveys.map((r) => [r.kind, { ...r, answers: parse(r.answers) }]));
  const out = [];
  const isiBlock = (kind, title) => {
    const r = byKind[kind];
    if (!r) return null;
    const isi = r.answers?.isi ?? [];
    return el('details', { open: true }, el('summary', {}, `${title}: ${r.score}점(0~28) · ${isiBand(r.score)}`),
      sentence(`${kst(r.created_at)}에 답했습니다.`, r.elapsed_sec ? `작성에 ${minutes(r.elapsed_sec / 60)} 걸렸습니다.` : ''),
      listOf(S.isiItems.map((q, i) => `${q.text} → ${q.scale[isi[i]] ?? '응답 없음'}(${isi[i] ?? '-'}점)`)));
  };
  out.push(isiBlock('baseline-isi', '불면증 심각도(ISI) 시작'));
  const base = byKind['baseline-isi']?.answers;
  if (base?.duration) {
    out.push(sentence(
      base.sex ? `생물학적 성은 ${base.sex === 'female' ? '여성' : '남성'}입니다.` : '',
      `수면 어려움은 "${S.durationOptions.find((o) => o.value === base.duration)?.label}" 이어졌고, "${S.frequencyOptions.find((o) => o.value === base.frequency)?.label}" 겪는다고 답했습니다.`));
  }
  const psqiBlock = (kind, title) => {
    const r = byKind[kind];
    if (!r) return null;
    const a = r.answers;
    const comp = a.components ?? {};
    const names = { quality: '주관적 수면의 질', latency: '수면 잠복기', duration: '수면 시간', efficiency: '수면 효율', disturbance: '수면 방해', medication: '수면제 사용', daytime: '낮 기능 장애' };
    return el('details', {}, el('summary', {}, `${title}: ${r.score}점(0~21, 높을수록 나쁨)`),
      sentence(`보통 ${a.bedtime}에 잠자리에 들어 ${a.latencyMin}분 만에 잠들고, ${a.wake}에 일어나며, 실제로 ${a.sleepHours}시간 잔다고 답했습니다.`,
        a.afterWakeMin !== undefined ? `깬 뒤 침대에 ${a.afterWakeMin}분 더 있습니다.` : ''),
      el('p', {}, el('strong', {}, '잠을 설친 이유와 빈도')),
      listOf(S.psqiItems.disturbances.map((t, i) => `${t}: ${S.psqiItems.frequencyScale[a.q5?.[i]] ?? '-'}`)),
      listOf([S.psqiItems.quality, S.psqiItems.medication, S.psqiItems.sleepiness, S.psqiItems.enthusiasm].map((q) => `${q.text} → ${q.scale[a[q.id]] ?? '-'}`)),
      el('p', {}, el('strong', {}, '요인별 점수(각 0~3)')),
      listOf(Object.entries(comp).map(([k, v]) => `${names[k] ?? k}: ${v}점`)));
  };
  out.push(psqiBlock('baseline-psqi', '피츠버그 수면의 질 지수(PSQI) 시작'));
  const first = byKind.first;
  if (first) {
    out.push(el('details', {}, el('summary', {}, `스트레스 반응(FIRST): ${first.score}점 · ${FIRST_GROUP[first.answers.group] ?? ''}`),
      listOf(S.firstItems.map((t, i) => `${t} → ${S.firstScale[(first.answers.answers?.[i] ?? 1) - 1]}`))));
  }
  const ar = byKind.arousal?.answers;
  if (ar?.bands) {
    const rules = ar.assignment?.rules ?? [];
    out.push(el('details', {}, el('summary', {}, `과각성: ${Object.entries(ar.scores).map(([k, v]) => `${k} ${v}점(${BAND[ar.bands[k]]})`).join(', ')}`),
      sentence(ar.assignment?.group === 'non_hyperarousal' ? '과각성 우세형이 아닙니다(R7, 분석에서 별도 집단).' : '과각성 우세형입니다.',
        ar.assignment ? `걱정 정리 모듈은 ${LEVEL[ar.assignment.modules.worry]}, 이완 모듈은 ${LEVEL[ar.assignment.modules.relax]}입니다.` : ''),
      el('p', {}, el('strong', {}, '적용된 규칙')),
      listOf(rules.map((r) => `${r}: ${c.arousal.AROUSAL_RULES[r]}`)),
      el('p', {}, el('strong', {}, '문항별 응답(0 전혀 아니다 ~ 4 거의 매일)')),
      c.arousal.arousalSurvey.subscales.map((sub) => [el('p', {}, sub.name), listOf(sub.items.map((it) => `${it.text} → ${c.arousal.arousalSurvey.scale[ar.answers?.[it.id]] ?? '-'}`))])));
  }
  const dbas = byKind.dbas?.answers;
  if (dbas?.mean !== undefined) {
    const items = S.surveyQuestions().dbas;
    out.push(el('details', {}, el('summary', {}, `수면에 대한 믿음(DBAS-16): 평균 ${dbas.mean}점(0~10)${dbas.high ? ' · 역기능적 믿음이 두드러짐' : ''}`),
      listOf(Object.entries(dbas.subscales ?? {}).map(([k, v]) => `${items.subscales[k]}: 평균 ${v}점`)),
      listOf(items.items.map((q, i) => `${q.text} → ${dbas.answers?.[i] ?? '-'}점`))));
  }
  const profile = byKind.profile?.answers;
  if (profile?.areas) out.push(sentence(`맞춤 과제를 고른 취약 영역: ${profile.areas.length ? profile.areas.map((a) => AREA[a] ?? a).join(', ') : '두드러진 영역 없음'}.`, profile.tibMin ? `설문 기준 침대에 머무는 시간은 ${minutes(profile.tibMin)}입니다.` : ''));
  const safety = byKind.safety?.answers;
  if (safety) {
    const hits = S.safetyItems.filter((i) => safety[i.id] === true).map((i) => i.text);
    out.push(el('details', {}, el('summary', {}, `안전 문진: ${hits.length ? `"예" ${hits.length}개` : '모두 "아니요"'}`), listOf(hits)));
  }
  out.push(isiBlock('final-isi', '불면증 심각도(ISI) 재응시'));
  out.push(psqiBlock('final-psqi', '피츠버그 수면의 질 지수(PSQI) 재응시'));
  const sus = byKind.usability;
  if (sus) {
    out.push(el('details', {}, el('summary', {}, `사용성(SUS): ${sus.score}점(0~100)`),
      listOf(S.susItems.map((t, i) => `${t} → ${sus.answers.sus?.[i] ?? '-'}점(1~5)`)),
      sus.answers.comment ? sentence(`남긴 의견: "${sus.answers.comment}"`) : null));
  }
  return out.filter(Boolean);
}

function windowText(w) {
  if (!w) return '';
  if (w.mode === 'window') return `${w.bedtime}에 자고 ${w.wake}에 일어나기(침대 시간 ${minutes(w.tibMin)})${w.flexMin ? `, 30~${w.flexMin}분 여유` : ''}`;
  return `${w.wake}에 일어나기(수면 시간 조절 없음)`;
}

async function viewDetail(code) {
  const [d, c] = await Promise.all([api(`/participants/${encodeURIComponent(code)}`), loadContent()]);
  const a = d.account;
  const p = d.participant ?? {};
  const consents = parse(p.consent_items) ?? [];
  const safety = parse(p.safety) ?? {};
  const consentItems = c.consent.consentDocument().groups.flatMap((g) => g.items);
  const isi = (kind) => d.surveys.find((s) => s.kind === kind)?.score;
  const diary = d.diary ?? [];
  const avgSe = diary.length ? Math.round(diary.reduce((x, e) => x + e.se_pct, 0) / diary.length * 10) / 10 : null;
  const education = Object.fromEntries(c.education.educationModules.map((m) => [m.id, m.title]));
  const n = d.notifications;

  const deleteInput = el('input', { type: 'text', name: 'confirm', autocomplete: 'off', placeholder: code });
  const deleteError = el('p', { class: 'error', role: 'alert' });

  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'actions' }, el('button', { class: 'link', type: 'button', onclick: viewList }, '목록으로'), logout()),
    el('h1', {}, `${a.fullName || a.username}`),
    el('section', { class: 'stack' },
      el('h2', {}, '요약'),
      sentence(
        `${a.fullName}(아이디 ${a.username}, 닉네임 ${a.nickname})님은 ${kst(a.createdAt)}에 가입했고, 현재 "${p.withdrawn_at ? '참여를 그만둠' : p.excluded_at ? '참여 제외' : STAGE[p.stage] ?? p.stage}" 상태입니다.`,
        p.track ? `분류는 ${TRACK[p.track]}입니다.` : '',
        isi('baseline-isi') !== undefined ? `ISI는 시작할 때 ${isi('baseline-isi')}점${isi('final-isi') !== undefined ? `, 마칠 때 ${isi('final-isi')}점` : ''}입니다.` : '',
        `수면 일지는 ${diary.length}일 적었습니다${avgSe !== null ? `(평균 수면 효율 ${avgSe}%)` : ''}.`)),
    el('section', { class: 'stack' },
      el('h2', {}, '연락처와 계정'),
      facts([['성명', a.fullName], ['아이디', a.username], ['닉네임', a.nickname], ['이메일', a.email], ['전화번호', a.phone || '받지 않음'], ['만 나이', p.age !== undefined ? `${p.age}세` : ''], ['참가자 코드', code], ['가입', kst(a.createdAt)]])),
    el('section', { class: 'stack' },
      el('h2', {}, '참여 상태'),
      facts([
        ['진행 단계', STAGE[p.stage] ?? p.stage],
        ['분류', TRACK[p.track] ?? '아직 없음'],
        ['프로그램 시작일', p.program_start || '아직 시작 전'],
        ['기상 시간', p.wake_time || ''],
        ['평소 수면 시간', minutes(p.baseline_sleep_min)],
        ['평소 침대에 있는 시간', minutes(p.baseline_tib_min)],
        ['수면 유형', PATTERN[p.sleep_pattern] ?? ''],
        ['안전 판정', [safety.excluded ? '참여 제외' : null, safety.crisis ? '위기 상담 안내' : null, safety.noRestriction ? '수면 시간 조절 제외' : null, safety.fallRisk ? '낙상 위험' : null, safety.relaxCaution ? '이완 주의' : null, safety.pregnant ? '임신 중(수정 규칙)' : null].filter(Boolean).join(', ') || '특이 사항 없음'],
        ['수면 시간 조절 중단', p.restriction_stopped_at ? kst(p.restriction_stopped_at) : '아니요'],
        ['참여 그만둠', p.withdrawn_at ? kst(p.withdrawn_at) : '아니요'],
      ])),
    el('section', { class: 'stack' },
      el('h2', {}, '동의'),
      sentence(`${kst(p.consent_at)}에 ${consents.length}개 항목에 동의했습니다.`,
        `전화번호 수집(Ⅱ-3) ${consents.includes('II-3') ? '동의' : '미동의'}, AI 전송(Ⅲ-6) ${consents.includes('III-6') ? '동의' : '미동의'}.`),
      el('details', {}, el('summary', {}, '동의한 항목 전체 보기'),
        listOf(consentItems.filter((i) => consents.includes(i.id)).map((i) => `${i.label ?? ''} ${i.text}`.trim())))),
    el('section', { class: 'stack' }, el('h2', {}, '설문 응답'), surveySections(d, c)),
    el('section', { class: 'stack' },
      el('h2', {}, `수면 일지 ${diary.length}일`),
      diary.length ? rowsTable(diary.map((e) => ({ ...e, quality: QUALITY[e.quality] ?? e.quality, danger: yes(e.danger), latency_min: minutes(e.latency_min), waso_min: minutes(e.waso_min), after_wake_min: e.after_wake_min === null || e.after_wake_min === undefined ? '' : minutes(e.after_wake_min), nap_min: minutes(e.nap_min), tib_min: minutes(e.tib_min), tst_min: minutes(e.tst_min), se_pct: `${e.se_pct}%` })), [
        ['night', '날짜'], ['bedtime', '침대에 누움'], ['sleep_try', '자려고 함'], ['latency_min', '잠들기까지'], ['awakenings', '깬 횟수'], ['waso_min', '깨어 있던 시간'],
        ['final_wake', '최종 기상'], ['after_wake_min', '깬 뒤 침대'], ['out_of_bed', '침대에서 나옴'], ['tst_min', '잔 시간'], ['tib_min', '침대 시간'], ['se_pct', '수면 효율'],
        ['quality', '수면의 질'], ['sleepiness', '낮 졸림(1~5)'], ['nap_min', '낮잠'], ['stress', '낮 스트레스(0~4)'], ['danger', '졸림 위험'], ['notes', '특이사항'],
      ]) : el('p', { class: 'muted' }, '적은 일지가 없습니다.')),
    el('section', { class: 'stack' },
      el('h2', {}, '수면 화면 기록'),
      d.sleep?.length ? listOf(d.sleep.map((s) => `${kst(s.started_at)} 켬 → ${s.ended_at ? `${kst(s.ended_at)} 끔` : '아직 켜져 있음'} · ${SLEEP_STATUS[s.status] ?? s.status} · 화면이 켜져 있던 시간 ${minutes(Math.round(s.on_seconds / 60))}${s.perceived_min !== null && s.perceived_min !== undefined ? ` · 느낀 수면 시간 ${minutes(s.perceived_min)}` : ''}`)) : el('p', { class: 'muted' }, '기록 없음')),
    el('section', { class: 'stack' },
      el('h2', {}, '기초 교육'),
      d.education?.length ? listOf(d.education.map((e) => {
        const ans = parse(e.answers);
        const detail = ans && typeof ans === 'object' ? Object.entries(ans).map(([k, v]) => `${k === 'wake' ? '정한 기상 시간' : k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') : '';
        return `${education[e.module_id] ?? e.module_id} 완료(${kst(e.completed_at)})${detail ? ` · ${detail}` : ''}`;
      })) : el('p', { class: 'muted' }, '기록 없음')),
    el('section', { class: 'stack' },
      el('h2', {}, '주차별 플랜'),
      d.plans?.length ? d.plans.map((pl) => {
        const content = parse(pl.content);
        return el('details', {}, el('summary', {}, `${pl.week}주차: ${content?.title ?? ''} · ${windowText(parse(pl.window_json))}`),
          content?.personal?.length ? sentence(`맞춤 기준: ${content.personal.join(', ')}`) : null,
          (content?.days ?? []).map((day, i) => [el('p', {}, el('strong', {}, `${i + 1}일째: ${day.focus}`)), listOf(day.tasks.map((t) => `${t.title}: ${t.detail}`))]));
      }) : el('p', { class: 'muted' }, '아직 만든 플랜이 없습니다.'),
      d.tasks?.length ? sentence(`완료로 표시한 과제는 ${d.tasks.length}개입니다.`) : null),
    n ? el('section', { class: 'stack' },
      el('h2', {}, '알림 설정'),
      sentence(`아침 일지 알림 ${n.morning_enabled ? `${n.reminder_time}` : '끔'}, 자기 전 알림 ${n.bedtime_enabled ? (n.bedtime_time ?? '수면 시간 30분 전 자동') : '끔'}.`)) : null,
    el('section', { class: 'stack' },
      el('h2', {}, '사용 기록'),
      d.usage?.length ? listOf(d.usage.map((u) => `${u.occurred_on} ${eventText(u.event)}${u.elapsed_sec ? `(입력 ${minutes(u.elapsed_sec / 60)})` : ''}`)) : el('p', { class: 'muted' }, '기록 없음')),
    el('section', { class: 'stack danger-zone' },
      el('h2', {}, '참가자 삭제'),
      el('p', {}, '이 참가자의 계정과 모든 응답, 일지, 기록을 지웁니다. 되돌릴 수 없습니다.'),
      el('form', {
        class: 'stack',
        onsubmit: async (e) => {
          e.preventDefault();
          deleteError.textContent = '';
          if (deleteInput.value.trim() !== code) {
            deleteError.textContent = `확인을 위해 참가자 코드 ${code}를 정확히 입력해 주세요.`;
            return;
          }
          try {
            await api(`/participants/${encodeURIComponent(code)}`, { method: 'DELETE' });
            await viewList();
          } catch (err) {
            deleteError.textContent = err.message;
          }
        },
      },
      el('label', { class: 'field' }, el('span', {}, `삭제하려면 참가자 코드(${code})를 입력하세요`), deleteInput),
      deleteError,
      el('button', { class: 'btn danger', type: 'submit' }, '이 참가자 삭제하기')))));
}

export async function startDeveloper(target, { home = null } = {}) {
  root = target;
  homeHref = home;
  try {
    const status = await api('/status');
    if (!status.enabled) {
      return show(el('main', { class: 'stack' },
        el('h1', {}, '개발자 모드가 꺼져 있습니다'),
        el('p', {}, '.env 파일에 ADMIN_PASSWORD를 12자 이상으로 넣고 서버를 다시 켜 주세요.')));
    }
    if (status.loggedIn) return await viewList();
    viewLogin();
  } catch (err) {
    if (err.message !== 'expired') show(el('p', { class: 'error' }, err.message));
  }
}
