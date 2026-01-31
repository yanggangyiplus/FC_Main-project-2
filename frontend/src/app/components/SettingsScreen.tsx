import { ArrowLeft, X, Mail, Bell, BellOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  initializeFirebase,
  setupForegroundMessageListener
} from "@/services/firebaseMessaging";

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCalendar?: (force?: boolean) => Promise<void>; // 동기화 새로고침 함수
  onRefreshTodos?: () => Promise<void>; // 일정 목록 새로고침 함수
}

export function SettingsScreen({ isOpen, onClose, onRefreshCalendar, onRefreshTodos }: SettingsScreenProps) {
  const [notificationPreference, setNotificationPreference] = useState<'email' | 'push' | 'both' | 'none'>('email');
  const [pushPermissionStatus, setPushPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [hasFcmToken, setHasFcmToken] = useState(false);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarImportEnabled, setGoogleCalendarImportEnabled] = useState(false);
  const [googleCalendarExportEnabled, setGoogleCalendarExportEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 알림 설정 및 Google Calendar 연동 상태 확인
  useEffect(() => {
    if (isOpen) {
      checkCalendarStatus();
      checkNotificationPreference();
      checkPushPermission();
    }
  }, [isOpen]);

  // Firebase 초기화
  useEffect(() => {
    initializeFirebase();
  }, []);

  // 알림 설정 확인
  const checkNotificationPreference = async () => {
    try {
      const response = await apiClient.getNotificationPreference();
      if (response.data) {
        setNotificationPreference(response.data.preference || 'email');
        setHasFcmToken(response.data.has_fcm_token || false);
      }
    } catch (error) {
      console.error("알림 설정 확인 실패:", error);
    }
  };

  // 푸시 권한 상태 확인
  const checkPushPermission = () => {
    const status = getNotificationPermissionStatus();
    setPushPermissionStatus(status);
  };

  // 알림 설정 변경
  const handleNotificationPreferenceChange = async (preference: 'email' | 'push' | 'both' | 'none') => {
    if (isNotificationLoading) return;
    setIsNotificationLoading(true);

    try {
      // push 또는 both를 선택하면 FCM 권한 요청
      if ((preference === 'push' || preference === 'both') && pushPermissionStatus !== 'granted') {
        const token = await requestNotificationPermission();
        if (!token) {
          toast.error("푸시 알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
          setIsNotificationLoading(false);
          return;
        }
        setPushPermissionStatus('granted');
        setHasFcmToken(true);
      }

      // 백엔드에 설정 저장
      await apiClient.updateNotificationPreference(preference);
      setNotificationPreference(preference);

      const messages: Record<string, string> = {
        'email': '이메일 알림으로 설정되었습니다.',
        'push': '푸시 알림으로 설정되었습니다.',
        'both': '이메일 + 푸시 알림으로 설정되었습니다.',
        'none': '알림이 비활성화되었습니다.'
      };
      toast.success(messages[preference]);
    } catch (error: any) {
      console.error("알림 설정 변경 실패:", error);
      toast.error("알림 설정 변경에 실패했습니다.");
    } finally {
      setIsNotificationLoading(false);
    }
  };

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
          <p className="text-sm text-[#6B7280] mb-4">
            일정 알림을 받을 방법을 선택하세요
          </p>

          <div className="space-y-2">
            {/* 이메일 알림 */}
            <button
              onClick={() => handleNotificationPreferenceChange('email')}
              disabled={isNotificationLoading}
              className={`w-full flex items-center p-3 rounded-lg border-2 transition-all ${
                notificationPreference === 'email'
                  ? 'border-[#FF9B82] bg-[#FFF5F3]'
                  : 'border-[#E5E7EB] hover:border-[#FF9B82]/50'
              } ${isNotificationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Mail size={20} className={notificationPreference === 'email' ? 'text-[#FF9B82]' : 'text-[#6B7280]'} />
              <div className="ml-3 text-left flex-1">
                <div className="font-medium text-[#1F2937]">이메일만</div>
                <div className="text-xs text-[#6B7280]">등록된 이메일로 알림</div>
              </div>
              {notificationPreference === 'email' && (
                <div className="w-5 h-5 rounded-full bg-[#FF9B82] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>

            {/* 푸시만 - 숨김 (미완성)
            <button
              onClick={() => handleNotificationPreferenceChange('push')}
              disabled={isNotificationLoading || pushPermissionStatus === 'denied'}
              className={`w-full flex items-center p-3 rounded-lg border-2 transition-all ${
                notificationPreference === 'push'
                  ? 'border-[#FF9B82] bg-[#FFF5F3]'
                  : 'border-[#E5E7EB] hover:border-[#FF9B82]/50'
              } ${isNotificationLoading || pushPermissionStatus === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Bell size={20} className={notificationPreference === 'push' ? 'text-[#FF9B82]' : 'text-[#6B7280]'} />
              <div className="ml-3 text-left flex-1">
                <div className="font-medium text-[#1F2937]">푸시만</div>
                <div className="text-xs text-[#6B7280]">
                  {pushPermissionStatus === 'denied'
                    ? '브라우저에서 알림이 차단됨'
                    : '브라우저 푸시 알림'}
                </div>
              </div>
              {notificationPreference === 'push' && (
                <div className="w-5 h-5 rounded-full bg-[#FF9B82] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
            */}

            {/* 이메일 + 푸시 - 숨김 (미완성)
            <button
              onClick={() => handleNotificationPreferenceChange('both')}
              disabled={isNotificationLoading || pushPermissionStatus === 'denied'}
              className={`w-full flex items-center p-3 rounded-lg border-2 transition-all ${
                notificationPreference === 'both'
                  ? 'border-[#FF9B82] bg-[#FFF5F3]'
                  : 'border-[#E5E7EB] hover:border-[#FF9B82]/50'
              } ${isNotificationLoading || pushPermissionStatus === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="relative">
                <Mail size={16} className={notificationPreference === 'both' ? 'text-[#FF9B82]' : 'text-[#6B7280]'} />
                <Bell size={14} className={`absolute -bottom-1 -right-1 ${notificationPreference === 'both' ? 'text-[#FF9B82]' : 'text-[#6B7280]'}`} />
              </div>
              <div className="ml-3 text-left flex-1">
                <div className="font-medium text-[#1F2937]">이메일 + 푸시</div>
                <div className="text-xs text-[#6B7280]">모든 알림 방법 사용</div>
              </div>
              {notificationPreference === 'both' && (
                <div className="w-5 h-5 rounded-full bg-[#FF9B82] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
            */}

            {/* 알림 끄기 */}
            <button
              onClick={() => handleNotificationPreferenceChange('none')}
              disabled={isNotificationLoading}
              className={`w-full flex items-center p-3 rounded-lg border-2 transition-all ${
                notificationPreference === 'none'
                  ? 'border-[#FF9B82] bg-[#FFF5F3]'
                  : 'border-[#E5E7EB] hover:border-[#FF9B82]/50'
              } ${isNotificationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BellOff size={20} className={notificationPreference === 'none' ? 'text-[#FF9B82]' : 'text-[#6B7280]'} />
              <div className="ml-3 text-left flex-1">
                <div className="font-medium text-[#1F2937]">알림 끄기</div>
                <div className="text-xs text-[#6B7280]">알림을 받지 않음</div>
              </div>
              {notificationPreference === 'none' && (
                <div className="w-5 h-5 rounded-full bg-[#FF9B82] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          </div>

          {/* 푸시 권한 안내 - 숨김 (미완성)
          {pushPermissionStatus === 'denied' && (
            <div className="mt-3 p-3 bg-[#FEF2F2] rounded-lg">
              <p className="text-xs text-[#DC2626]">
                브라우저에서 알림이 차단되어 있습니다. 푸시 알림을 사용하려면 브라우저 설정에서 알림을 허용해주세요.
              </p>
            </div>
          )}

          {pushPermissionStatus === 'unsupported' && (
            <div className="mt-3 p-3 bg-[#FEF3C7] rounded-lg">
              <p className="text-xs text-[#92400E]">
                이 브라우저는 푸시 알림을 지원하지 않습니다.
              </p>
            </div>
          )}
          */}
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
                        // 토글을 끌 때: Google Calendar에서 가져온 일정들이 삭제됨
                        const deletedCount = response.data?.deleted_count || 0;
                        if (deletedCount > 0) {
                          toast.success(`Google Calendar 가져오기가 비활성화되었습니다. ${deletedCount}개 Google Calendar 일정이 제거되었습니다.`);
                        } else {
                          toast.success("Google Calendar 가져오기가 비활성화되었습니다. Google Calendar 일정이 제거됩니다.");
                        }
                        // 일정 목록 새로고침 (삭제된 일정 반영)
                        if (onRefreshTodos) {
                          try {
                            await onRefreshTodos();
                          } catch (error) {
                            console.error("일정 목록 새로고침 실패:", error);
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
                        // 일정 목록 새로고침 (새로 가져온 일정 반영)
                        if (onRefreshTodos) {
                          try {
                            await onRefreshTodos();
                          } catch (error) {
                            console.error("일정 목록 새로고침 실패:", error);
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

              {/* Google Calendar 내보내기 토글 - 숨김 (미완성)
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
                      console.log("[토글] Always Plan 일정 내보내기 토글 변경 시작...");
                      const response = await apiClient.toggleCalendarExport();
                      console.log("[토글] 응답:", response.data);

                      const newState = response.data?.export_enabled !== undefined
                        ? response.data.export_enabled
                        : response.data?.success
                          ? (response.data.export_enabled ?? false)
                          : false;

                      console.log("[토글] 새 상태:", newState, "현재 상태:", googleCalendarExportEnabled);

                      // 상태 업데이트
                      setGoogleCalendarExportEnabled(newState);

                      // 상태 확인을 위해 다시 로드
                      await checkCalendarStatus();

                      if (!newState) {
                        // 토글을 끌 때: bulk_synced가 아닌 일정들의 Google Calendar 이벤트가 삭제됨
                        const deletedCount = response.data?.deleted_count || 0;
                        if (deletedCount > 0) {
                          toast.success(`Always Plan 일정 내보내기가 비활성화되었습니다. ${deletedCount}개 이벤트가 Google Calendar에서 삭제되었습니다. (동기화 후 저장한 일정은 유지됩니다)`);
                        } else {
                          toast.success("Always Plan 일정 내보내기가 비활성화되었습니다. (동기화 후 저장한 일정은 유지됩니다)");
                        }

                        // 일정 목록 새로고침 (동기화 해제 반영)
                        if (onRefreshTodos) {
                          await onRefreshTodos();
                        }
                      } else {
                        // 토글을 켤 때: 바로 동기화 실행
                        const syncedCount = response.data?.synced_count || 0;
                        const matchedCount = response.data?.matched_count || 0;

                        // 일정 목록 새로고침 (동기화된 일정 반영)
                        if (onRefreshTodos) {
                          await onRefreshTodos();
                        }

                        if (syncedCount > 0 || matchedCount > 0) {
                          toast.success(`Always Plan 일정 내보내기가 활성화되었습니다. ${syncedCount}개 일정 동기화, ${matchedCount}개 일정 매칭됨`);
                        } else {
                          toast.success("Always Plan 일정 내보내기가 활성화되었습니다. (이미 모든 일정이 동기화되어 있음)");
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
              */}

              {/* 동기화 새로고침 버튼 */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    if (isSyncLoading) return;
                    setIsSyncLoading(true);
                    try {
                      toast.info("Google Calendar 동기화 중...");
                      // 동기화 API 직접 호출
                      const response = await apiClient.syncAllTodosToGoogleCalendar();
                      
                      if (response.data) {
                        const importedCount = response.data.imported_count || 0;
                        const syncedCount = response.data.synced_count || 0;
                        const matchedCount = response.data.matched_count || 0;
                        
                        // 일정 목록 새로고침
                        if (onRefreshTodos) {
                          await onRefreshTodos();
                        }
                        
                        // 성공 메시지
                        if (importedCount > 0 || syncedCount > 0 || matchedCount > 0) {
                          toast.success(`동기화 완료! ${importedCount > 0 ? `가져옴: ${importedCount}개` : ''} ${syncedCount > 0 ? `동기화: ${syncedCount}개` : ''} ${matchedCount > 0 ? `매칭: ${matchedCount}개` : ''}`);
                        } else {
                          toast.success("동기화가 완료되었습니다.");
                        }
                      } else {
                        toast.success("동기화가 완료되었습니다.");
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
              <span className="text-[#1F2937]">2026.01.15</span>
            </div>
          </div>
        </div>

        {/* 회원 탈퇴 */}
        <div className="bg-white p-6 mt-4">
          <h3 className="font-medium text-[#1F2937] mb-4">계정</h3>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 text-[#DC2626] text-sm font-medium hover:bg-[#FEF2F2] rounded-lg transition-colors"
          >
            회원 탈퇴
          </button>
          <p className="text-xs text-[#9CA3AF] mt-2 text-center">
            탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
          </p>
        </div>
      </div>

      {/* 회원 탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">회원 탈퇴</h3>
            <p className="text-sm text-[#6B7280] mb-6">
              정말 탈퇴하시겠습니까?<br />
              모든 일정, 메모, 설정 등 모든 데이터가 영구적으로 삭제됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-[#F3F4F6] text-[#1F2937] rounded-lg font-medium hover:bg-[#E5E7EB] transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await apiClient.deleteAccount();
                    toast.success("계정이 삭제되었습니다.");
                    // 로컬 스토리지 정리 및 로그인 페이지로 이동
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/';
                  } catch (error: any) {
                    console.error("회원 탈퇴 실패:", error);
                    toast.error("회원 탈퇴에 실패했습니다. 다시 시도해주세요.");
                  } finally {
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 py-3 bg-[#DC2626] text-white rounded-lg font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
