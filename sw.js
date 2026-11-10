// 사이트가 /저장소이름/ 아래에 있어도 동작하도록 주소는 서비스 워커 범위(scope)를 기준으로 만든다.
const home = () => self.registration.scope;
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'without counting sheep', body: '알림이 도착했어요.', url: home(), tag: 'general' };
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: new URL('icon.svg', home()).href,
    tag: data.tag,
    silent: false,
    requireInteraction: Boolean(data.urgent),
    data: { url: new URL(data.url ?? '', home()).href },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? home()));
});
