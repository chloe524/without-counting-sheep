const root = document.getElementById('app');
const tabs = document.getElementById('tabs');

// ---------- 공통 도구 ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k in node && k !== 'list') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error ?? '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    error.status = res.status;
    throw error;
  }
  return data;
}

function show(...args) {
  const options = args[0] instanceof Node ? {} : args.shift();
  const nodes = args;
  clearTimeout(pollTimer);
  stopBreathing?.();
  stopBreathing = null;
  leaveView?.();
  leaveView = null;
  const banner = options.banner !== false && config?.draft ? el('p', { class: 'draft' }, '시험 버전입니다. 확정되지 않은 동의서 항목이 남아 있습니다.') : null;
  root.replaceChildren(...[banner, ...nodes].filter(Boolean));
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

const go = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

// 제출 버튼을 잠그고, 실패하면 오류 문구를 폼 안에 보여 준다.
function submitter(errorNode, action) {
  return async (event) => {
    event.preventDefault();
    const button = event.target.querySelector?.('button[type=submit]');
    errorNode.textContent = '';
    if (button) button.disabled = true;
    try {
      await action(event);
    } catch (err) {
      if (err.status === 401 && state.me) return go('#/login');
      errorNode.textContent = err.message;
    } finally {
      if (button) button.disabled = false;
    }
  };
}

const errorLine = () => el('p', { class: 'error', role: 'alert' });
const minutesToText = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
};

function field(label, input, hint) {
  return el('label', { class: 'field' }, el('span', {}, label), input, hint ?? null);
}

function radioScale(name, options, { row = false, onchange } = {}) {
  return el('div', { class: `scale${row ? ' row' : ''}` }, options.map((o) => el('label', {},
    el('input', { type: 'radio', name, value: String(o.value), required: true, onchange }),
    el('span', {}, o.label))));
}

const formValue = (form, name) => new FormData(form).get(name);

const crisisInfo = () => el('div', { class: 'notice stack' },
  el('p', {}, el('strong', {}, '지금 힘든 마음이 든다면 혼자 견디지 마세요.')),
  el('p', {}, '자살예방 상담전화 ', el('a', { href: 'tel:109' }, '109'), '에 24시간 전화할 수 있어요. 위급하면 ', el('a', { href: 'tel:119' }, '119'), '에 전화하세요.'));

// ---------- 상태 ----------
const state = { me: null, signup: null, consents: null, questions: null };
let config = null;
let pollTimer = null;
let stopBreathing = null;
let leaveView = null;

function applyTheme() {
  const h = new Date().getHours();
  document.documentElement.dataset.theme = h >= 20 || h < 6 ? 'night' : 'day';
}
applyTheme();
setInterval(applyTheme, 10 * 60 * 1000);

async function loadQuestions() {
  state.questions ??= await api('/survey/questions');
  return state.questions;
}

// ---------- 수면 일지 차트 ----------
const CHART_START = 18 * 60;
const CHART_SPAN = 18 * 60;
const offset = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h * 60 + m - CHART_START + 1440) % 1440);
};

