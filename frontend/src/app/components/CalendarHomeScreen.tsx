import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  Pencil,
  Check,
  Edit2,
  User,
  Settings,
  Users,
  HelpCircle,
  LogOut,
  ChevronRight,
  Mic,
  Camera,
  FileText,
  X,
  Clock,
  Tag,
  Calendar,
  Repeat,
  Trash2,
  MapPin,
} from "lucide-react";
import { MemberAddSheet } from "./MemberAddSheet";
import { WorkContactAddSheet } from "./WorkContactAddSheet";
import { CommunityScreen } from "./CommunityScreen";
import { MyPageScreen } from "./MyPageScreen";
import { SettingsScreen } from "./SettingsScreen";
import { NotificationPanel } from "./NotificationPanel";
import { InputMethodModal } from "./InputMethodModal";
import { AddTodoModal, TodoFormData } from "./AddTodoModal";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { DayCalendar } from "./DayCalendar";
import { RoutineView } from "./RoutineView";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import { formatDuration } from "@/utils/formatDuration";

export function CalendarHomeScreen() {
  const [showMemberAddSheet, setShowMemberAddSheet] = useState(false);
  const [showWorkContactAddSheet, setShowWorkContactAddSheet] = useState(false);
  const [showCommunityScreen, setShowCommunityScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"todo" | "calendar" | "routine">("todo");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMyPageScreen, setShowMyPageScreen] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [userEmail, setUserEmail] = useState("always-plan@email.com");
  const [userName, setUserName] = useState("나");
  const [selectedEmoji, setSelectedEmoji] = useState("🐼");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Family members for user selection
  interface FamilyMember {
    id: string;
    name: string;
    emoji: string;
    color: string;
    phone?: string;
    memo?: string;
  }

  // 가족 구성원 초기값은 빈 배열로 시작 (API에서 로드)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // localStorage에서 선택된 구성원 불러오기
  const loadSelectedMembers = (): string[] => {
    try {
      const saved = localStorage.getItem('selectedMembers');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["me"];
      }
    } catch (error) {
      console.error("선택된 구성원 불러오기 실패:", error);
    }
    return ["me"];
  };

  const [selectedMembers, setSelectedMembers] = useState<string[]>(loadSelectedMembers());

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) => {
      const newSelection = prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];

      // localStorage에 저장
      try {
        localStorage.setItem('selectedMembers', JSON.stringify(newSelection));
      } catch (error) {
        console.error("선택된 구성원 저장 실패:", error);
      }

      return newSelection;
    });
  };

  // Draggable FAB state - 기본값을 우측 하단으로 설정 (우측에서 왼쪽으로 이동 가능)
  const [fabPosition, setFabPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [showInputMethodModal, setShowInputMethodModal] = useState(false);
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [selectedTodoForDetail, setSelectedTodoForDetail] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  // 체크리스트 항목 상태 관리 (id별로 completed 상태 저장)
  const [checklistItemStates, setChecklistItemStates] = useState<Record<string, Record<string, boolean>>>({});
  // 검색 기능
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  const handleFabMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setHasMoved(false);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - fabPosition.x,
      y: e.clientY - fabPosition.y,
    });
  };

  const handleFabTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setHasMoved(false);
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - fabPosition.x,
      y: touch.clientY - fabPosition.y,
    });
  };

  const handleFabMouseUp = () => {
    if (isDragging && !hasMoved) {
      setShowInputMethodModal(true);
    }
    setIsDragging(false);
  };

  // Add event listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setHasMoved(true);
        setFabPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        setHasMoved(true);
        const touch = e.touches[0];
        setFabPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging && !hasMoved) {
        setShowInputMethodModal(true);
      }
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      if (isDragging && !hasMoved) {
        setShowInputMethodModal(true);
      }
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, hasMoved, dragStart]);

  // Google Calendar OAuth 콜백 처리
  useEffect(() => {
    const handleGoogleCalendarCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const scope = urlParams.get('scope');

      // Google Calendar OAuth 콜백인지 확인 (scope에 calendar가 포함되어 있거나 저장된 state가 있는 경우)
      const storedState = localStorage.getItem('google_calendar_oauth_state');
      const isCalendarCallback = code && state && (
        (scope && scope.includes('calendar')) ||
        storedState === state
      );

      if (isCalendarCallback) {
        try {
          if (storedState && storedState !== state) {
            console.error('[Google Calendar] State 불일치');
            toast.error('Google Calendar 연동에 실패했습니다.');
            // URL 정리
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }

          console.log('[Google Calendar] OAuth 콜백 처리 시작...');

          // 백엔드로 콜백 처리 요청
          await apiClient.googleCalendarCallback(code, state);
          toast.success('Google Calendar 연동이 완료되었습니다.');

          // localStorage 정리
          localStorage.removeItem('google_calendar_oauth_state');

          // URL 정리
          window.history.replaceState({}, document.title, window.location.pathname);

          // 페이지 새로고침하여 캘린더 데이터 로드
          window.location.reload();
        } catch (error: any) {
          console.error('[Google Calendar] OAuth callback error:', error);
          toast.error('Google Calendar 연동에 실패했습니다.');
          // URL 정리
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('google_calendar_oauth_state');
        }
      }
    };

    handleGoogleCalendarCallback();
  }, []);

  // Google Calendar 동기화 상태 관리
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'disabled'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  // ref로 관리하여 함수 재생성 방지 (UI 표시는 state로)
  const isSyncInFlightRef = useRef(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const SYNC_COOLDOWN_MS = 30000; // 30초 쿨다운

  // Google Calendar 이벤트 가져오기 함수 (재사용 가능하도록 분리)
  const loadGoogleCalendarEvents = useCallback(async (force: boolean = false) => {
    // 쿨다운 체크
    const now = Date.now();
    if (!force && (isSyncInFlightRef.current || (now - lastSyncTimestampRef.current < SYNC_COOLDOWN_MS))) {
      const remainingSeconds = Math.ceil((SYNC_COOLDOWN_MS - (now - lastSyncTimestampRef.current)) / 1000);
      console.log(`[Google Calendar] 동기화 쿨다운 중... (${remainingSeconds}초 남음)`);
      return;
    }

    isSyncInFlightRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    lastSyncTimestampRef.current = now;

    try {
      const calendarStatusResponse = await apiClient.getCalendarStatus();
      const googleCalendarEnabled = calendarStatusResponse.data?.enabled || false;
      const googleCalendarConnected = calendarStatusResponse.data?.connected || false;
      const googleCalendarImportEnabled = calendarStatusResponse.data?.import_enabled || false;

      // 가져오기가 활성화되어 있고 연동이 되어 있을 때만 Google Calendar 이벤트 가져오기
      if (googleCalendarEnabled && googleCalendarConnected && googleCalendarImportEnabled) {
        console.log('[Google Calendar] 가져오기 활성화됨, 이벤트 가져오기 시작...');

        // 시간 범위 설정 (2주 전 ~ 6주 후)
        const now = new Date();
        const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2주 전
        const timeMax = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000); // 6주 후

        const timeMinISO = timeMin.toISOString();
        const timeMaxISO = timeMax.toISOString();

        console.log('[Google Calendar] 이벤트 요청:', { timeMin: timeMinISO, timeMax: timeMaxISO });

        try {
          const eventsResponse = await apiClient.getGoogleCalendarEvents(timeMinISO, timeMaxISO);
          console.log('[Google Calendar] 이벤트 응답:', eventsResponse.data);

          if (eventsResponse.data?.success && eventsResponse.data?.events) {
            const googleEvents = eventsResponse.data.events;
            console.log(`[Google Calendar] ${googleEvents.length}개 이벤트 받음`);

            // Google Calendar 이벤트를 Todo 형식으로 변환
            const formattedGoogleEvents = googleEvents.map((event: any) => {
              const dateStr = event.date || new Date().toISOString().split('T')[0];
              const endDateStr = event.end_date || undefined;
              const isAllDay = event.all_day || false;

              // duration 계산 (하루종일이 아닌 경우만)
              let duration = 60;
              if (!isAllDay && event.start_time && event.end_time) {
                const [startHours, startMinutes] = event.start_time.split(':').map(Number);
                const [endHours, endMinutes] = event.end_time.split(':').map(Number);
                const startTotal = startHours * 60 + startMinutes;
                const endTotal = endHours * 60 + endMinutes;
                duration = endTotal - startTotal;
              } else if (isAllDay && endDateStr) {
                // 하루종일이고 여러 날짜에 걸친 경우, 날짜 차이로 duration 계산
                const startDate = new Date(dateStr);
                const endDate = new Date(endDateStr);
                const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                duration = daysDiff * 24 * 60; // 일수를 분으로 변환
              }

              // notification_reminders 파싱
              let notificationReminders: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }> = [];
              if (event.notification_reminders) {
                try {
                  const parsed = Array.isArray(event.notification_reminders)
                    ? event.notification_reminders
                    : (typeof event.notification_reminders === 'string'
                      ? JSON.parse(event.notification_reminders)
                      : []);
                  if (Array.isArray(parsed)) {
                    notificationReminders = parsed.map((r: any) => ({
                      value: Number(r.value) || 30,
                      unit: r.unit || 'minutes'
                    }));
                  }
                } catch (e) {
                  console.error('Failed to parse notification_reminders:', e);
                }
              }

              // repeat_pattern 파싱
              let repeatPattern: any = undefined;
              if (event.repeat_pattern) {
                try {
                  repeatPattern = typeof event.repeat_pattern === 'string'
                    ? JSON.parse(event.repeat_pattern)
                    : event.repeat_pattern;
                } catch (e) {
                  console.error('Failed to parse repeat_pattern:', e);
                }
              }

              // repeat_end_date 파싱
              let repeatEndDate: string | undefined = undefined;
              if (event.repeat_end_date) {
                if (typeof event.repeat_end_date === 'string') {
                  repeatEndDate = event.repeat_end_date;
                } else if (event.repeat_end_date instanceof Date) {
                  const year = event.repeat_end_date.getFullYear();
                  const month = event.repeat_end_date.getMonth() + 1;
                  const day = event.repeat_end_date.getDate();
                  repeatEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
              }

              return {
                id: event.google_calendar_event_id || `google_${event.id}`,
                title: event.title || '제목 없음',
                time: isAllDay ? '' : (event.start_time || "09:00"), // 하루종일이면 빈 문자열
                duration: duration > 0 ? duration : 60,
                completed: false,
                category: "구글",
                date: dateStr,
                endDate: endDateStr, // 종료 날짜 추가
                startTime: isAllDay ? undefined : event.start_time, // 하루종일이면 undefined
                endTime: isAllDay ? undefined : event.end_time, // 하루종일이면 undefined
                isAllDay: isAllDay,
                memo: event.description || "",
                location: event.location || "",
                hasNotification: notificationReminders.length > 0,
                alarmTimes: [],
                notificationReminders: notificationReminders, // 알림 정보 추가
                repeatType: event.repeat_type || "none", // 반복 타입 추가
                repeatEndDate: repeatEndDate, // 반복 종료 날짜 추가
                repeatPattern: repeatPattern, // 반복 패턴 추가
                checklistItems: [],
                memberId: undefined,
                isRoutine: false,
                source: 'google_calendar' as const,
                googleCalendarEventId: event.id,
                sourceId: event.source_id, // Always Plan의 Todo ID (중복 제거용)
              };
            });

            // 기존 일정과 병합 (중복 제거)
            setTodos((prevTodos) => {
              // Always Plan 일정만 유지 (Google Calendar 이벤트는 새로 가져온 것으로 교체)
              // 단, bulkSynced=True인 Todo는 "동기화 후 저장"으로 영구 저장된 것이므로 항상 유지
              const alwaysPlanTodos = prevTodos.filter(t => {
                // bulkSynced=True인 Todo는 항상 유지
                if (t.bulkSynced === true) {
                  return true;
                }
                // source가 'always_plan'이거나 없는 경우만 유지
                return t.source === 'always_plan' || !t.source;
              });

              // 기존 일정 ID와 Google Calendar 이벤트 ID를 모두 체크
              const existingIds = new Set(alwaysPlanTodos.map(t => t.id));

              // Always Plan 일정 중 google_calendar_event_id가 있는 것들의 이벤트 ID 수집
              const alwaysPlanGoogleEventIds = new Set(
                alwaysPlanTodos
                  .filter(t => t.googleCalendarEventId)
                  .map(t => t.googleCalendarEventId!)
              );

              // 중복되지 않는 Google Calendar 이벤트만 추가
              // ID 기반 중복 제거 (제목+날짜+시간 기반은 제거 - 사용자 의도 반영)
              const newGoogleEvents = formattedGoogleEvents.filter(
                (event: any) => {
                  // 1. ID로 중복 체크 (가장 정확)
                  if (existingIds.has(event.id)) {
                    console.log(`[Google Calendar] 중복 제거 (ID): ${event.id}`);
                    return false;
                  }
                  // 2. Always Plan 일정과 이미 매칭된 Google Calendar 이벤트는 표시하지 않음
                  // (googleCalendarEventId로 매칭된 일정은 이미 동기화된 것으로 간주)
                  if (event.googleCalendarEventId && alwaysPlanGoogleEventIds.has(event.googleCalendarEventId)) {
                    console.log(`[Google Calendar] 중복 제거 (Always Plan과 매칭됨): ${event.googleCalendarEventId}`);
                    return false;
                  }
                  // 3. sourceId로 중복 체크 (extendedProperties 또는 description에서 추출)
                  if (event.sourceId) {
                    const existingTodoWithSourceId = alwaysPlanTodos.find(t => t.id === event.sourceId);
                    if (existingTodoWithSourceId) {
                      console.log(`[Google Calendar] 중복 제거 (sourceId 매칭): ${event.sourceId}`);
                      return false;
                    }
                  }
                  // 4. 제목+날짜+시간 기반 중복 제거는 제거 (사용자가 비슷한 일정을 만들 수 있도록)
                  return true;
                }
              );

              const matchedCount = alwaysPlanGoogleEventIds.size;
              console.log(`[Google Calendar] Always Plan 일정: ${alwaysPlanTodos.length}개 (${matchedCount}개가 Google Calendar와 매칭됨), 새 Google 이벤트: ${newGoogleEvents.length}개`);

              // Always Plan 일정과 새로 가져온 Google Calendar 이벤트 병합
              const mergedTodos = [...alwaysPlanTodos, ...newGoogleEvents];

              // 최종적으로 ID 기반 중복 제거만 수행 (제목+날짜+시간 기반은 제거)
              const finalUniqueTodos: any[] = [];
              const finalSeenIds = new Set<string>();

              for (const todo of mergedTodos) {
                // ID가 있으면 ID로, 없으면 생성
                const todoId = todo.id || `temp_${Date.now()}_${Math.random()}`;
                
                if (!finalSeenIds.has(todoId)) {
                  finalSeenIds.add(todoId);
                  finalUniqueTodos.push(todo);
                } else {
                  console.log(`[최종 중복 제거] ID: ${todoId} (${todo.title})`);
                }
              }

              console.log(`[최종] 중복 제거 전: ${mergedTodos.length}개, 제거 후: ${finalUniqueTodos.length}개`);

              return finalUniqueTodos;
            });

            // 동기화 성공
            setSyncStatus('success');
            setLastSyncTime(new Date());
            setSyncError(null);
          } else {
            console.warn('[Google Calendar] 이벤트가 없거나 실패:', eventsResponse.data);
            setSyncStatus('error');
            setSyncError('이벤트 데이터를 받지 못했습니다.');
          }
        } catch (error: any) {
          console.error('[Google Calendar] 이벤트 가져오기 실패:', error);
          console.error('[Google Calendar] 에러 상세:', error.response?.data || error.message);
          setSyncStatus('error');
          setSyncError(error.response?.data?.detail || error.message || '동기화에 실패했습니다.');
        }
      } else {
        console.log('[Google Calendar] 연동 비활성화됨 또는 연결 안됨');

        // Google Calendar 연동이 비활성화된 경우, Google Calendar 이벤트 제거
        // 단, bulkSynced=True인 Todo는 "동기화 후 저장"으로 영구 저장된 것이므로 유지
        setTodos((prevTodos) => {
          const filteredTodos = prevTodos.filter(
            (todo: any) => {
              // bulkSynced=True인 Todo는 항상 유지 (동기화 후 저장으로 영구 저장됨)
              if (todo.bulkSynced === true) {
                return true;
              }
              // source가 'google_calendar'이거나 googleCalendarEventId가 있지만 bulkSynced가 아닌 경우만 제거
              return todo.source !== 'google_calendar' && !todo.googleCalendarEventId;
            }
          );
          const removedCount = prevTodos.length - filteredTodos.length;
          if (removedCount > 0) {
            console.log(`[Google Calendar] ${removedCount}개 이벤트 제거됨 (연동 비활성화, bulkSynced=True인 일정은 유지)`);
          }
          return filteredTodos;
        });
      }
    } catch (error: any) {
      console.error('[Google Calendar] 상태 확인 실패:', error);
      setSyncStatus('error');
      setSyncError(error.response?.data?.detail || error.message || '상태 확인에 실패했습니다.');
    } finally {
      isSyncInFlightRef.current = false;
    }
  }, []); // 의존성 배열 비움 - ref 사용하므로 재생성 불필요

  useEffect(() => {
    const loadInitialData = async () => {
      // 사용자 정보 변수 (모든 try-catch 블록에서 사용 가능하도록 함수 최상단에 선언)
      let currentUserName = "나";
      let currentUserEmoji = "🐼";

      // 1. 사용자 정보 로드 (별도 try-catch로 분리)
      try {
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.data) {
          currentUserName = userResponse.data.name || "나";
          currentUserEmoji = userResponse.data.avatar_emoji || "🐼";
          setUserName(currentUserName);
          setUserEmail(userResponse.data.email || "always-plan@email.com");
          setSelectedEmoji(currentUserEmoji);
        }
      } catch (error) {
        console.error("사용자 정보 로드 실패:", error);
        // 에러가 발생해도 기본값 사용
      }

      // 2. 일정 로드 (Google Calendar 이벤트와 병합하기 전에 먼저 로드)
      let baseTodos: any[] = [];
      try {
        const todosResponse = await apiClient.getTodos();
        if (todosResponse.data && Array.isArray(todosResponse.data)) {
          const formattedTodos = todosResponse.data.map((todo: any) => {
            // duration 계산 (start_time과 end_time이 있는 경우)
            let duration = 60;
            if (todo.start_time && todo.end_time) {
              const [startHours, startMinutes] = todo.start_time.split(':').map(Number);
              const [endHours, endMinutes] = todo.end_time.split(':').map(Number);
              const startTotal = startHours * 60 + startMinutes;
              const endTotal = endHours * 60 + endMinutes;
              duration = endTotal - startTotal;
            }

            // notification_times 파싱 (구버전 호환)
            let alarmTimes: string[] = [];
            if (todo.notification_times) {
              try {
                alarmTimes = typeof todo.notification_times === 'string'
                  ? JSON.parse(todo.notification_times)
                  : todo.notification_times;
              } catch (e) {
                alarmTimes = [];
              }
            }

            // notification_reminders 파싱 (새로운 형식)
            let notificationReminders: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }> = [];
            if (todo.notification_reminders) {
              try {
                const parsed = typeof todo.notification_reminders === 'string'
                  ? JSON.parse(todo.notification_reminders)
                  : todo.notification_reminders;
                if (Array.isArray(parsed)) {
                  notificationReminders = parsed.map((r: any) => ({
                    value: Number(r.value) || 30,
                    unit: r.unit || 'minutes'
                  }));
                }
              } catch (e) {
                console.error('Failed to parse notification_reminders:', e);
                notificationReminders = [];
              }
            }

            // repeat_end_date 파싱
            let repeatEndDate: string | undefined = undefined;
            if (todo.repeat_end_date) {
              if (todo.repeat_end_date instanceof Date) {
                const year = todo.repeat_end_date.getFullYear();
                const month = todo.repeat_end_date.getMonth() + 1;
                const day = todo.repeat_end_date.getDate();
                repeatEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof todo.repeat_end_date === 'string') {
                repeatEndDate = todo.repeat_end_date;
              }
            }

            // repeat_pattern 파싱
            let repeatPattern: any = undefined;
            if (todo.repeat_pattern) {
              try {
                repeatPattern = typeof todo.repeat_pattern === 'string'
                  ? JSON.parse(todo.repeat_pattern)
                  : todo.repeat_pattern;
              } catch (e) {
                console.error('Failed to parse repeat_pattern:', e);
                repeatPattern = undefined;
              }
            }

            // family_member_ids 파싱
            let memberId: string | undefined;
            if (todo.family_member_ids) {
              try {
                const memberIds = typeof todo.family_member_ids === 'string'
                  ? JSON.parse(todo.family_member_ids)
                  : todo.family_member_ids;
                memberId = Array.isArray(memberIds) ? memberIds[0] : memberIds;
              } catch (e) {
                memberId = undefined;
              }
            }

            // 날짜 형식 변환 (Date 객체인 경우 문자열로 변환)
            let todoDate = todo.date;
            if (todoDate) {
              if (todoDate instanceof Date) {
                const year = todoDate.getFullYear();
                const month = todoDate.getMonth() + 1;
                const day = todoDate.getDate();
                todoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof todoDate === 'string') {
                // 이미 문자열인 경우 그대로 사용
                todoDate = todoDate;
              }
            }

            // 종료 날짜 형식 변환 (기간 일정인 경우)
            let todoEndDate: string | undefined = undefined;
            if (todo.end_date) {
              if (todo.end_date instanceof Date) {
                const year = todo.end_date.getFullYear();
                const month = todo.end_date.getMonth() + 1;
                const day = todo.end_date.getDate();
                todoEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof todo.end_date === 'string') {
                todoEndDate = todo.end_date;
              }
            }

            return {
              id: todo.id,
              title: todo.title,
              time: todo.start_time || "09:00",
              duration: duration > 0 ? duration : 60,
              completed: todo.status === 'completed',
              category: todo.category || "기타",
              date: todoDate,
              endDate: todoEndDate,  // 종료 날짜 추가
              startTime: todo.start_time,
              endTime: todo.end_time,
              isAllDay: todo.all_day || false,
              memo: todo.memo || todo.description || "",
              location: todo.location || "",
              hasNotification: todo.has_notification || false,
              alarmTimes: alarmTimes, // 구버전 호환
              notificationReminders: notificationReminders, // 새로운 알림 형식
              repeatType: todo.repeat_type || "none",
              repeatEndDate: repeatEndDate, // 반복 종료 날짜
              repeatPattern: repeatPattern, // 반복 패턴
              checklistItems: todo.checklist_items?.map((item: any) => item.text || item) || [],
              memberId: memberId,
              isRoutine: false,
              source: 'always_plan' as const, // 기존 일정임을 명시
              googleCalendarEventId: todo.google_calendar_event_id || undefined, // Google Calendar 이벤트 ID 추가
              bulkSynced: todo.bulk_synced || false, // 동기화 후 저장 여부 (새로고침 후에도 유지되도록)
              todoGroupId: todo.todo_group_id || undefined, // 일정 그룹 ID (여러 날짜에 걸친 일정 묶기)
            };
          });
          baseTodos = formattedTodos;

          // Always Plan 일정들 사이에서도 중복 제거 (제목+날짜+시간 기준)
          const uniqueTodos: any[] = [];
          const seenKeys = new Set<string>();

          for (const todo of formattedTodos) {
            const dateStr = todo.date || '';
            const timeStr = todo.startTime || (todo.isAllDay ? 'all_day' : '');
            const key = `${todo.title}_${dateStr}_${timeStr}`.toLowerCase().trim();

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              uniqueTodos.push(todo);
            } else {
              console.log(`[Always Plan] 중복 제거: ${todo.title} ${dateStr} ${timeStr}`);
            }
          }

          console.log(`[Always Plan] 중복 제거 전: ${formattedTodos.length}개, 제거 후: ${uniqueTodos.length}개`);

          // 기존 일정을 먼저 설정
          setTodos(uniqueTodos);
          console.log(`[Always Plan] 기존 일정 ${formattedTodos.length}개 로드 완료`);
        }
      } catch (error) {
        console.error("일정 로드 실패:", error);
      }

      // 3. 시간표 로드
      try {
        const routinesResponse = await apiClient.getRoutines();
        if (routinesResponse.data && Array.isArray(routinesResponse.data)) {
          const formattedRoutines = routinesResponse.data.map((routine: any) => ({
            id: routine.id,
            memberId: routine.member_id,
            name: routine.name,
            color: routine.color || "rgba(255, 155, 130, 0.6)",
            memo: routine.memo || "",
            category: routine.category || "기타",
            timeSlots: routine.time_slots || [],
          }));
          setRoutines(formattedRoutines);
        }
      } catch (error) {
        console.error("시간표 로드 실패:", error);
      }

      // 4. 가족 구성원 로드 (사용자 정보 로드 후 실행)
      try {
        const familyResponse = await apiClient.getFamilyMembers();
        if (familyResponse.data && Array.isArray(familyResponse.data)) {
          // 기본 색상 배열
          const defaultColors = [
            "#9B82FF", // 연한 보라색 (가족구성원 1)
            "#9ae3a9", // 연한 초록색
            "#FFD482", // 연한 노란색
            "#82D4FF", // 연한 파란색
            "#FF82D4", // 연한 분홍색
            "#FF9B82", // 연한 주황색 (나의 색상과 구분)
          ];

          const formattedMembers = familyResponse.data.map((member: any, index: number) => {
            // color_code가 있으면 사용, 없으면 기본 색상 배열에서 순차적으로 할당
            let memberColor = member.color_code || member.color;

            // 색상이 없거나 빈 문자열이면 기본 색상 배열에서 할당
            if (!memberColor || memberColor.trim() === '') {
              memberColor = defaultColors[index % defaultColors.length];
            }

            return {
              id: member.id,
              name: member.name,
              emoji: member.emoji || "🐼",
              color: memberColor,
              phone: member.phone_number,
              memo: member.notes,
            };
          });
          // "나" 항목을 항상 맨 앞에 추가 (현재 사용자 정보 기반)
          formattedMembers.unshift({
            id: "me", // 특별한 ID로 표시 (DB에 저장되지 않음)
            name: currentUserName,
            emoji: currentUserEmoji,
            color: "rgba(255, 155, 130, 0.6)",
            phone: undefined,
            memo: undefined,
          });
          setFamilyMembers(formattedMembers);
        }
      } catch (error) {
        console.error("가족 구성원 로드 실패:", error);
        // 에러가 발생해도 "나" 항목은 표시
        setFamilyMembers([{
          id: "me",
          name: currentUserName,
          emoji: currentUserEmoji,
          color: "rgba(255, 155, 130, 0.6)",
          phone: undefined,
          memo: undefined,
        }]);
      }

      // 5. Google Calendar 연동 상태 확인 및 이벤트 가져오기
      await loadGoogleCalendarEvents(true); // 초기 로드는 강제 실행
    };

    loadInitialData();
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // Google Calendar 초기 상태 확인 및 이벤트 로드 (마운트 시 한 번만)
  useEffect(() => {
    const initialCheck = async () => {
      console.log('[Google Calendar] 초기 상태 확인 실행...');
      try {
        const calendarStatusResponse = await apiClient.getCalendarStatus();
        const googleCalendarEnabled = calendarStatusResponse.data?.enabled || false;
        const googleCalendarConnected = calendarStatusResponse.data?.connected || false;
        const googleCalendarImportEnabled = calendarStatusResponse.data?.import_enabled || false;

        if (googleCalendarEnabled && googleCalendarConnected && googleCalendarImportEnabled) {
          console.log('[Google Calendar] 초기 이벤트 가져오기 시작...');
          await loadGoogleCalendarEvents(true); // 초기 로드는 강제 실행
        } else {
          console.log('[Google Calendar] 초기 로드 스킵 (토글 비활성화 또는 연결 안됨)');
          setSyncStatus('disabled');
        }
      } catch (error) {
        console.error('[Google Calendar] 초기 이벤트 가져오기 실패:', error);
      }
    };

    // 약간의 지연 후 실행 (초기 로드 완료 후)
    const timeoutId = setTimeout(initialCheck, 2000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadGoogleCalendarEvents]);

  // 화면이 포커스될 때 Google Calendar 이벤트 가져오기 (쿨다운 적용)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Google Calendar] 화면 포커스 감지...');
        try {
          const calendarStatusResponse = await apiClient.getCalendarStatus();
          const googleCalendarEnabled = calendarStatusResponse.data?.enabled || false;
          const googleCalendarConnected = calendarStatusResponse.data?.connected || false;
          const googleCalendarImportEnabled = calendarStatusResponse.data?.import_enabled || false;

          if (googleCalendarEnabled && googleCalendarConnected && googleCalendarImportEnabled) {
            console.log('[Google Calendar] 화면 포커스 시 이벤트 가져오기 시작... (쿨다운 적용)');
            await loadGoogleCalendarEvents(false); // 쿨다운 적용
          }
        } catch (error) {
          console.error('[Google Calendar] 화면 포커스 시 이벤트 가져오기 실패:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadGoogleCalendarEvents]);

  // Routine Item Interface
  interface RoutineItem {
    id: string;
    memberId: string;
    name: string;
    color: string;
    memo?: string;
    category?: string;
    timeSlots: {
      day: number;
      startTime: string;
      duration: number;
    }[];
    addToCalendar?: boolean; // 캘린더에 일정으로 추가 여부
    endDate?: string; // 스케줄 종료 날짜 (선택사항)
    hasEndDate?: boolean; // 종료 날짜 사용 여부
  }

  const [routines, setRoutines] = useState<RoutineItem[]>([]);

  const handleRoutineAdd = async (routine: RoutineItem) => {
    try {
      console.log("시간표 추가 시작:", routine);
      // API로 저장
      const routineData = {
        name: routine.name,
        member_id: routine.memberId,
        color: routine.color,
        category: routine.category || "기타",
        memo: routine.memo || "",
        time_slots: routine.timeSlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          duration: slot.duration
        })),
        add_to_calendar: routine.addToCalendar || false // 체크박스 상태 사용
      };

      console.log("시간표 데이터:", routineData);
      const response = await apiClient.createRoutine(routineData);
      console.log("시간표 저장 응답:", response);

      if (response && response.data) {
        const savedRoutine = {
          ...routine,
          id: response.data.id,
          addToCalendar: routine.addToCalendar || false, // 체크박스 상태 유지
        };
        setRoutines(prev => [...prev, savedRoutine]);
        toast.success("시간표가 저장되었습니다.");
      } else {
        console.error("응답 데이터 없음:", response);
        toast.error("시간표 저장에 실패했습니다. 응답 데이터가 없습니다.");
      }
    } catch (error: any) {
      console.error("시간표 저장 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      toast.error(`시간표 저장에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  // 시간표를 캘린더 일정으로 추가/제거하는 함수
  const handleToggleRoutineInCalendar = async (routine: RoutineItem, addToCalendar: boolean) => {
    if (addToCalendar) {
      // 시간표의 각 요일별로 일정 생성
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 오늘 날짜의 시작 (00:00:00)

      // 종료 날짜 설정 (hasEndDate가 true이고 endDate가 있으면 사용, 없으면 1년 후)
      let endDate: Date;
      if (routine.hasEndDate && routine.endDate) {
        endDate = new Date(routine.endDate);
        endDate.setHours(23, 59, 59, 999); // 종료 날짜의 끝 (23:59:59)
      } else {
        // 기본값: 1년 후
        endDate = new Date(today);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setHours(23, 59, 59, 999);
      }

      let addedCount = 0;
      let failedCount = 0;

      // 각 요일별로 일정 생성
      for (const slot of routine.timeSlots) {
        console.log(`시간표 요일 처리: slot.day = ${slot.day} (${['일', '월', '화', '수', '목', '금', '토'][slot.day]})`);

        // 오늘부터 종료 날짜까지 모든 해당 요일에 일정 생성
        let currentDate = new Date(today);

        // 오늘 이후의 첫 번째 해당 요일 찾기
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay(); // 0(일) ~ 6(토)

          // 해당 요일인 경우에만 일정 추가
          if (dayOfWeek === slot.day) {
            // 로컬 날짜를 직접 포맷팅 (UTC 변환으로 인한 날짜 밀림 방지)
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const day = currentDate.getDate();
            const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // 이 요일에 이미 일정이 있는지 확인 (중복 방지) - memberId도 확인
            const existingTodo = todos.find(t =>
              t.title === routine.name &&
              t.date === dateString &&
              t.startTime === slot.startTime &&
              t.memberId === routine.memberId
            );
            if (existingTodo) {
              // 다음 주로 이동
              currentDate.setDate(currentDate.getDate() + 7);
              continue;
            }

            // 시작 시간과 종료 시간 계산
            const [startHours, startMinutes] = slot.startTime.split(':').map(Number);
            const startTotalMinutes = startHours * 60 + startMinutes;
            const endTotalMinutes = startTotalMinutes + slot.duration;
            const endHours = Math.floor(endTotalMinutes / 60) % 24;
            const endMins = endTotalMinutes % 60;
            const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

            // 백엔드에 일정 저장
            try {
              const todoData = {
                title: routine.name,
                description: routine.memo || "",
                memo: routine.memo || "",
                location: "",
                date: dateString,
                start_time: slot.startTime,
                end_time: endTime,
                all_day: false,
                category: routine.category || "기타",
                status: 'pending',
                has_notification: false,
                notification_times: [],
                repeat_type: "none",
                checklist_items: [],
                member_id: routine.memberId, // 구성원 ID 추가
              };

              const response = await apiClient.createTodo(todoData);
              console.log("시간표 일정 추가 응답:", response);

              if (response && response.data) {
                const newTodo: TodoItem = {
                  id: response.data.id, // 백엔드에서 생성한 실제 ID 사용
                  title: routine.name,
                  time: slot.startTime,
                  duration: slot.duration,
                  completed: false,
                  category: routine.category || "기타",
                  date: dateString,
                  startTime: slot.startTime,
                  endTime: endTime,
                  isAllDay: false,
                  memo: routine.memo || "",
                  location: "",
                  hasNotification: false,
                  alarmTimes: [],
                  repeatType: "none",
                  checklistItems: [],
                  memberId: routine.memberId,
                  isRoutine: false,
                };

                setTodos(prev => {
                  // 이미 존재하는지 확인
                  const exists = prev.some(t => t.id === newTodo.id);
                  if (exists) return prev;
                  addedCount++;
                  return [...prev, newTodo];
                });
              }
            } catch (error: any) {
              console.error("시간표 일정 추가 실패:", error);
              failedCount++;
            }

            // 다음 주로 이동
            currentDate.setDate(currentDate.getDate() + 7);
          } else {
            // 다음 날로 이동
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      if (addedCount > 0) {
        toast.success(`${routine.name}이(가) 캘린더에 ${addedCount}개의 일정으로 추가되었습니다.`);
      }
      if (failedCount > 0) {
        toast.error(`${routine.name}의 일정 ${failedCount}개 추가에 실패했습니다.`);
      }
      if (addedCount === 0 && failedCount === 0) {
        toast.info(`${routine.name}의 일정이 이미 캘린더에 존재합니다.`);
      }
    } else {
      // 체크박스 해제 시 해당 시간표로 생성된 모든 일정 제거 (백엔드에서도 삭제) - memberId도 확인
      const routineTodos = todos.filter(t =>
        t.title === routine.name &&
        t.startTime &&
        t.memberId === routine.memberId &&
        routine.timeSlots.some(slot => slot.startTime === t.startTime)
      );

      let deletedCount = 0;
      let failedCount = 0;

      for (const todo of routineTodos) {
        try {
          // 백엔드에서 일정 삭제
          await apiClient.deleteTodo(todo.id);
          deletedCount++;
        } catch (error: any) {
          console.error("시간표 일정 삭제 실패:", error);
          failedCount++;
        }
      }

      // 프론트엔드 상태 업데이트 - memberId도 확인
      setTodos(prev => {
        const filtered = prev.filter(t =>
          !(t.title === routine.name &&
            t.startTime &&
            t.memberId === routine.memberId &&
            routine.timeSlots.some(slot => slot.startTime === t.startTime))
        );
        return filtered;
      });

      if (deletedCount > 0) {
        toast.success(`${routine.name}의 캘린더 일정 ${deletedCount}개가 제거되었습니다.`);
      }
      if (failedCount > 0) {
        toast.error(`${routine.name}의 일정 ${failedCount}개 삭제에 실패했습니다.`);
      }
    }
  };

  const handleRoutineUpdate = async (updatedRoutine: RoutineItem) => {
    try {
      console.log("시간표 수정 시작:", updatedRoutine);
      // API로 업데이트
      const routineData = {
        name: updatedRoutine.name,
        member_id: updatedRoutine.memberId,
        color: updatedRoutine.color,
        category: updatedRoutine.category || "기타",
        memo: updatedRoutine.memo || "",
        time_slots: updatedRoutine.timeSlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          duration: slot.duration
        })),
        add_to_calendar: updatedRoutine.addToCalendar || false, // 체크박스 상태 사용
      };

      console.log("시간표 수정 데이터:", routineData);
      try {
        const response = await apiClient.updateRoutine(updatedRoutine.id, routineData);
        console.log("시간표 수정 응답:", response);
        console.log("시간표 수정 응답 데이터:", response?.data);
        console.log("시간표 수정 응답 상태:", response?.status);

        if (response && response.data) {
          // 응답 데이터로 업데이트된 시간표 구성
          const updatedRoutineFromResponse: RoutineItem = {
            ...updatedRoutine,
            id: response.data.id,
            name: response.data.name || updatedRoutine.name,
            memberId: response.data.member_id || updatedRoutine.memberId,
            color: response.data.color || updatedRoutine.color,
            category: response.data.category || updatedRoutine.category,
            memo: response.data.memo || updatedRoutine.memo,
            timeSlots: response.data.time_slots?.map((slot: any) => ({
              day: slot.day,
              startTime: slot.startTime,
              duration: slot.duration
            })) || updatedRoutine.timeSlots
          };
          setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutineFromResponse : r));
          toast.success("시간표가 수정되었습니다.");
        } else {
          console.error("응답 데이터 없음:", response);
          toast.error("시간표 수정에 실패했습니다. 응답 데이터가 없습니다.");
        }
      } catch (apiError: any) {
        console.error("시간표 수정 API 에러:", apiError);
        console.error("에러 응답:", apiError.response);
        console.error("에러 데이터:", apiError.response?.data);
        throw apiError; // 상위 catch로 전달
      }
    } catch (error: any) {
      console.error("시간표 수정 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      console.error("에러 스택:", error.stack);
      toast.error(`시간표 수정에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  const handleRoutineDelete = async (id: string) => {
    try {
      console.log("시간표 삭제 시작:", id);
      // API로 삭제
      const response = await apiClient.deleteRoutine(id);
      console.log("시간표 삭제 응답:", response);
      setRoutines(prev => prev.filter(r => r.id !== id));
      toast.success("시간표가 삭제되었습니다.");
    } catch (error: any) {
      console.error("시간표 삭제 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      toast.error(`시간표 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  // Todo Item Interface
  interface TodoItem {
    source?: 'always_plan' | 'google_calendar';
    googleCalendarEventId?: string;
    bulkSynced?: boolean; // 동기화 후 저장 여부 (새로고침 후에도 유지되도록)
    todoGroupId?: string; // 여러 날짜에 걸친 일정을 묶기 위한 그룹 ID
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
    date?: string;
    endDate?: string; // 종료 날짜 (여러 날 선택 시)
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
    memo?: string;
    location?: string;
    hasNotification?: boolean;
    alarmTimes?: string[]; // 구버전 호환
    notificationReminders?: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }>; // 새로운 알림 형식
    repeatType?: "none" | "daily" | "weekly" | "monthly" | "yearly" | "weekdays" | "weekends" | "custom";
    repeatEndDate?: string; // 반복 종료 날짜
    repeatPattern?: any; // 반복 패턴 JSON
    type?: "todo" | "checklist";
    checklistItems?: string[];
    postponeMinutes?: number;
    postponeToNextDay?: boolean;
    memberId?: string;
    isRoutine?: boolean;
    routineId?: string;
  }

  const [todos, setTodos] = useState<TodoItem[]>([]);

  // 검색 로직: 일정 이름, 메모, 체크리스트, 장소 검색
  const filteredTodos = searchQuery.trim()
    ? todos.filter((todo) => {
      const query = searchQuery.toLowerCase();
      // 일정 이름 검색
      const titleMatch = todo.title?.toLowerCase().includes(query);
      // 메모 검색
      const memoMatch = todo.memo?.toLowerCase().includes(query);
      // 장소 검색
      const locationMatch = todo.location?.toLowerCase().includes(query);
      // 체크리스트 검색
      const checklistMatch = todo.checklistItems?.some((item) =>
        item.toLowerCase().includes(query)
      );
      // 카테고리 검색
      const categoryMatch = todo.category?.toLowerCase().includes(query);

      return titleMatch || memoMatch || locationMatch || checklistMatch || categoryMatch;
    })
    : [];

  // 검색어 변경 핸들러
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchResults(value.trim().length > 0);
  };

  // 검색창 포커스 핸들러
  const handleSearchFocus = () => {
    if (searchQuery.trim().length > 0) {
      setShowSearchResults(true);
    }
  };

  // 검색창 블러 핸들러
  const handleSearchBlur = () => {
    // 약간의 지연을 두어 클릭 이벤트가 먼저 처리되도록 함
    setTimeout(() => {
      setShowSearchResults(false);
    }, 200);
  };

  const handleBack = () => {
    window.location.reload();
  };

  const handleSaveTodo = (todo: any) => {
    const newTodo = {
      id: Date.now().toString(),
      title: todo.title || "새로운 할 일",
      time: todo.time || "09:00",
      duration: 60,
      completed: false,
      category: todo.category || "기타",
    };

    setTodos((prev) =>
      [...prev, newTodo].sort((a, b) => a.time.localeCompare(b.time))
    );
    toast.success("일정이 추가되었습니다.");
  };

  const handleSaveDetailedTodo = async (formData: TodoFormData) => {
    // Calculate duration from start and end time (only if not all day)
    let duration = 60; // 기본값
    if (!formData.isAllDay && formData.startTime && formData.endTime) {
      try {
        const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
        const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
        duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
        if (duration <= 0) duration = 60; // 최소 1시간
      } catch (e) {
        duration = 60;
      }
    }

    try {
      if (editingTodoId) {
        console.log("일정 수정 시작:", editingTodoId, formData);
        // 수정 모드 - API 호출
        // 기존 일정 정보 가져오기
        const existingTodo = todos.find(t => t.id === editingTodoId);

        // Google Calendar 이벤트는 수정할 수 없음 (DB에 저장되지 않음)
        if (existingTodo?.source === 'google_calendar' || existingTodo?.googleCalendarEventId) {
          toast.error("Google Calendar에서 가져온 일정은 수정할 수 없습니다. Google Calendar에서 직접 수정해주세요.");
          setEditingTodoId(null);
          return;
        }

        // 날짜 형식 정규화 함수
        const normalizeDate = (date: any): string => {
          if (typeof date === 'string') {
            return date;
          } else if (date && typeof date === 'object' && 'getFullYear' in date) {
            const d = date as Date;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else {
            return String(date || '');
          }
        };

        // 날짜 형식 정규화
        const newDateStr = normalizeDate(formData.date);
        const newEndDateStr = formData.endDate && formData.endDate !== formData.date
          ? normalizeDate(formData.endDate)
          : null;

        // all_day가 true일 때는 start_time과 end_time을 null로 설정
        const todoData: any = {
          title: formData.title,
          description: formData.memo || "",
          memo: formData.memo || "",
          location: formData.location || "",
          date: newDateStr, // 시작 날짜는 항상 전송 (사용자가 변경할 수 있도록)
          end_date: newEndDateStr || undefined, // 종료 날짜 (기간 수정 가능)
          all_day: formData.isAllDay,
          category: formData.category,
          status: existingTodo?.completed ? 'completed' : 'pending',
          has_notification: formData.hasNotification,
          notification_times: formData.alarmTimes || [], // 구버전 호환
          notification_reminders: formData.notificationReminders && formData.notificationReminders.length > 0
            ? formData.notificationReminders.map(r => ({ value: r.value, unit: r.unit }))
            : [],
          repeat_type: formData.repeatType || "none",
          repeat_end_date: formData.repeatType === 'custom'
            ? (formData.customRepeatEndType === 'date' ? formData.customRepeatEndDate :
              (formData.customRepeatEndType === 'count' ? undefined : formData.repeatEndDate || undefined))
            : (formData.repeatEndDate || undefined),
          repeat_pattern: formData.repeatType === 'custom' ? {
            freq: formData.customRepeatUnit || 'days',
            interval: formData.customRepeatInterval || 1,
            days: formData.customRepeatDays || [],
            endType: formData.customRepeatEndType || 'never',
            endDate: formData.customRepeatEndType === 'date' ? formData.customRepeatEndDate : undefined,
            count: formData.customRepeatEndType === 'count' ? formData.customRepeatCount : undefined,
          } : (formData.repeatPattern || undefined),
          checklist_items: formData.checklistItems.filter(item => item.trim() !== ''),
        };

        // all_day가 false일 때만 start_time과 end_time 설정
        // 빈 문자열이나 "24:00" 같은 잘못된 값은 null로 변환
        if (!formData.isAllDay && formData.startTime && formData.endTime) {
          // 빈 문자열이나 유효하지 않은 시간은 null로 설정
          const startTime = formData.startTime.trim() === '' || formData.startTime === '24:00' ? null : formData.startTime;
          const endTime = formData.endTime.trim() === '' || formData.endTime === '24:00' ? null : formData.endTime;
          todoData.start_time = startTime;
          todoData.end_time = endTime;
        } else {
          // all_day가 true이거나 시간이 없으면 null로 설정
          todoData.start_time = null;
          todoData.end_time = null;
        }

        console.log("일정 수정 데이터:", todoData);
        console.log("일정 수정 데이터 JSON:", JSON.stringify(todoData, null, 2));

        try {
          const response = await apiClient.updateTodo(editingTodoId, todoData);
          console.log("일정 수정 응답:", response);

          if (response && response.data) {
            // 날짜 형식 정규화
            const normalizedDate = normalizeDate(response.data.date || formData.date);

            // 응답에서 종료 날짜 가져오기
            let normalizedEndDate = newEndDateStr;
            if (response.data.end_date) {
              if (response.data.end_date instanceof Date) {
                const year = response.data.end_date.getFullYear();
                const month = response.data.end_date.getMonth() + 1;
                const day = response.data.end_date.getDate();
                normalizedEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof response.data.end_date === 'string') {
                normalizedEndDate = response.data.end_date;
              }
            }

            const updatedTodo = {
              id: editingTodoId,
              title: formData.title,
              time: formData.startTime || "09:00",
              duration: duration > 0 ? duration : 60,
              completed: response.data.status === 'completed' || todos.find(t => t.id === editingTodoId)?.completed || false,
              category: formData.category,
              date: normalizedDate,
              endDate: normalizedEndDate || undefined,  // 종료 날짜 추가
              startTime: formData.startTime,
              endTime: formData.endTime,
              isAllDay: formData.isAllDay,
              memo: formData.memo || "",
              location: formData.location || "",
              hasNotification: formData.hasNotification,
              alarmTimes: formData.alarmTimes,
              repeatType: formData.repeatType,
              checklistItems: formData.checklistItems.filter(item => item.trim() !== ''),
              postponeToNextDay: formData.postponeToNextDay,
              source: 'always_plan' as const, // 수정된 일정임을 명시
            };

            // 반복 설정이 변경된 경우, 모든 일정을 다시 로드
            const oldRepeatType = existingTodo?.repeatType || "none";
            const newRepeatType = formData.repeatType || "none";

            if (oldRepeatType !== newRepeatType || (formData.repeatType && formData.repeatType !== 'none')) {
              console.log('[일정 수정] 반복 설정 변경됨:', oldRepeatType, '->', newRepeatType, ', 모든 일정 다시 로드');
              // 잠시 후 todos를 다시 로드 (백엔드에서 반복 일정 생성 완료 후)
              setTimeout(async () => {
                try {
                  const todosResponse = await apiClient.getTodos();
                  if (todosResponse.data && Array.isArray(todosResponse.data)) {
                    const formattedTodos = todosResponse.data.map((todo: any) => {
                      // duration 계산
                      let duration = 60;
                      if (todo.start_time && todo.end_time) {
                        const [startHours, startMinutes] = todo.start_time.split(':').map(Number);
                        const [endHours, endMinutes] = todo.end_time.split(':').map(Number);
                        const startTotal = startHours * 60 + startMinutes;
                        const endTotal = endHours * 60 + endMinutes;
                        duration = endTotal - startTotal;
                      }

                      // end_date 파싱
                      let endDate: string | undefined = undefined;
                      if (todo.end_date) {
                        if (todo.end_date instanceof Date) {
                          const year = todo.end_date.getFullYear();
                          const month = todo.end_date.getMonth() + 1;
                          const day = todo.end_date.getDate();
                          endDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        } else if (typeof todo.end_date === 'string') {
                          endDate = todo.end_date;
                        }
                      }

                      // notification_reminders 파싱
                      let notificationReminders: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }> = [];
                      if (todo.notification_reminders) {
                        try {
                          const parsed = typeof todo.notification_reminders === 'string'
                            ? JSON.parse(todo.notification_reminders)
                            : todo.notification_reminders;
                          if (Array.isArray(parsed)) {
                            notificationReminders = parsed.map((r: any) => ({
                              value: Number(r.value) || 30,
                              unit: r.unit || 'minutes'
                            }));
                          }
                        } catch (e) {
                          console.error('Failed to parse notification_reminders:', e);
                        }
                      }

                      // repeat_end_date 파싱
                      let repeatEndDate: string | undefined = undefined;
                      if (todo.repeat_end_date) {
                        if (todo.repeat_end_date instanceof Date) {
                          const year = todo.repeat_end_date.getFullYear();
                          const month = todo.repeat_end_date.getMonth() + 1;
                          const day = todo.repeat_end_date.getDate();
                          repeatEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        } else if (typeof todo.repeat_end_date === 'string') {
                          repeatEndDate = todo.repeat_end_date;
                        }
                      }

                      // repeat_pattern 파싱
                      let repeatPattern: any = undefined;
                      if (todo.repeat_pattern) {
                        try {
                          repeatPattern = typeof todo.repeat_pattern === 'string'
                            ? JSON.parse(todo.repeat_pattern)
                            : todo.repeat_pattern;
                        } catch (e) {
                          console.error('Failed to parse repeat_pattern:', e);
                        }
                      }

                      // family_member_ids 파싱
                      let memberId: string | undefined;
                      if (todo.family_member_ids) {
                        try {
                          const memberIds = typeof todo.family_member_ids === 'string'
                            ? JSON.parse(todo.family_member_ids)
                            : todo.family_member_ids;
                          if (Array.isArray(memberIds) && memberIds.length > 0) {
                            memberId = memberIds[0];
                          }
                        } catch (e) {
                          console.error('Failed to parse family_member_ids:', e);
                        }
                      }

                      return {
                        id: todo.id,
                        title: todo.title || '',
                        time: todo.start_time || "09:00",
                        duration: duration > 0 ? duration : 60,
                        completed: todo.status === 'completed',
                        category: todo.category || "기타",
                        date: todo.date ? (typeof todo.date === 'string' ? todo.date : todo.date.split('T')[0]) : undefined,
                        endDate: endDate,
                        startTime: todo.start_time,
                        endTime: todo.end_time,
                        isAllDay: todo.all_day || false,
                        memo: todo.memo || "",
                        location: todo.location || "",
                        hasNotification: todo.has_notification || false,
                        alarmTimes: todo.notification_times ? (typeof todo.notification_times === 'string' ? JSON.parse(todo.notification_times) : todo.notification_times) : [],
                        notificationReminders: notificationReminders,
                        repeatType: todo.repeat_type || "none",
                        repeatEndDate: repeatEndDate,
                        repeatPattern: repeatPattern,
                        checklistItems: todo.checklist_items?.map((item: any) => item.text || item) || [],
                        memberId: memberId,
                        isRoutine: false,
                        source: 'always_plan' as const,
                        googleCalendarEventId: todo.google_calendar_event_id || undefined,
                        bulkSynced: todo.bulk_synced || false,
                        todoGroupId: todo.todo_group_id || undefined,
                      };
                    });
                    setTodos(formattedTodos);
                    console.log('[일정 수정] 반복 일정 포함 모든 일정 로드 완료:', formattedTodos.length, '개');
                  }
                } catch (error) {
                  console.error('[일정 수정] 반복 일정 로드 실패:', error);
                }
              }, 500); // 0.5초 후 다시 로드 (백엔드에서 반복 일정 생성 완료 대기)

              if (formData.repeatType && formData.repeatType !== 'none') {
                toast.success("일정이 수정되었습니다. 반복 일정이 생성되었습니다.");
              } else {
                toast.success("일정이 수정되었습니다.");
              }
            } else {
              setTodos((prev) =>
                prev.map(t => t.id === editingTodoId ? updatedTodo : t)
                  .sort((a, b) => {
                    // 날짜와 시간으로 정렬
                    if (a.date !== b.date) {
                      return (a.date || '').localeCompare(b.date || '');
                    }
                    return a.time.localeCompare(b.time);
                  })
              );
              toast.success("일정이 수정되었습니다.");
            }
            setEditingTodoId(null);
          } else {
            console.error("응답 데이터 없음:", response);
            toast.error("일정 수정에 실패했습니다. 응답 데이터가 없습니다.");
          }
        } catch (updateError: any) {
          console.error("일정 수정 API 에러:", updateError);
          if (updateError.response?.status === 404) {
            toast.error("일정을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.");
          } else {
            toast.error(`일정 수정에 실패했습니다: ${updateError.response?.data?.detail || updateError.message}`);
          }
          throw updateError;
        }
      } else {
        console.log("일정 추가 시작:", formData);

        // 날짜 형식 정규화 함수
        const normalizeDate = (date: any): string => {
          if (typeof date === 'string') {
            return date;
          } else if (date && typeof date === 'object' && 'getFullYear' in date) {
            const d = date as Date;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else {
            return String(date || '');
          }
        };

        // 시작 날짜와 종료 날짜 정규화
        const startDate = normalizeDate(formData.date);
        const endDate = formData.endDate && formData.endDate !== startDate ? normalizeDate(formData.endDate) : null;

        // 기간 일정을 하나의 일정으로 생성 (시작날짜/시간에서 종료날짜/시간까지)
        const todoData: any = {
          title: formData.title,
          description: formData.memo || "",
          memo: formData.memo || "",
          location: formData.location || "",
          date: startDate,  // 시작 날짜
          end_date: endDate,  // 종료 날짜 (기간 일정인 경우)
          start_time: formData.startTime || null,
          end_time: formData.endTime || null,
          all_day: formData.isAllDay,
          category: formData.category,
          status: 'pending',
          has_notification: formData.hasNotification,
          notification_times: formData.alarmTimes || [], // 구버전 호환
          notification_reminders: formData.notificationReminders && formData.notificationReminders.length > 0
            ? formData.notificationReminders.map(r => ({ value: r.value, unit: r.unit }))
            : [],
          repeat_type: formData.repeatType || "none",
          repeat_end_date: formData.repeatType === 'custom'
            ? (formData.customRepeatEndType === 'date' ? formData.customRepeatEndDate :
              (formData.customRepeatEndType === 'count' ? undefined : formData.repeatEndDate || null))
            : (formData.repeatEndDate || null),
          repeat_pattern: formData.repeatType === 'custom' ? {
            freq: formData.customRepeatUnit || 'days',
            interval: formData.customRepeatInterval || 1,
            days: formData.customRepeatDays || [],
            endType: formData.customRepeatEndType || 'never',
            endDate: formData.customRepeatEndType === 'date' ? formData.customRepeatEndDate : undefined,
            count: formData.customRepeatEndType === 'count' ? formData.customRepeatCount : undefined,
          } : (formData.repeatPattern || null),
          checklist_items: formData.checklistItems.filter(item => item.trim() !== ''),
        };

        console.log(`일정 추가: ${startDate}${endDate ? ` ~ ${endDate}` : ''} (하나의 일정으로 생성)`);
        console.log("일정 추가 데이터:", todoData);

        try {
          const response = await apiClient.createTodo(todoData);
          console.log("일정 추가 응답:", response);

          if (response && response.data) {
            // API 응답에서 날짜 형식 확인 및 변환
            let todoDate = startDate;
            if (response.data.date) {
              if (response.data.date instanceof Date) {
                const year = response.data.date.getFullYear();
                const month = response.data.date.getMonth() + 1;
                const day = response.data.date.getDate();
                todoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof response.data.date === 'string') {
                todoDate = response.data.date;
              }
            }

            let todoEndDate: string | undefined = endDate || undefined;
            if (response.data.end_date) {
              if (response.data.end_date instanceof Date) {
                const year = response.data.end_date.getFullYear();
                const month = response.data.end_date.getMonth() + 1;
                const day = response.data.end_date.getDate();
                todoEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof response.data.end_date === 'string') {
                todoEndDate = response.data.end_date;
              }
            } else {
              // API 응답에 end_date가 없으면 null로 설정
              todoEndDate = undefined;
            }

            // notification_reminders 파싱 (API 응답에서 받은 데이터 사용)
            let notificationReminders: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }> = [];
            if (response.data.notification_reminders) {
              try {
                const parsed = typeof response.data.notification_reminders === 'string'
                  ? JSON.parse(response.data.notification_reminders)
                  : response.data.notification_reminders;
                if (Array.isArray(parsed)) {
                  notificationReminders = parsed.map((r: any) => ({
                    value: Number(r.value) || 30,
                    unit: r.unit || 'minutes'
                  }));
                }
              } catch (e) {
                console.error('Failed to parse notification_reminders:', e);
                // 폼 데이터에서 가져오기
                notificationReminders = formData.notificationReminders || [];
              }
            } else {
              // API 응답에 없으면 폼 데이터에서 가져오기
              notificationReminders = formData.notificationReminders || [];
            }

            // repeat_end_date 파싱
            let repeatEndDate: string | undefined = undefined;
            if (response.data.repeat_end_date) {
              if (response.data.repeat_end_date instanceof Date) {
                const year = response.data.repeat_end_date.getFullYear();
                const month = response.data.repeat_end_date.getMonth() + 1;
                const day = response.data.repeat_end_date.getDate();
                repeatEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else if (typeof response.data.repeat_end_date === 'string') {
                repeatEndDate = response.data.repeat_end_date;
              }
            } else {
              repeatEndDate = formData.repeatEndDate;
            }

            // repeat_pattern 파싱
            let repeatPattern: any = undefined;
            if (response.data.repeat_pattern) {
              try {
                repeatPattern = typeof response.data.repeat_pattern === 'string'
                  ? JSON.parse(response.data.repeat_pattern)
                  : response.data.repeat_pattern;
              } catch (e) {
                console.error('Failed to parse repeat_pattern:', e);
                repeatPattern = formData.repeatPattern;
              }
            } else {
              repeatPattern = formData.repeatPattern;
            }

            const newTodo = {
              id: response.data.id,
              title: formData.title,
              time: formData.startTime || "09:00",
              duration: duration > 0 ? duration : 60,
              completed: false,
              category: formData.category,
              date: todoDate,
              endDate: todoEndDate,  // 종료 날짜 추가
              startTime: formData.startTime,
              endTime: formData.endTime,
              isAllDay: formData.isAllDay,
              memo: formData.memo || "",
              location: formData.location || "",
              hasNotification: formData.hasNotification,
              alarmTimes: formData.alarmTimes,
              notificationReminders: notificationReminders, // 새로운 알림 형식
              repeatType: formData.repeatType,
              repeatEndDate: repeatEndDate, // 반복 종료 날짜
              repeatPattern: repeatPattern, // 반복 패턴
              checklistItems: formData.checklistItems.filter(item => item.trim() !== ''),
              postponeToNextDay: formData.postponeToNextDay,
              isRoutine: false,
              source: 'always_plan' as const,
              todoGroupId: response.data.todo_group_id, // 그룹 ID 저장
            };

            // 생성된 Todo를 상태에 추가
            console.log('[일정 추가] newTodo 객체:', newTodo);
            setTodos((prev) => {
              const updated = [...prev, newTodo];
              // 날짜와 시간으로 정렬
              const sorted = updated.sort((a, b) => {
                if (a.date !== b.date) {
                  return (a.date || '').localeCompare(b.date || '');
                }
                return a.time.localeCompare(b.time);
              });
              console.log('[일정 추가] 상태 업데이트 후 todos 개수:', sorted.length);
              console.log('[일정 추가] 새로 추가된 일정:', sorted.find(t => t.id === newTodo.id));
              return sorted;
            });

            // 반복 일정이 생성된 경우, 모든 일정을 다시 로드
            if (formData.repeatType && formData.repeatType !== 'none') {
              console.log('[일정 추가] 반복 일정이 생성되었으므로 모든 일정을 다시 로드합니다.');
              // 잠시 후 todos를 다시 로드 (백엔드에서 반복 일정 생성 완료 후)
              setTimeout(async () => {
                try {
                  const todosResponse = await apiClient.getTodos();
                  if (todosResponse.data && Array.isArray(todosResponse.data)) {
                    const formattedTodos = todosResponse.data.map((todo: any) => {
                      // duration 계산
                      let duration = 60;
                      if (todo.start_time && todo.end_time) {
                        const [startHours, startMinutes] = todo.start_time.split(':').map(Number);
                        const [endHours, endMinutes] = todo.end_time.split(':').map(Number);
                        const startTotal = startHours * 60 + startMinutes;
                        const endTotal = endHours * 60 + endMinutes;
                        duration = endTotal - startTotal;
                      }

                      // end_date 파싱
                      let endDate: string | undefined = undefined;
                      if (todo.end_date) {
                        if (todo.end_date instanceof Date) {
                          const year = todo.end_date.getFullYear();
                          const month = todo.end_date.getMonth() + 1;
                          const day = todo.end_date.getDate();
                          endDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        } else if (typeof todo.end_date === 'string') {
                          endDate = todo.end_date;
                        }
                      }

                      // notification_reminders 파싱
                      let notificationReminders: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }> = [];
                      if (todo.notification_reminders) {
                        try {
                          const parsed = typeof todo.notification_reminders === 'string'
                            ? JSON.parse(todo.notification_reminders)
                            : todo.notification_reminders;
                          if (Array.isArray(parsed)) {
                            notificationReminders = parsed.map((r: any) => ({
                              value: Number(r.value) || 30,
                              unit: r.unit || 'minutes'
                            }));
                          }
                        } catch (e) {
                          console.error('Failed to parse notification_reminders:', e);
                        }
                      }

                      // repeat_end_date 파싱
                      let repeatEndDate: string | undefined = undefined;
                      if (todo.repeat_end_date) {
                        if (todo.repeat_end_date instanceof Date) {
                          const year = todo.repeat_end_date.getFullYear();
                          const month = todo.repeat_end_date.getMonth() + 1;
                          const day = todo.repeat_end_date.getDate();
                          repeatEndDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        } else if (typeof todo.repeat_end_date === 'string') {
                          repeatEndDate = todo.repeat_end_date;
                        }
                      }

                      // repeat_pattern 파싱
                      let repeatPattern: any = undefined;
                      if (todo.repeat_pattern) {
                        try {
                          repeatPattern = typeof todo.repeat_pattern === 'string'
                            ? JSON.parse(todo.repeat_pattern)
                            : todo.repeat_pattern;
                        } catch (e) {
                          console.error('Failed to parse repeat_pattern:', e);
                        }
                      }

                      // family_member_ids 파싱
                      let memberId: string | undefined;
                      if (todo.family_member_ids) {
                        try {
                          const memberIds = typeof todo.family_member_ids === 'string'
                            ? JSON.parse(todo.family_member_ids)
                            : todo.family_member_ids;
                          if (Array.isArray(memberIds) && memberIds.length > 0) {
                            memberId = memberIds[0];
                          }
                        } catch (e) {
                          console.error('Failed to parse family_member_ids:', e);
                        }
                      }

                      return {
                        id: todo.id,
                        title: todo.title || '',
                        time: todo.start_time || "09:00",
                        duration: duration > 0 ? duration : 60,
                        completed: todo.status === 'completed',
                        category: todo.category || "기타",
                        date: todo.date ? (typeof todo.date === 'string' ? todo.date : todo.date.split('T')[0]) : undefined,
                        endDate: endDate,
                        startTime: todo.start_time,
                        endTime: todo.end_time,
                        isAllDay: todo.all_day || false,
                        memo: todo.memo || "",
                        location: todo.location || "",
                        hasNotification: todo.has_notification || false,
                        alarmTimes: todo.notification_times ? (typeof todo.notification_times === 'string' ? JSON.parse(todo.notification_times) : todo.notification_times) : [],
                        notificationReminders: notificationReminders,
                        repeatType: todo.repeat_type || "none",
                        repeatEndDate: repeatEndDate,
                        repeatPattern: repeatPattern,
                        checklistItems: todo.checklist_items?.map((item: any) => item.text || item) || [],
                        memberId: memberId,
                        isRoutine: false,
                        source: 'always_plan' as const,
                        googleCalendarEventId: todo.google_calendar_event_id || undefined,
                        bulkSynced: todo.bulk_synced || false,
                        todoGroupId: todo.todo_group_id || undefined,
                      };
                    });
                    setTodos(formattedTodos);
                    console.log('[일정 추가] 반복 일정 포함 모든 일정 로드 완료:', formattedTodos.length, '개');
                  }
                } catch (error) {
                  console.error('[일정 추가] 반복 일정 로드 실패:', error);
                }
              }, 500); // 0.5초 후 다시 로드 (백엔드에서 반복 일정 생성 완료 대기)

              if (endDate) {
                toast.success(`일정이 생성되었습니다. (${startDate} ~ ${endDate})`);
              } else {
                toast.success("일정이 추가되었습니다. 반복 일정이 생성되었습니다.");
              }
            } else {
              if (endDate) {
                toast.success(`일정이 생성되었습니다. (${startDate} ~ ${endDate})`);
              } else {
                toast.success("일정이 추가되었습니다.");
              }
            }
          } else {
            toast.error("일정 추가에 실패했습니다.");
          }
        } catch (error: any) {
          console.error("일정 추가 실패:", error);
          toast.error(`일정 추가에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
        }

        // 모달 닫기
        setEditingTodoId(null);
      }
    } catch (error: any) {
      console.error("일정 추가 API 에러:", error);
      console.error("에러 응답:", error.response);
      console.error("에러 데이터:", error.response?.data);
      toast.error(`일정 저장 실패: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  const toggleTodoComplete = async (id: string) => {
    try {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        const newStatus = todo.completed ? 'pending' : 'completed';
        console.log("일정 상태 변경 시작:", id, newStatus);
        const response = await apiClient.updateTodo(id, { status: newStatus });
        console.log("일정 상태 변경 응답:", response);

        if (response && response.data) {
          setTodos((prev) =>
            prev.map((t) =>
              t.id === id ? { ...t, completed: !t.completed } : t
            )
          );
        } else {
          console.error("응답 데이터 없음:", response);
          toast.error("일정 상태 변경에 실패했습니다. 응답 데이터가 없습니다.");
        }
      }
    } catch (error: any) {
      console.error("일정 상태 변경 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      toast.error(`일정 상태 변경에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      console.log("일정 삭제 시작:", id);

      // 삭제할 일정 찾기 (최신 상태에서 찾기)
      const todoToDelete = todos.find(t => t.id === id);
      if (!todoToDelete) {
        console.warn("삭제할 일정을 찾을 수 없습니다:", id);
        toast.error("일정을 찾을 수 없습니다.");
        return;
      }

      // Google Calendar 이벤트인 경우 Google Calendar에서 삭제
      if (todoToDelete.source === 'google_calendar' || todoToDelete.googleCalendarEventId) {
        const eventId = todoToDelete.googleCalendarEventId || todoToDelete.id;
        console.log("Google Calendar 이벤트 삭제 시도:", eventId);

        try {
          // Google Calendar 이벤트 삭제를 위한 API 호출
          const response = await apiClient.deleteGoogleCalendarEvent(eventId);
          console.log("Google Calendar 이벤트 삭제 응답:", response);

          if (response && response.data?.success) {
            // 프론트엔드에서 제거
            setTodos((prev) => prev.filter((todo) => todo.id !== id));
            toast.success("Google Calendar 이벤트가 삭제되었습니다.");
          } else {
            throw new Error("삭제 응답이 성공이 아닙니다.");
          }
          return;
        } catch (error: any) {
          console.error("Google Calendar 이벤트 삭제 실패:", error);
          toast.error(`Google Calendar 이벤트 삭제에 실패했습니다: ${error.response?.data?.detail || error.message}`);
          return;
        }
      }

      // Always Plan 일정인 경우 백엔드에 삭제 요청
      // 같은 그룹의 모든 일정 찾기
      const todosToDelete: TodoItem[] = [];
      if (todoToDelete.todoGroupId) {
        // 같은 그룹의 모든 일정 찾기
        const groupTodos = todos.filter(t => t.todoGroupId === todoToDelete.todoGroupId);
        todosToDelete.push(...groupTodos);
        console.log(`같은 그룹의 일정 ${groupTodos.length}개 발견: todoGroupId=${todoToDelete.todoGroupId}`);
      } else {
        // 그룹 ID가 없으면 현재 일정만 삭제
        todosToDelete.push(todoToDelete);
      }

      // 백엔드에 삭제 요청 (첫 번째 일정 ID로 삭제하면 백엔드에서 같은 그룹의 모든 일정 삭제)
      try {
        const response = await apiClient.deleteTodo(id);
        console.log("일정 삭제 응답:", response);
        console.log("일정 삭제 응답 상태:", response?.status);

        // API 호출 성공 여부 확인 (204 No Content는 응답 본문이 없을 수 있음)
        if (response && (response.status === 204 || response.status === 200)) {
          // 프론트엔드 상태에서 제거 (성공 후에만 제거)
          setTodos((prev) => {
            const filtered = prev.filter((todo) => !todosToDelete.some(td => td.id === todo.id));
            console.log(`프론트엔드에서 일정 ${todosToDelete.length}개 제거 완료, 남은 일정 수:`, filtered.length);
            return filtered;
          });

          console.log("백엔드 삭제 성공 확인됨");
          if (todosToDelete.length > 1) {
            toast.success(`${todosToDelete.length}개 날짜의 일정이 모두 삭제되었습니다.`);
          } else {
            toast.success("일정이 삭제되었습니다.");
          }
        } else {
          console.error("일정 삭제 실패: 예상치 못한 응답", response);
          toast.error("일정 삭제에 실패했습니다. 응답을 확인할 수 없습니다.");
        }
      } catch (error: any) {
        console.error("일정 삭제 실패:", error);
        console.error("에러 상세:", error.response?.data || error.message);
        console.error("에러 상태:", error.response?.status);

        // 404 에러는 이미 삭제된 것으로 간주하고 프론트엔드에서 제거
        if (error.response?.status === 404) {
          console.log("일정이 이미 삭제되었거나 존재하지 않음. 프론트엔드에서 제거합니다.");
          setTodos((prev) => prev.filter((todo) => !todosToDelete.some(td => td.id === todo.id)));
          toast.success("일정이 삭제되었습니다.");
        } else {
          toast.error(`일정 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
        }
      }
    } catch (error: any) {
      console.error("일정 삭제 처리 중 오류:", error);
      toast.error(`일정 삭제 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      공부: "bg-[#E0F2FE] border-l-[#0EA5E9]",
      업무: "bg-[#F3E8FF] border-l-[#A855F7]",
      약속: "bg-[#FCE7F3] border-l-[#EC4899]",
      생활: "bg-[#D1FAE5] border-l-[#10B981]",
      건강: "bg-[#FFF0EB] border-l-[#FF9B82]",
      구글: "bg-[#E8F5E9] border-l-[#00085c]",
      기타: "bg-[#FEF3C7] border-l-[#F59E0B]",
    };
    return colors[category] || colors["기타"];
  };

  /**
   * 사용자 추가/수정 핸들러
   */
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const handleSaveMember = async (member: any) => {
    try {
      if (editingMemberId) {
        console.log("가족 구성원 수정 시작:", editingMemberId, member);

        // "나" 항목(id가 "me")인 경우 사용자 정보 업데이트
        if (editingMemberId === "me") {
          const userData = {
            name: member.name,
            avatar_emoji: member.emoji,
          };

          console.log("사용자 정보 수정 데이터:", userData);
          const userResponse = await apiClient.updateUser(userData);
          console.log("사용자 정보 수정 응답:", userResponse);

          if (userResponse && userResponse.data) {
            setUserName(member.name);
            setSelectedEmoji(member.emoji);
            setFamilyMembers((prev) =>
              prev.map((m) =>
                m.id === "me"
                  ? {
                    ...m,
                    name: member.name || m.name,
                    emoji: member.emoji || m.emoji,
                  }
                  : m
              )
            );
            toast.success(`${member.name}님이 수정되었습니다!`);
            setEditingMemberId(null);
            setShowMemberAddSheet(false);
          } else {
            console.error("응답 데이터 없음:", userResponse);
            toast.error("사용자 정보 수정에 실패했습니다. 응답 데이터가 없습니다.");
          }
          return;
        }

        // 일반 가족 구성원 수정 - API 호출
        const memberData = {
          name: member.name,
          emoji: member.emoji,
          color: member.color,
          relation: member.relation || "other",
          phone_number: member.phone,
          notes: member.memo,
        };

        console.log("가족 구성원 수정 데이터:", memberData);
        const response = await apiClient.updateFamilyMember(editingMemberId, memberData);
        console.log("가족 구성원 수정 응답:", response);

        if (response && response.data) {
          setFamilyMembers((prev) =>
            prev.map((m) =>
              m.id === editingMemberId
                ? {
                  ...m,
                  name: member.name || m.name,
                  emoji: member.emoji || m.emoji,
                  phone: member.phone || m.phone,
                  memo: member.memo || m.memo,
                  color: member.color || m.color,
                }
                : m
            )
          );
          toast.success(`${member.name}님이 수정되었습니다!`);
          setEditingMemberId(null);
          setShowMemberAddSheet(false);
        } else {
          console.error("응답 데이터 없음:", response);
          toast.error("가족 구성원 수정에 실패했습니다. 응답 데이터가 없습니다.");
        }
      } else {
        console.log("가족 구성원 추가 시작:", member);
        // 추가 모드 - API 호출
        const memberData = {
          name: member.name,
          emoji: member.emoji || "🐼",
          color: member.color || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`,
          relation: "other",
          phone_number: member.phone,
          notes: member.memo,
        };

        console.log("가족 구성원 추가 데이터:", memberData);
        const response = await apiClient.createFamilyMember(memberData);
        console.log("가족 구성원 추가 응답:", response);

        if (response && response.data) {
          const newMember: FamilyMember = {
            id: response.data.id,
            name: member.name,
            emoji: member.emoji || "🐼",
            color: member.color || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`,
            phone: member.phone,
            memo: member.memo,
          };
          setFamilyMembers((prev) => [...prev, newMember]);
          toast.success(`${member.name}님이 추가되었습니다!`);
          setShowMemberAddSheet(false);
        } else {
          console.error("응답 데이터 없음:", response);
          toast.error("가족 구성원 추가에 실패했습니다. 응답 데이터가 없습니다.");
        }
      }
    } catch (error: any) {
      console.error("가족 구성원 저장 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      toast.error(`가족 구성원 저장에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const member = familyMembers.find(m => m.id === memberId);
    if (member && window.confirm(`${member.name}님을 삭제하시겠습니까?`)) {
      try {
        // "나"는 삭제하지 않음
        if (memberId === "me") {
          toast.error("기본 사용자는 삭제할 수 없습니다.");
          return;
        }

        console.log("가족 구성원 삭제 시작:", memberId);
        const response = await apiClient.deleteFamilyMember(memberId);
        console.log("가족 구성원 삭제 응답:", response);

        setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
        setSelectedMembers((prev) => {
          const newSelection = prev.filter((id) => id !== memberId);
          // localStorage에 저장
          try {
            localStorage.setItem('selectedMembers', JSON.stringify(newSelection));
          } catch (error) {
            console.error("선택된 구성원 저장 실패:", error);
          }
          return newSelection;
        });
        toast.success(`${member.name}님이 삭제되었습니다.`);
      } catch (error: any) {
        console.error("가족 구성원 삭제 실패:", error);
        console.error("에러 상세:", error.response?.data || error.message);
        toast.error(`가족 구성원 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
      }
    }
  };

  const handleSaveWorkContact = (contact: any) => {
    toast.success(`${contact.name}님의 연락처가 저장되었습니다!`);
    console.log("New Work Contact:", contact);
  };

  const handleTodoUpdate = async (id: string, updates: { time: string; duration: number }) => {
    // duration으로부터 endTime 계산
    const [startHours, startMinutes] = updates.time.split(":").map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = startTotalMinutes + updates.duration;
    const endHours = Math.floor(endTotalMinutes / 60) % 24;
    const endMins = endTotalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

    // 먼저 Todo를 찾아서 업데이트 가능한지 확인
    const updatedTodo = todos.find(t => t.id === id);
    if (!updatedTodo) {
      console.warn('업데이트할 일정을 찾을 수 없습니다:', id);
      return;
    }

    // 프론트엔드 상태 먼저 업데이트 (즉시 반영)
    setTodos((prev) => {
      return prev.map((todo) =>
        todo.id === id
          ? {
            ...todo,
            time: updates.time,
            startTime: updates.time,
            endTime: endTime,
            duration: updates.duration
          }
          : todo
      );
    });

    // 백엔드에 저장 - Google Calendar 이벤트나 Routine 인스턴스는 제외
    if (
      updatedTodo.id &&
      !updatedTodo.id.startsWith('routine-') &&
      updatedTodo.source !== 'google_calendar' &&
      !updatedTodo.googleCalendarEventId
    ) {
      // UUID 형식인지 확인 (36자 문자열: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedTodo.id);

      if (isUUID) {
        // 실제 DB의 Todo ID인 경우에만 백엔드 업데이트
        try {
          console.log('[일정 시간 업데이트] 백엔드에 저장:', {
            id: updatedTodo.id,
            start_time: updates.time,
            end_time: endTime
          });

          const updateData = {
            start_time: updates.time,
            end_time: endTime,
            // duration은 계산된 값이므로 별도로 전달하지 않음
          };

          console.log('[일정 시간 업데이트] 백엔드 API 호출:', {
            id: updatedTodo.id,
            data: updateData
          });

          const response = await apiClient.updateTodo(updatedTodo.id, updateData);

          console.log('[일정 시간 업데이트] 백엔드 응답:', response.data);

          console.log('[일정 시간 업데이트] 백엔드 저장 성공');
          toast.success("일정 시간이 변경되었습니다.");
        } catch (error: any) {
          console.error('일정 시간 업데이트 실패:', error);

          // 에러 발생 시 프론트엔드 상태를 원래대로 되돌림
          setTodos((prev) => {
            return prev.map((todo) =>
              todo.id === id
                ? {
                  ...todo,
                  time: updatedTodo.time || updatedTodo.startTime || "09:00",
                  startTime: updatedTodo.startTime,
                  endTime: updatedTodo.endTime,
                  duration: updatedTodo.duration || 60
                }
                : todo
            );
          });

          // 404 에러는 Google Calendar 이벤트 등 실제 DB에 없는 경우이므로 조용히 처리
          if (error.response?.status !== 404) {
            toast.error('일정 시간 업데이트에 실패했습니다.');
          }
        }
      } else {
        // UUID가 아닌 경우 (예: routine-, google_ 등) 프론트엔드 상태만 업데이트
        console.log('[일정 시간 업데이트] 프론트엔드만 업데이트 (UUID 아님):', updatedTodo.id);
        toast.success("일정 시간이 변경되었습니다.");
      }
    } else {
      // Google Calendar 이벤트나 Routine 인스턴스는 프론트엔드 상태만 업데이트
      console.log('[일정 시간 업데이트] 프론트엔드만 업데이트 (Google Calendar/Routine):', id);
      toast.success("일정 시간이 변경되었습니다.");
    }

    // Routine 인스턴스 처리
    if (id.startsWith('routine-')) {
      const parts = id.split('-');
      // Format: routine-{id}-{yyyy}-{mm}-{dd}
      const routineId = parts[1];
      const dateStr = parts.slice(2).join('-');

      const routine = routines.find(r => r.id === routineId);

      if (routine) {
        // Create a new "Exception" Todo
        setTodos((prev) => {
          const existingException = prev.find(t => t.id === id);
          if (existingException) {
            return prev.map((todo) =>
              todo.id === id
                ? {
                  ...todo,
                  time: updates.time,
                  startTime: updates.time,
                  endTime: endTime,
                  duration: updates.duration
                }
                : todo
            );
          } else {
            const newExceptionTodo: TodoItem = {
              id: id, // Maintain the same ID to shadow the routine instance
              title: routine.name,
              time: updates.time, // New time
              startTime: updates.time,
              endTime: endTime,
              duration: updates.duration, // New duration
              completed: false,
              category: routine.category || "기타",
              date: dateStr,
              memberId: routine.memberId,
              isRoutine: true, // Mark as detached routine
              routineId: routine.id,
              memo: routine.memo,
            };
            return [...prev, newExceptionTodo];
          }
        });
      }
    }
  };

  // STT/OCR로 추출된 텍스트 및 일정 정보 상태
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractedTodoInfo, setExtractedTodoInfo] = useState<any>(null);

  // 로컬 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleInputMethodSelect = (method: 'voice' | 'camera' | 'text', extractedText?: string, todoInfo?: any) => {
    setShowInputMethodModal(false);

    if (method === 'voice') {
      toast.info('음성 입력을 시작합니다.');
    } else if (method === 'camera') {
      toast.info('이미지 촬영을 시작합니다.');
    } else {
      // 텍스트 입력 또는 STT/OCR로 추출된 텍스트와 일정 정보가 있으면 설정
      if (extractedText) {
        setExtractedText(extractedText);
      }
      if (todoInfo) {
        console.log("일정 정보 받음:", todoInfo);
        setExtractedTodoInfo(todoInfo);
      }
      setShowAddTodoModal(true);
    }
  };

  /* Helper to get Todos for a specific date (시간표와 분리) */
  const getTodosForDate = (targetDate: Date) => {
    // 로컬 날짜를 직접 포맷팅 (UTC 변환으로 인한 날짜 밀림 방지)
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDateObj = new Date(dateString);
    currentDateObj.setHours(0, 0, 0, 0);

    // Regular Todos만 반환 (시간표는 제외)
    // 기간 일정인 경우 시작일부터 종료일까지 모든 날짜에 표시
    const regularTodos = todos.filter(t => {
      if (t.isRoutine) return false;
      if (!t.date) return false;

      // 시작일과 동일한 경우
      if (t.date === dateString) return true;

      // 기간 일정인 경우: 시작일과 종료일 사이에 포함되는지 확인
      if (t.endDate && t.endDate !== t.date) {
        const startDate = new Date(t.date);
        const endDate = new Date(t.endDate);

        // 날짜 비교 (시간 제외)
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        return currentDateObj >= startDate && currentDateObj <= endDate;
      }

      return false;
    });

    return regularTodos.sort((a, b) => a.time.localeCompare(b.time));
  };

  const filteredRoutines = routines.filter(r => selectedMembers.includes(r.memberId));
  // For Todo List tab (Today)
  const displayTodos = getTodosForDate(new Date());

  // 동기화 상태 표시 포맷팅
  const formatLastSyncTime = () => {
    if (!lastSyncTime) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col max-w-[375px] mx-auto relative pb-4">
      {/* Google Calendar 동기화 상태 표시 */}
      {syncStatus !== 'idle' && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${
          syncStatus === 'syncing' ? 'bg-[#E0F2FE] text-[#0EA5E9]' :
          syncStatus === 'success' ? 'bg-[#D1FAE5] text-[#10B981]' :
          syncStatus === 'disabled' ? 'bg-[#F3F4F6] text-[#6B7280]' :
          'bg-[#FEE2E2] text-[#EF4444]'
        }`}>
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && <Clock size={12} className="animate-spin" />}
            {syncStatus === 'success' && <Check size={12} />}
            {syncStatus === 'error' && <X size={12} />}
            {syncStatus === 'disabled' && <Clock size={12} />}
            <span>
              {syncStatus === 'syncing' && '동기화 중...'}
              {syncStatus === 'success' && `마지막 동기화: ${formatLastSyncTime()}`}
              {syncStatus === 'error' && `동기화 실패: ${syncError || '알 수 없는 오류'}`}
              {syncStatus === 'disabled' && '동기화 비활성화'}
            </span>
          </div>
          {syncStatus === 'error' && (
            <button
              onClick={() => loadGoogleCalendarEvents(true)}
              className="text-xs underline hover:no-underline"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* Header - Profile, Search, Notification */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F3F4F6]">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
        >
          <span className="text-xl">{selectedEmoji}</span>
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="일정을 검색해주세요."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className="w-full px-4 py-2 bg-[#F9FAFB] rounded-full text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:bg-white transition-all"
          />

          {/* 검색 결과 드롭다운 */}
          {showSearchResults && filteredTodos.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] z-50 max-h-[400px] overflow-y-auto">
              <div className="p-2">
                <div className="text-xs text-[#9CA3AF] px-3 py-2 font-medium">
                  검색 결과 ({filteredTodos.length}개)
                </div>
                <div className="space-y-1">
                  {filteredTodos.map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => {
                        setSelectedTodoForDetail(todo.id);
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="px-3 py-3 rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors border-b border-[#F3F4F6] last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium text-sm ${todo.completed ? "line-through text-[#9CA3AF]" : "text-[#1F2937]"}`}>
                              {todo.title}
                            </h4>
                            {todo.completed && (
                              <Check size={14} className="text-[#10B981] flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
                            {todo.date && (
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(todo.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {todo.startTime && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {todo.startTime}
                              </span>
                            )}
                            {todo.category && (
                              <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(todo.category)}`}>
                                {todo.category}
                              </span>
                            )}
                          </div>
                          {todo.location && (
                            <div className="flex items-center gap-1 text-xs text-[#6B7280] mb-1">
                              <MapPin size={12} />
                              <span className="truncate">{todo.location}</span>
                            </div>
                          )}
                          {todo.memo && (
                            <p className="text-xs text-[#6B7280] line-clamp-2 mt-1">
                              {todo.memo}
                            </p>
                          )}
                          {todo.checklistItems && todo.checklistItems.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {todo.checklistItems.slice(0, 3).map((item, index) => (
                                <span key={index} className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">
                                  {item}
                                </span>
                              ))}
                              {todo.checklistItems.length > 3 && (
                                <span className="text-xs text-[#9CA3AF]">
                                  +{todo.checklistItems.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {showSearchResults && searchQuery.trim().length > 0 && filteredTodos.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] z-50 p-4">
              <div className="text-center text-sm text-[#9CA3AF]">
                검색 결과가 없습니다.
              </div>
            </div>
          )}
        </div>
        <button className="p-2 flex-shrink-0" onClick={() => setShowNotificationPanel(true)}>
          <Bell size={20} className="text-[#6B7280]" />
        </button>
      </div>

      {/* ToDo, Calendar, Routine Tabs */}
      <div className="bg-white px-4 py-3 border-b border-[#F3F4F6]">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("todo")}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${activeTab === "todo"
              ? "bg-[#FF9B82] text-white"
              : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
          >
            ToDo
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${activeTab === "calendar"
              ? "bg-[#FF9B82] text-white"
              : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
          >
            캘린더
          </button>
          <button
            onClick={() => setActiveTab("routine")}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${activeTab === "routine"
              ? "bg-[#FF9B82] text-white"
              : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
          >
            시간표
          </button>
        </div>
      </div>

      {/* 시간표 탭 아래에 사용자 선택 영역을 배치 (UX 개선: 탭 → 필터 순서) */}
      {activeTab === "routine" && (
        <div className="bg-white px-4 pt-6 pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-[#1F2937]">시간표 보기</h4>
            <button
              onClick={() => setShowMemberAddSheet(true)}
              className="px-3 py-1.5 text-sm font-medium bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors flex items-center gap-1"
            >
              <Users size={16} />
              추가
            </button>
          </div>
          {/* 가로 스크롤 가능한 사용자 목록 */}
          <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
            {familyMembers.map((member) => {
              const isSelected = selectedMembers.includes(member.id);
              return (
                <div key={member.id} className="flex-shrink-0 relative group">
                  <button
                    onClick={() => toggleMemberSelection(member.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] ${isSelected
                      ? "bg-[#FF9B82] shadow-md scale-100"
                      : "bg-[#F9FAFB] hover:bg-[#F3F4F6]"
                      }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all relative ${isSelected
                        ? "bg-white"
                        : "bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82]"
                        }`}
                    >
                      {member.emoji}
                    </div>
                    <span
                      className={`text-xs font-medium ${isSelected ? "text-white" : "text-[#6B7280]"
                        }`}
                    >
                      {member.name}
                    </span>
                  </button>
                  {/* 편집 버튼 (호버 시 표시) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMemberId(member.id);
                      setShowMemberAddSheet(true);
                    }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-[#6366F1] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#5558E3] z-10"
                    title="수정"
                  >
                    <Edit2 size={12} />
                  </button>
                  {/* 삭제 버튼 (호버 시 표시, "나"는 제외) */}
                  {member.id !== "1" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMember(member.id);
                      }}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#EF4444] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#DC2626] z-10"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
        todos={todos}
      />

      {/* Timeline ToDo List */}
      <div className="flex-1 overflow-auto bg-white relative">
        {/* Profile Menu Dropdown */}
        {showProfileMenu && (
          <div className="absolute top-4 left-4 right-4 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Header with Close Button */}
            <div className="relative">
              {/* User Info Section */}
              <div className="px-5 py-4 bg-gradient-to-r from-[#FFF0EB] to-[#FFE8E0] border-b border-[#FFD4C8]">
                <div className="space-y-3">
                  {/* Profile Emoji */}
                  <div className="flex items-center justify-center mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center">
                      <span className="text-4xl">{selectedEmoji}</span>
                    </div>
                  </div>
                  {/* User Name */}
                  <div className="flex items-center justify-center">
                    <span className="text-base font-medium text-[#1F2937]">{userName}</span>
                  </div>
                  {/* Email */}
                  <div className="flex items-center justify-center">
                    <span className="text-sm text-[#6B7280]">{userEmail}</span>
                  </div>
                </div>
              </div>
              {/* Close Button */}
              <button
                onClick={() => setShowProfileMenu(false)}
                className="absolute top-3 right-3 p-1.5 bg-white/80 hover:bg-white rounded-full transition-colors shadow-sm"
                aria-label="닫기"
              >
                <X size={18} className="text-[#6B7280]" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowMyPageScreen(true);
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User size={20} className="text-[#6B7280]" />
                  <span className="text-[#1F2937]">마이페이지</span>
                </div>
                <ChevronRight size={18} className="text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowSettingsScreen(true);
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings size={20} className="text-[#6B7280]" />
                  <span className="text-[#1F2937]">설정</span>
                </div>
                <ChevronRight size={18} className="text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowCommunityScreen(true);
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-[#6B7280]" />
                  <span className="text-[#1F2937]">커뮤니티</span>
                </div>
                <ChevronRight size={18} className="text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  toast.info("고객센터로 이동합니다.");
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle size={20} className="text-[#6B7280]" />
                  <span className="text-[#1F2937]">고객센터</span>
                </div>
                <ChevronRight size={18} className="text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  toast.info("사용설명서를 열었습니다.");
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-[#6B7280]" />
                  <span className="text-[#1F2937]">사용설명서</span>
                </div>
                <ChevronRight size={18} className="text-[#9CA3AF]" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-2 bg-[#F3F4F6]" />

            {/* Logout */}
            <button
              onClick={async () => {
                try {
                  setShowProfileMenu(false);

                  // 백엔드에 로그아웃 요청 (선택사항)
                  try {
                    await apiClient.logout();
                  } catch (error) {
                    console.error('Logout API error:', error);
                    // API 호출 실패해도 로컬 로그아웃은 진행
                  }

                  // 로컬 스토리지에서 토큰 삭제
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('refresh_token');
                  localStorage.removeItem('remember_me');

                  toast.success("로그아웃 되었습니다.");

                  // 페이지 리로드하여 로그인 화면으로 전환
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 500);
                } catch (error) {
                  console.error('Logout error:', error);
                  toast.error("로그아웃 중 오류가 발생했습니다.");
                }
              }}
              className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-[#FEF2F2] transition-colors"
            >
              <LogOut size={20} className="text-[#EF4444]" />
              <span className="text-[#EF4444]">로그아웃</span>
            </button>
          </div>
        )}

        <div className="px-4 py-4">
          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div className="space-y-4">
              {/* Calendar View Selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCalendarView("month")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${calendarView === "month"
                    ? "bg-[#FF9B82] text-white"
                    : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                >
                  월간
                </button>
                <button
                  onClick={() => setCalendarView("week")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${calendarView === "week"
                    ? "bg-[#FF9B82] text-white"
                    : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                >
                  주간
                </button>
                <button
                  onClick={() => setCalendarView("day")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${calendarView === "day"
                    ? "bg-[#FF9B82] text-white"
                    : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                >
                  일간
                </button>
              </div>

              {/* Month Calendar */}
              {calendarView === "month" && (
                <>
                  <MonthCalendar
                    todos={todos}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => {
                      setSelectedDate(date);
                    }}
                    onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                  />

                  {/* Selected Date Todos */}
                  <div className="pt-4 border-t border-[#F3F4F6]">
                    <h3 className="font-semibold text-[#1F2937] mb-3 px-1">
                      일정
                    </h3>
                    <div className="space-y-2">
                      {(selectedDate ? (() => {
                        // 선택된 날짜의 일정 필터링 (기간 일정 포함)
                        const selectedDateObj = new Date(selectedDate);
                        selectedDateObj.setHours(0, 0, 0, 0);

                        return todos.filter(t => {
                          if (t.isRoutine || !t.date) return false;

                          // 시작일과 동일한 경우
                          if (t.date === selectedDate) return true;

                          // 기간 일정인 경우: 시작일과 종료일 사이에 포함되는지 확인
                          if (t.endDate && t.endDate !== t.date) {
                            const startDate = new Date(t.date);
                            const endDate = new Date(t.endDate);

                            startDate.setHours(0, 0, 0, 0);
                            endDate.setHours(0, 0, 0, 0);

                            return selectedDateObj >= startDate && selectedDateObj <= endDate;
                          }

                          return false;
                        }).sort((a, b) => a.time.localeCompare(b.time));
                      })() : displayTodos).map((todo) => (
                        <div
                          key={todo.id}
                          className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all`}
                          onClick={() => setSelectedTodoForDetail(todo.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTodoComplete(todo.id);
                                  }}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-110 transition-transform ${todo.completed
                                    ? "bg-[#FF9B82] border-[#FF9B82]"
                                    : "border-[#D1D5DB] bg-white hover:border-[#FF9B82]"
                                    }`}
                                >
                                  {todo.completed && (
                                    <Check size={12} className="text-white" strokeWidth={3} />
                                  )}
                                </div>
                                <h4
                                  className={`text-sm font-medium ${todo.completed
                                    ? "line-through text-[#9CA3AF]"
                                    : "text-[#1F2937]"
                                    }`}
                                >
                                  {todo.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 mt-1 ml-6">
                                <span className="text-xs text-[#6B7280]">
                                  {todo.endDate && todo.endDate !== todo.date
                                    ? `${todo.date} ~ ${todo.endDate}`
                                    : todo.startTime && todo.endTime
                                      ? `${todo.startTime} ~ ${todo.endTime}`
                                      : todo.time
                                        ? `${todo.time} • ${formatDuration(todo.duration || 0)}`
                                        : ''}
                                </span>
                                <span className="text-xs text-[#9CA3AF] bg-white px-2 py-0.5 rounded-full">
                                  {todo.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Week Calendar */}
              {calendarView === "week" && (
                <WeekCalendar
                  todos={todos}
                  onTodoUpdate={handleTodoUpdate}
                  onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                />
              )}

              {/* Day Calendar */}
              {calendarView === "day" && (
                <DayCalendar
                  todos={todos}
                  onTodoUpdate={handleTodoUpdate}
                  onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                />
              )}
            </div>
          )}

          {/* ToDo List */}
          {activeTab === "todo" && (
            <>
              <div className="mb-4 px-1">
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {new Date().getMonth() + 1}월 {new Date().getDate()}일
                  <span className="ml-2 text-base font-normal text-[#6B7280]">
                    {['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}요일
                  </span>
                </h2>
              </div>
              <div className="space-y-3">
                {displayTodos.length === 0 ? (
                  <div className="text-center py-8 text-[#9CA3AF]">
                    <p className="text-sm">오늘 예정된 일정이 없습니다.</p>
                  </div>
                ) : (
                  displayTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-4 hover:shadow-sm transition-all cursor-pointer`}
                      onClick={() => setSelectedTodoForDetail(todo.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTodoComplete(todo.id);
                              }}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-110 transition-transform ${todo.completed
                                ? "bg-[#FF9B82] border-[#FF9B82]"
                                : "border-[#D1D5DB] bg-white hover:border-[#FF9B82]"
                                }`}
                            >
                              {todo.completed && (
                                <Check size={14} className="text-white" strokeWidth={3} />
                              )}
                            </div>
                            <h4
                              className={`font-medium ${todo.completed
                                ? "line-through text-[#9CA3AF]"
                                : "text-[#1F2937]"
                                }`}
                            >
                              {todo.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mt-2 ml-7">
                            <span className="text-xs text-[#6B7280]">
                              {todo.endDate && todo.endDate !== todo.date
                                ? `${todo.date} ~ ${todo.endDate}`
                                : todo.startTime && todo.endTime
                                  ? `${todo.startTime} ~ ${todo.endTime}`
                                  : todo.time
                                    ? `${todo.time} • ${formatDuration(todo.duration || 0)}`
                                    : ''}
                            </span>
                            <span className="text-xs text-[#9CA3AF] bg-white px-2 py-0.5 rounded-full">
                              {todo.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </>
          )}

          {/* Routine View */}
          {activeTab === "routine" && (
            <RoutineView
              currentUserEmoji={selectedEmoji}
              currentUserName="나"
              selectedMemberIds={selectedMembers}
              familyMembers={familyMembers}
              routines={routines}
              onAddRoutine={handleRoutineAdd}
              onUpdateRoutine={handleRoutineUpdate}
              onDeleteRoutine={handleRoutineDelete}
              onToggleRoutineInCalendar={handleToggleRoutineInCalendar}
              todos={todos}
            />
          )}
        </div>
      </div>

      {/* Todo Detail Modal - 공통 사용 (모든 탭에서 표시) */}
      {selectedTodoForDetail && (() => {
        const todo = todos.find(t => t.id === selectedTodoForDetail);
        if (!todo) return null;

        // 체크리스트 항목 준비
        const checklistItems = todo.checklistItems || [];
        const todoChecklistStates = checklistItemStates[todo.id] || {};

        // 체크리스트 항목 토글 함수
        const toggleChecklistItem = (itemIndex: number) => {
          const itemKey = `item-${itemIndex}`;
          setChecklistItemStates(prev => ({
            ...prev,
            [todo.id]: {
              ...prev[todo.id],
              [itemKey]: !prev[todo.id]?.[itemKey],
            },
          }));
        };

        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setSelectedTodoForDetail(null)}
            />

            {/* Detail Box */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 max-w-[90vw] max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 border-2 border-[#E5E7EB] overflow-y-auto">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-[#1F2937] flex-1">일정 상세</h3>
                  <button
                    onClick={() => setSelectedTodoForDetail(null)}
                    className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  >
                    <X size={20} className="text-[#6B7280]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#FAFAFA] rounded-lg p-4">
                    <h4 className="font-medium text-[#1F2937] mb-4 text-lg">{todo.title}</h4>

                    <div className="space-y-3">
                      {/* 날짜 - 기간 표시 */}
                      {todo.date && (
                        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                          <Calendar size={18} className="text-[#9CA3AF]" />
                          <span>
                            {todo.endDate && todo.endDate !== todo.date
                              ? `${new Date(todo.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} ~ ${new Date(todo.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`
                              : new Date(todo.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                          </span>
                        </div>
                      )}

                      {/* 시간 */}
                      <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                        <Clock size={18} className="text-[#9CA3AF]" />
                        <div className="flex flex-col gap-1">
                          {todo.isAllDay ? (
                            <span className="font-medium">하루종일</span>
                          ) : (
                            <>
                              <span>
                                {todo.startTime || todo.time} ~ {todo.endTime || (todo.duration ? `${Math.floor(todo.duration / 60)}:${String(todo.duration % 60).padStart(2, '0')}` : '')}
                              </span>
                              {todo.duration && <span className="text-xs text-[#9CA3AF]">({formatDuration(todo.duration)})</span>}
                            </>
                          )}
                        </div>
                      </div>

                      {/* 카테고리 */}
                      <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                        <Tag size={18} className="text-[#9CA3AF]" />
                        <span
                          className={`px-3 py-1 rounded text-sm ${getCategoryColor(todo.category)}`}
                        >
                          {todo.category}
                        </span>
                      </div>

                      {/* 장소 */}
                      {todo.location && (
                        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                          <MapPin size={18} className="text-[#9CA3AF]" />
                          <span>{todo.location}</span>
                        </div>
                      )}

                      {/* 미루기 설정 */}
                      <div className="flex items-center gap-3 text-sm text-[#6B7280] pt-3 border-t border-[#E5E7EB]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={todo.postponeToNextDay || false}
                            onChange={async (e) => {
                              const isChecked = e.target.checked;

                              // 프론트엔드 상태 업데이트
                              setTodos(prev =>
                                prev.map(t =>
                                  t.id === todo.id
                                    ? { ...t, postponeToNextDay: isChecked }
                                    : t
                                )
                              );

                              // 체크박스가 해제되면 다음날 일정 삭제
                              if (!isChecked) {
                                try {
                                  // 다음날 날짜 계산
                                  if (!todo.date) {
                                    return;
                                  }
                                  const currentDate = new Date(todo.date);
                                  const nextDate = new Date(currentDate);
                                  nextDate.setDate(nextDate.getDate() + 1);

                                  // 다음날 날짜 문자열로 변환
                                  const nextDateString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

                                  // 다음날에 같은 일정 찾기 (제목, 날짜, 시작 시간이 일치)
                                  const nextDayTodo = todos.find(t =>
                                    t.title === todo.title &&
                                    t.date === nextDateString &&
                                    t.startTime === todo.startTime
                                  );

                                  if (nextDayTodo) {
                                    console.log("미루기 해제: 다음날 일정 삭제 시작:", nextDayTodo.id);
                                    await deleteTodo(nextDayTodo.id);
                                    toast.success("다음날 일정이 삭제되었습니다.");
                                  }
                                } catch (error: any) {
                                  console.error("다음날 일정 삭제 실패:", error);
                                  toast.error("다음날 일정 삭제에 실패했습니다.");
                                }
                                return;
                              }

                              // 체크박스가 체크되면 다음날 일정 생성
                              if (isChecked) {
                                try {
                                  // 다음날 날짜 계산
                                  if (!todo.date) {
                                    toast.error("일정 날짜가 없습니다.");
                                    return;
                                  }
                                  const currentDate = new Date(todo.date);
                                  const nextDate = new Date(currentDate);
                                  nextDate.setDate(nextDate.getDate() + 1);

                                  // 다음날 날짜 문자열로 변환
                                  const nextDateString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

                                  // 다음날에 이미 같은 일정이 있는지 확인
                                  const existingNextDayTodo = todos.find(t =>
                                    t.title === todo.title &&
                                    t.date === nextDateString &&
                                    t.startTime === todo.startTime
                                  );

                                  if (existingNextDayTodo) {
                                    toast.info("다음날에 이미 같은 일정이 있습니다.");
                                    return;
                                  }

                                  // 다음날 일정 데이터 준비
                                  const duration = todo.duration || 60;
                                  const [startHours, startMinutes] = (todo.startTime || "09:00").split(':').map(Number);
                                  const startTotalMinutes = startHours * 60 + startMinutes;
                                  const endTotalMinutes = startTotalMinutes + duration;
                                  const endHours = Math.floor(endTotalMinutes / 60) % 24;
                                  const endMins = endTotalMinutes % 60;
                                  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

                                  const nextDayTodoData = {
                                    title: todo.title,
                                    description: todo.memo || "",
                                    memo: todo.memo || "",
                                    location: todo.location || "",
                                    date: nextDateString,
                                    start_time: todo.startTime || "09:00",
                                    end_time: endTime,
                                    all_day: todo.isAllDay || false,
                                    category: todo.category || "기타",
                                    status: 'pending',
                                    has_notification: todo.hasNotification || false,
                                    notification_times: todo.alarmTimes || [],
                                    repeat_type: "none",
                                    checklist_items: todo.checklistItems || [],
                                  };

                                  console.log("다음날 일정 생성 시작:", nextDayTodoData);
                                  const response = await apiClient.createTodo(nextDayTodoData);

                                  if (response && response.data) {
                                    // 응답 데이터에서 날짜 형식 변환
                                    let todoDate = response.data.date;
                                    if (todoDate instanceof Date) {
                                      const year = todoDate.getFullYear();
                                      const month = todoDate.getMonth() + 1;
                                      const day = todoDate.getDate();
                                      todoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    } else if (typeof todoDate === 'string') {
                                      todoDate = todoDate;
                                    }

                                    const newNextDayTodo: TodoItem = {
                                      id: response.data.id,
                                      title: response.data.title,
                                      time: response.data.start_time || "09:00",
                                      duration: duration,
                                      completed: false,
                                      category: response.data.category || "기타",
                                      date: todoDate,
                                      startTime: response.data.start_time,
                                      endTime: response.data.end_time,
                                      isAllDay: response.data.all_day || false,
                                      memo: response.data.memo || response.data.description || "",
                                      location: response.data.location || "",
                                      hasNotification: response.data.has_notification || false,
                                      alarmTimes: response.data.notification_times || [],
                                      repeatType: response.data.repeat_type || "none",
                                      checklistItems: response.data.checklist_items?.map((item: any) => item.text || item) || [],
                                      memberId: todo.memberId,
                                      isRoutine: false,
                                    };

                                    setTodos(prev => [...prev, newNextDayTodo]);
                                    toast.success("다음날 일정이 추가되었습니다.");
                                    console.log("다음날 일정 생성 완료:", newNextDayTodo);
                                  } else {
                                    console.error("응답 데이터 없음:", response);
                                    toast.error("다음날 일정 추가에 실패했습니다.");
                                  }
                                } catch (error: any) {
                                  console.error("다음날 일정 생성 실패:", error);
                                  console.error("에러 상세:", error.response?.data || error.message);
                                  toast.error(`다음날 일정 추가에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
                                }
                              }
                            }}
                            className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-2 focus:ring-[#FF9B82]"
                          />
                          <span className="text-sm text-[#1F2937]">미루기</span>
                        </label>
                      </div>

                      {/* 체크리스트 항목 표시 */}
                      {checklistItems.length > 0 && (
                        <div className="pt-3 border-t border-[#E5E7EB]">
                          <h5 className="text-xs font-medium text-[#9CA3AF] uppercase mb-2">체크리스트</h5>
                          <div className="space-y-2">
                            {checklistItems.map((itemText, index) => {
                              const itemKey = `item-${index}`;
                              const isCompleted = todoChecklistStates[itemKey] || false;
                              return (
                                <div key={index} className="flex items-center gap-3">
                                  <button
                                    onClick={() => toggleChecklistItem(index)}
                                    className={`
                                      w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                      ${isCompleted ? 'bg-[#FF9B82] border-[#FF9B82]' : 'border-[#D1D5DB] hover:border-[#FF9B82]'}
                                    `}
                                  >
                                    {isCompleted && <Check size={14} className="text-white" />}
                                  </button>
                                  <span className={`text-sm text-[#1F2937] ${isCompleted ? 'line-through text-[#9CA3AF]' : ''}`}>
                                    {itemText}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 메모 */}
                      {todo.memo && (
                        <div className="pt-3 border-t border-[#E5E7EB]">
                          <h5 className="text-xs font-medium text-[#9CA3AF] uppercase mb-2">메모</h5>
                          <p className="text-sm text-[#1F2937] whitespace-pre-wrap">{todo.memo}</p>
                        </div>
                      )}

                      {/* 반복 설정 */}
                      {todo.repeatType && todo.repeatType !== 'none' && (
                        <div className="flex items-center gap-3 text-sm text-[#6B7280] pt-3 border-t border-[#E5E7EB]">
                          <Repeat size={18} className="text-[#9CA3AF]" />
                          <span>
                            {todo.repeatType === 'daily' && '매일 반복'}
                            {todo.repeatType === 'weekly' && '매주 반복'}
                            {todo.repeatType === 'monthly' && '매월 반복'}
                            {todo.repeatType === 'yearly' && '매년 반복'}
                          </span>
                        </div>
                      )}

                      {/* 알림 설정 */}
                      {todo.hasNotification && (
                        <div className="pt-3 border-t border-[#E5E7EB]">
                          <div className="flex items-center gap-3 text-sm text-[#6B7280] mb-2">
                            <Bell size={18} className="text-[#9CA3AF]" />
                            <span>알림 설정됨</span>
                          </div>
                          {todo.alarmTimes && todo.alarmTimes.length > 0 && (
                            <div className="ml-7 space-y-1">
                              {todo.alarmTimes.map((alarmTime, index) => (
                                <div key={index} className="text-xs text-[#6B7280]">
                                  • {alarmTime}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 완료 상태 */}
                      <div className="pt-3 border-t border-[#E5E7EB]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#6B7280]">상태:</span>
                          <span className={`text-sm font-medium ${todo.completed ? "text-[#10B981]" : "text-[#F59E0B]"
                            }`}>
                            {todo.completed ? "완료" : "미완료"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 수정 및 삭제 버튼 */}
                <div className="mt-6 pt-4 border-t border-[#E5E7EB] flex gap-3">
                  <button
                    onClick={async () => {
                      if (window.confirm('이 일정을 삭제하시겠습니까?')) {
                        console.log("일정 상세 모달에서 삭제 버튼 클릭:", todo.id);
                        await deleteTodo(todo.id);
                        setSelectedTodoForDetail(null);
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    삭제
                  </button>
                  <button
                    onClick={() => {
                      setEditingTodoId(todo.id);
                      setShowAddTodoModal(true);
                      setSelectedTodoForDetail(null);
                    }}
                    className="flex-1 px-4 py-3 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Edit2 size={18} />
                    수정
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Floating Action Button (Add Todo) */}
      <button
        className="fixed w-16 h-16 bg-[#FF9B82] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#FF8A6D] transition-all hover:scale-110 z-40 cursor-move select-none"
        style={{
          right: `24px`,
          bottom: `80px`,
          transform: `translate(${fabPosition.x}px, ${fabPosition.y}px)`,
        }}
        aria-label="일정 추가"
        onMouseDown={handleFabMouseDown}
        onTouchStart={handleFabTouchStart}
      >
        <Pencil size={28} strokeWidth={2.5} />
      </button>

      {/* Input Method Modal */}
      {showInputMethodModal && (
        <InputMethodModal
          isOpen={showInputMethodModal}
          onClose={() => setShowInputMethodModal(false)}
          onSelect={handleInputMethodSelect}
        />
      )}

      {/* Add Todo Modal */}
      {showAddTodoModal && (
        <AddTodoModal
          isOpen={showAddTodoModal}
          onClose={() => {
            setShowAddTodoModal(false);
            setEditingTodoId(null);
            setExtractedText(""); // 모달 닫을 때 추출된 텍스트 초기화
          }}
          onSave={handleSaveDetailedTodo}
          initialData={
            editingTodoId
              ? todos.find(t => t.id === editingTodoId)
              : extractedTodoInfo
                ? {
                  title: extractedTodoInfo.title || '',
                  date: extractedTodoInfo.date || formatLocalDate(new Date()),
                  endDate: extractedTodoInfo.endDate || extractedTodoInfo.date || formatLocalDate(new Date()), // 종료 날짜 (없으면 시작 날짜와 동일)
                  startTime: extractedTodoInfo.startTime || (extractedTodoInfo.isAllDay ? '' : '09:00'),
                  endTime: extractedTodoInfo.endTime || (extractedTodoInfo.isAllDay ? '' : '10:00'),
                  isAllDay: extractedTodoInfo.isAllDay || false,
                  category: extractedTodoInfo.category || '기타',
                  checklistItems: extractedTodoInfo.checklistItems && extractedTodoInfo.checklistItems.length > 0
                    ? extractedTodoInfo.checklistItems.filter((item: string) => item && item.trim() !== '')
                    : [],
                  location: extractedTodoInfo.location || '',
                  memo: extractedTodoInfo.memo || extractedText || '',
                  repeatType: extractedTodoInfo.repeatType || 'none',
                  hasNotification: extractedTodoInfo.hasNotification || false,
                  alarmTimes: extractedTodoInfo.alarmTimes || [],
                }
                : extractedText
                  ? { memo: extractedText }
                  : undefined
          }
        />
      )}

      {/* Member Add Sheet */}
      <MemberAddSheet
        isOpen={showMemberAddSheet}
        onClose={() => {
          setShowMemberAddSheet(false);
          setEditingMemberId(null);
        }}
        onSave={handleSaveMember}
        initialData={editingMemberId ? familyMembers.find(m => m.id === editingMemberId) : undefined}
      />

      {/* Work Contact Add Sheet */}
      <WorkContactAddSheet
        isOpen={showWorkContactAddSheet}
        onClose={() => setShowWorkContactAddSheet(false)}
        onSave={handleSaveWorkContact}
      />

      {/* Community Screen */}
      <CommunityScreen
        isOpen={showCommunityScreen}
        onClose={() => setShowCommunityScreen(false)}
      />

      {/* MyPage Screen */}
      <MyPageScreen
        isOpen={showMyPageScreen}
        onClose={() => setShowMyPageScreen(false)}
        userName={userName}
        userEmail={userEmail}
        selectedEmoji={selectedEmoji}
        onUserNameChange={async (name: string) => {
          try {
            await apiClient.updateUser({ name });
            setUserName(name);
            toast.success("이름이 변경되었습니다.");
          } catch (error) {
            console.error("이름 변경 실패:", error);
            toast.error("이름 변경에 실패했습니다.");
          }
        }}
        onEmojiChange={async (emoji: string) => {
          try {
            await apiClient.updateUser({ avatar_emoji: emoji });
            setSelectedEmoji(emoji);
            toast.success("프로필 이모지가 변경되었습니다.");
          } catch (error) {
            console.error("이모지 변경 실패:", error);
            toast.error("이모지 변경에 실패했습니다.");
          }
        }}
      />

      {/* Settings Screen */}
      <SettingsScreen
        isOpen={showSettingsScreen}
        onClose={() => setShowSettingsScreen(false)}
      />
    </div>
  );
}