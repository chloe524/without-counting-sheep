// 화면 코드(public/app.js)를 고치지 않고 /api 요청만 브라우저 안의 가짜 서버로 돌린다.
import { createDemoApi } from './api.js?v=a24e33003c';
import { createCloud } from './cloud.js?v=a24e33003c';

const memory = new Map();
const fallbackStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
let storage = fallbackStorage;
try {
  storage = window.localStorage;
} catch {
  // 저장소가 막힌 브라우저에서는 탭을 닫을 때까지만 유지한다.
}

const realFetch = window.fetch.bind(window);
const TOKEN_KEY = 'without-counting-sheep-developer';
let developerToken = null;
// 개발자 모드 토큰은 탭을 닫으면 사라지게 sessionStorage에 둔다.
const tokenStore = {
  get() {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return developerToken;
    }
  },
  set(value) {
    developerToken = value;
    try {
      if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // 저장소가 막힌 브라우저에서는 메모리에만 둔다.
    }
  },
};
const demo = createDemoApi({ storage, cloud: createCloud({ fetchFn: realFetch, tokenStore }) });

window.fetch = async (input, init = {}) => {
  const url = new URL(String(input), location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
  const { status, data } = await demo.handle(init.method ?? 'GET', url.pathname.slice(4) + url.search, init.body ? JSON.parse(init.body) : undefined);
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
};

// 동의서 사본은 링크로 받는 파일이라 fetch를 거치지 않는다.
document.addEventListener('click', async (event) => {
  const link = event.target.closest?.('a[href="/api/consent/copy"]');
  if (!link) return;
  event.preventDefault();
  const { status, data } = await demo.handle('GET', '/consent/copy');
  if (status !== 200) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data.text], { type: 'text/plain;charset=utf-8' }));
  a.download = 'consent-copy.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});