function sleepChart(entries, windowInfo, { rows = 14, endDate, label }) {
  // 휴대폰 너비와 비슷한 좌표계라 글자가 실제 크기에 가깝게 보인다.
  const W = 360;
  const LEFT = 38;
  const RH = 18;
  const TOP = 20;
  const H = TOP + rows * RH + 4;
  const x = (min) => LEFT + (min / CHART_SPAN) * (W - LEFT);
  const byNight = new Map(entries.map((e) => [e.night, e]));
  const end = new Date(`${endDate}T00:00:00Z`);
  const shapes = [];

  if (windowInfo?.bedtime) {
    shapes.push(svg('rect', {
      class: 'band', x: x(offset(windowInfo.bedtime)), y: TOP, width: x(offset(windowInfo.wake)) - x(offset(windowInfo.bedtime)), height: rows * RH,
    }));
  }
  for (const hour of [21, 0, 3, 6, 9]) {
    const pos = x(((hour * 60 - CHART_START) + 1440) % 1440);
    shapes.push(svg('line', { class: 'grid', x1: pos, x2: pos, y1: TOP - 4, y2: H - 4 }));
    const t = svg('text', { x: pos, y: 12, 'text-anchor': 'middle' });
    t.textContent = `${hour}시`;
    shapes.push(t);
  }
  for (let i = 0; i < rows; i += 1) {
    const d = new Date(end.getTime() - (rows - 1 - i) * 86400000).toISOString().slice(0, 10);
    const y = TOP + i * RH;
    if (i % 2 === (rows - 1) % 2) {
      const t = svg('text', { x: 0, y: y + 13 });
      t.textContent = `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
      shapes.push(t);
    }
    const e = byNight.get(d);
    if (e) {
      const a = x(offset(e.bedtime));
      const b = x(offset(e.out_of_bed));
      shapes.push(svg('rect', { class: 'bar', x: a, y: y + 4, width: Math.max(2, b - a), height: RH - 8, rx: 2 }));
    } else {
      shapes.push(svg('rect', { class: 'empty', x: LEFT, y: y + RH / 2 - 0.5, width: W - LEFT, height: 1 }));
    }
  }
  return svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label }, ...shapes);
}

const chartLabel = (entries) => (entries.length
  ? `최근 수면 일지 차트. ${entries.length}일 기록됨. 가장 최근 기록은 ${entries[0].bedtime}에 잠자리에 들어 ${entries[0].out_of_bed}에 일어남.`
  : '수면 일지 차트. 아직 기록 없음.');

// ---------- 시작, 동의, 가입 ----------
function viewLanding() {
  const error = errorLine();
  const saved = state.signup ?? {};
  const userHint = el('p', { class: 'hint' }, '영문, 숫자, 밑줄로 4~20자. 다른 사람이 쓰는 아이디는 쓸 수 없습니다.');
  let timer;
  const userInput = el('input', {
    type: 'text', name: 'username', required: true, autocomplete: 'username', maxLength: 20, value: saved.username ?? '',
    oninput: (e) => {
      clearTimeout(timer);
      const value = e.target.value;
      timer = setTimeout(async () => {
        const r = await api(`/auth/check-username?username=${encodeURIComponent(value)}`);
        userHint.textContent = !r.valid ? '영문, 숫자, 밑줄로 4~20자' : r.available ? '쓸 수 있는 아이디입니다.' : '이미 쓰고 있는 아이디입니다.';
        userHint.className = `hint ${r.valid && r.available ? 'good' : r.valid ? 'bad' : ''}`;
      }, 300);
    },
  });
  show({ banner: false }, el('main', { class: 'landing' },
    el('h1', {}, config.name),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        const username = formValue(f, 'username');
        const r = await api(`/auth/check-username?username=${encodeURIComponent(username)}`);
        if (!r.valid) throw new Error('아이디는 영문, 숫자, 밑줄로 4~20자여야 합니다.');
        if (!r.available) throw new Error('이미 쓰고 있는 아이디입니다.');
        state.signup = {
          username,
          email: formValue(f, 'email'),
          password: formValue(f, 'password'),
          nickname: formValue(f, 'nickname'),
          remember: formValue(f, 'remember') === 'on',
        };
        go('#/consent');
      }),
    },
    field('사용할 아이디', userInput, userHint),
    field('이메일', el('input', { type: 'email', name: 'email', required: true, autocomplete: 'email', value: saved.email ?? '' })),
    field('패스워드', el('input', { type: 'password', name: 'password', required: true, minLength: 8, autocomplete: 'new-password' }), el('p', { class: 'hint' }, '8자 이상')),
    field('닉네임', el('input', { type: 'text', name: 'nickname', required: true, maxLength: 20, value: saved.nickname ?? '' })),
    el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'remember', ...(saved.remember ? { checked: true } : {}) }), el('span', {}, '자동 로그인')),
    error,
    el('button', { class: 'btn', type: 'submit' }, '시작하기')),
    el('div', { class: 'landing-actions' },
      el('a', { class: 'btn ghost', href: '#/login' }, '재로그인'),
      el('a', { class: 'btn ghost', href: '#/developer' }, '개발자 모드'))));
}

function renderBlocks(blocks) {
  return blocks.map((b) => {
    if (b.p) return el('p', {}, b.p);
    if (b.h) return el('h3', {}, b.h);
    if (b.ul) return el('ul', {}, b.ul.map((t) => el('li', {}, t)));
    if (b.ol) return el('ol', {}, b.ol.map((t) => el('li', {}, t)));
    if (b.note) return el('p', { class: 'notice' }, b.note);
    if (b.table) return el('table', { class: 'kv' }, el('tbody', {}, b.table.map(([k, v]) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, v)))));
    return null;
  });
}

async function viewConsent() {
  if (!state.signup) return go('#/');
  if (!config.signupOpen) {
    return show(el('main', { class: 'stack' }, el('h1', {}, '지금은 참가자를 모집하지 않습니다'), el('a', { href: '#/' }, '처음으로')));
  }
  const doc = await api('/public/consent');
  const error = errorLine();
  const syncAll = () => {
    const boxes = [...form.querySelectorAll('input[name=consent]')];
    const count = boxes.filter((b) => b.checked).length;
    allBox.checked = count === boxes.length;
    allBox.indeterminate = count > 0 && count < boxes.length;
  };
  const allBox = el('input', {
    type: 'checkbox',
    onchange: (e) => {
      for (const b of form.querySelectorAll('input[name=consent]')) b.checked = e.target.checked;
      syncAll();
    },
  });
  const form = el('form', {
    class: 'stack-lg',
    onchange: (e) => {
      if (e.target.name === 'consent') syncAll();
    },
    onsubmit: submitter(error, (e) => {
      const checked = new FormData(e.target).getAll('consent');
      const missing = doc.groups.flatMap((g) => g.items).filter((i) => i.required && !checked.includes(i.id));
      if (missing.length) throw new Error(`필수 항목 ${missing.length}개에 아직 동의하지 않았습니다.`);
      state.consents = checked;
      go('#/signup');
    }),
  },
  el('label', { class: 'check' }, allBox, el('span', {}, el('strong', {}, '모두 동의'), ' (선택 항목 포함)')),
  doc.groups.map((g) => el('fieldset', { class: 'stack' },
    el('legend', {}, el('h3', {}, g.title), g.basis ? el('span', { class: 'basis' }, g.basis) : null),
    g.items.map((i) => el('label', { class: 'check' },
      el('input', { type: 'checkbox', name: 'consent', value: i.id, ...(state.consents?.includes(i.id) ? { checked: true } : {}) }),
      el('span', {}, el('strong', {}, `${i.label ? `${i.label} ` : ''}${i.untagged ? '' : i.required ? '[필수] ' : '[선택] '}`), i.text, i.basis ? el('span', { class: 'basis' }, i.basis) : null))))),
  error,
  el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'submit' }, '동의하고 다음으로')));

  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' }, el('h1', {}, '연구 참여 설명과 동의'), el('ul', {}, doc.summary.map((t) => el('li', {}, t)))),
    el('div', {}, doc.sections.map((s) => el('details', {},
      el('summary', {}, `자세히 보기: ${s.title}`),
      el('div', { class: 'stack' }, renderBlocks(s.blocks))))),
    form));
  syncAll();
}

function viewSignup() {
  if (!state.signup) return go('#/');
  if (!state.consents) return go('#/consent');
  const wantsPhone = state.consents.includes('II-3');
  const error = errorLine();
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '참가자 정보'),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        await api('/auth/signup', {
          method: 'POST',
          body: {
            ...state.signup,
            fullName: formValue(f, 'fullName'),
            age: Number(formValue(f, 'age')),
            phone: formValue(f, 'phone') ?? undefined,
            consents: state.consents,
          },
        });
        state.signup = null;
        go('#/');
      }),
    },
    field('성명', el('input', { type: 'text', name: 'fullName', required: true, autocomplete: 'name' }), el('p', { class: 'hint' }, '설문 응답과 분리해 저장합니다.')),
    field('만 나이', el('input', { type: 'number', name: 'age', required: true, min: 14, max: 120, inputMode: 'numeric' })),
    wantsPhone ? field('전화번호', el('input', { type: 'tel', name: 'phone', required: true, autocomplete: 'tel' }), el('p', { class: 'hint' }, '연구 진행에 필요한 연락에 씁니다.')) : null,
    error,
    el('button', { class: 'btn', type: 'submit' }, '가입하기'),
    el('a', { href: '#/' }, '처음으로'))));
}

function viewLogin() {
  const error = errorLine();
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '로그인'),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        state.me = null;
        await api('/auth/login', { method: 'POST', body: { username: formValue(f, 'username'), password: formValue(f, 'password'), remember: formValue(f, 'remember') === 'on' } });
        go('#/');
      }),
    },
    field('아이디', el('input', { type: 'text', name: 'username', required: true, autocomplete: 'username' })),
    field('패스워드', el('input', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' })),
    el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'remember' }), el('span', {}, '자동 로그인')),
    error,
    el('button', { class: 'btn', type: 'submit' }, '로그인')),
    el('p', { class: 'small muted' }, `패스워드를 잊었다면 연구자(${config.researcher.email})에게 문의해 주세요.`),
    el('p', { class: 'small' }, el('a', { href: '#/developer' }, '개발자 모드'))));
}

// ---------- 기초 설문 ----------
function isiFields(items) {
  return items.map((q, i) => el('fieldset', {},
    el('legend', {}, `${i + 1}. ${q.text}`),
    radioScale(q.id, q.scale.map((label, value) => ({ label: `${label}`, value })))));
}

const readIsi = (form, items) => items.map((q) => Number(formValue(form, q.id)));

const sourceNote = (info, notice) => el('div', { class: 'stack' },
  el('p', {}, el('strong', {}, info.name)),
  el('p', { class: 'small muted' }, info.source),
  notice ? el('p', { class: 'small muted' }, notice) : null);

const scaleField = (name, text, labels, start = 0) => el('fieldset', {},
  el('legend', {}, text),
  radioScale(name, labels.map((label, i) => ({ label, value: i + start }))));

function psqiFields(q) {
  const p = q.psqi;
  return [
    sourceNote(q.sources.psqi, q.sources.draftNotice),
    el('p', {}, '지난 한 달 동안의 평소 수면 습관을 답해 주세요.'),
    el('div', { class: 'two' },
      field('1. 보통 잠자리에 든 시간', el('input', { type: 'time', name: 'bedtime', required: true, value: '23:00' })),
      field('3. 보통 일어난 시간', el('input', { type: 'time', name: 'wake', required: true, value: '07:00' }))),
    field('2. 잠들기까지 걸린 시간(분)', el('input', { type: 'number', name: 'latencyMin', required: true, min: 0, max: 600, value: 30, inputMode: 'numeric' })),
    field('4. 실제로 잔 시간(시간)', el('input', { type: 'number', name: 'sleepHours', required: true, min: 0.5, max: 16, step: 0.5, value: 6 })),
    field('깬 뒤 침대에 더 있는 시간(분)', el('input', { type: 'number', name: 'afterWakeMin', required: true, min: 0, max: 300, value: 15, inputMode: 'numeric' }),
      el('p', { class: 'hint' }, '침대에 머무는 시간 = 잠들기까지의 시간 + 수면 시간 + 이 시간')),
    el('p', {}, el('strong', {}, '5. 다음 이유로 잠을 설친 적이 얼마나 자주 있었나요?')),
    p.disturbances.map((text, i) => scaleField(`q5_${i}`, text, p.frequencyScale)),
    [p.quality, p.medication, p.sleepiness, p.enthusiasm].map((item, i) => scaleField(item.id, `${i + 6}. ${item.text}`, item.scale)),
  ];
}

const readPsqi = (f, q) => {
  const n = (name) => Number(formValue(f, name));
  return {
    bedtime: formValue(f, 'bedtime'),
    wake: formValue(f, 'wake'),
    latencyMin: n('latencyMin'),
    sleepHours: n('sleepHours'),
    afterWakeMin: n('afterWakeMin'),
    q5: q.psqi.disturbances.map((_, i) => n(`q5_${i}`)),
    q6: n('q6'),
    q7: n('q7'),
    q8: n('q8'),
    q9: n('q9'),
  };
};

const pregnancyBlock = (info) => el('div', { class: 'notice stack' },
  el('p', {}, el('strong', {}, info.title)),
  info.body.map((t) => el('p', {}, t)),
  el('p', {}, el('strong', {}, info.sitePolicy.title)),
  el('ul', {}, info.sitePolicy.points.map((t) => el('li', {}, t))),
  el('p', {}, info.sitePolicy.closing));

function viewClassified(q, track) {
  const info = q.trackInfo[track];
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('p', { class: 'steps' }, '설문 결과에 따른 분류'),
      el('h1', {}, info.title),
      info.details.map((t) => el('p', {}, t)),
      el('p', {}, el('strong', {}, info.plan)),
      el('p', { class: 'small muted' }, q.trackInfo.notice)),
    el('button', { class: 'btn', type: 'button', onclick: () => { state.me = null; route(); } }, '계속하기')));
}

async function viewBaseline() {
  const q = await loadQuestions();
  const startedAt = Date.now();
  const answers = {};
  const TOTAL = 8;
  const step = (n, title, content, onNext, { button = '다음' } = {}) => {
    const error = errorLine();
    show(el('main', { class: 'stack-lg' },
      el('p', { class: 'steps' }, `기초 설문 ${n}/${TOTAL}`),
      el('h1', {}, title),
      el('form', {
        class: 'stack-lg',
        onsubmit: submitter(error, (e) => onNext(e.target)),
      }, content, error, el('button', { class: 'btn', type: 'submit' }, button))));
  };
  const step1 = () => step(1, '기본 정보', [
    el('p', { class: 'muted' }, '만 나이는 가입할 때 적은 값을 씁니다.'),
    el('fieldset', {}, el('legend', {}, '생물학적 성'), radioScale('sex', [{ label: '남성', value: 'male' }, { label: '여성', value: 'female' }])),
  ], (f) => {
    answers.sex = formValue(f, 'sex');
    step2();
  });
  const step2 = () => step(2, '요즘 잠은 어떤가요?', [sourceNote(q.sources.isi, q.sources.draftNotice), isiFields(q.isi)], (f) => {
    answers.isi = readIsi(f, q.isi);
    step3();
  });
  const step3 = () => step(3, '피츠버그 수면의 질 지수', psqiFields(q), (f) => {
    answers.psqi = readPsqi(f, q);
    step4();
  });
  const step4 = () => step(4, '수면 어려움의 기간', [
    el('fieldset', {}, el('legend', {}, '수면 어려움이 얼마나 오래 이어졌나요?'), radioScale('duration', q.duration)),
    el('fieldset', {}, el('legend', {}, '어려움을 겪는 밤은 얼마나 자주 있나요?'), radioScale('frequency', q.frequency)),
  ], (f) => {
    answers.duration = formValue(f, 'duration');
    answers.frequency = formValue(f, 'frequency');
    step5();
  });
  const step5 = () => step(5, '스트레스와 잠', [
    sourceNote(q.sources.first, q.sources.draftNotice),
    el('p', {}, '다음 상황에서 잠들기 어렵거나 잠을 설칠 가능성이 얼마나 되나요?'),
    q.first.items.map((text, i) => scaleField(`first_${i}`, `${i + 1}. ${text}`, q.first.scale, 1)),
  ], (f) => {
    answers.first = q.first.items.map((_, i) => Number(formValue(f, `first_${i}`)));
    step6();
  });
  const step6 = () => step(6, '잠들기 전 몸과 마음의 상태', [
    el('p', {}, `${q.arousal.recall} 동안을 떠올리며 답해 주세요.`),
    el('p', { class: 'small muted' }, `0 = ${q.arousal.scale[0]}, 1 = ${q.arousal.scale[1]}, 2 = ${q.arousal.scale[2]}, 3 = ${q.arousal.scale[3]}, 4 = ${q.arousal.scale[4]}`),
    q.arousal.subscales.map((sub) => el('section', { class: 'stack' },
      el('h2', {}, sub.name),
      el('p', { class: 'small muted' }, sub.when),
      sub.items.map((item) => scaleField(item.id, item.text, q.arousal.scale.map((label, i) => `${i} ${label}`))))),
  ], (f) => {
    answers.arousal = Object.fromEntries(q.arousal.subscales.flatMap((sub) => sub.items.map((item) => [item.id, Number(formValue(f, item.id))])));
    step7();
  });
  const step7 = () => step(7, '수면에 대한 생각', [
    sourceNote(q.dbas, q.sources.draftNotice),
    el('p', {}, '각 문장에 얼마나 동의하는지 0부터 10까지 골라 주세요.'),
    el('p', { class: 'small muted' }, q.dbas.scaleNote),
    q.dbas.items.map((item) => el('fieldset', {},
      el('legend', {}, `${item.id}. ${item.text}`),
      el('div', { class: 'scale numeric' }, Array.from({ length: 11 }, (_, v) => el('label', {},
        el('input', { type: 'radio', name: `dbas_${item.id}`, value: String(v), required: true }),
        el('span', {}, String(v))))))),
  ], (f) => {
    answers.dbas = q.dbas.items.map((item) => Number(formValue(f, `dbas_${item.id}`)));
    step8();
  });
  const step8 = () => {
    const error = errorLine();
    const pregnancy = el('div', { hidden: true }, pregnancyBlock(q.pregnancyInfo));
    show(el('main', { class: 'stack-lg' },
      el('p', { class: 'steps' }, `기초 설문 ${TOTAL}/${TOTAL}`),
      el('h1', {}, '안전을 위한 질문'),
      el('form', {
        class: 'stack-lg',
        onsubmit: submitter(error, async (e) => {
          const f = e.target;
          const safety = Object.fromEntries(q.safety.map((s) => [s.id, formValue(f, s.id) === 'yes']));
          const r = await api('/survey/baseline', { method: 'POST', body: { ...answers, safety, elapsedSec: Math.round((Date.now() - startedAt) / 1000) } });
          state.me = null;
          if (r.excluded) go('#/');
          else viewClassified(q, r.track);
        }),
      },
      el('p', {}, '프로그램이 맞지 않거나 일부 안내를 빼야 하는 경우를 확인합니다. 진단이 아닙니다.'),
      q.safety.map((s) => el('fieldset', {},
        el('legend', {}, s.text),
        radioScale(s.id, [{ label: '아니요', value: 'no' }, { label: '예', value: 'yes' }], {
          row: true,
          onchange: s.id === 'pregnant' ? (e) => { pregnancy.hidden = e.target.value !== 'yes'; } : undefined,
        }),
        s.id === 'pregnant' ? pregnancy : null)),
      error,
      el('button', { class: 'btn', type: 'submit' }, '설문 마치기'))));
  };
  step1();
}

function viewExcluded() {
  show(el('main', { class: 'stack-lg' },
    state.me.crisis ? crisisInfo() : null,
    el('div', { class: 'stack' },
      el('h1', {}, '이 프로그램에 참여하기 어렵습니다'),
      el('p', {}, '응답해 주신 내용을 보면, 이 프로그램의 안내가 안전하게 맞지 않을 수 있습니다. 진단이 아니라, 연구 참여 기준에 따른 안내입니다.'),
      el('p', {}, '수면 때문에 힘들다면 의사와 상담해 주세요. 이 결과로 어떤 불이익도 없습니다.'),
      el('p', { class: 'small muted' }, `궁금한 점은 연구자(${config.researcher.email})에게 문의해 주세요.`)),
    logoutButton()));
}

// ---------- 기초 교육 ----------
async function viewEducationList() {
  const { modules } = await api('/education');
  const nextIndex = modules.findIndex((m) => !m.done);
  const total = modules.reduce((s, m) => s + m.minutes, 0);
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('h1', {}, '기초 교육'),
      el('p', {}, `3주 플랜을 시작하기 전에 잠의 원리를 익히고 내 계획을 세워요. 모두 약 ${total}분 걸리고, 나눠서 해도 됩니다.`)),
    el('ol', { class: 'modules' }, modules.map((m, i) => {
      const inner = [el('span', { class: 'num' }, String(i + 1)), el('span', {}, el('strong', {}, m.title), el('br'), el('span', { class: 'small muted' }, m.done ? '완료' : `약 ${m.minutes}분`))];
      return el('li', {}, i <= nextIndex || m.done ? el('a', { href: `#/education/${m.id}` }, inner) : el('div', { class: 'locked' }, inner));
    })),
    logoutButton()));
}

