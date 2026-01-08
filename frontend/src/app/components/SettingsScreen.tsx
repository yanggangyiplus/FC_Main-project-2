import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsScreen({ isOpen, onClose }: SettingsScreenProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Google Calendar 연동 상태 확인
  useEffect(() => {
    if (isOpen) {
      checkCalendarStatus();
    }
  }, [isOpen]);

  const checkCalendarStatus = async () => {
    try {
      const response = await apiClient.getCalendarStatus();
      console.log("[Google Calendar] 상태 확인 응답:", response.data);
      if (response.data) {
        const enabled = response.data.enabled || false;
        const connected = response.data.connected || false;
        console.log("[Google Calendar] 상태:", { enabled, connected, token_exists: response.data.token_exists, token_valid: response.data.token_valid });
        setGoogleCalendarEnabled(enabled);
        setGoogleCalendarConnected(connected);
      }
    } catch (error) {
      console.error("Google Calendar 상태 확인 실패:", error);
      // 에러 발생 시에도 상태를 false로 설정
      setGoogleCalendarEnabled(false);
      setGoogleCalendarConnected(false);
    }
  };

  if (!isOpen) return null;

  const handleNotificationToggle = () => {
    const newState = !notificationEnabled;
    setNotificationEnabled(newState);
    toast.success(newState ? "알림이 활성화되었습니다." : "알림이 비활성화되었습니다.");
  };

  const handleGoogleCalendarToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (!googleCalendarConnected) {
        // Google OAuth 시작
        try {
          const response = await apiClient.getGoogleCalendarAuthUrl();
          const authUrl = response.data.auth_url;

          // state를 localStorage에 저장 (OAuth 콜백에서 확인용)
          const state = new URL(authUrl).searchParams.get('state');
          if (state) {
            localStorage.setItem('google_calendar_oauth_state', state);
          }

          // Google OAuth 페이지로 리다이렉트
          window.location.href = authUrl;
        } catch (error: any) {
          console.error("Google Calendar OAuth URL 가져오기 실패:", error);
          toast.error("Google Calendar 연동 시작에 실패했습니다.");
          setIsLoading(false);
        }
      } else {
        // 연동 해제 또는 활성화/비활성화 토글
        if (googleCalendarEnabled) {
          await apiClient.disableCalendarSync();
          setGoogleCalendarEnabled(false);
          toast.success("Google Calendar 연동이 비활성화되었습니다.");
          window.location.reload(); // Google Calendar 이벤트 제거를 위해 새로고침
        } else {
          await apiClient.enableCalendarSync();
          setGoogleCalendarEnabled(true);
          toast.success("Google Calendar 연동이 활성화되었습니다.");
          window.location.reload(); // 캘린더 데이터 새로고침
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Google Calendar 연동 실패:", error);
      toast.error("Google Calendar 연동에 실패했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col max-w-[375px] mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-[#F3F4F6]">
        <button onClick={onClose} className="p-1">
          <ArrowLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="flex-1 font-semibold text-[#1F2937]">설정</h1>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto bg-[#FAFAFA]">
        {/* Notification Settings */}
        <div className="bg-white p-6 mb-4">
          <h3 className="font-medium text-[#1F2937] mb-4">알림 설정</h3>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium text-[#1F2937]">푸시 알림</div>
              <div className="text-sm text-[#6B7280] mt-1">
                일정 알림을 받아보세요
              </div>
            </div>
            <button
              onClick={handleNotificationToggle}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${notificationEnabled ? "bg-[#FF9B82]" : "bg-[#D1D5DB]"
                }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${notificationEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Google Calendar Integration */}
        <div className="bg-white p-6">
          <h3 className="font-medium text-[#1F2937] mb-4">캘린더 연동</h3>
          <div className="flex items-center justify-between py-3">
            <div className="flex-1">
              <div className="font-medium text-[#1F2937]">Google Calendar</div>
              <div className="text-sm text-[#6B7280] mt-1">
                {googleCalendarConnected
                  ? "Google Calendar 자동 동기화"
                  : "구글 캘린더와 동기화하기"}
              </div>
            </div>
            <button
              onClick={handleGoogleCalendarToggle}
              disabled={isLoading}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${googleCalendarEnabled ? "bg-[#FF9B82]" : "bg-[#D1D5DB]"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${googleCalendarEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
              />
            </button>
          </div>
          {!googleCalendarConnected && (
            <div className="text-xs text-[#6B7280] bg-[#F3F4F6] p-2 rounded mt-2">
              Google 로그인 후 사용할 수 있습니다.
            </div>
          )}
          {googleCalendarConnected && (
            <button
              onClick={async () => {
                try {
                  const response = await apiClient.debugListCalendars();
                  console.log("[Google Calendar] 캘린더 목록:", response.data);
                  toast.success("캘린더 목록을 콘솔에서 확인하세요");
                } catch (error) {
                  console.error("[Google Calendar] 캘린더 목록 가져오기 실패:", error);
                  toast.error("캘린더 목록 가져오기 실패");
                }
              }}
              className="mt-2 text-xs text-[#FF9B82] hover:underline"
            >
              캘린더 목록 확인 (디버그)
            </button>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white p-6 mt-4">
          <h3 className="font-medium text-[#1F2937] mb-4">앱 정보</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
              <span className="text-[#6B7280]">버전</span>
              <span className="text-[#1F2937]">1.0.0</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
              <span className="text-[#6B7280]">최근 업데이트</span>
              <span className="text-[#1F2937]">2024.01.05</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
