// Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 활성화됨');
  event.waitUntil(self.clients.claim());
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[Service Worker] 푸시 알림 수신:', event);
  
  let notificationData = {
    title: '일정 알림',
    body: '새로운 알림이 있습니다.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: {}
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || {}
      };
    } catch (e) {
      console.error('[Service Worker] 푸시 데이터 파싱 실패:', e);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.data.todo_id || 'notification',
      requireInteraction: false
    })
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 알림 클릭:', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  const todoId = data?.todo_id;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려있는 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          if (todoId) {
            return client.navigate(`/?todo=${todoId}`).then(() => client.focus());
          }
          return client.focus();
        }
      }
      // 새 창 열기
      if (clients.openWindow) {
        if (todoId) {
          return clients.openWindow(`/?todo=${todoId}`);
        }
        return clients.openWindow('/');
      }
    })
  );
});