function breathingPractice() {
  const circle = el('div', { class: 'breath-circle', 'aria-live': 'off' }, '준비');
  const status = el('p', { class: 'muted', role: 'status' });
  let running = false;
  let timer;
  const stop = () => {
    running = false;
    clearTimeout(timer);
    circle.textContent = '준비';
    circle.style.transform = '';
    toggle.textContent = '호흡 시작하기';
  };
  const phase = (inhale) => {
    if (!running) return;
    circle.textContent = inhale ? '들이쉬기' : '내쉬기';
    circle.style.transitionDuration = inhale ? '4s' : '6s';
    circle.style.transform = inhale ? 'scale(1)' : 'scale(0.6)';
    timer = setTimeout(() => phase(!inhale), inhale ? 4000 : 6000);
  };
  const toggle = el('button', {
    class: 'btn ghost', type: 'button',
    onclick: () => {
      if (running) return stop();
      running = true;
      toggle.textContent = '멈추기';
      status.textContent = '4초 들이쉬고 6초 내쉬어요.';
      phase(true);
    },
  }, '호흡 시작하기');
  stopBreathing = stop;
  return el('div', { class: 'stack' }, el('div', { class: 'breath' }, circle), status, toggle);
}

function exerciseFields(ex, saved, wake) {
  if (ex.type === 'text') return [field(ex.prompt, el('textarea', { name: ex.id, value: saved?.[ex.id] ?? '' }))];
  if (ex.type === 'fields') {
    return [el('p', {}, ex.prompt), ...ex.fields.map((f) => field(f.label, el('textarea', { name: f.id, value: saved?.[f.id] ?? '' })))];
  }
  if (ex.type === 'time') return [field(ex.prompt, el('input', { type: 'time', name: 'wake', required: true, value: saved?.wake ?? wake ?? '07:00' }))];
  if (ex.type === 'breathing') return [el('p', {}, ex.prompt), breathingPractice()];
  return [];
}

