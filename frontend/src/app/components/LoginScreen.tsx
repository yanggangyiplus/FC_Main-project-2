import { ArrowLeft, Loader, Calendar } from 'lucide-react'
import { Checkbox } from './ui/checkbox'
import { useState, useEffect } from 'react'
import { apiClient } from '@/services/apiClient';

/**
 * LoginScreen - Main_PJ2 패턴 적용
 * 
 * OAuth 흐름:
 * 1. "Google로 로그인" 클릭
 * 2. /auth/google-init 호출 → auth_url 받기
 * 3. Google OAuth 팝업으로 리다이렉트
 * 4. 사용자 동의 → 리다이렉트 URL로 돌아옴
 * 5. URL에서 code 파라미터 추출
 * 6. /auth/google-login 호출 → 토큰 받기
 * 7. localStorage에 토큰 저장
 * 8. 메인 화면으로 이동
 */

export function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)

  // URL에서 OAuth callback 처리 (Main_PJ2 패턴)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      const source = urlParams.get('source')

      // Calendar OAuth 콜백인 경우 처리하지 않음 (CalendarHomeScreen에서 처리)
      if (source === 'calendar') {
        console.log('[LoginScreen] Calendar OAuth 콜백은 CalendarHomeScreen에서 처리됩니다.');
        return;
      }

      if (code && state) {
        try {
          setIsLoading(true)
          setError(null)

          // 코드를 백엔드로 전송하여 토큰 교환 (Main_PJ2의 exchange_code_for_token)
          const response = await apiClient.googleLogin(code, state)

          // 토큰 저장
          localStorage.setItem('access_token', response.data.access_token)
          localStorage.setItem('refresh_token', response.data.refresh_token)

          if (rememberMe) {
            localStorage.setItem('remember_me', 'true')
          }

          // URL 깔끔하게 정리 (Main_PJ2 패턴)
          window.history.replaceState({}, document.title, window.location.pathname)

          // 메인 화면으로 이동
          setTimeout(() => {
            window.location.href = '/'
          }, 500)
        } catch (err) {
          console.error('OAuth callback error:', err)
          const errorMsg = err instanceof Error ? err.message : '로그인 실패'
          setError(errorMsg)
          setIsLoading(false)
        }
      }
    }

    handleOAuthCallback()
  }, [])

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Step 1: auth_url 획득 (Main_PJ2의 get_authorization_url 호출)
      const response = await apiClient.getGoogleInitUrl()
      const { auth_url } = response.data

      if (!auth_url) {
        throw new Error('Google OAuth URL을 받지 못했습니다. 백엔드 환경변수를 확인하세요.')
      }

      // Step 2: Google OAuth 페이지로 리다이렉트
      // Main_PJ2: st.link_button("Google로 로그인", auth_url)
      window.location.href = auth_url
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인 초기화 실패'
      console.error('Google login error:', err)
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFE8E0] to-[#FFF5F2] flex flex-col items-center justify-center px-4 sm:px-6 relative w-full max-w-full md:max-w-md mx-auto">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 p-2 hover:bg-white/50 rounded-lg transition-colors z-10"
        disabled={isLoading}
      >
        <ArrowLeft size={24} className="text-[#6B7280]" />
      </button>

      <div className="w-full max-w-[320px] sm:max-w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg">
            <Calendar size={28} className="text-white sm:size-8" strokeWidth={2.5} />
          </div>
          <h1 className="mb-2 text-xl sm:text-2xl font-bold text-[#1F2937]">ALWAYS PLAN</h1>
          <p className="text-sm sm:text-base text-[#6B7280] text-center">부모들을 위한 손쉬운 일정 관리 & 소통</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-lg">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Google Login Button (Main_PJ2 패턴) */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-12 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center gap-2 mb-4 hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader size={20} className="animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Google로 시작하기</span>
              </>
            )}
          </button>

          {/* Remember me (Main_PJ2 패턴: 세션 유지) */}
          <label className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={isLoading}
            />
            <span>로그인 상태 유지</span>
          </label>
        </div>

        {/* Terms */}
        <p className="text-xs text-[#9CA3AF] text-center mt-6 px-4">
          로그인만 하면 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  )
}