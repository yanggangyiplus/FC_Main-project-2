/**
 * Firebase Cloud Messaging Service Worker
 * 백그라운드에서 푸시 알림을 수신하고 표시합니다.
 */

// Firebase SDK 가져오기
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase 설정 (Firebase Console에서 가져온 값으로 교체 필요)
// 이 값들은 .env에서 가져올 수 없으므로 직접 입력해야 합니다.
const firebaseConfig = {
  apiKey: "AIzaSyDl9NnCfm1bNa-o7Sj-D2uIU2FDV9KiO2c",
  authDomain: "always-plan-fc.firebaseapp.com",
  projectId: "always-plan-fc",
  storageBucket: "always-plan-fc.firebasestorage.app",
  messagingSenderId: "509998441771",
  appId: "1:509998441771:web:a0c8a9f2a5b3c4d5e6f7g8"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Messaging 인스턴스 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 수신 처리
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || '일정 알림';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: payload.data?.todo_id || 'default',
    data: payload.data || {},
    // 알림 클릭 시 앱으로 이동
    actions: [
      {
        action: 'open',
        title: '열기'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ],
    // 진동 패턴 (모바일)
    vibrate: [200, 100, 200],
    // 알림 유지 시간
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 클릭:', event);

  event.notification.close();

  // 액션에 따른 처리
  if (event.action === 'close') {
    return;
  }

  // 앱 열기 또는 포커스
  const urlToOpen = event.notification.data?.click_action || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열린 창이 있으면 포커스
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// 서비스 워커 설치
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker 설치됨');
  self.skipWaiting();
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker 활성화됨');
  event.waitUntil(clients.claim());
});