async function viewEducationModule(id) {
  const { modules, wake } = await api('/education');
  const index = modules.findIndex((m) => m.id === id);
  if (index < 0) return go('#/');
  const m = modules[index];
  const startedAt = Date.now();
  const error = errorLine();
  show(el('main', { class: 'stack-lg' },
    el('a', { href: '#/', class: 'small' }, '교육 목록으로'),
    el('div', { class: 'stack' },
      el('p', { class: 'steps' }, `${index + 1}/${modules.length}, 약 ${m.minutes}분`),
      el('h1', {}, m.title)),
    el('div', { class: 'stack reading' }, renderBlocks(m.blocks)),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        const answers = Object.fromEntries(new FormData(e.target).entries());
        const r = await api(`/education/${m.id}/complete`, { method: 'POST', body: { answers, elapsedSec: Math.round((Date.now() - startedAt) / 1000) } });
        state.me = null;
        go(r.finished ? '#/today' : '#/');
      }),
    },
    exerciseFields(m.exercise, m.answers, wake),
    error,
    el('button', { class: 'btn', type: 'submit' }, '이 교육 마치기'))));
}

// ---------- 오늘 ----------
function windowHeadline(w) {
  if (w.mode === 'window') {
    return el('p', { class: 'tonight' }, '오늘의 수면 시간', el('b', {}, `${w.bedtime} ~ ${w.wake}`),
      w.flexMin ? el('span', { class: 'small' }, `임신 중이라 취침·기상 시간은 30~${w.flexMin}분 정도 여유 있게 지켜도 괜찮아요.`) : null);
  }
  return el('p', { class: 'tonight' }, '일어나는 시간', el('b', {}, w.wake));
}

function taskList(plan, dayIndex, day) {
  return day.tasks.map((t, i) => el('label', { class: 'task' },
    el('input', {
      type: 'checkbox',
      ...(plan.checks.some((c) => c.day === dayIndex && c.task === i) ? { checked: true } : {}),
      onchange: (e) => api(`/plan/${plan.id}/check`, { method: 'POST', body: { day: dayIndex, task: i, done: e.target.checked } }).catch(() => { e.target.checked = !e.target.checked; }),
    }),
    el('span', {}, el('strong', {}, t.title), t.detail, el('span', { class: 'small muted' }, ` 약 ${t.minutes}분`))));
}

const LEVEL_LABEL = { required: '필수', recommended: '권장', optional: '선택' };

function moduleCard(id, title, level, status, content, extra = []) {
  const record = (event) => api(`/modules/${id}/${event}`, { method: 'POST' }).then(() => route()).catch(() => {});
  return el('section', { class: 'module stack' },
    el('h3', {}, title, level ? el('span', { class: `badge ${level}` }, LEVEL_LABEL[level]) : null),
    content,
    extra,
    el('div', { class: 'actions' },
      status.completed
        ? el('p', { class: 'small good' }, '완료했어요.')
        : status.started
          ? el('button', { class: 'btn ghost', type: 'button', onclick: () => record('complete') }, '완료했어요')
          : el('button', { class: 'btn ghost', type: 'button', onclick: () => record('start') }, '시작하기')));
}

async function modulesSection(plan) {
  const [{ view }, q] = await Promise.all([api('/modules'), loadQuestions()]);
  if (!view) return null;
  const m = q.modules;
  const parts = [el('h2', {}, '맞춤 모듈')];
  if (view.basicOnly) parts.push(el('p', {}, m.basicOnly));
  for (const mod of view.modules) {
    const c = m[mod.id];
    const extra = mod.id === 'relax'
      ? [view.daytimeRelax ? el('p', {}, m.daytimeRelax) : null, el('p', { class: 'small muted' }, c.stopNotice)]
      : [];
    parts.push(moduleCard(mod.id, c.title, mod.level, mod, [el('p', { class: 'muted' }, c.summary), el('ol', {}, c.steps.map((t) => el('li', {}, t)))], extra));
  }
  if (view.emergency) {
    parts.push(moduleCard('emergency', m.emergency.title, null, view.emergency, el('ol', {}, m.emergency.steps.map((t) => el('li', {}, t)))));
  }
  const notes = [
    view.somaticNotice ? m.somaticNotice : null,
    view.stressDiary ? m.stressDiary : null,
    view.relapse ? m.relapse : null,
    plan.window.mode === 'window' ? m.restrictionCaution : null,
  ].filter(Boolean);
  return el('section', { class: 'stack' }, parts, notes.map((t) => el('p', { class: 'notice' }, t)));
}

async function viewToday() {
  const [{ plan, position, track }, diary] = await Promise.all([api('/plan/current'), api('/diary')]);
  const wroteToday = diary.entries.some((e) => e.night === diary.today);
  const header = [
    el('p', { class: 'steps' }, `${state.me.nickname}님, ${position.week}주차 ${position.dayIndex}일째 (전체 21일)`),
    windowHeadline(plan.window),
    el('p', { class: 'small muted' }, plan.window.reason),
  ];
  const chart = el('figure', {},
    sleepChart(diary.entries, plan.window, { endDate: diary.today, label: chartLabel(diary.entries) }));
  const diaryCta = el('div', { class: 'actions' },
    state.me.sleep?.pending ? el('a', { class: 'btn', href: '#/sleep/morning' }, '느낀 수면 시간 적기') : null,
    wroteToday
      ? el('p', { class: 'small muted' }, '오늘 일지를 적었어요.')
      : el('a', { class: `btn${state.me.sleep?.pending ? ' ghost' : ''}`, href: '#/diary/new' }, '지난밤 일지 쓰기'),
    el('a', { class: 'btn ghost', href: '#/sleep' }, '수면 화면'));
  const warnings = state.me.restrictionStopped
    ? el('p', { class: 'notice' }, '졸려서 위험했던 날이 있어 수면 시간 조절을 멈췄어요. 졸릴 때는 운전과 기계 조작을 하지 말고, 불편이 계속되면 의사와 상담해 주세요.')
    : null;

  let body;
  if (plan.status !== 'ready') {
    body = el('p', { class: 'muted', role: 'status' }, '이번 주 플랜을 만드는 중이에요. 잠시만 기다려 주세요.');
  } else if (track === 'long') {
    const dayIndex = (position.dayIndex - 1) % 7;
    const day = plan.content.days[dayIndex];
    body = el('section', {}, el('h2', {}, `오늘의 과제: ${day.focus}`), taskList(plan, dayIndex, day));
  } else {
    body = el('section', {}, el('h2', {}, plan.content.title), el('p', { class: 'muted' }, '이번 주 안에 편한 날 이틀을 골라 해 보세요.'),
      plan.content.days.map((d, i) => [el('p', { class: 'day-title' }, `${i + 1}일째: ${d.focus}`), taskList(plan, i, d)]));
  }
  const pregnancyNote = state.me.pregnant
    ? el('details', {}, el('summary', {}, '임신 중에는 수정된 방식으로 진행해요'), pregnancyBlock((await loadQuestions()).pregnancyInfo))
    : null;
  const personal = plan.content?.personal?.length
    ? el('details', {}, el('summary', {}, '내 맞춤 기준 보기'),
      el('p', { class: 'small' }, '설문에서 다음 부분이 두드러져 맞춤 과제를 넣었어요. 진단이 아닙니다.'),
      el('ul', {}, plan.content.personal.map((t) => el('li', {}, t))))
    : null;
  const modules = await modulesSection(plan).catch(() => null);
  show(el('main', { class: 'stack-lg' }, el('div', { class: 'stack' }, header), warnings, pregnancyNote, personal, diaryCta, chart, body, modules));
  // show()가 이전 타이머를 지우므로 화면을 그린 뒤에 건다.
  if (plan.status !== 'ready') pollTimer = setTimeout(route, 3000);
}

