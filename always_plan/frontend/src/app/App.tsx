import { useEffect, useState } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { CalendarHomeScreen } from './components/CalendarHomeScreen'

/**
 * Always Plan App
 * 로그인 상태에 따라 화면 분기
 */
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log('[App] Checking authentication...')
    // 토큰 확인
    const accessToken = localStorage.getItem('access_token')
    console.log('[App] Access token:', accessToken ? '있음' : '없음')

    setIsAuthenticated(!!accessToken)
    setIsLoading(false)

    console.log('[App] Authentication state:', !!accessToken ? 'authenticated' : 'not authenticated')
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  console.log('[App] Rendering:', isAuthenticated ? 'CalendarHomeScreen' : 'LoginScreen')

  // 토큰이 없으면 로그인 화면, 있으면 메인 화면 (CalendarHomeScreen으로 변경)
  return isAuthenticated ? <CalendarHomeScreen /> : <LoginScreen />
}