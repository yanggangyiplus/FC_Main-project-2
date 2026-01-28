import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alwaysplan.app',
  appName: 'Always Plan',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // 프로덕션에서는 로컬 assets 사용
    // 개발 중에는 아래 url 활성화
    // url: 'https://always-plan-fc.web.app'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FF9B82',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FF9B82',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // 개발 중 디버깅용, 프로덕션에서는 false
  },
};

export default config;