async function viewPlan() {
  const { plans } = await api('/plan/history');
  if (!plans.length) {
    return show(el('main', { class: 'stack' }, el('h1', {}, '주차별 플랜'), el('p', {}, '오늘 화면을 열면 이번 주 플랜이 만들어져요.'), el('a', { class: 'btn', href: '#/today' }, '오늘 화면 열기')));
  }
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '주차별 플랜'),
    plans.slice().reverse().map((plan) => el('section', { class: 'stack' },
      el('h2', {}, plan.content?.title ?? `${plan.week}주차 플랜을 만드는 중이에요`),
      plan.content ? el('p', {}, plan.content.summary) : null,
      plan.window.mode === 'window' ? el('p', { class: 'small muted' }, `오늘의 수면 시간 ${plan.window.bedtime} ~ ${plan.window.wake} (${minutesToText(plan.window.tibMin)})`) : el('p', { class: 'small muted' }, `일어나는 시간 ${plan.window.wake}`),
      plan.content?.days.map((d, i) => el('details', {},
        el('summary', {}, `${i + 1}일째: ${d.focus}`),
        taskList(plan, i, d))),
      plan.content?.sources?.length
        ? el('div', { class: 'small muted' }, '참고한 자료', el('ul', {}, plan.content.sources.map((s) => el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title)))))
        : null))));
}

// ---------- 일지 ----------
// 낮 스트레스가 높은 날과 낮은 날의 수면 효율을 나란히 보여 준다(각 2일 이상일 때).
function stressFeedback(entries) {
  const rated = entries.filter((e) => Number.isInteger(e.stress));
  const high = rated.filter((e) => e.stress >= 3);
  const low = rated.filter((e) => e.stress <= 1);
  if (high.length < 2 || low.length < 2) return el('p', { class: 'small muted' }, '스트레스가 높은 날과 낮은 날이 각각 2일 이상 쌓이면 잠과의 관계를 보여 드려요.');
  const avg = (rows) => Math.round((rows.reduce((a, e) => a + e.se_pct, 0) / rows.length) * 10) / 10;
  return el('p', { class: 'notice' }, `낮 스트레스가 높았던 날(${high.length}일)의 수면 효율은 평균 ${avg(high)}%, 낮았던 날(${low.length}일)은 ${avg(low)}%였어요.`);
}

async function viewDiaryList() {
  const { entries, today, stressRequired } = await api('/diary');
  const plan = await api('/plan/current').then((r) => r.plan.window).catch(() => null);
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '수면 일지'),
    sleepChart(entries, plan, { endDate: today, label: chartLabel(entries) }),
    el('a', { class: 'btn', href: '#/diary/new' }, '일지 쓰기'),
    entries.length
      ? el('table', { class: 'kv' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '날짜'), el('th', { scope: 'col' }, '잔 시간'), el('th', { scope: 'col' }, '수면 효율'), stressRequired ? el('th', { scope: 'col' }, '낮 스트레스') : null)),
        el('tbody', {}, entries.map((e) => el('tr', {}, el('td', {}, e.night), el('td', {}, minutesToText(e.tst_min)), el('td', {}, `${e.se_pct}%`), stressRequired ? el('td', {}, e.stress ?? '-') : null))))
      : el('p', { class: 'muted' }, '아직 적은 일지가 없어요. 일어난 뒤에 지난밤을 적어 보세요.'),
    stressRequired ? stressFeedback(entries) : null));
}

async function viewDiaryNew() {
  const [{ entries, today, stressRequired }, sleep] = await Promise.all([api('/diary'), api('/sleep/status')]);
  const last = entries[0];
  // 지난밤 수면 화면 기록이 있으면 시각을 미리 채워 둔다.
  const measured = sleep.last;
  const startedAt = Date.now();
  const error = errorLine();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const time = (name, value) => el('input', { type: 'time', name, required: true, value });
  const num = (name, min, max, value) => el('input', { type: 'number', name, required: true, min, max, value, inputMode: 'numeric' });
  const scale = (name, low, high) => radioScale(name, [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), { row: true });
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' }, el('h1', {}, '지난밤 일지'), el('p', { class: 'muted' }, '시계를 보며 재지 않아도 돼요. 기억나는 대로 어림잡아 적어 주세요.')),
    el('form', {
      class: 'stack-lg',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        const n = (k) => Number(formValue(f, k));
        const r = await api('/diary', {
          method: 'POST',
          body: {
            night: formValue(f, 'night'),
            bedtime: formValue(f, 'bedtime'),
            sleepTry: formValue(f, 'sleepTry'),
            latencyMin: n('latencyMin'),
            awakenings: n('awakenings'),
            wasoMin: n('wasoMin'),
            finalWake: formValue(f, 'finalWake'),
            afterWakeMin: n('afterWakeMin'),
            notes: formValue(f, 'notes'),
            quality: n('quality'),
            sleepiness: n('sleepiness'),
            danger: formValue(f, 'danger') === 'on',
            napMin: n('napMin'),
            stress: stressRequired ? n('stress') : undefined,
            elapsedSec: Math.round((Date.now() - startedAt) / 1000),
          },
        });
        state.me = null;
        viewDiarySaved(r);
      }),
    },
    el('fieldset', {}, el('legend', {}, '어느 날 아침의 일지인가요?'),
      radioScale('night', [{ value: today, label: `오늘 아침 (${today.slice(5)})` }, { value: yesterday, label: `어제 아침 (${yesterday.slice(5)})` }])),
    el('p', { class: 'small muted' }, '합의 수면일지(Consensus Sleep Diary, Carney et al., 2012) 항목을 따르며, CBT-I Coach 앱의 수면 일지를 참고했습니다.'),
    field('1. 몇 시에 침대에 누웠나요?', time('bedtime', measured?.startTime ?? last?.bedtime ?? '23:30')),
    field('2. 몇 시에 잠을 자려고 했나요?', time('sleepTry', measured?.startTime ?? last?.sleep_try ?? '23:45')),
    field('3. 잠드는 데 얼마나 걸렸나요?(분)', num('latencyMin', 0, 600, 20)),
    field('4. 마지막으로 깬 것을 제외하고 몇 번이나 깨어났나요?', num('awakenings', 0, 30, 0)),
    field('5. 밤중에 깨어 있었던 시간은 모두 합쳐 얼마인가요?(분)', num('wasoMin', 0, 600, 0)),
    field('6. 최종적으로 깨어난 시간은 몇 시였나요?', time('finalWake', measured?.endTime ?? last?.final_wake ?? '07:00')),
    field('7. 최종적으로 깨어난 후, 침대에서 얼마나 오래 있었나요?(분)', num('afterWakeMin', 0, 300, last?.after_wake_min ?? 10)),
    el('fieldset', {}, el('legend', {}, '8. 수면의 질을 어떻게 평가하시나요?'),
      radioScale('quality', ['매우 별로', '별로', '보통', '좋음', '매우 좋음'].map((label, i) => ({ value: i + 1, label: `${i + 1}) ${label}` })))),
    field('9. 추가로 기록할 내용(특이사항)', el('textarea', { name: 'notes', rows: 3, maxLength: 500, placeholder: '예: 늦게까지 시험공부를 했다, 밤에 소음이 있었다' }),
      el('p', { class: 'hint' }, '선택 사항이에요. 500자까지 적을 수 있어요.')),
    el('h2', {}, '함께 적어 주세요'),
    field('어제 낮잠 잔 시간(분)', num('napMin', 0, 300, 0)),
    el('fieldset', {}, el('legend', {}, '낮에 얼마나 졸렸나요? (1 거의 안 졸림, 5 매우 졸림)'), scale('sleepiness')),
    el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'danger' }), el('span', {}, '졸려서 운전, 작업, 이동 중에 위험했던 적이 있었어요.')),
    stressRequired ? el('fieldset', {}, el('legend', {}, '어제 낮 스트레스는 어느 정도였나요? (0 없음, 4 매우 심함)'),
      radioScale('stress', [0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) })), { row: true })) : null,
    error,
    el('button', { class: 'btn', type: 'submit' }, '일지 저장하기'))));
}

function viewDiarySaved(r) {
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('h1', {}, '일지를 저장했어요'),
      el('p', {}, `잔 시간은 ${minutesToText(r.tstMin)}, 침대에 있던 시간은 ${minutesToText(r.tibMin)}, 수면 효율은 ${r.sePct}%입니다.`)),
    r.danger ? el('p', { class: 'notice' }, r.restrictionStopped
      ? '수면 시간 조절을 멈췄어요. 졸릴 때는 운전과 기계 조작을 하지 말고, 불편이 계속되면 의사와 상담해 주세요.'
      : '졸릴 때는 운전과 기계 조작을 하지 말고, 불편이 계속되면 의사와 상담해 주세요.') : null,
    el('a', { class: 'btn', href: '#/today' }, '오늘 화면으로')));
}

