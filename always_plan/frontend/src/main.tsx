
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// 개발 모드에서 localStorage 초기화 (첫 로드 시에만)
const isDev = !window.location.hostname.includes('localhost') || true;

if (isDev) {
  const initKey = '__app_initialized__'
  const isInitialized = localStorage.getItem(initKey)
  
  if (!isInitialized) {
    console.log('[Main] 앱 초기화 중...')
    localStorage.clear()
    localStorage.setItem(initKey, 'true')
    console.log('[Main] localStorage 초기화 완료')
  }
}

console.log('[Main] React App 마운트 시작')

createRoot(document.getElementById("root")!).render(
  <>
    <App />
  </>
);

console.log('[Main] React App 마운트 완료')
  