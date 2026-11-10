// 시연판과 Supabase 서버 기능 사이의 통신. 저장소가 잠시 안 되어도 사이트는 계속 쓸 수 있어야 한다.
import { CLOUD_ORIGIN } from './cloud-config.js';

const ADMIN_ACTIONS = { '/admin/status': 'status', '/admin/participants': 'list' };

export function createCloud({ fetchFn, tokenStore, baseUrl = `${CLOUD_ORIGIN}/functions/v1` }) {
  const post = async (name, body) => {
    const res = await fetchFn(`${baseUrl}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  return {
    async check(username, email) {
      try {
        const { status, data } = await post('participant-sync', { action: 'check', username, email });
        return status === 200 ? data : null;
      } catch {
        return null;
      }
    },

    // 연구자가 지운 참가자 코드 목록. 확인하지 못하면 빈 목록이다.
    async deletedCodes(codes) {
      try {
        const { status, data } = await post('participant-sync', { action: 'deleted', codes });
        return status === 200 ? data.deleted : [];
      } catch {
        return [];
      }
    },

    // 성공하면 true, 연구자가 삭제한 참가자면 'deleted', 그 밖의 실패는 false
    async sync(payload) {
      try {
        const { status } = await post('participant-sync', { action: 'sync', ...payload });
        return status === 410 ? 'deleted' : status === 200;
      } catch {
        return false;
      }
    },

    // 개발자 화면이 쓰는 /admin 주소를 서버 기능 요청으로 바꾼다.
    async admin(path, body, method = 'GET') {
      try {
        if (path === '/admin/logout') {
          tokenStore.set(null);
          return { status: 200, data: { ok: true } };
        }
        if (path === '/admin/login') {
          const result = await post('developer-admin', { action: 'login', password: body?.password });
          if (result.status === 200) tokenStore.set(result.data.token);
          return { status: result.status, data: result.status === 200 ? { ok: true } : result.data };
        }
        const code = /^\/admin\/participants\/([\w-]+)$/.exec(path)?.[1];
        const action = code ? (method === 'DELETE' ? 'delete' : 'detail') : ADMIN_ACTIONS[path];
        if (!action) return { status: 404, data: { error: '없는 주소입니다.' } };
        return await post('developer-admin', { action, code, token: tokenStore.get() });
      } catch {
        return { status: 503, data: { error: '저장소에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.' } };
      }
    },
  };
}

export const offlineCloud = {
  check: async () => null,
  deletedCodes: async () => [],
  sync: async () => false,
  admin: async () => ({ status: 503, data: { error: '저장소에 연결하지 못했습니다.' } }),
};