// ---------- 소리와 알림 ----------
let audio = null;
const unlockAudio = () => {
  audio ??= new (window.AudioContext ?? window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function chime(frequencies = [523, 659]) {
  if (!audio || audio.state !== 'running') return false;
  frequencies.forEach((frequency, i) => {
    const start = audio.currentTime + i * 0.35;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });
  return true;
}

function toast(message, href, label) {
  document.querySelector('.toast')?.remove();
  const box = el('div', { class: 'toast', role: 'alert' },
    el('p', {}, message),
    el('div', { class: 'actions' },
      href ? el('a', { class: 'btn', href, onclick: () => box.remove() }, label) : null,
      el('button', { class: 'btn ghost', type: 'button', onclick: () => box.remove() }, '닫기')));
  document.body.append(box);
}

// 사이트를 열어 둔 동안에는 푸시 설정과 관계없이 화면 안에서 소리와 함께 알린다.
const REMINDER_LOOKAHEAD_MIN = 10;
const remembered = (key) => {
  try {
    if (localStorage.getItem(key)) return true;
    localStorage.setItem(key, '1');
  } catch { /* 저장소를 못 쓰면 메모리만 쓴다 */ }
  if (remembered.seen.has(key)) return true;
  remembered.seen.add(key);
  return false;
};
remembered.seen = new Set();

function isDue(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  return ((d.getHours() * 60 + d.getMinutes() - (h * 60 + m) + 1440) % 1440) < REMINDER_LOOKAHEAD_MIN;
}

async function checkReminders() {
  if (state.me?.stage !== 'program' || state.me.sleep?.active) return;
  const n = await api('/notifications').catch(() => null);
  if (!n || n.sleeping) return;
  const day = new Date().toDateString();
  if (n.bedtimeEnabled && isDue(n.bedtimeTime) && !remembered(`bedtime:${day}`)) {
    chime();
    toast('잠자리에 들 준비를 시작할 시간이에요.', '#/sleep', '수면 화면 열기');
  } else if (n.morningEnabled && !n.wroteToday && isDue(n.reminderTime) && !remembered(`morning:${day}`)) {
    chime();
    toast('오늘 수면 일지를 적을 시간이에요.', '#/diary/new', '일지 쓰기');
  }
}
setInterval(() => checkReminders(), 30 * 1000);

// ---------- 수면 화면 ----------
async function viewSleepPrep() {
  const status = await api('/sleep/status');
  const n = await api('/notifications');
  const error = errorLine();
  const alarmOn = el('input', { type: 'checkbox', name: 'alarmOn', checked: true });
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('h1', {}, '수면 화면'),
      el('p', {}, '잠자리에 들 때 켜 두세요. 화면이 켜져 있는 동안의 시간을 기록합니다.'),
      el('p', { class: 'notice' }, '수면 화면을 끄면 수면 시간이 체크되지 않아 검사 결과가 부정확해질 수 있어요. 일어날 때까지 끄지 마세요.'),
      el('p', { class: 'small muted' }, '실제로 잠든 시간을 재는 것은 아니에요. 그래서 아침에 느낀 수면 시간을 함께 적습니다. 기기를 충전기에 연결하고, 화면 자동 잠금이 켜져 있다면 꺼 주세요. 화면이 꺼지면 기록과 알람이 멈출 수 있어요.')),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        unlockAudio();
        await api('/sleep/start', { method: 'POST', body: { alarm: alarmOn.checked ? formValue(e.target, 'alarm') : null } });
        state.me = null;
        await route();
      }),
    },
    el('label', { class: 'check' }, alarmOn, el('span', {}, '일어날 시간에 알람 울리기')),
    field('알람 시간', el('input', { type: 'time', name: 'alarm', required: true, value: status.defaultAlarm ?? '07:00' })),
    n.vapidPublicKey && !n.pushEnabled ? el('p', { class: 'small muted' }, '화면이 꺼져도 알림을 받고 싶다면 ', el('a', { href: '#/settings' }, '설정'), '에서 푸시 알림을 켜 주세요.') : null,
    error,
    el('button', { class: 'btn', type: 'submit' }, '수면 화면 켜기')),
    status.recent.length ? el('section', { class: 'stack' },
      el('h2', {}, '지난 기록'),
      el('table', { class: 'kv' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '날짜'), el('th', { scope: 'col' }, '화면이 켜져 있던 시간'), el('th', { scope: 'col' }, '느낀 수면 시간'))),
        el('tbody', {}, status.recent.map((r) => el('tr', {}, el('td', {}, r.night), el('td', {}, minutesToText(r.onMin)), el('td', {}, r.perceivedMin === null ? '적지 않음' : minutesToText(r.perceivedMin))))))) : null));
}

function viewSleepScreen(active) {
  const HEARTBEAT_MS = 60 * 1000;
  const ALARM_CHECK_MS = 5 * 1000;
  const ALARM_REPEAT_MS = 2 * 1000;
  let wakeLock = null;
  let alarmTimer = null;

  const message = el('p', { class: 'sleep-message' }, '편히 쉬세요');
  const warning = el('p', { class: 'sleep-note', role: 'status' });
  const error = errorLine();
  const screen = el('main', { class: 'sleep-screen' },
    message,
    el('p', { class: 'sleep-note' }, '화면을 끄면 수면 시간이 체크되지 않아 결과가 부정확해질 수 있어요.'),
    warning,
    error,
    el('button', {
      class: 'btn sleep-wake', type: 'button',
      onclick: async (e) => {
        e.target.disabled = true;
        error.textContent = '';
        try {
          await api('/sleep/end', { method: 'POST' });
          state.me = null;
          go('#/sleep/morning');
        } catch (err) {
          error.textContent = err.message;
          e.target.disabled = false;
        }
      },
    }, '일어났어요'),
    el('button', {
      class: 'link sleep-cancel', type: 'button',
      onclick: async () => {
        if (!window.confirm('이번 수면 기록을 지울까요?')) return;
        await api('/sleep/cancel', { method: 'POST' });
        state.me = null;
        go('#/sleep');
      },
    }, '잘못 켰어요'));
  show({ banner: false }, screen);

  async function holdScreen() {
    if (!navigator.wakeLock) {
      warning.textContent = '이 브라우저는 화면 켜짐을 유지하지 못해요. 기기의 자동 잠금을 꺼 주세요.';
      return;
    }
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      warning.textContent = '화면 켜짐을 유지하지 못했어요. 기기의 자동 잠금을 꺼 주세요.';
    }
  }

  const beat = () => {
    if (document.visibilityState === 'visible') api('/sleep/heartbeat', { method: 'POST' }).catch(() => {});
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      holdScreen();
      beat();
    }
  };
  const checkAlarm = () => {
    if (alarmTimer || !active.alarmAt || Date.now() < Date.parse(active.alarmAt)) return;
    screen.classList.add('alarm');
    message.textContent = '일어날 시간이에요';
    if (!chime([659, 784, 988])) warning.textContent = '소리를 켜려면 화면을 한 번 눌러 주세요.';
    alarmTimer = setInterval(() => {
      if (chime([659, 784, 988])) warning.textContent = '';
    }, ALARM_REPEAT_MS);
  };

  holdScreen();
  beat();
  document.addEventListener('visibilitychange', onVisible);
  const beatTimer = setInterval(beat, HEARTBEAT_MS);
  const alarmCheck = setInterval(checkAlarm, ALARM_CHECK_MS);
  checkAlarm();
  leaveView = () => {
    clearInterval(beatTimer);
    clearInterval(alarmCheck);
    clearInterval(alarmTimer);
    document.removeEventListener('visibilitychange', onVisible);
    wakeLock?.release().catch(() => {});
  };
}

async function viewSleepMorning() {
  const status = await api('/sleep/status');
  const record = status.pending;
  if (!record) return go('#/today');
  const startedAt = Date.now();
  const error = errorLine();
  const missed = record.totalMin - record.onMin;
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('h1', {}, '좋은 아침이에요'),
      el('table', { class: 'kv' }, el('tbody', {},
        el('tr', {}, el('th', { scope: 'row' }, '수면 화면을 켠 시각'), el('td', {}, record.startTime)),
        el('tr', {}, el('th', { scope: 'row' }, '일어났어요를 누른 시각'), el('td', {}, record.endTime)),
        el('tr', {}, el('th', { scope: 'row' }, '화면이 켜져 있던 시간'), el('td', {}, minutesToText(record.onMin))))),
      missed >= 10 ? el('p', { class: 'small muted' }, `중간에 화면이 꺼져 약 ${minutesToText(missed)}은 기록되지 않았어요.`) : null,
      el('p', { class: 'small muted' }, '실제로 잠든 시간과는 다를 수 있어요.')),
    el('form', {
      class: 'stack',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        const perceivedMin = Number(formValue(f, 'hours')) * 60 + Number(formValue(f, 'minutes'));
        await api(`/sleep/${record.id}/perceived`, { method: 'POST', body: { perceivedMin, elapsedSec: Math.round((Date.now() - startedAt) / 1000) } });
        state.me = null;
        viewSleepSaved(perceivedMin, record);
      }),
    },
    el('fieldset', { class: 'stack' },
      el('legend', {}, '지난밤 몇 시간 잔 것 같나요?'),
      el('div', { class: 'two' },
        field('시간', el('input', { type: 'number', name: 'hours', required: true, min: 0, max: 16, inputMode: 'numeric' })),
        field('분', el('input', { type: 'number', name: 'minutes', required: true, min: 0, max: 59, step: 5, value: 0, inputMode: 'numeric' })))),
    error,
    el('button', { class: 'btn', type: 'submit' }, '느낀 수면 시간 저장하기'))));
}

