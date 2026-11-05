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
  const input = el('input', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' });
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
          input.value = '';
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
  const { participants, accessLog, scopeNotice } = await api('/participants');
  const search = el('input', { type: 'text', placeholder: '이름, 아이디, 이메일, 전화번호, 코드', 'aria-label': '참가자 검색' });
  const holder = el('div');
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const hits = participants.filter((p) => !q || [p.fullName, p.username, p.email, p.phone, p.nickname, p.code].some((v) => text(v).toLowerCase().includes(q)));
    holder.replaceChildren(rowsTable(hits.map((p) => ({
      ...p,
      status: statusOf(p),
      open: el('button', { class: 'link', type: 'button', onclick: () => viewDetail(p.code) }, p.code),
    })), [
      ['open', '코드'], ['fullName', '성명'], ['username', '아이디'], ['nickname', '닉네임'], ['email', '이메일'], ['phone', '전화번호'], ['age', '나이'],
      ['status', '상태'], ['track', '플랜'], ['isiBefore', 'ISI 시작'], ['isiAfter', 'ISI 종료'], ['diaryNights', '일지 수'], ['lastActive', '최근 접속'], ['createdAt', '가입 시각'],
    ]));
  };
  search.addEventListener('input', render);
  render();
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'actions' }, el('h1', {}, '개발자 모드'), logout()),
    scopeNotice ? el('p', { class: 'notice' }, scopeNotice) : null,
    el('p', { class: 'notice' }, '참가자의 개인정보와 건강정보입니다. 연구 목적으로만 열람하고, 화면을 켜 둔 채 자리를 비우지 마세요. 30분 뒤 자동으로 로그아웃됩니다.'),
    section(`참가자 ${participants.length}명`, search, holder),
    el('details', {}, el('summary', {}, '최근 개발자 모드 사용 기록'), el('div', { class: 'stack' }, rowsTable(accessLog)))));
}

async function viewDetail(code) {
  const d = await api(`/participants/${encodeURIComponent(code)}`);
  show(el('main', { class: 'stack-lg' },
    el('div', { class: 'actions' }, el('button', { class: 'link', type: 'button', onclick: viewList }, '목록으로'), logout()),
    el('h1', {}, `${d.account.fullName} (${code})`),
    section('계정', rowsTable([d.account])),
    section('참가 상태와 동의', rowsTable([d.participant])),
    section('알림 설정', rowsTable(d.notifications ? [d.notifications] : [])),
    section('설문과 안전 문진', rowsTable(d.surveys)),
    section('기초 교육 응답', rowsTable(d.education)),
    section('수면 일지', rowsTable(d.diary)),
    section('수면 화면 기록', rowsTable(d.sleep)),
    section('주차별 플랜', rowsTable(d.plans.map(({ content, ...rest }) => rest)),
      d.plans.filter((p) => p.content).map((p) => el('details', {}, el('summary', {}, `${p.week}주차 플랜 내용`), el('pre', {}, JSON.stringify(JSON.parse(p.content), null, 2))))),
    section('완료한 과제', rowsTable(d.tasks)),
    section('사용 기록', rowsTable(d.usage))));
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
