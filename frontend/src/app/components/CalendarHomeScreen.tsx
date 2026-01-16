import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell,
  Pencil,
  Check,
  User,
  Settings,
  Users,
  HelpCircle,
  LogOut,
  ChevronRight,
  FileText,
  X,
  Clock,
  Tag,
  Calendar,
  MapPin,
  Repeat,
} from "lucide-react";
import { CommunityScreen } from "./CommunityScreen";
import { MyPageScreen } from "./MyPageScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ProfileManagementScreen } from "./ProfileManagementScreen";
import { NotificationPanel } from "./NotificationPanel";
import { InputMethodModal } from "./InputMethodModal";
import { AddTodoModal } from "./AddTodoModal";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { DayCalendar } from "./DayCalendar";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import { formatDuration } from "@/utils/formatDuration";
import { useIsMobile } from "./ui/use-mobile";

export function CalendarHomeScreen() {
  const isMobile = useIsMobile();
  const [showCommunityScreen, setShowCommunityScreen] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMyPageScreen, setShowMyPageScreen] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [showProfileManagementScreen, setShowProfileManagementScreen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // 읽음 상태를 localStorage에서 불러오기
  const [readUpcomingNotificationIds, setReadUpcomingNotificationIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('readUpcomingNotificationIds');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("읽음 예정 알림 상태 불러오기 실패:", error);
    }
    return new Set();
  });

  const [readPastNotificationIds, setReadPastNotificationIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('readPastNotificationIds');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("읽음 지나간 알림 상태 불러오기 실패:", error);
    }
    return new Set();
  });

  // 기존 호환성을 위한 readNotificationIds (지나간 알림용)
  const readNotificationIds = readPastNotificationIds;
  const [showTodoDetailFromNotification, setShowTodoDetailFromNotification] = useState(false);

  // 읽음 상태를 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('readUpcomingNotificationIds', JSON.stringify(Array.from(readUpcomingNotificationIds)));
    } catch (error) {
      console.error("읽음 예정 알림 상태 저장 실패:", error);
    }
  }, [readUpcomingNotificationIds]);

  useEffect(() => {
    try {
      localStorage.setItem('readPastNotificationIds', JSON.stringify(Array.from(readPastNotificationIds)));
    } catch (error) {
      console.error("읽음 지나간 알림 상태 저장 실패:", error);
    }
  }, [readPastNotificationIds]);

  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [userEmail, setUserEmail] = useState("always-plan@email.com");
  const [userName, setUserName] = useState("나");
  const [selectedEmoji, setSelectedEmoji] = useState("🐼");

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
  const [inputMethodInitialMode, setInputMethodInitialMode] = useState<'voice' | 'camera' | null>('voice');
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
      // 일정 추가 모달을 열 때 이전 입력값 초기화
      setExtractedTodoInfo(null);
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
        // 일정 추가 모달을 열 때 이전 입력값 초기화
        setExtractedTodoInfo(null);
        setShowInputMethodModal(true);
      }
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      if (isDragging && !hasMoved) {
        // 일정 추가 모달을 열 때 이전 입력값 초기화
        setExtractedTodoInfo(null);
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

  // 알림 상태 관리
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'disabled'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiClient.getCurrentUser();
        setUserEmail(response.data.email);
        setUserName(response.data.name);
        // avatar_emoji 필드 사용 (emoji가 아닌)
        setSelectedEmoji(response.data.avatar_emoji || response.data.emoji || "🐼");
        console.log('User loaded:', response.data);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };

    loadUser();
  }, []);

  // Google Calendar 상태 확인
  useEffect(() => {
    const checkGoogleCalendarStatus = async () => {
      try {
        const response = await apiClient.getCalendarStatus();
        if (response.data) {
          const importEnabled = response.data.import_enabled || false;
          const exportEnabled = response.data.export_enabled || false;
          // 두 토글 중 하나도 활성화되어 있지 않으면 동기화 비활성화
          if (!importEnabled && !exportEnabled) {
            setSyncStatus('disabled');
            setLastSyncTime(null); // 동기화 비활성화시 마지막 동기화 시간 초기화
          } else {
            // 동기화가 활성화되어 있고 현재 disabled 상태면 idle로 변경
            if (syncStatus === 'disabled') {
              setSyncStatus('idle');
            }
          }
        } else {
          setSyncStatus('disabled');
          setLastSyncTime(null);
        }
      } catch (error) {
        console.error('Failed to check Google Calendar status:', error);
        setSyncStatus('disabled');
        setLastSyncTime(null);
      }
    };

    checkGoogleCalendarStatus();
    // 주기적으로 상태 확인 (30초마다)
    const interval = setInterval(checkGoogleCalendarStatus, 30000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  // 가족 구성원 로드
  useEffect(() => {
    const loadFamilyMembers = async () => {
      try {
        const response = await apiClient.getFamilyMembers();
        const formattedMembers = [
          {
            id: "me",
            name: userName,
            emoji: selectedEmoji,
            color: "rgba(255, 155, 130, 0.6)",
            phone: undefined,
            memo: undefined,
          },
          ...response.data.map((member: any) => ({
            id: member.id,
            name: member.name,
            emoji: member.emoji || "👤",
            color: member.color || "rgba(99, 102, 241, 0.6)",
            phone: member.phone,
            memo: member.memo,
          })),
        ];
        setFamilyMembers(formattedMembers);
      } catch (error) {
        console.error('Failed to load family members:', error);
        // 기본 사용자만 설정
        setFamilyMembers([
          {
            id: "me",
            name: userName,
            emoji: selectedEmoji,
            color: "rgba(255, 155, 130, 0.6)",
            phone: undefined,
            memo: undefined,
          },
        ]);
      }
    };

    if (userName) {
      loadFamilyMembers();
    }
  }, [userName, selectedEmoji]);

  // 할 일 로드
  const loadTodos = useCallback(async () => {
    try {
      const response = await apiClient.getTodos();
      console.log('Todos loaded:', response.data);

      if (response.data && Array.isArray(response.data)) {
        const formattedTodos = response.data.map((todo: any) => {
          // duration 계산: start_time과 end_time으로부터 계산
          let calculatedDuration = 60; // 기본값
          if (!todo.all_day && todo.start_time && todo.end_time) {
            try {
              const startTimeStr = typeof todo.start_time === 'string' ? todo.start_time : todo.start_time;
              const endTimeStr = typeof todo.end_time === 'string' ? todo.end_time : todo.end_time;

              // "HH:MM" 형식 파싱
              const [startHours, startMinutes] = startTimeStr.split(':').map((s: string) => {
                const num = parseInt(s, 10);
                return isNaN(num) ? 0 : num;
              });
              const [endHours, endMinutes] = endTimeStr.split(':').map((s: string) => {
                const num = parseInt(s, 10);
                return isNaN(num) ? 0 : num;
              });

              const startTotal = startHours * 60 + startMinutes;
              const endTotal = endHours * 60 + endMinutes;
              calculatedDuration = endTotal - startTotal;

              if (calculatedDuration <= 0 || isNaN(calculatedDuration)) {
                calculatedDuration = 60; // 최소 1시간
              }
            } catch (e) {
              console.error('Duration 계산 오류:', e, todo);
              calculatedDuration = 60;
            }
          } else if (todo.all_day) {
            calculatedDuration = 24 * 60; // 하루종일 일정은 24시간
          }

          // todo.duration이 있으면 우선 사용, 없으면 계산된 값 사용
          const finalDuration = (todo.duration && !isNaN(todo.duration) && todo.duration > 0)
            ? todo.duration
            : calculatedDuration;

          return {
            id: todo.id,
            title: todo.title,
            description: todo.description,
            time: todo.start_time ? `${todo.start_time}` : undefined,
            rule: todo.category,
            completed: todo.status === 'completed',
            draft: todo.status === 'draft',
            overdue: todo.status === 'overdue',
            status: todo.status,
            priority: todo.priority,
            date: todo.date,
            endDate: todo.end_date,
            startTime: todo.start_time,
            endTime: todo.end_time,
            isAllDay: todo.all_day,
            duration: finalDuration,
            location: todo.location,
            memo: todo.memo,
            category: todo.category,
            hasNotification: todo.has_notification,
            notificationTimes: todo.notification_times || [],
            notificationReminders: todo.notification_reminders || [],
            repeatType: todo.repeat_type || "none",
            repeatEndDate: todo.repeat_end_date,
            repeatPattern: todo.repeat_pattern,
            checklistItems: todo.checklist_items?.map((item: any) => item.text || item) || [],
            memberId: todo.member_id,
            assignedMemberIds: Array.isArray(todo.family_member_ids)
              ? todo.family_member_ids
              : (Array.isArray(todo.assigned_member_ids)
                ? todo.assigned_member_ids
                : (todo.family_member_ids ? [todo.family_member_ids] : (todo.assigned_member_ids ? [todo.assigned_member_ids] : []))),
            isRoutine: todo.is_routine || false,
            source: todo.source || 'always_plan',
            googleCalendarEventId: todo.google_calendar_event_id || undefined,
            bulkSynced: todo.bulk_synced || false,
            todoGroupId: todo.todo_group_id || undefined,
          };
        });
        setTodos(formattedTodos);
        console.log('[할 일 로드] 완료:', formattedTodos.length, '개');
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Google Calendar 이벤트 로드
  const loadGoogleCalendarEvents = useCallback(async (force: boolean = false) => {
    // 동기화 상태 확인: import_enabled 또는 export_enabled 중 하나 이상이 활성화되어 있어야 함
    try {
      const statusResponse = await apiClient.getCalendarStatus();
      const importEnabled = statusResponse.data?.import_enabled || false;
      const exportEnabled = statusResponse.data?.export_enabled || false;

      // 두 토글 중 하나도 활성화되어 있지 않으면 동기화 비활성화 (force여도 무시)
      if (!importEnabled && !exportEnabled) {
        setSyncStatus('disabled');
        setLastSyncTime(null);
        console.log('[동기화] 비활성화 상태 - 동기화 중단');
        return;
      }

      // 동기화가 비활성화되어 있고 force가 아니면 동기화하지 않음
      if (syncStatus === 'disabled' && !force) {
        console.log('[동기화] 비활성화 상태 - 동기화 중단');
        return;
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error);
      setSyncStatus('disabled');
      setLastSyncTime(null);
      return;
    }

    setSyncStatus('syncing');
    console.log('[동기화] Google Calendar 동기화 시작...', force ? '(강제 실행)' : '');
    try {
      const response = await apiClient.syncGoogleCalendar();
      console.log('[동기화] Google Calendar 동기화 완료:', response.data);
      setSyncStatus('success');
      setSyncError(null);
      setLastSyncTime(new Date());

      // 동기화 결과 메시지 표시
      if (response.data?.message) {
        console.log('[동기화] 결과:', response.data.message);
        console.log('[동기화] 저장 통계:', {
          imported: response.data.imported_count,
          synced: response.data.synced_count,
          matched: response.data.matched_count,
          skipped: response.data.skipped_counts
        });
      }

      // 전체 응답 데이터 로깅 (디버깅용)
      console.log('[동기화] 전체 응답 데이터:', response.data);

      // 문제 진단: 왜 일정이 저장되지 않았는지 확인
      if (response.data.imported_count === 0) {
        console.warn('[동기화] ⚠️ Google Calendar 이벤트가 저장되지 않았습니다.');
        console.log('[동기화] 진단 정보:');
        console.log('  - import_enabled 토글이 켜져있는지 확인하세요:', response.data.import_enabled);
        console.log('  - Google Calendar에서 가져온 전체 이벤트 수:', response.data.total_events_from_google);
        console.log('  - 새로 처리해야 할 이벤트 수:', response.data.new_events_count);
        console.log('  - 건너뛴 이벤트 수:', response.data.skipped_counts);
        console.log('  - Always Plan 이벤트:', response.data.skipped_counts?.always_plan_events || 0, '개 (이것들은 건너뛰는 것이 정상)');
        console.log('  - 이미 저장된 이벤트:', response.data.skipped_counts?.already_saved || 0, '개');
        console.log('  - 저장 실패한 이벤트 수:', response.data.imported_failed_count);

        // 실패한 이벤트 상세 정보 출력
        if (response.data.failed_events_info && response.data.failed_events_info.length > 0) {
          console.error('[동기화] ❌ 저장 실패한 이벤트 상세 정보:');
          response.data.failed_events_info.forEach((failedEvent: any, index: number) => {
            console.error(`  [${index + 1}] 이벤트 ID: ${failedEvent.event_id}`);
            console.error(`      제목: ${failedEvent.title}`);
            console.error(`      에러 타입: ${failedEvent.error_type}`);
            console.error(`      에러 메시지: ${failedEvent.error_message}`);
            console.error(`      시작 시간: ${failedEvent.start}`);
          });
        }
      }
    } catch (error: any) {
      console.error('[동기화] Google Calendar 동기화 실패:', error);
      setSyncStatus('error');
      setSyncError(error.response?.data?.detail || error.message);
    }
  }, [syncStatus]);

  // 초기 Google Calendar 상태 확인 및 동기화
  useEffect(() => {
    const initializeSync = async () => {
      try {
        const response = await apiClient.getCalendarStatus();
        if (response.data) {
          const importEnabled = response.data.import_enabled || false;
          const exportEnabled = response.data.export_enabled || false;

          // 두 토글 중 하나도 활성화되어 있지 않으면 동기화 비활성화
          if (!importEnabled && !exportEnabled) {
            setSyncStatus('disabled');
            setLastSyncTime(null);
          } else {
            // 동기화가 활성화되어 있으면 초기 로드 (토글 활성화 시 1회)
            setSyncStatus('idle');
            loadGoogleCalendarEvents(true);
          }
        } else {
          setSyncStatus('disabled');
          setLastSyncTime(null);
        }
      } catch (error) {
        console.error('Failed to check Google Calendar status:', error);
        // 에러 발생 시도 disabled로 설정
        setSyncStatus('disabled');
        setLastSyncTime(null);
      }
    };

    initializeSync();
  }, []);

  // 앱이 백그라운드→포그라운드로 돌아왔을 때 동기화 (30~60초 쿨다운)
  useEffect(() => {
    const currentSyncStatus = syncStatus;
    if (currentSyncStatus === 'disabled') {
      return;
    }

    let lastFocusTime = Date.now();
    let cooldownTime = 30000; // 30초 쿨다운

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // 쿨다운 시간이 지났을 때만 동기화
        if (now - lastFocusTime >= cooldownTime) {
          // 동기화 상태 확인: import_enabled 또는 export_enabled 중 하나 이상이 활성화되어 있어야 함
          apiClient.getCalendarStatus().then((response) => {
            const importEnabled = response.data?.import_enabled || false;
            const exportEnabled = response.data?.export_enabled || false;
            if (importEnabled || exportEnabled) {
              loadGoogleCalendarEvents(true);
              lastFocusTime = now;
            }
          }).catch(() => {
            // 에러 무시
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadGoogleCalendarEvents, syncStatus]);

  // 검색 처리
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.trim().length > 0);
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim().length > 0) {
      setShowSearchResults(true);
    }
  };

  const handleSearchBlur = () => {
    // 검색 결과 유지
  };

  const [todos, setTodos] = useState<any[]>([]);
  const [extractedTodoInfo, setExtractedTodoInfo] = useState<any>(null);

  // 현재 날짜/시간
  const currentDate = new Date().toISOString().split('T')[0];

  // 새로고침 시 오늘 날짜로 초기화
  const [selectedDate, setSelectedDate] = useState<string | null>(currentDate);

  // Todo 관련 함수들 (임시 구현)
  const handleTodoUpdate = async (todoId: string, updates: any) => {
    try {
      // time과 duration을 start_time과 end_time으로 변환
      const apiUpdates: any = { ...updates };

      // completed를 status로 변환
      if (updates.completed !== undefined) {
        apiUpdates.status = updates.completed ? 'completed' : 'pending';
        delete apiUpdates.completed;
      }

      if (updates.time !== undefined || updates.duration !== undefined) {
        const todo = todos.find(t => t.id === todoId);
        if (todo) {
          // 업데이트할 시간과 duration
          const newTime = updates.time !== undefined ? updates.time : todo.time;
          const newDuration = updates.duration !== undefined ? updates.duration : todo.duration;

          if (newTime && !isNaN(newDuration) && newDuration > 0) {
            try {
              // "HH:MM" 형식 파싱
              const [hours, minutes] = newTime.split(':').map((s: string) => {
                const num = parseInt(s, 10);
                return isNaN(num) ? 0 : num;
              });

              const startTotalMinutes = hours * 60 + minutes;
              const endTotalMinutes = startTotalMinutes + newDuration;

              const endHours = Math.floor(endTotalMinutes / 60) % 24;
              const endMins = endTotalMinutes % 60;

              apiUpdates.start_time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
              apiUpdates.end_time = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

              // time과 duration 제거 (백엔드에서는 start_time과 end_time만 사용)
              delete apiUpdates.time;
              delete apiUpdates.duration;
            } catch (e) {
              console.error('시간 변환 오류:', e);
            }
          }
        }
      }

      const response = await apiClient.updateTodo(todoId, apiUpdates);

      // 응답 데이터를 프론트엔드 형식으로 변환
      if (response.data) {
        const updatedTodo = {
          id: response.data.id,
          title: response.data.title,
          description: response.data.description || response.data.memo || '',
          time: response.data.start_time ? `${response.data.start_time}` : undefined,
          rule: response.data.category || '기타',
          completed: response.data.status === 'completed',
          draft: response.data.status === 'draft',
          overdue: response.data.status === 'overdue',
          status: response.data.status || 'pending',
          priority: response.data.priority,
          date: response.data.date,
          endDate: response.data.end_date,
          startTime: response.data.start_time || undefined,
          endTime: response.data.end_time || undefined,
          isAllDay: response.data.all_day === true || response.data.all_day === 'true',
          duration: (() => {
            if (response.data.start_time && response.data.end_time) {
              try {
                const [startHours, startMinutes] = response.data.start_time.split(':').map((s: string) => {
                  const num = parseInt(s, 10);
                  return isNaN(num) ? 0 : num;
                });
                const [endHours, endMinutes] = response.data.end_time.split(':').map((s: string) => {
                  const num = parseInt(s, 10);
                  return isNaN(num) ? 0 : num;
                });
                const startTotal = startHours * 60 + startMinutes;
                const endTotal = endHours * 60 + endMinutes;
                const calcDuration = endTotal - startTotal;
                return (calcDuration > 0 && !isNaN(calcDuration)) ? calcDuration : 60;
              } catch (e) {
                return 60;
              }
            }
            return response.data.duration || 60;
          })(),
          location: response.data.location,
          memo: response.data.memo || response.data.description || '',
          category: response.data.category || '기타',
          hasNotification: response.data.has_notification || false,
          notificationTimes: response.data.notification_times || [],
          notificationReminders: response.data.notification_reminders ? (typeof response.data.notification_reminders === 'string' ? JSON.parse(response.data.notification_reminders) : response.data.notification_reminders) : [],
          repeatType: response.data.repeat_type || 'none',
          repeatEndDate: response.data.repeat_end_date,
          repeatPattern: response.data.repeat_pattern ? (typeof response.data.repeat_pattern === 'string' ? JSON.parse(response.data.repeat_pattern) : response.data.repeat_pattern) : undefined,
          checklistItems: response.data.checklist_items?.map((item: any) => item.text || item) || [],
          memberId: response.data.member_id,
          assignedMemberIds: Array.isArray(response.data.family_member_ids)
            ? response.data.family_member_ids
            : (Array.isArray(response.data.assigned_member_ids)
              ? response.data.assigned_member_ids
              : (response.data.family_member_ids ? [response.data.family_member_ids] : (response.data.assigned_member_ids ? [response.data.assigned_member_ids] : []))),
          isRoutine: response.data.is_routine || false,
          source: response.data.source || 'always_plan',
          googleCalendarEventId: response.data.google_calendar_event_id || undefined,
          bulkSynced: response.data.bulk_synced || false,
          todoGroupId: response.data.todo_group_id || undefined,
        };

        setTodos(prev => prev.map(t => t.id === todoId ? updatedTodo : t));
      } else {
        // 응답 데이터가 없으면 기존 방식으로 fallback
        setTodos(prev => prev.map(t => t.id === todoId ? { ...t, ...updates } : t));
      }
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const toggleTodoComplete = async (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    const newCompleted = !todo.completed;
    await handleTodoUpdate(todoId, { completed: newCompleted });
  };

  const handleTodoDelete = async (todoId: string) => {
    try {
      await apiClient.deleteTodo(todoId);
      setTodos(prev => prev.filter(t => t.id !== todoId));
      toast.success("일정이 삭제되었습니다.");
    } catch (error: any) {
      console.error('Failed to delete todo:', error);
      toast.error(`일정 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
    }
  };

  const handleTodoSubmit = async (formData: any) => {
    try {
      // 담당 프로필 디버깅
      console.log('[일정 저장] 담당 프로필 데이터:', {
        assignedMemberIds: formData.assignedMemberIds,
        type: typeof formData.assignedMemberIds,
        isArray: Array.isArray(formData.assignedMemberIds),
        length: formData.assignedMemberIds?.length,
        editingTodoId
      });

      // 시간 계산 (startTime과 endTime으로부터 duration 계산)
      let duration = 60; // 기본값
      if (!formData.isAllDay && formData.startTime && formData.endTime) {
        try {
          const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
          const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
          const startTotal = startHours * 60 + startMinutes;
          const endTotal = endHours * 60 + endMinutes;
          duration = endTotal - startTotal;
          if (duration <= 0) duration = 60; // 최소 1시간
        } catch (e) {
          duration = 60;
        }
      }

      // 담당 프로필 ID 배열 정규화
      const assignedMemberIdsArray = Array.isArray(formData.assignedMemberIds)
        ? formData.assignedMemberIds
        : (formData.assignedMemberIds ? [formData.assignedMemberIds] : []);

      // API에 전송할 데이터 변환
      const todoData: any = {
        title: formData.title,
        description: formData.memo || "",
        memo: formData.memo || "",
        location: formData.location || "",
        date: formData.date,
        // end_date: 종료 날짜가 시작 날짜와 같거나 없으면 빈 문자열로 설정 (백엔드에서 None으로 처리)
        // 수정 모드에서는 항상 end_date를 보내야 함 (없으면 빈 문자열로)
        end_date: formData.endDate && formData.endDate !== formData.date ? formData.endDate : (editingTodoId ? "" : undefined),
        start_time: formData.isAllDay ? undefined : (formData.startTime || undefined),
        end_time: formData.isAllDay ? undefined : (formData.endTime || undefined),
        all_day: formData.isAllDay === true,
        category: formData.category || "기타",
        status: 'pending',
        has_notification: formData.hasNotification || false,
        notification_reminders: formData.hasNotification && formData.notificationReminders && formData.notificationReminders.length > 0
          ? formData.notificationReminders.map((r: any) => ({ value: r.value, unit: r.unit }))
          : undefined,
        repeat_type: formData.repeatType || "none",
        repeat_end_date: formData.repeatEndDate || undefined,
        // 맞춤 반복인 경우 repeat_pattern 생성
        repeat_pattern: formData.repeatType === 'custom' ? {
          // 요일이 선택되어 있으면 자동으로 주 단위로 설정
          freq: (formData.customRepeatDays && formData.customRepeatDays.length > 0) ? 'weeks' : (formData.customRepeatUnit || 'days'),
          interval: formData.customRepeatInterval || 1,
          days: formData.customRepeatDays || [],
          endType: formData.customRepeatEndType || 'never',
          endDate: formData.customRepeatEndType === 'date' ? formData.customRepeatEndDate : undefined,
          count: formData.customRepeatEndType === 'count' ? formData.customRepeatCount : undefined,
        } : (formData.repeatPattern || undefined),
        checklist_items: formData.checklistItems && formData.checklistItems.length > 0
          ? formData.checklistItems.filter((item: string) => item.trim())
          : undefined,
        // 수정 모드에서는 항상 family_member_ids를 보내야 함 (백엔드가 None이 아닐 때만 업데이트하기 때문)
        // 생성 모드에서도 빈 배열이라도 보내야 함
        family_member_ids: assignedMemberIdsArray,
      };

      console.log('[일정 저장] 전송할 데이터:', {
        ...todoData,
        family_member_ids: assignedMemberIdsArray
      });

      if (editingTodoId) {
        // 수정 모드
        const response = await apiClient.updateTodo(editingTodoId, todoData);

        // 응답 데이터를 프론트엔드 형식으로 변환 (loadTodos와 동일한 형식)
        const updatedTodo = {
          id: response.data.id,
          title: response.data.title,
          description: response.data.description || response.data.memo || '',
          time: response.data.start_time ? `${response.data.start_time}` : undefined,
          rule: response.data.category || '기타',
          completed: response.data.status === 'completed',
          draft: response.data.status === 'draft',
          overdue: response.data.status === 'overdue',
          status: response.data.status || 'pending',
          priority: response.data.priority,
          date: response.data.date,
          endDate: response.data.end_date,
          startTime: response.data.start_time || undefined,
          endTime: response.data.end_time || undefined,
          isAllDay: response.data.all_day === true || response.data.all_day === 'true',
          duration: response.data.start_time && response.data.end_time ? duration : (response.data.duration || duration),
          location: response.data.location,
          memo: response.data.memo || response.data.description || '',
          category: response.data.category || '기타',
          hasNotification: response.data.has_notification || false,
          notificationTimes: response.data.notification_times || [],
          notificationReminders: response.data.notification_reminders ? (typeof response.data.notification_reminders === 'string' ? JSON.parse(response.data.notification_reminders) : response.data.notification_reminders) : [],
          repeatType: response.data.repeat_type || 'none',
          repeatEndDate: response.data.repeat_end_date,
          repeatPattern: response.data.repeat_pattern ? (typeof response.data.repeat_pattern === 'string' ? JSON.parse(response.data.repeat_pattern) : response.data.repeat_pattern) : undefined,
          checklistItems: response.data.checklist_items?.map((item: any) => item.text || item) || [],
          memberId: response.data.member_id,
          assignedMemberIds: Array.isArray(response.data.family_member_ids)
            ? response.data.family_member_ids
            : (Array.isArray(response.data.assigned_member_ids)
              ? response.data.assigned_member_ids
              : (response.data.family_member_ids ? [response.data.family_member_ids] : (response.data.assigned_member_ids ? [response.data.assigned_member_ids] : []))),
          isRoutine: response.data.is_routine || false,
          source: response.data.source || 'always_plan',
          googleCalendarEventId: response.data.google_calendar_event_id || undefined,
          bulkSynced: response.data.bulk_synced || false,
          todoGroupId: response.data.todo_group_id || undefined,
        };

        console.log('[일정 수정] 업데이트된 일정:', updatedTodo);
        setTodos(prev => {
          const updated = prev.map(t => t.id === editingTodoId ? updatedTodo : t);
          console.log('[일정 수정] 업데이트된 todos:', updated.length, '개');
          return updated;
        });
        setEditingTodoId(null);
        setShowAddTodoModal(false);
        toast.success("일정이 수정되었습니다.");
      } else {
        // 생성 모드
        const response = await apiClient.createTodo(todoData);

        // 응답 데이터를 프론트엔드 형식으로 변환 (loadTodos와 동일한 형식)
        const newTodo = {
          id: response.data.id,
          title: response.data.title,
          description: response.data.description || response.data.memo || '',
          time: response.data.start_time ? `${response.data.start_time}` : undefined,
          rule: response.data.category || '기타',
          completed: response.data.status === 'completed',
          draft: response.data.status === 'draft',
          overdue: response.data.status === 'overdue',
          status: response.data.status || 'pending',
          priority: response.data.priority,
          date: response.data.date,
          endDate: response.data.end_date,
          startTime: response.data.start_time || undefined,
          endTime: response.data.end_time || undefined,
          isAllDay: response.data.all_day === true || response.data.all_day === 'true',
          duration: response.data.start_time && response.data.end_time ? duration : (response.data.duration || duration),
          location: response.data.location,
          memo: response.data.memo || response.data.description || '',
          category: response.data.category || '기타',
          hasNotification: response.data.has_notification || false,
          notificationTimes: response.data.notification_times || [],
          notificationReminders: response.data.notification_reminders ? (typeof response.data.notification_reminders === 'string' ? JSON.parse(response.data.notification_reminders) : response.data.notification_reminders) : [],
          repeatType: response.data.repeat_type || 'none',
          repeatEndDate: response.data.repeat_end_date,
          repeatPattern: response.data.repeat_pattern ? (typeof response.data.repeat_pattern === 'string' ? JSON.parse(response.data.repeat_pattern) : response.data.repeat_pattern) : undefined,
          checklistItems: response.data.checklist_items?.map((item: any) => item.text || item) || [],
          memberId: response.data.member_id,
          assignedMemberIds: Array.isArray(response.data.family_member_ids)
            ? response.data.family_member_ids
            : (Array.isArray(response.data.assigned_member_ids)
              ? response.data.assigned_member_ids
              : (response.data.family_member_ids ? [response.data.family_member_ids] : (response.data.assigned_member_ids ? [response.data.assigned_member_ids] : []))),
          isRoutine: response.data.is_routine || false,
          source: response.data.source || 'always_plan',
          googleCalendarEventId: response.data.google_calendar_event_id || undefined,
          bulkSynced: response.data.bulk_synced || false,
          todoGroupId: response.data.todo_group_id || undefined,
        };

        console.log('[일정 추가] 새 일정:', newTodo);
        // 일정을 즉시 상태에 추가하고, 그 다음 전체 목록 새로고침
        setTodos(prev => {
          const updated = [...prev, newTodo];
          console.log('[일정 추가] 로컬 상태 업데이트 완료:', updated.length, '개');
          return updated;
        });
        // 전체 목록 새로고침 (서버와 동기화)
        await loadTodos();
        setShowAddTodoModal(false);
        setExtractedTodoInfo(null); // AI 추출 정보 초기화
        toast.success("일정이 추가되었습니다.");
      }
    } catch (error) {
      console.error('Failed to save todo:', error);
      toast.error(editingTodoId ? "일정 수정에 실패했습니다." : "일정 추가에 실패했습니다.");
    }
  };

  const handleInputMethodSelect = (method: 'voice' | 'camera' | 'text', _extractedText?: string, _todoInfo?: any) => {
    // STT/OCR에서 직접 작성 탭으로 전환할 때 extractedTodoInfo 설정
    // 이 함수는 InputMethodModal 내부에서 탭 전환 시 호출되지 않음
    // 직접 작성 탭으로 전환은 InputMethodModal 내부에서 setActiveMethod(null)로 처리됨
    if (method === 'text') {
      // 직접 작성 선택 시 AddTodoModal 열기
      if (_todoInfo) {
        console.log('[일정 추가] 추출된 일정 정보:', _todoInfo);
        setExtractedTodoInfo(_todoInfo);
      } else {
        setExtractedTodoInfo(null);
      }
      setEditingTodoId(null);
      setShowInputMethodModal(false);
      setShowAddTodoModal(true);
    } else {
      setInputMethodInitialMode(method);
      setShowInputMethodModal(false);
    }
  };

  // 검색 결과 필터링
  const filteredTodos = todos.filter((todo) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    return (
      todo.title.toLowerCase().includes(query) ||
      todo.description?.toLowerCase().includes(query) ||
      todo.category?.toLowerCase().includes(query) ||
      todo.location?.toLowerCase().includes(query)
    );
  });

  const displayTodos = todos.filter(t => !t.isRoutine && t.date).sort((a, b) => {
    if (a.date !== b.date) {
      return (a.date || '').localeCompare(b.date || '');
    }
    if (!a.time && b.time) return -1;
    if (a.time && !b.time) return 1;
    return (a.time || '').localeCompare(b.time || '');
  });

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return '';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;

    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  // 프로필 메뉴 렌더링 함수
  const renderProfileMenu = () => (
    <div className="h-full flex flex-col bg-white border-r border-[#E5E7EB]">
      {/* User Info Section */}
      <div className="px-5 py-6 bg-gradient-to-r from-[#FFF0EB] to-[#FFE8E0] border-b border-[#FFD4C8]">
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

      {/* Menu Items */}
      <div className="flex-1 py-2 overflow-y-auto">
        <button
          onClick={() => setShowMyPageScreen(true)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
        >
          <div className="flex items-center gap-3">
            <User size={20} className="text-[#6B7280]" />
            <span className="text-[#1F2937]">마이페이지</span>
          </div>
          <ChevronRight size={18} className="text-[#9CA3AF]" />
        </button>

        <button
          onClick={() => setShowProfileManagementScreen(true)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#6B7280]" />
            <span className="text-[#1F2937]">프로필 관리</span>
          </div>
          <ChevronRight size={18} className="text-[#9CA3AF]" />
        </button>

        <button
          onClick={() => setShowSettingsScreen(true)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-[#6B7280]" />
            <span className="text-[#1F2937]">설정</span>
          </div>
          <ChevronRight size={18} className="text-[#9CA3AF]" />
        </button>

        <button
          onClick={() => setShowCommunityScreen(true)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#6B7280]" />
            <span className="text-[#1F2937]">커뮤니티</span>
          </div>
          <ChevronRight size={18} className="text-[#9CA3AF]" />
        </button>

        <button
          onClick={() => setShowCustomerService(true)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-[#6B7280]" />
            <span className="text-[#1F2937]">고객센터</span>
          </div>
          <ChevronRight size={18} className="text-[#9CA3AF]" />
        </button>

        <button
          onClick={() => setShowUserGuide(true)}
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
            // 백엔드에 로그아웃 요청
            try {
              await apiClient.logout();
            } catch (error) {
              console.error('Logout API error:', error);
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
  );

  // 선택된 날짜의 일정 필터링 함수
  const getSelectedDateTodos = () => {
    if (!selectedDate) return [];
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    return todos.filter(t => {
      if (t.isRoutine || !t.date) return false;

      // 프로필 필터링 (assignedMemberIds 지원)
      if (selectedMembers.length > 0) {
        // 프로필이 선택되어 있는 경우:
        // - 담당 프로필이 있는 일정: 선택된 프로필에 포함되어야 함
        // - 담당 프로필이 없는 일정: 표시 (프로필이 선택되어 있어도 담당 프로필 없는 일정은 표시)
        const hasAssignedMembers = t.assignedMemberIds && Array.isArray(t.assignedMemberIds) && t.assignedMemberIds.length > 0;
        const hasMemberId = t.memberId;
        
        if (hasAssignedMembers) {
          // assignedMemberIds 중 하나라도 선택된 프로필에 포함되어야 함
          const assignedIds = t.assignedMemberIds.map((id: any) => String(id));
          const selectedIds = selectedMembers.map((id: string) => String(id));
          const hasSelectedMember = assignedIds.some((id: string) => selectedIds.includes(id));
          if (!hasSelectedMember) {
            return false;
          }
        } else if (hasMemberId && !selectedMembers.includes(String(t.memberId))) {
          return false;
        }
        // 담당 프로필이 없으면 표시
      } else {
        // 모든 프로필이 꺼져 있는 경우: 담당 프로필이 없는 일정만 표시
        const hasAssignedMembers = t.assignedMemberIds && Array.isArray(t.assignedMemberIds) && t.assignedMemberIds.length > 0;
        if (t.memberId || hasAssignedMembers) {
          return false;
        }
      }

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
    }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '병원': 'bg-red-50 border-red-200',
      '학교': 'bg-blue-50 border-blue-200',
      '학원': 'bg-green-50 border-green-200',
      '약속': 'bg-purple-50 border-purple-200',
      '기념일': 'bg-pink-50 border-pink-200',
      '업무': 'bg-gray-50 border-gray-200',
      '개인': 'bg-yellow-50 border-yellow-200',
    };
    // 디버깅: category 값 확인
    if (!category || category.trim() === '') {
      console.log('Empty category for todo, using default color');
      return 'bg-blue-50 border-blue-200'; // 기본 색상을 파란색으로 변경
    }
    return colors[category] || 'bg-blue-50 border-blue-200'; // 기본 색상도 파란색으로 변경
  };

  return (
    <div className={`min-h-screen bg-[#FAFAFA] flex flex-col w-full ${!isMobile ? 'max-w-full' : 'max-w-full md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto'} relative pb-4 md:pb-6`}>
      {/* Google Calendar 동기화 상태 표시 */}
      {(syncStatus === 'disabled' || syncStatus === 'syncing' || syncStatus === 'success' || syncStatus === 'error') && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${syncStatus === 'syncing' ? 'bg-[#E0F2FE] text-[#0EA5E9]' :
          syncStatus === 'success' ? 'bg-[#D1FAE5] text-[#10B981]' :
            syncStatus === 'disabled' ? 'bg-[#F3F4F6] text-[#6B7280]' :
              'bg-[#FEE2E2] text-[#EF4444]'
          }`}>
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && <Clock size={12} className="animate-spin" />}
            {syncStatus === 'success' && <Check size={12} />}
            {syncStatus === 'error' && <X size={12} />}
            {syncStatus === 'disabled' && <X size={12} />}
            <span>
              {syncStatus === 'syncing' && '동기화 중...'}
              {syncStatus === 'success' && `마지막 동기화: ${formatLastSyncTime()}`}
              {syncStatus === 'error' && `동기화 실패: ${syncError || '알 수 없는 오류'}`}
              {syncStatus === 'disabled' && '동기화가 비활성화되었습니다'}
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

      {/* Header - Profile, Search, Notification - 반응형 */}
      <div className="bg-white px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-[#F3F4F6]">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
        >
          <span className="text-lg sm:text-xl">{selectedEmoji}</span>
        </button>
        <div className="flex-1 relative min-w-0">
          <input
            type="text"
            placeholder="일정을 검색해주세요."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F9FAFB] rounded-full text-xs sm:text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:bg-white transition-all"
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
                          <p className="text-xs text-[#6B7280] line-clamp-2 mt-1">
                            {todo.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {todo.checklistItems && todo.checklistItems.length > 0 && (
                              <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">
                                체크리스트 {todo.checklistItems.length}개
                              </span>
                            )}
                            {todo.repeatType && todo.repeatType !== 'none' && (
                              <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">
                                반복
                              </span>
                            )}
                            {todo.hasNotification && (
                              <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">
                                알림
                              </span>
                            )}
                          </div>
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
        <button
          className="p-2 flex-shrink-0 relative"
          onClick={() => {
            console.log("[알림 버튼] 클릭됨, showNotificationPanel 설정:", true);
            setShowTodoDetailFromNotification(false); // 일정 상세 화면 닫기
            setShowNotificationPanel(true);
          }}
        >
          <Bell size={20} className="text-[#6B7280]" />
          {/* 알림 상태 점 - todos와 읽음 상태 변경 시 즉시 업데이트 */}
          {useMemo(() => {
            const now = new Date();
            const currentDateTime = now.getTime();

            // 알림이 설정된 일정만 필터링
            const notifications = todos.filter(todo => {
              if (todo.completed || !todo.date || !todo.hasNotification) return false;
              const notificationReminders = todo.notificationReminders || todo.notification_reminders || [];
              return Array.isArray(notificationReminders) && notificationReminders.length > 0;
            });

            // 알림 시간 기준으로 지나간 알림과 예정된 알림 분리 (NotificationPanel과 동일한 로직)
            const past: string[] = [];
            const upcoming: string[] = [];

            notifications.forEach(todo => {
              if (!todo.date) return;

              const reminders = todo.notificationReminders || todo.notification_reminders || [];
              if (reminders.length === 0) return;

              const todoDate = todo.date;
              const todoTime = todo.time || todo.startTime || "00:00";
              const [hours, minutes] = todoTime.split(':').map(Number);

              // 일정 날짜/시간 계산
              const todoDateTime = new Date(todoDate);
              todoDateTime.setHours(hours, minutes, 0, 0);

              // 각 알림 리마인더에 대해 알림 시간 계산
              reminders.forEach((reminder: { value: number; unit: string }) => {
                const value = reminder.value || 30;
                const unit = reminder.unit || 'minutes';

                // 알림 시간 계산
                let notificationDateTime = new Date(todoDateTime);
                if (unit === 'minutes') {
                  notificationDateTime.setMinutes(notificationDateTime.getMinutes() - value);
                } else if (unit === 'hours') {
                  notificationDateTime.setHours(notificationDateTime.getHours() - value);
                } else if (unit === 'days') {
                  notificationDateTime.setDate(notificationDateTime.getDate() - value);
                } else if (unit === 'weeks') {
                  notificationDateTime.setDate(notificationDateTime.getDate() - (value * 7));
                }

                // 알림 시간 기준으로 분류
                if (notificationDateTime.getTime() < currentDateTime) {
                  if (!past.includes(todo.id)) past.push(todo.id);
                } else {
                  if (!upcoming.includes(todo.id)) upcoming.push(todo.id);
                }
              });
            });

            const pastNotifications = notifications.filter(todo => past.includes(todo.id));
            const upcomingNotifications = notifications.filter(todo => upcoming.includes(todo.id));

            // 읽지 않은 알림만 필터링 (todo.id를 문자열로 변환하여 비교)
            const unreadUpcomingNotifications = upcomingNotifications.filter(todo => {
              const todoId = String(todo.id);
              const isRead = readUpcomingNotificationIds.has(todoId);
              return !isRead;
            });
            const unreadPastNotifications = pastNotifications.filter(todo => {
              const todoId = String(todo.id);
              const isRead = readPastNotificationIds.has(todoId);
              return !isRead;
            });

            const hasNewUpcoming = unreadUpcomingNotifications.length > 0;
            const hasUnreadPast = unreadPastNotifications.length > 0;

            // 디버깅: 실제 계산 결과 확인
            if (hasNewUpcoming || hasUnreadPast) {
              console.log("[알림 점 계산]", {
                upcomingCount: upcomingNotifications.length,
                pastCount: pastNotifications.length,
                unreadUpcomingCount: unreadUpcomingNotifications.length,
                unreadPastCount: unreadPastNotifications.length,
                readUpcomingIds: Array.from(readUpcomingNotificationIds),
                readPastIds: Array.from(readPastNotificationIds),
                hasNewUpcoming,
                hasUnreadPast
              });
            }

            // 둘 다 없으면 null 반환
            if (!hasNewUpcoming && !hasUnreadPast) return null;

            return (
              <>
                {hasNewUpcoming && (
                  <div
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#10B981] rounded-full z-50"
                    style={{
                      minWidth: '8px',
                      minHeight: '8px'
                    }}
                    title={`${unreadUpcomingNotifications.length}개의 예정된 알림`}
                  />
                )}
                {hasUnreadPast && (
                  <div
                    className={`absolute -top-0.5 rounded-full w-2 h-2 bg-[#EF4444] z-50 ${hasNewUpcoming ? 'right-2' : '-right-0.5'}`}
                    style={{
                      minWidth: '8px',
                      minHeight: '8px'
                    }}
                    title={`${unreadPastNotifications.length}개의 확인 안된 알림`}
                  />
                )}
              </>
            );
          }, [todos, readUpcomingNotificationIds, readPastNotificationIds])}
        </button>
      </div>

      {/* Calendar View Selector - 우측 정렬 */}
      <div className="bg-white px-3 sm:px-4 py-2 sm:py-3 border-b border-[#F3F4F6]">
        <div className="flex justify-end">
          <div className="flex gap-1">
            <button
              onClick={() => setCalendarView("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${calendarView === "month"
                ? "bg-[#FF9B82] text-white shadow-md"
                : "bg-white text-[#6B7280] hover:bg-[#F9FAFB] hover:shadow-sm border border-[#E5E7EB]"
                }`}
            >
              월간
            </button>
            <button
              onClick={() => setCalendarView("week")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${calendarView === "week"
                ? "bg-[#FF9B82] text-white shadow-md"
                : "bg-white text-[#6B7280] hover:bg-[#F9FAFB] hover:shadow-sm border border-[#E5E7EB]"
                }`}
            >
              주간
            </button>
            <button
              onClick={() => setCalendarView("day")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${calendarView === "day"
                ? "bg-[#FF9B82] text-white shadow-md"
                : "bg-white text-[#6B7280] hover:bg-[#F9FAFB] hover:shadow-sm border border-[#E5E7EB]"
                }`}
            >
              일간
            </button>
          </div>
        </div>
      </div>

      {/* 데스크톱 레이아웃: 좌측 사이드바 + 중앙 캘린더 + 우측 일정 리스트 */}
      {!isMobile ? (
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측 사이드바 - 프로필 메뉴 */}
          <aside className="w-64 flex-shrink-0">
            {renderProfileMenu()}
          </aside>

          {/* 중앙 캘린더 영역 - 스크롤 없이 한눈에 보이도록 */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-auto p-6">
              {/* 캘린더 표시 */}
              {calendarView === "month" && (
                <>
                  {/* 프로필 선택 영역 */}
                  <div className="bg-white px-4 pt-4 pb-3 border-b border-[#F3F4F6] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-[#1F2937]">프로필</h4>
                    </div>
                    {/* 가로 스크롤 가능한 프로필 목록 */}
                    <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
                      {familyMembers.map((member) => {
                        const isSelected = selectedMembers.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => toggleMemberSelection(member.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] flex-shrink-0 ${isSelected
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
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-4xl">
                      <MonthCalendar
                        todos={todos}
                        familyMembers={familyMembers}
                        selectedMembers={selectedMembers}
                        selectedDate={selectedDate}
                        onDateSelect={(date) => {
                          setSelectedDate(date);
                        }}
                        onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                      />
                    </div>
                  </div>
                </>
              )}
              {calendarView === "week" && (
                <>
                  {/* 프로필 선택 영역 */}
                  <div className="bg-white px-4 pt-4 pb-3 border-b border-[#F3F4F6] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-[#1F2937]">프로필</h4>
                    </div>
                    {/* 가로 스크롤 가능한 프로필 목록 */}
                    <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
                      {familyMembers.map((member) => {
                        const isSelected = selectedMembers.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => toggleMemberSelection(member.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] flex-shrink-0 ${isSelected
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
                        );
                      })}
                    </div>
                  </div>
                  <WeekCalendar
                    todos={todos}
                    familyMembers={familyMembers}
                    selectedMembers={selectedMembers}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => setSelectedDate(date)}
                    onTodoUpdate={handleTodoUpdate}
                    onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                  />
                  {/* 선택된 날짜의 할일 리스트 */}
                  {selectedDate && (
                    <div className="px-4 py-4 bg-white border-t border-[#E5E7EB]">
                      <h3 className="text-lg font-bold text-[#1F2937] mb-4">
                        {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
                      </h3>
                      <div className="space-y-3">
                        {(() => {
                          // 프로필 필터링 적용
                          const selectedDateTodos = todos.filter(t => {
                            if (!t.date || t.date !== selectedDate) return false;
                            
                            // 프로필 필터링 (assignedMemberIds 지원)
                            if (selectedMembers.length > 0) {
                              const hasAssignedMembers = t.assignedMemberIds && Array.isArray(t.assignedMemberIds) && t.assignedMemberIds.length > 0;
                              const hasMemberId = t.memberId;
                              
                              if (hasAssignedMembers) {
                                const assignedIds = t.assignedMemberIds.map((id: any) => String(id));
                                const selectedIds = selectedMembers.map((id: string) => String(id));
                                const hasSelectedMember = assignedIds.some((id: string) => selectedIds.includes(id));
                                if (!hasSelectedMember) {
                                  return false;
                                }
                              } else if (hasMemberId && !selectedMembers.includes(String(t.memberId))) {
                                return false;
                              }
                            } else {
                              // 모든 프로필이 꺼져 있는 경우: 담당 프로필이 없는 일정만 표시
                              const hasAssignedMembers = t.assignedMemberIds && Array.isArray(t.assignedMemberIds) && t.assignedMemberIds.length > 0;
                              if (t.memberId || hasAssignedMembers) {
                                return false;
                              }
                            }
                            
                            return true;
                          });
                          return selectedDateTodos.length > 0 ? (
                            selectedDateTodos.map((todo) => (
                              <div
                                key={todo.id}
                                className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
                                onClick={() => setSelectedTodoForDetail(todo.id)}
                              >
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
                                  <h4 className={`text-sm font-medium truncate ${todo.completed
                                    ? "line-through text-[#9CA3AF]"
                                    : "text-[#1F2937]"
                                    }`}>
                                    {todo.title}
                                  </h4>
                                </div>
                                {todo.time && (
                                  <div className="mt-1 ml-6">
                                    <span className="text-xs text-[#6B7280]">{todo.time}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-[#9CA3AF]">
                              <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                              <p className="text-sm">선택한 날짜에 일정이 없습니다</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}
              {calendarView === "day" && (
                <>
                  {/* 프로필 선택 영역 */}
                  <div className="bg-white px-4 pt-4 pb-3 border-b border-[#F3F4F6] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-[#1F2937]">프로필</h4>
                    </div>
                    {/* 가로 스크롤 가능한 프로필 목록 */}
                    <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
                      {familyMembers.map((member) => {
                        const isSelected = selectedMembers.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => toggleMemberSelection(member.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] flex-shrink-0 ${isSelected
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
                        );
                      })}
                    </div>
                  </div>
                  <DayCalendar
                    todos={todos}
                    familyMembers={familyMembers}
                    selectedMembers={selectedMembers}
                    selectedDate={selectedDate}
                    onDateChange={(date) => setSelectedDate(date)}
                    onTodoUpdate={handleTodoUpdate}
                    onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                  />
                </>
              )}
            </div>
          </div>

          {/* 우측 일정 리스트 */}
          <aside className="w-80 flex-shrink-0 bg-white border-l border-[#E5E7EB] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4">
                {'ToDo'}
              </h3>
              {selectedDate ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-[#6B7280] mb-3">
                    {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}의 일정
                  </div>
                  {getSelectedDateTodos().length > 0 ? (
                    getSelectedDateTodos().map((todo) => (
                      <div
                        key={todo.id}
                        className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all`}
                        onClick={() => setSelectedTodoForDetail(todo.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
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
                                className={`text-base font-semibold ${todo.completed
                                  ? "line-through text-[#9CA3AF]"
                                  : "text-[#1F2937]"
                                  }`}
                              >
                                {todo.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 mt-2 ml-7">
                              <span className="text-sm text-[#6B7280]">
                                {todo.isAllDay
                                  ? '하루종일'
                                  : todo.endDate && todo.endDate !== todo.date
                                    ? `${todo.date} ~ ${todo.endDate}`
                                    : todo.startTime && todo.endTime
                                      ? `${todo.startTime} ~ ${todo.endTime}`
                                      : todo.time
                                        ? `${todo.time} • ${formatDuration(todo.duration || 0)}`
                                        : ''}
                              </span>
                            </div>
                            {todo.category && (
                              <div className="mt-2 ml-7">
                                <span className="text-xs text-[#9CA3AF] bg-white px-2 py-1 rounded-full">
                                  {todo.category}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[#9CA3AF]">
                      <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                      <p>선택한 날짜에 일정이 없습니다</p>
                    </div>
                  )}
                </div>
              ) : (
                /* 오늘의 할 일 리스트 */
                <div className="space-y-3">
                  <div className="text-sm font-medium text-[#6B7280] mb-3">오늘의 할 일</div>
                  {(() => {
                    const todayTodos = todos.filter(t => !t.completed && !t.isRoutine && t.date === currentDate).slice(0, 10);
                    return (
                      <>
                        {todayTodos.map((todo) => (
                          <div
                            key={todo.id}
                            className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all`}
                            onClick={() => setSelectedTodoForDetail(todo.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
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
                                    className={`text-base font-semibold ${todo.completed
                                      ? "line-through text-[#9CA3AF]"
                                      : "text-[#1F2937]"
                                      }`}
                                  >
                                    {todo.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 mt-2 ml-7">
                                  <span className="text-sm text-[#6B7280]">
                                    {todo.isAllDay
                                      ? '하루종일'
                                      : todo.endDate && todo.endDate !== todo.date
                                        ? `${todo.date} ~ ${todo.endDate}`
                                        : todo.startTime && todo.endTime
                                          ? `${todo.startTime} ~ ${todo.endTime}`
                                          : todo.time
                                            ? `${todo.time} • ${formatDuration(todo.duration || 0)}`
                                            : ''}
                                  </span>
                                </div>
                                {todo.category && (
                                  <div className="mt-2 ml-7">
                                    <span className="text-xs text-[#9CA3AF] bg-white px-2 py-1 rounded-full">
                                      {todo.category}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {todayTodos.length === 0 && (
                          <div className="text-center py-12 text-[#9CA3AF]">
                            <Check size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">모든 할 일을 완료했습니다!</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* 모바일/기타 뷰: 기존 레이아웃 */
        <div className="flex-1 overflow-auto bg-white relative">
          {/* Profile Menu Dropdown - 모바일에서만 */}
          {showProfileMenu && isMobile && (
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
                    setShowProfileManagementScreen(true);
                  }}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-[#6B7280]" />
                    <span className="text-[#1F2937]">프로필 관리</span>
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
                    setShowCustomerService(true);
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
                    setShowUserGuide(true);
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

            {/* Month Calendar - 모바일 뷰에서만 표시 */}
            {calendarView === "month" && isMobile && (
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
                                {todo.isAllDay
                                  ? '하루종일'
                                  : todo.endDate && todo.endDate !== todo.date
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

            {/* Week Calendar - 모바일 뷰에서만 표시 */}
            {calendarView === "week" && isMobile && (
              <>
                {/* 프로필 선택 영역 */}
                <div className="bg-white px-4 pt-4 pb-3 border-b border-[#F3F4F6]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-[#1F2937]">프로필</h4>
                  </div>
                  {/* 가로 스크롤 가능한 프로필 목록 */}
                  <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
                    {familyMembers.map((member) => {
                      const isSelected = selectedMembers.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleMemberSelection(member.id)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] flex-shrink-0 ${isSelected
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
                      );
                    })}
                  </div>
                </div>
                <WeekCalendar
                  todos={todos}
                  familyMembers={familyMembers}
                  selectedMembers={selectedMembers}
                  selectedDate={selectedDate}
                  onDateSelect={(date) => setSelectedDate(date)}
                  onTodoUpdate={handleTodoUpdate}
                  onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                />
                {/* 선택된 날짜의 일정 리스트 - 모바일/태블릿 주간 캘린더 아래에 표시 */}
                {selectedDate && (
                  <div className="space-y-3 px-4 mt-4">
                    <h3 className="text-lg font-bold text-[#1F2937] mb-4">
                      {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} 일정
                    </h3>
                    {(() => {
                      const selectedDateTodos = todos.filter(t => {
                        if (t.isRoutine || !t.date) return false;
                        if (t.date === selectedDate) return true;
                        if (t.endDate && t.date <= selectedDate && t.endDate >= selectedDate) return true;
                        return false;
                      });
                      return selectedDateTodos.length > 0 ? (
                        selectedDateTodos.map((todo) => (
                          <div
                            key={todo.id}
                            className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
                            onClick={() => setSelectedTodoForDetail(todo.id)}
                          >
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
                              <h4 className={`text-sm font-medium truncate ${todo.completed
                                ? "line-through text-[#9CA3AF]"
                                : "text-[#1F2937]"
                                }`}>
                                {todo.title}
                              </h4>
                            </div>
                            {todo.time && (
                              <div className="mt-1 ml-6">
                                <span className="text-xs text-[#6B7280]">{todo.time}</span>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-[#9CA3AF]">
                          <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">선택한 날짜에 일정이 없습니다</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {/* Day Calendar - 모바일 뷰에서만 표시 */}
            {calendarView === "day" && isMobile && (
              <div className="flex flex-col gap-4">
                {/* 선택된 날짜의 할 일 리스트 - 캘린더 위에 표시 */}
                <div className="space-y-3 px-4">
                  <h3 className="text-lg font-bold text-[#1F2937] mb-4">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }) + ' 일정'
                      : '오늘의 할 일'}
                  </h3>
                  {(() => {
                    // 선택된 날짜의 일정만 표시 (새로고침 시 오늘 날짜)
                    const displayDate = selectedDate || currentDate;
                    const todayTodos = todos.filter(t => {
                      if (t.isRoutine || !t.date) return false;
                      if (t.date === displayDate) return true;
                      if (t.endDate && t.date <= displayDate && t.endDate >= displayDate) return true;
                      return false;
                    }).slice(0, 10);
                    return (
                      <>
                        {todayTodos.map((todo) => (
                          <div
                            key={todo.id}
                            className={`${getCategoryColor(todo.category)} border-l-4 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
                            onClick={() => setSelectedTodoForDetail(todo.id)}
                          >
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
                              <h4 className={`text-sm font-medium truncate ${todo.completed
                                ? "line-through text-[#9CA3AF]"
                                : "text-[#1F2937]"
                                }`}>
                                {todo.title}
                              </h4>
                            </div>
                            {todo.time && (
                              <div className="mt-1 ml-6">
                                <span className="text-xs text-[#6B7280]">{todo.time}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {todayTodos.length === 0 && (
                          <div className="text-center py-8 text-[#9CA3AF]">
                            <Check size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">모든 할 일을 완료했습니다!</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <DayCalendar
                  todos={todos}
                  selectedDate={selectedDate || currentDate}
                  onDateChange={(date) => setSelectedDate(date)}
                  onTodoUpdate={handleTodoUpdate}
                  onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotificationPanel && !showTodoDetailFromNotification}
        onClose={() => {
          setShowNotificationPanel(false);
          setShowTodoDetailFromNotification(false);
        }}
        todos={todos}
        readNotificationIds={readNotificationIds}
        readUpcomingNotificationIds={readUpcomingNotificationIds}
        readPastNotificationIds={readPastNotificationIds}
        onMarkAsRead={(todoId, notificationType) => {
          const todoIdStr = String(todoId);
          if (notificationType === 'upcoming') {
            setReadUpcomingNotificationIds(prev => new Set([...prev, todoIdStr]));
          } else {
            setReadPastNotificationIds(prev => new Set([...prev, todoIdStr]));
          }
        }}
        onTodoClick={(todoId) => {
          setShowTodoDetailFromNotification(true);
          setSelectedTodoForDetail(todoId);
        }}
      />

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
        onMouseUp={handleFabMouseUp}
        onTouchStart={handleFabTouchStart}
        onTouchEnd={handleFabMouseUp}
      >
        <Pencil size={28} strokeWidth={2.5} />
      </button>

      {/* Input Method Modal */}
      {showInputMethodModal && (
        <InputMethodModal
          isOpen={showInputMethodModal}
          onClose={() => {
            setShowInputMethodModal(false);
            // InputMethodModal을 닫을 때도 입력값 초기화
            setExtractedTodoInfo(null);
            setInputMethodInitialMode('voice'); // 기본값으로 리셋
          }}
          onSelect={handleInputMethodSelect}
          initialMethod={inputMethodInitialMode}
          familyMembers={familyMembers}
          onSave={async (formData: any) => {
            await handleTodoSubmit(formData);
            setShowInputMethodModal(false);
            setExtractedTodoInfo(null);
            setInputMethodInitialMode('voice');
          }}
        />
      )}

      {/* Add Todo Modal */}
      {showAddTodoModal && (
        <AddTodoModal
          isOpen={showAddTodoModal}
          onClose={() => {
            setShowAddTodoModal(false);
            setEditingTodoId(null);
            setExtractedTodoInfo(null);
          }}
          onSave={handleTodoSubmit}
          initialData={editingTodoId
            ? (() => {
              const todo = todos.find(t => t.id === editingTodoId);
              if (!todo) return undefined;

              // 담당 프로필 디버깅
              console.log('[일정 수정] 초기 데이터:', {
                todoId: todo.id,
                assignedMemberIds: todo.assignedMemberIds,
                type: typeof todo.assignedMemberIds,
                isArray: Array.isArray(todo.assignedMemberIds)
              });

              return {
                id: todo.id,
                title: todo.title,
                date: todo.date || '',
                endDate: todo.endDate,
                startTime: todo.startTime || todo.time || '09:00',
                endTime: todo.endTime || (() => {
                  const [hours, mins] = (todo.startTime || todo.time || '09:00').split(':').map(Number);
                  const duration = todo.duration || 60;
                  const totalMins = hours * 60 + mins + duration;
                  const endHours = Math.floor(totalMins / 60) % 24;
                  const endMins = totalMins % 60;
                  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
                })(),
                isAllDay: todo.isAllDay || false,
                category: todo.category || '기타',
                checklistItems: todo.checklistItems || [],
                memo: todo.memo || todo.description || '',
                location: todo.location || '',
                hasNotification: todo.hasNotification || false,
                alarmTimes: todo.alarmTimes || [],
                notificationReminders: todo.notificationReminders || [],
                repeatType: todo.repeatType || 'none',
                repeatEndDate: todo.repeatEndDate,
                repeatPattern: todo.repeatPattern,
                assignedMemberIds: Array.isArray(todo.assignedMemberIds) ? todo.assignedMemberIds : (todo.assignedMemberIds ? [todo.assignedMemberIds] : []),
              };
            })()
            : extractedTodoInfo && extractedTodoInfo.title
              ? {
                ...extractedTodoInfo,
                date: selectedDate || extractedTodoInfo?.date
              }
              : undefined
          }
          familyMembers={familyMembers}
        />
      )}

      {/* My Page Screen */}
      {showMyPageScreen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <MyPageScreen
              isOpen={true}
              onClose={() => setShowMyPageScreen(false)}
              userName={userName}
              userEmail={userEmail}
              selectedEmoji={selectedEmoji}
              onUserNameChange={(name) => setUserName(name)}
              onEmojiChange={async (emoji) => {
                setSelectedEmoji(emoji);
                try {
                  await apiClient.updateUser({ avatar_emoji: emoji });
                  toast.success("프로필 이모지가 변경되었습니다!");
                } catch (error) {
                  console.error('Failed to update emoji:', error);
                  toast.error("프로필 이모지 변경에 실패했습니다.");
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Settings Screen */}
      {showSettingsScreen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <SettingsScreen
              isOpen={true}
              onClose={async () => {
                // 설정 화면이 닫힐 때 동기화 상태를 다시 확인
                try {
                  const response = await apiClient.getCalendarStatus();
                  if (response.data) {
                    const importEnabled = response.data.import_enabled || false;
                    const exportEnabled = response.data.export_enabled || false;

                    // 두 토글 중 하나도 활성화되어 있지 않으면 동기화 비활성화
                    if (!importEnabled && !exportEnabled) {
                      setSyncStatus('disabled');
                      setLastSyncTime(null);
                    } else {
                      // 동기화가 활성화되어 있으면 상태만 업데이트 (자동 동기화는 하지 않음)
                      if (syncStatus === 'disabled') {
                        setSyncStatus('idle');
                      }
                    }
                  }
                } catch (error) {
                  console.error('Failed to check calendar status:', error);
                }
                setShowSettingsScreen(false);
              }}
              onRefreshCalendar={async (force?: boolean) => {
                // 사용자가 '동기화 새로고침' 버튼을 눌렀을 때
                await loadGoogleCalendarEvents(force || true);
              }}
              onRefreshTodos={async () => {
                // 일정 목록 새로고침
                await loadTodos();
              }}
            />
          </div>
        </div>
      )}

      {/* Profile Management Screen */}
      {showProfileManagementScreen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <ProfileManagementScreen
              isOpen={true}
              onClose={() => setShowProfileManagementScreen(false)}
            />
          </div>
        </div>
      )}

      {/* Community Screen */}
      {showCommunityScreen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CommunityScreen
              isOpen={true}
              onClose={() => setShowCommunityScreen(false)}
            />
          </div>
        </div>
      )}

      {showCustomerService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1F2937]">고객센터</h2>
                <button
                  onClick={() => setShowCustomerService(false)}
                  className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                >
                  <X size={20} className="text-[#6B7280]" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <HelpCircle size={48} className="mx-auto text-[#FF9B82] mb-4" />
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">문의사항이 있으신가요?</h3>
                  <p className="text-[#6B7280] mb-6">
                    고객센터로 연락주시면 친절하게 도와드리겠습니다.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-[#F9FAFB] rounded-lg">
                      <div className="w-10 h-10 bg-[#FF9B82] rounded-full flex items-center justify-center">
                        📧
                      </div>
                      <div>
                        <div className="font-medium text-[#1F2937]">이메일</div>
                        <div className="text-sm text-[#6B7280]">support@always-plan.com</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-[#F9FAFB] rounded-lg">
                      <div className="w-10 h-10 bg-[#FF9B82] rounded-full flex items-center justify-center">
                        💬
                      </div>
                      <div>
                        <div className="font-medium text-[#1F2937]">실시간 채팅</div>
                        <div className="text-sm text-[#6B7280]">평일 09:00 - 18:00</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1F2937]">사용설명서</h2>
                <button
                  onClick={() => setShowUserGuide(false)}
                  className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                >
                  <X size={20} className="text-[#6B7280]" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-[#FF9B82] mb-4" />
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">사용설명서</h3>
                  <p className="text-[#6B7280] mb-6">
                    Always Plan 앱의 사용법을 확인하세요.
                  </p>
                  <div className="space-y-3">
                    <div className="p-4 bg-[#F9FAFB] rounded-lg text-left">
                      <h4 className="font-medium text-[#1F2937] mb-2">📅 캘린더 사용법</h4>
                      <ul className="text-sm text-[#6B7280] space-y-1">
                        <li>• 월간/주간/일간 뷰 전환</li>
                        <li>• 날짜를 클릭하여 일정 추가</li>
                        <li>• 일정을 드래그하여 이동</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-[#F9FAFB] rounded-lg text-left">
                      <h4 className="font-medium text-[#1F2937] mb-2">✅ 할 일 관리</h4>
                      <ul className="text-sm text-[#6B7280] space-y-1">
                        <li>• + 버튼으로 새 할 일 추가</li>
                        <li>• 체크박스로 완료 표시</li>
                        <li>• 카테고리별 색상 구분</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-[#F9FAFB] rounded-lg text-left">
                      <h4 className="font-medium text-[#1F2937] mb-2">🔄 동기화</h4>
                      <ul className="text-sm text-[#6B7280] space-y-1">
                        <li>• 설정에서 Google Calendar 연동</li>
                        <li>• 자동 동기화로 일정 공유</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              ...todoChecklistStates,
              [itemKey]: !todoChecklistStates[itemKey]
            }
          }));
        };

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#FF9B82] to-[#FFB499] px-6 py-4 text-white rounded-t-2xl flex items-center justify-between flex-shrink-0 relative">
                <h2 className="text-lg font-semibold text-white">일정 상세</h2>
                <button
                  onClick={() => {
                    // 알림에서 열었을 경우 알림 팝업으로 돌아가기
                    if (showTodoDetailFromNotification) {
                      setShowTodoDetailFromNotification(false);
                      setSelectedTodoForDetail(null);
                    } else {
                      setSelectedTodoForDetail(null);
                    }
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-6 space-y-4">
                {/* Title */}
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => toggleTodoComplete(todo.id)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-110 transition-transform ${todo.completed
                      ? "bg-[#FF9B82] border-[#FF9B82]"
                      : "border-[#D1D5DB] bg-white hover:border-[#FF9B82]"
                      }`}
                  >
                    {todo.completed && (
                      <Check size={16} className="text-white" strokeWidth={3} />
                    )}
                  </div>
                  <h3 className={`text-xl font-bold ${todo.completed ? "line-through text-[#9CA3AF]" : "text-[#1F2937]"}`}>
                    {todo.title}
                  </h3>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                  <Calendar size={18} className="text-[#9CA3AF]" />
                  <div className="flex flex-col gap-1">
                    {todo.isAllDay ? (
                      <span className="font-medium">하루종일</span>
                    ) : (
                      <>
                        <span>
                          {todo.endDate && todo.endDate !== todo.date
                            ? `${new Date(todo.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} ~ ${new Date(todo.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`
                            : new Date(todo.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                        </span>
                        {todo.startTime && (
                          <span className="text-xs">
                            {todo.startTime} {todo.endTime ? `~ ${todo.endTime}` : ''} {todo.duration ? `(${formatDuration(todo.duration)})` : ''}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Category */}
                {todo.category && (
                  <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                    <Tag size={18} className="text-[#9CA3AF]" />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(todo.category)}`}>
                      {todo.category}
                    </span>
                  </div>
                )}

                {/* Location */}
                {todo.location && (
                  <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                    <MapPin size={18} className="text-[#9CA3AF]" />
                    <span>{todo.location}</span>
                  </div>
                )}

                {/* 담당 프로필 */}
                {todo.assignedMemberIds && todo.assignedMemberIds.length > 0 && (
                  <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                    <User size={18} className="text-[#9CA3AF]" />
                    <div className="flex gap-2 flex-wrap">
                      {todo.assignedMemberIds.map((memberId: string) => {
                        const member = familyMembers.find(m => m.id === memberId);
                        return member ? (
                          <span key={memberId} className="flex items-center gap-1 px-2 py-1 bg-[#F3F4F6] rounded-full text-xs">
                            <span>{member.emoji}</span>
                            <span>{member.name}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* 반복 설정 */}
                {todo.repeatType && todo.repeatType !== 'none' && (
                  <div className="flex items-start gap-3 text-sm text-[#6B7280] pt-4 border-t border-[#F3F4F6]">
                    <Repeat size={18} className="text-[#9CA3AF] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-[#1F2937] mb-1">반복 설정</h4>
                      <p className="text-sm text-[#6B7280]">
                        {todo.repeatType === 'daily' && '매일 반복'}
                        {todo.repeatType === 'weekly' && '매주 반복'}
                        {todo.repeatType === 'monthly' && '매월 반복'}
                        {todo.repeatType === 'yearly' && '매년 반복'}
                        {todo.repeatType === 'weekdays' && '평일 반복'}
                        {todo.repeatType === 'weekends' && '주말 반복'}
                        {todo.repeatType === 'custom' && '맞춤 반복'}
                        {todo.repeatEndDate && ` (${new Date(todo.repeatEndDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}까지)`}
                      </p>
                    </div>
                  </div>
                )}

                {/* 알림 설정 */}
                {todo.hasNotification && (
                  <div className="flex items-start gap-3 text-sm text-[#6B7280] pt-4 border-t border-[#F3F4F6]">
                    <Bell size={18} className="text-[#9CA3AF] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-[#1F2937] mb-1">알림 설정</h4>
                      <div className="space-y-1">
                        {todo.notificationReminders && todo.notificationReminders.length > 0 ? (
                          todo.notificationReminders.map((reminder: any, index: number) => {
                            const value = typeof reminder === 'object' ? reminder.value : reminder;
                            const unit = typeof reminder === 'object' ? reminder.unit : 'minutes';
                            const unitText = unit === 'minutes' ? '분' : unit === 'hours' ? '시간' : unit === 'days' ? '일' : '주';
                            return (
                              <p key={index} className="text-sm text-[#6B7280]">
                                일정 {value}{unitText} 전 알림
                              </p>
                            );
                          })
                        ) : (
                          <p className="text-sm text-[#6B7280]">알림이 설정되어 있습니다</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {todo.description && (
                  <div className="pt-4 border-t border-[#F3F4F6]">
                    <h4 className="text-sm font-medium text-[#1F2937] mb-2">메모</h4>
                    <p className="text-sm text-[#6B7280] whitespace-pre-wrap">{todo.description}</p>
                  </div>
                )}

                {/* Checklist */}
                {checklistItems.length > 0 && (
                  <div className="pt-4 border-t border-[#F3F4F6]">
                    <h4 className="text-sm font-medium text-[#1F2937] mb-3">체크리스트</h4>
                    <div className="space-y-2">
                      {checklistItems.map((item: string, index: number) => {
                        const itemKey = `item-${index}`;
                        const isChecked = todoChecklistStates[itemKey] || false;
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleChecklistItem(index)}
                              className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-[#FF9B82] focus:ring-2"
                            />
                            <span className={`text-sm ${isChecked ? "line-through text-[#9CA3AF]" : "text-[#1F2937]"}`}>
                              {item}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                              await handleTodoDelete(nextDayTodo.id);
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

                            // todo_group_id 생성 또는 기존 그룹 ID 사용
                            const todoGroupId = todo.todoGroupId || `postpone_${todo.id}_${Date.now()}`;

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
                              assigned_member_ids: todo.assignedMemberIds || [],
                              todo_group_id: todoGroupId, // 그룹 ID 설정
                            };

                            // 원본 일정도 같은 그룹 ID로 업데이트 (아직 그룹 ID가 없는 경우)
                            if (!todo.todoGroupId) {
                              try {
                                await apiClient.updateTodo(todo.id, { todo_group_id: todoGroupId });
                              } catch (error) {
                                console.error("원본 일정 그룹 ID 업데이트 실패:", error);
                              }
                            }

                            console.log("다음날 일정 생성 시작:", nextDayTodoData);
                            const response = await apiClient.createTodo(nextDayTodoData);

                            if (response && response.data) {
                              // 응답 데이터를 todos 형식으로 변환
                              const formattedTodo = {
                                id: response.data.id,
                                title: response.data.title,
                                time: response.data.start_time || "09:00",
                                duration: duration,
                                completed: false,
                                category: response.data.category || "기타",
                                date: nextDateString,
                                startTime: response.data.start_time,
                                endTime: response.data.end_time,
                                isAllDay: response.data.all_day || false,
                                memo: response.data.memo || response.data.description || "",
                                location: response.data.location || "",
                                hasNotification: response.data.has_notification || false,
                                alarmTimes: response.data.notification_times || [],
                                repeatType: response.data.repeat_type || "none",
                                checklistItems: response.data.checklist_items?.map((item: any) => item.text || item) || [],
                                assignedMemberIds: Array.isArray(response.data.family_member_ids)
                                  ? response.data.family_member_ids
                                  : (Array.isArray(response.data.assigned_member_ids)
                                    ? response.data.assigned_member_ids
                                    : (response.data.family_member_ids ? [response.data.family_member_ids] : (response.data.assigned_member_ids ? [response.data.assigned_member_ids] : []))),
                                postponeToNextDay: false,
                              };

                              setTodos(prev => [...prev, formattedTodo]);
                              toast.success("다음날 일정이 추가되었습니다.");
                              console.log("다음날 일정 생성 완료:", formattedTodo);
                            } else {
                              console.error("응답 데이터 없음:", response);
                              toast.error("다음날 일정 추가에 실패했습니다.");
                            }
                          } catch (error: any) {
                            console.error("다음날 일정 생성 실패:", error);
                            toast.error(`다음날 일정 추가에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
                          }
                        }
                      }}
                      className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-2 focus:ring-[#FF9B82]"
                    />
                    <span className="text-sm text-[#1F2937]">미루기</span>
                  </label>
                </div>

              </div>

              {/* Footer - Actions */}
              <div className="px-6 py-4 border-t border-[#F3F4F6] bg-white flex-shrink-0 flex gap-3">
                <button
                  onClick={() => {
                    setEditingTodoId(todo.id);
                    setShowAddTodoModal(true);
                    setSelectedTodoForDetail(null);
                  }}
                  className="flex-1 py-3 px-4 bg-[#FF9B82] text-white rounded-lg font-medium hover:bg-[#FF8A6D] transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('정말로 이 일정을 삭제하시겠습니까?')) {
                      handleTodoDelete(todo.id);
                      setSelectedTodoForDetail(null);
                    }
                  }}
                  className="flex-1 py-3 px-4 bg-[#FEF2F2] text-[#EF4444] rounded-lg font-medium hover:bg-[#FEE2E2] transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}