function viewSleepSaved(perceivedMin, record) {
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('h1', {}, '저장했어요'),
      el('p', {}, `화면이 켜져 있던 시간은 ${minutesToText(record.onMin)}, 느낀 수면 시간은 ${minutesToText(perceivedMin)}입니다.`)),
    el('div', { class: 'actions' },
      el('a', { class: 'btn', href: '#/diary/new' }, '이어서 일지 쓰기'),
      el('a', { class: 'btn ghost', href: '#/today' }, '오늘 화면으로'))));
}

// ---------- 설정 ----------
const logoutButton = () => el('button', {
  class: 'link', type: 'button',
  onclick: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.me = null;
    go('#/login');
  },
}, '로그아웃');

const urlBase64ToUint8Array = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

async function enablePush(publicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('브라우저 설정에서 알림을 허용해 주세요.');
  await navigator.serviceWorker.register('/sw.js');
  // 등록 직후에는 아직 활성화 전이라 구독이 실패한다.
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await api('/notifications/push', { method: 'POST', body: sub.toJSON() });
}

async function viewSettings() {
  const n = await api('/notifications');
  const error = errorLine();
  const saved = el('p', { class: 'hint good', role: 'status' });
  const withdrawError = errorLine();
  const available = n.emailAvailable || n.vapidPublicKey;
  const bedtimeInput = el('input', { type: 'time', name: 'bedtime', required: true, value: n.bedtimeTime, disabled: n.bedtimeAuto });
  const testResult = el('p', { class: 'hint', role: 'status' });
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '설정'),
    el('section', { class: 'stack' },
      el('h2', {}, '알림'),
      el('p', { class: 'small muted' }, '사이트를 열어 두면 화면에서 소리로 알려 드려요. 사이트를 닫아도 받으려면 푸시 알림을 켜 주세요.'),
      available ? null : el('p', { class: 'muted' }, '푸시와 이메일 발송이 아직 설정되지 않았습니다. 연구자에게 문의해 주세요.'),
      el('form', {
        class: 'stack',
        onsubmit: submitter(error, async (e) => {
          const f = e.target;
          saved.textContent = '';
          const wantPush = formValue(f, 'push') === 'on';
          if (wantPush && !n.pushEnabled) await enablePush(n.vapidPublicKey);
          await api('/notifications', {
            method: 'POST',
            body: {
              reminderTime: formValue(f, 'time'),
              emailEnabled: formValue(f, 'email') === 'on',
              pushEnabled: wantPush,
              morningEnabled: formValue(f, 'morning') === 'on',
              bedtimeEnabled: formValue(f, 'bedtimeOn') === 'on',
              bedtimeAuto: formValue(f, 'bedtimeAuto') === 'on',
              bedtimeTime: bedtimeInput.value,
            },
          });
          n.pushEnabled = wantPush;
          saved.textContent = '알림 설정을 저장했어요.';
        }),
      },
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'bedtimeOn', ...(n.bedtimeEnabled ? { checked: true } : {}) }), el('span', {}, '자기 전 알림 받기')),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', name: 'bedtimeAuto', ...(n.bedtimeAuto ? { checked: true } : {}), onchange: (e) => { bedtimeInput.disabled = e.target.checked; } }),
        el('span', {}, '오늘의 수면 시간 30분 전에 자동으로 알리기')),
      field('자기 전 알림 시간', bedtimeInput),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'morning', ...(n.morningEnabled ? { checked: true } : {}) }), el('span', {}, '아침 일지 알림 받기')),
      field('아침 일지 알림 시간', el('input', { type: 'time', name: 'time', required: true, value: n.reminderTime })),
      n.emailAvailable ? el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'email', ...(n.emailEnabled ? { checked: true } : {}) }), el('span', {}, '이메일로 받기')) : null,
      n.vapidPublicKey ? el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'push', ...(n.pushEnabled ? { checked: true } : {}) }), el('span', {}, '이 기기에서 푸시 알림 받기')) : null,
      el('p', { class: 'small muted' }, '알림에는 수면 정보가 들어가지 않습니다. 그날 일지를 이미 적었다면 아침 알림은 보내지 않아요.'),
      error, saved,
      el('div', { class: 'actions' },
        el('button', { class: 'btn ghost', type: 'submit' }, '알림 설정 저장하기'),
        el('button', {
          class: 'btn ghost', type: 'button',
          onclick: async () => {
            unlockAudio();
            chime();
            testResult.textContent = '화면 소리를 울렸어요.';
            const r = await api('/notifications/test', { method: 'POST' }).catch(() => null);
            if (r?.push) testResult.textContent = `화면 소리를 울리고, 푸시 알림을 ${r.push}건 보냈어요.`;
            else if (n.vapidPublicKey) testResult.textContent = '화면 소리를 울렸어요. 푸시 알림은 켜고 저장한 뒤에 시험할 수 있어요.';
          },
        }, '알림 시험하기')),
      testResult)),
    el('section', { class: 'stack' },
      el('h2', {}, '동의서'),
      el('a', { href: '/api/consent/copy', download: 'consent-copy.txt' }, '동의서 사본 내려받기')),
    el('section', { class: 'stack' },
      el('h2', {}, '문의'),
      el('p', {}, `연구자: ${config.researcher.email}, ${config.researcher.phone}`),
      el('p', {}, el('a', { href: '#/developer' }, '개발자 모드'))),
    el('section', { class: 'stack' }, logoutButton()),
    el('section', { class: 'stack' },
      el('h2', {}, '참여 그만두기'),
      el('p', {}, '언제든 이유 없이 그만둘 수 있고, 불이익은 없습니다. 그만두면 알림이 멈춥니다.'),
      el('form', {
        class: 'stack',
        onsubmit: submitter(withdrawError, async (e) => {
          await api('/withdraw', { method: 'POST', body: { password: formValue(e.target, 'password') } });
          state.me = null;
          go('#/');
        }),
      },
      field('확인을 위해 패스워드를 입력해 주세요', el('input', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' })),
      withdrawError,
      el('button', { class: 'btn danger', type: 'submit' }, '참여 그만두기')))));
}

function viewWithdrawn() {
  show(el('main', { class: 'stack' },
    el('h1', {}, '참여를 그만두셨습니다'),
    el('p', {}, '알림과 플랜 생성을 멈췄습니다. 함께해 주셔서 고맙습니다.'),
    el('p', {}, '수면 문제가 계속되거나 불편이 크다면 의사와 상담해 주세요.'),
    el('p', { class: 'small muted' }, `자료 처리에 관한 문의: ${config.researcher.email}`),
    logoutButton()));
}

// ---------- 종료 설문과 결과 ----------
async function viewFinalSurvey() {
  const q = await loadQuestions();
  const startedAt = Date.now();
  const answers = {};
  const finish = () => {
    const error = errorLine();
    show(el('main', { class: 'stack-lg' },
      el('div', { class: 'stack' },
        el('p', { class: 'steps' }, '종료 설문 2/3'),
        el('h1', {}, '피츠버그 수면의 질 지수')),
      el('form', {
        class: 'stack-lg',
        onsubmit: submitter(error, async (e) => {
          await api('/survey/final', { method: 'POST', body: { ...answers, psqi: readPsqi(e.target, q), elapsedSec: Math.round((Date.now() - startedAt) / 1000) } });
          state.me = null;
          go('#/');
        }),
      }, psqiFields(q), error, el('button', { class: 'btn', type: 'submit' }, '다음'))));
  };
  const error = errorLine();
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('p', { class: 'steps' }, '종료 설문 1/3'),
      el('h1', {}, '3주를 마쳤어요'),
      el('p', {}, '처음에 답했던 수면 설문에 다시 답해 주세요.')),
    el('form', {
      class: 'stack-lg',
      onsubmit: submitter(error, (e) => {
        answers.isi = readIsi(e.target, q.isi);
        finish();
      }),
    }, sourceNote(q.sources.isi, q.sources.draftNotice), isiFields(q.isi), error, el('button', { class: 'btn', type: 'submit' }, '다음'))));
}

