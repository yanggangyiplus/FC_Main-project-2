import { ArrowLeft, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCalendar?: (force?: boolean) => Promise<void>; // 동기화 새로고침 함수
}

export function SettingsScreen({ isOpen, onClose, onRefreshCalendar }: SettingsScreenProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarImportEnabled, setGoogleCalendarImportEnabled] = useState(false);
  const [googleCalendarExportEnabled, setGoogleCalendarExportEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false); // 동기화 후 저장 버튼 전용 로딩 상태

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
        const importEnabled = response.data.import_enabled || false;
        const exportEnabled = response.data.export_enabled || false;
        console.log("[Google Calendar] 상태:", { enabled, connected, importEnabled, exportEnabled, token_exists: response.data.token_exists, token_valid: response.data.token_valid });
        setGoogleCalendarEnabled(enabled);
        setGoogleCalendarConnected(connected);
        setGoogleCalendarImportEnabled(importEnabled);
        setGoogleCalendarExportEnabled(exportEnabled);
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
          const response = await apiClient.disableCalendarSync();
          // 상태를 다시 확인하여 최신 값 가져오기 (가져오기와 내보내기도 자동으로 OFF됨)
          await checkCalendarStatus();
          const deletedCount = response.data?.deleted_count || 0;
          const preservedCount = response.data?.preserved_count || 0;

          // 동기화 해제 성공 메시지
          toast.success("동기화가 해제되었습니다.");
          // 상태만 업데이트하고 설정 화면에 머물기
        } else {
          await apiClient.enableCalendarSync();
          // 상태를 다시 확인하여 최신 값 가져오기
          await checkCalendarStatus();
          toast.success("Google Calendar 연동이 활성화되었습니다. 가져오기와 내보내기를 원하시면 각각 활성화해주세요.");
          // 상태만 업데이트하고 설정 화면에 머물기
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
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6]">
        <h2 className="text-lg font-bold text-[#1F2937]">설정</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <X size={20} className="text-[#6B7280]" />
        </button>
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
          
          {/* Google Calendar 연동이 활성화되지 않았을 때만 연동 토글 표시 */}
          {(!googleCalendarConnected || !googleCalendarEnabled) && (
            <>
              {/* Google Calendar 연동 토글 */}
              <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6]">
                <div className="flex-1">
                  <div className="font-medium text-[#1F2937]">Google Calendar</div>
                  <div className="text-sm text-[#6B7280] mt-1">
                    {googleCalendarConnected
                      ? "Google Calendar 동기화"
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
            </>
          )}
          
          {/* Google Calendar 연동이 활성화되면 바로 세부 옵션만 표시 */}
          {googleCalendarConnected && googleCalendarEnabled && (
            <>
              {/* Google Calendar 가져오기 토글 */}
              <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6]">
                <div className="flex-1">
                  <div className="font-medium text-[#1F2937]">Google Calendar 일정 가져오기</div>
                  <div className="text-sm text-[#6B7280] mt-1">
                    Google Calendar의 일정을 앱에 표시
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (isLoading) return;
                    setIsLoading(true);
                    try {
                      const response = await apiClient.toggleCalendarImport();
                      const newState = response.data?.import_enabled || false;
                      setGoogleCalendarImportEnabled(newState);

                      if (!newState) {
                        // 토글을 끌 때: Google Calendar 이벤트가 제거됨
                        toast.success("Google Calendar 가져오기가 비활성화되었습니다. Google Calendar 일정이 제거됩니다.");
                        // 토글을 끌 때: 바로 동기화 상태 업데이트 (Google Calendar 이벤트 제거)
                        if (onRefreshCalendar) {
                          try {
                            await onRefreshCalendar(true);
                          } catch (syncError) {
                            console.error("동기화 상태 업데이트 실패:", syncError);
                          }
                        }
                      } else {
                        toast.success("Google Calendar 가져오기가 활성화되었습니다.");
                        // 토글을 켤 때: 바로 동기화 실행
                        if (onRefreshCalendar) {
                          try {
                            await onRefreshCalendar(true);
                          } catch (syncError) {
                            console.error("동기화 실행 실패:", syncError);
                          }
                        }
                      }
                    } catch (error: any) {
                      console.error("Google Calendar 가져오기 토글 실패:", error);
                      toast.error("토글 변경에 실패했습니다.");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${googleCalendarImportEnabled ? "bg-[#FF9B82]" : "bg-[#D1D5DB]"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${googleCalendarImportEnabled ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Google Calendar 내보내기 토글 */}
              <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6]">
                <div className="flex-1">
                  <div className="font-medium text-[#1F2937]">Always Plan 일정 내보내기</div>
                  <div className="text-sm text-[#6B7280] mt-1">
                    앱의 일정을 Google Calendar에 표시
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (isLoading) return;
                    setIsLoading(true);
                    try {
                      const response = await apiClient.toggleCalendarExport();
                      const newState = response.data?.export_enabled || false;
                      setGoogleCalendarExportEnabled(newState);

                      if (!newState) {
                        // 토글을 끌 때: bulk_synced가 아닌 일정들의 Google Calendar 이벤트가 삭제됨
                        const deletedCount = response.data?.deleted_count || 0;
                        if (deletedCount > 0) {
                          toast.success(`Always Plan 일정 내보내기가 비활성화되었습니다. ${deletedCount}개 이벤트가 Google Calendar에서 삭제되었습니다. (동기화 후 저장한 일정은 유지됩니다)`);
                        } else {
                          toast.success("Always Plan 일정 내보내기가 비활성화되었습니다. (동기화 후 저장한 일정은 유지됩니다)");
                        }
                      } else {
                        // 토글을 켤 때: 바로 동기화 실행
                        const syncedCount = response.data?.synced_count || 0;
                        const matchedCount = response.data?.matched_count || 0;
                        if (syncedCount > 0 || matchedCount > 0) {
                          toast.success(`Always Plan 일정 내보내기가 활성화되었습니다. ${syncedCount}개 일정 동기화, ${matchedCount}개 일정 매칭됨`);
                        } else {
                          toast.success("Always Plan 일정 내보내기가 활성화되었습니다.");
                        }
                      }
                    } catch (error: any) {
                      console.error("Google Calendar 내보내기 토글 실패:", error);
                      toast.error("토글 변경에 실패했습니다.");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${googleCalendarExportEnabled ? "bg-[#FF9B82]" : "bg-[#D1D5DB]"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${googleCalendarExportEnabled ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* 동기화 새로고침 버튼 */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    if (isSyncLoading) return;
                    setIsSyncLoading(true);
                    try {
                      toast.info("Google Calendar 동기화 중...");
                      if (onRefreshCalendar) {
                        await onRefreshCalendar(true);
                        toast.success("동기화가 완료되었습니다.");
                      } else {
                        toast.error("동기화 함수를 사용할 수 없습니다.");
                      }
                    } catch (error: any) {
                      console.error("[Google Calendar] 동기화 실패:", error);
                      toast.error(`동기화 실패: ${error.response?.data?.detail || error.message}`);
                    } finally {
                      setIsSyncLoading(false);
                    }
                  }}
                  disabled={isSyncLoading}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isSyncLoading
                    ? "bg-[#D1D5DB] text-[#9CA3AF] cursor-not-allowed"
                    : "bg-[#FF9B82] text-white hover:bg-[#FF8A6D]"
                    }`}
                >
                  {isSyncLoading ? "동기화 중..." : "동기화 새로고침"}
                </button>
                <p className="text-xs text-[#6B7280] mt-2">
                  Google Calendar에서 최신 일정을 가져옵니다.
                </p>
              </div>
            </>
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
