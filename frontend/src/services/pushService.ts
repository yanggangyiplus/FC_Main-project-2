/**
 * 웹 푸시 알림 서비스
 */
import { apiClient } from './apiClient'

class PushService {
  private registration: ServiceWorkerRegistration | null = null
  private publicKey: string | null = null

  /**
   * Service Worker 등록 및 푸시 구독 초기화
   */
  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PushService] 브라우저가 푸시 알림을 지원하지 않습니다.')
      return false
    }

    try {
      // Service Worker 등록
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      console.log('[PushService] Service Worker 등록 완료')

      // VAPID 공개 키 가져오기
      const response = await apiClient.getPushPublicKey()
      this.publicKey = response.data.publicKey

      if (!this.publicKey) {
        console.warn('[PushService] VAPID 공개 키를 가져올 수 없습니다.')
        return false
      }

      return true
    } catch (error) {
      console.error('[PushService] 초기화 실패:', error)
      return false
    }
  }

  /**
   * 푸시 알림 권한 요청 및 구독
   */
  async subscribe(): Promise<boolean> {
    if (!this.registration) {
      const initialized = await this.initialize()
      if (!initialized) {
        return false
      }
    }

    if (!this.publicKey) {
      const response = await apiClient.getPushPublicKey()
      this.publicKey = response.data.publicKey
      if (!this.publicKey) {
        console.error('[PushService] VAPID 공개 키를 가져올 수 없습니다.')
        return false
      }
    }

    try {
      // 권한 확인
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.warn('[PushService] 푸시 알림 권한이 거부되었습니다.')
        return false
      }

      // 기존 구독 확인
      let subscription = await this.registration!.pushManager.getSubscription()

      // 구독이 없으면 새로 생성
      if (!subscription) {
        subscription = await this.registration!.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.publicKey!)
        })
      }

      // 구독 정보를 서버에 전송
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
      }

      await apiClient.subscribePush(subscriptionData)
      console.log('[PushService] 푸시 구독 완료')
      return true
    } catch (error) {
      console.error('[PushService] 구독 실패:', error)
      return false
    }
  }

  /**
   * 푸시 알림 구독 해제
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await apiClient.unsubscribePush(subscription.endpoint)
        console.log('[PushService] 푸시 구독 해제 완료')
        return true
      }
      return false
    } catch (error) {
      console.error('[PushService] 구독 해제 실패:', error)
      return false
    }
  }

  /**
   * 현재 구독 상태 확인
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription()
      return subscription !== null
    } catch (error) {
      console.error('[PushService] 구독 상태 확인 실패:', error)
      return false
    }
  }

  /**
   * 권한 상태 확인
   */
  getPermission(): NotificationPermission {
    return Notification.permission
  }

  /**
   * Base64 URL을 Uint8Array로 변환
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * ArrayBuffer를 Base64로 변환
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

export const pushService = new PushService()