async function viewUsability() {
  const q = await loadQuestions();
  const startedAt = Date.now();
  const error = errorLine();
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'stack' },
      el('p', { class: 'steps' }, '종료 설문 3/3'),
      el('h1', {}, '웹사이트는 어땠나요?'),
      el('p', { class: 'muted' }, '1은 전혀 그렇지 않다, 5는 매우 그렇다입니다.')),
    el('form', {
      class: 'stack-lg',
      onsubmit: submitter(error, async (e) => {
        const f = e.target;
        await api('/survey/usability', {
          method: 'POST',
          body: { sus: q.sus.map((_, i) => Number(formValue(f, `sus${i}`))), comment: formValue(f, 'comment'), elapsedSec: Math.round((Date.now() - startedAt) / 1000) },
        });
        state.me = null;
        go('#/');
      }),
    },
    q.sus.map((text, i) => el('fieldset', {}, el('legend', {}, `${i + 1}. ${text}`), radioScale(`sus${i}`, [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), { row: true }))),
    field('더 하고 싶은 말 (선택)', el('textarea', { name: 'comment', maxLength: 2000 })),
    error,
    el('button', { class: 'btn', type: 'submit' }, '설문 마치고 결과 보기'))));
}

const AREA_NAMES = {
  onset: '잠들기 어려움', maintenance: '자다가 깸', earlyWaking: '너무 일찍 깸', timeInBed: '침대에 머무는 시간이 김', daytime: '낮 시간 피로',
  worry: '수면에 대한 걱정', stress: '스트레스에 잠이 민감함', beliefs: '수면에 대한 잘못된 믿음', medication: '수면을 위한 약 사용',
};
const AROUSAL_NAMES = { A: '수면 전 인지적 각성', B: '수면 전 신체적 각성', C: '스트레스에 대한 수면 반응성', D: '낮 동안의 기본 긴장' };
const MODULE_NAMES = { worry: '걱정 정리', relax: '이완' };

// 변수 기반 결괏값. 진단이 아니라 응답과 기록을 정리한 것이다.
function variablesSection(v) {
  if (!v) return null;
  const row = (k, val) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, val));
  return el('section', { class: 'stack' },
    el('h2', {}, '변수별 결과'),
    el('table', { class: 'kv' }, el('tbody', {},
      row('나이', `만 ${v.age}세`),
      row('생물학적 성', v.sex),
      v.arousal.map((a) => row(AROUSAL_NAMES[a.id], `${a.score}점, ${a.band}`)),
      row('과각성 유형', v.arousalGroup === 'non_hyperarousal' ? '과각성 우세형 아님' : '과각성 우세형'),
      row('스트레스 반응(FIRST)', `${v.first.total}점, ${v.first.group}`),
      row('침대에 머무는 시간(시작할 때)', minutesToText(v.tibMin)),
      v.dbasMean !== null ? row('수면에 대한 역기능적 믿음(DBAS-16)', `평균 ${v.dbasMean}점(0~10)`) : null,
      row('취약 영역', v.areas.length ? v.areas.map((a) => AREA_NAMES[a] ?? a).join(', ') : '두드러진 영역 없음'),
      v.modules.map((m) => row(`${MODULE_NAMES[m.id]} 모듈(${LEVEL_LABEL[m.level]})`, m.completed ? '완료' : m.started ? '시작했지만 완료하지 않음' : '시작하지 않음')))),
    v.stress ? el('p', {}, `낮 스트레스가 높았던 날의 수면 효율은 평균 ${v.stress.highSe}%, 낮았던 날은 ${v.stress.lowSe}%였습니다.`) : null,
    el('p', { class: 'small muted' }, '진단이 아니라 설문 응답과 기록을 정리한 결과입니다.'));
}

async function viewResults() {
  const r = await api('/results');
  const se = r.sePctWeek1 !== null && r.sePctWeek3 !== null
    ? el('p', {}, `수면 효율은 1주차 ${r.sePctWeek1}%, 3주차 ${r.sePctWeek3}%로 기록되었습니다.`)
    : null;
  show(el('main', { class: 'stack-lg' },
    el('h1', {}, '참여 결과'),
    el('section', { class: 'stack' },
      el('h2', {}, '수면 설문 점수'),
      el('div', { class: 'scores' },
        el('div', {}, el('b', {}, String(r.isiBefore)), '시작할 때'),
        el('div', {}, el('b', {}, String(r.isiAfter)), '마칠 때')),
      el('p', { class: 'small muted' }, `0~${r.isiMax}점이며, 낮을수록 수면 어려움을 적게 느낀다고 답했다는 뜻입니다.`),
      el('p', {}, '참여 전후 응답을 비교한 것입니다. 웹사이트의 효과나 건강 상태를 뜻하지는 않습니다.'),
      r.psqiBefore !== null && r.psqiAfter !== null ? el('p', {}, `피츠버그 수면의 질 지수(0~21점, 낮을수록 좋음)는 시작할 때 ${r.psqiBefore}점, 마칠 때 ${r.psqiAfter}점입니다.`) : null),
    el('section', { class: 'stack' },
      el('h2', {}, '내 기록'),
      el('p', {}, `21일 중 ${r.diaryNights}일 일지를 적었습니다.`),
      se,
      r.sleepNights ? el('p', {}, `수면 화면을 쓴 ${r.sleepNights}일 동안 화면이 켜져 있던 시간은 평균 ${minutesToText(r.avgOnMin)}, 느낀 수면 시간은 평균 ${minutesToText(r.avgPerceivedMin)}이었습니다.`) : null),
    r.suggestConsult ? el('p', { class: 'notice' }, '수면 어려움이 아직 크다고 답하셨어요. 의사와 상담해 보시기를 권합니다.') : null,
    variablesSection(r.variables),
    el('p', {}, '참여해 주셔서 고맙습니다.'),
    logoutButton()));
}

// ---------- 라우터 ----------
function renderTabs(active) {
  const inProgram = state.me?.stage === 'program' && !state.me.sleep?.active;
  tabs.hidden = !inProgram;
  if (!inProgram) return;
  const items = [['#/today', '오늘'], ['#/plan', '플랜'], ['#/sleep', '수면'], ['#/diary', '일지'], ['#/settings', '설정']];
  tabs.replaceChildren(...items.map(([href, label]) => el('a', { href, ...(active === href ? { 'aria-current': 'page' } : {}) }, label)));
  for (const a of tabs.children) if (a.getAttribute('href') === active) a.setAttribute('aria-current', 'page');
}

async function loadMe() {
  try {
    state.me = await api('/me');
  } catch (err) {
    if (err.status !== 401) throw err;
    state.me = null;
  }
}

async function route() {
  const hash = location.hash || '#/';
  try {
    config ??= await api('/public/config');
    root.classList.toggle('wide', hash === '#/developer');
    if (hash === '#/developer') {
      show({ banner: false });
      tabs.hidden = true;
      const { startDeveloper } = await import('./developer.js');
      return await startDeveloper(root, { home: '#/' });
    }
    await loadMe();
    if (!state.me) {
      renderTabs();
      if (hash === '#/consent') return await viewConsent();
      if (hash === '#/signup') return viewSignup();
      if (hash === '#/login') return viewLogin();
      return viewLanding();
    }
    const { stage } = state.me;
    renderTabs(hash === '#/diary/new' ? '#/diary' : hash === '#/' ? '#/today' : hash === '#/sleep/morning' ? '#/sleep' : hash);
    // 수면 화면이 켜져 있으면 단계와 주소에 관계없이 그 화면을 이어서 보여 준다. 21일째 밤에도 끝낼 수 있어야 한다.
    if (state.me.sleep?.active) return viewSleepScreen(state.me.sleep.active);
    if (hash === '#/sleep/morning' && stage !== 'withdrawn' && stage !== 'excluded') return await viewSleepMorning();
    if (stage === 'withdrawn') return viewWithdrawn();
    if (stage === 'excluded') return viewExcluded();
    if (stage === 'survey') return await viewBaseline();
    if (stage === 'education') {
      const m = /^#\/education\/([\w-]+)$/.exec(hash);
      return await (m ? viewEducationModule(m[1]) : viewEducationList());
    }
    if (stage === 'final-survey') return await viewFinalSurvey();
    if (stage === 'usability') return await viewUsability();
    if (stage === 'done') return await viewResults();
    checkReminders();
    if (hash === '#/sleep') return await viewSleepPrep();
    if (hash === '#/plan') return await viewPlan();
    if (hash === '#/diary') return await viewDiaryList();
    if (hash === '#/diary/new') return await viewDiaryNew();
    if (hash === '#/settings') return await viewSettings();
    return await viewToday();
  } catch (err) {
    show(el('main', { class: 'stack' },
      el('h1', {}, '화면을 불러오지 못했습니다'),
      el('p', {}, err.message),
      el('button', { class: 'btn', type: 'button', onclick: route }, '다시 불러오기')));
  }
}

window.addEventListener('hashchange', route);
route();
