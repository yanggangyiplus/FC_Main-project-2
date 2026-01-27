/**
 * Firebase Cloud Messaging 서비스
 * 웹 푸시 알림을 위한 FCM 초기화 및 토큰 관리
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { apiClient } from './apiClient';

// Firebase 설정 (Firebase Console에서 가져온 값)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDl9NnCfm1bNa-o7Sj-D2uIU2FDV9KiO2c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "always-plan-fc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "always-plan-fc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "always-plan-fc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "509998441771",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:509998441771:web:a0c8a9f2a5b3c4d5e6f7g8"
};

// VAPID 키 (Firebase Console > Cloud Messaging > Web Push certificates에서 생성)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BJoIomALyR7T2O2DRwG37yAeOHsZDwINb70u8rH7Hf2NxQooTNQJd4Z3rXd5V_wMdtX4Bva39VeLn82UvevvvgU';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Firebase 앱 초기화
 */
export function initializeFirebase(): FirebaseApp | null {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('[FCM] Firebase 앱 초기화 완료');
    } else {
      app = getApps()[0];
    }
    return app;
  } catch (error) {
    console.error('[FCM] Firebase 초기화 실패:', error);
    return null;
  }
}

/**
 * FCM Messaging 인스턴스 가져오기
 */
export function getMessagingInstance(): Messaging | null {
  try {
    if (!app) {
      app = initializeFirebase();
    }
    if (!app) return null;

    if (!messaging) {
      messaging = getMessaging(app);
      console.log('[FCM] Messaging 인스턴스 생성 완료');
    }
    return messaging;
  } catch (error) {
    console.error('[FCM] Messaging 인스턴스 생성 실패:', error);
    return null;
  }
}

/**
 * 알림 권한 요청 및 FCM 토큰 발급
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // 브라우저 알림 지원 확인
    if (!('Notification' in window)) {
      console.warn('[FCM] 이 브라우저는 알림을 지원하지 않습니다.');
      return null;
    }

    // 권한 상태 확인
    let permission = Notification.permission;

    // 권한 요청 (아직 요청하지 않은 경우)
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] 알림 권한이 거부되었습니다.');
      return null;
    }

    console.log('[FCM] 알림 권한 허용됨');

    // Service Worker 등록
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM] Service Worker 등록 완료:', registration.scope);

    // FCM 토큰 발급
    const messagingInstance = getMessagingInstance();
    if (!messagingInstance) {
      console.error('[FCM] Messaging 인스턴스를 가져올 수 없습니다.');
      return null;
    }

    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('[FCM] 토큰 발급 성공');
      // 백엔드에 토큰 저장
      await saveFcmTokenToServer(token);
      return token;
    } else {
      console.warn('[FCM] 토큰을 발급받지 못했습니다.');
      return null;
    }
  } catch (error) {
    console.error('[FCM] 알림 권한 요청 실패:', error);
    return null;
  }
}

/**
 * 백엔드에 FCM 토큰 저장
 */
async function saveFcmTokenToServer(token: string): Promise<boolean> {
  try {
    await apiClient.saveFcmToken(token);
    console.log('[FCM] 토큰 서버 저장 완료');
    return true;
  } catch (error) {
    console.error('[FCM] 토큰 서버 저장 실패:', error);
    return false;
  }
}

/**
 * 포그라운드 메시지 리스너 설정
 */
export function setupForegroundMessageListener(
  onNotification: (payload: any) => void
): (() => void) | null {
  try {
    const messagingInstance = getMessagingInstance();
    if (!messagingInstance) return null;

    const unsubscribe = onMessage(messagingInstance, (payload) => {
      console.log('[FCM] 포그라운드 메시지 수신:', payload);

      // 포그라운드에서는 직접 알림 표시
      if (Notification.permission === 'granted') {
        const notificationTitle = payload.notification?.title || '일정 알림';
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: '/icons/icon-192x192.png',
          data: payload.data || {}
        };

        new Notification(notificationTitle, notificationOptions);
      }

      // 콜백 호출
      onNotification(payload);
    });

    console.log('[FCM] 포그라운드 메시지 리스너 설정 완료');
    return unsubscribe;
  } catch (error) {
    console.error('[FCM] 포그라운드 메시지 리스너 설정 실패:', error);
    return null;
  }
}

/**
 * 현재 알림 권한 상태 확인
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * FCM 토큰 삭제 (로그아웃 시 호출)
 */
export async function deleteFcmToken(): Promise<void> {
  try {
    await apiClient.client.delete('/notifications/fcm-token');
    console.log('[FCM] 토큰 삭제 완료');
  } catch (error) {
    console.error('[FCM] 토큰 삭제 실패:', error);
  }
}
