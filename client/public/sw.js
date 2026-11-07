// PRITONN Service Worker for Interactive Call & Message Notifications (Web PWA / Browser)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const data = (notif && notif.data) || {};
  const action = event.action || 'expand';

  if (action !== 'stop_screen') {
    notif.close();
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const shouldFocus = action === 'accept' || action === 'expand' || (!event.action && data.chatId);
        let targetClient = clientList.find((c) => c.focused) || clientList[0];

        if (targetClient) {
          if (shouldFocus && typeof targetClient.focus === 'function') {
            targetClient.focus().catch(() => {});
          }
          targetClient.postMessage({
            type: data.isCallControl ? 'pritonn-call-action' : 'pritonn-open-chat',
            action,
            callerId: data.callerId || '',
            chatId: data.chatId || '',
          });
          return;
        }

        if (shouldFocus && self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});
