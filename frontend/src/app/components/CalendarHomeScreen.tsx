import { useState, useEffect } from "react";
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
import { TodoAddSheet } from "./TodoAddSheet";
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

export function CalendarHomeScreen() {
  const [showTodoAddSheet, setShowTodoAddSheet] = useState(false);
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

  const [selectedMembers, setSelectedMembers] = useState<string[]>(["me"]);

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
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

  // 초기 데이터 로드 (프로필, 일정, 시간표, 가족 구성원)
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

      // 2. 일정 로드
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

            // notification_times 파싱
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

            return {
              id: todo.id,
              title: todo.title,
              time: todo.start_time || "09:00",
              duration: duration > 0 ? duration : 60,
              completed: todo.status === 'completed',
              category: todo.category || "기타",
              date: todoDate,
              startTime: todo.start_time,
              endTime: todo.end_time,
              isAllDay: todo.all_day || false,
              memo: todo.memo || todo.description || "",
              location: todo.location || "",
              hasNotification: todo.has_notification || false,
              alarmTimes: alarmTimes,
              repeatType: todo.repeat_type || "none",
              checklistItems: todo.checklist_items?.map((item: any) => item.text || item) || [],
              memberId: memberId,
              isRoutine: false,
            };
          });
          setTodos(formattedTodos);
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
          const formattedMembers = familyResponse.data.map((member: any) => ({
            id: member.id,
            name: member.name,
            emoji: member.emoji || "🐼",
            color: member.color_code || member.color || "rgba(255, 155, 130, 0.6)",
            phone: member.phone_number,
            memo: member.notes,
          }));
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
    };

    loadInitialData();

    loadInitialData();
  }, []); // 컴포넌트 마운트 시 한 번만 실행

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
        add_to_calendar: false
      };

      console.log("시간표 데이터:", routineData);
      const response = await apiClient.createRoutine(routineData);
      console.log("시간표 저장 응답:", response);

      if (response && response.data) {
        const savedRoutine = {
          ...routine,
          id: response.data.id
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
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      let addedCount = 0;
      let failedCount = 0;

      // 각 요일별로 일정 생성
      for (const slot of routine.timeSlots) {
        console.log(`시간표 요일 처리: slot.day = ${slot.day} (${['일', '월', '화', '수', '목', '금', '토'][slot.day]})`);
        // 이번 달의 해당 요일 찾기
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayOfWeek = firstDayOfMonth.getDay(); // 0(일) ~ 6(토)

        // slot.day는 0(일) ~ 6(토) 순서로 저장됨
        // 해당 요일이 이번 달에 처음 나타나는 날짜 찾기
        // firstDayOfWeek는 1일의 요일 (0=일, 1=월, ..., 6=토)
        // slot.day는 찾고자 하는 요일 (0=일, 1=월, ..., 6=토)

        // 1일부터 시작하여 해당 요일을 찾음
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(currentYear, currentMonth, day);
          const actualDayOfWeek = date.getDay(); // 0(일) ~ 6(토)

          // 해당 요일인 경우에만 일정 추가
          // slot.day는 0(일) ~ 6(토) 순서로 저장됨
          // actualDayOfWeek도 0(일) ~ 6(토) 순서
          if (actualDayOfWeek === slot.day) {
            console.log(`일정 추가: ${day}일 (${['일', '월', '화', '수', '목', '금', '토'][actualDayOfWeek]}) - slot.day: ${slot.day}`);
            // 로컬 날짜를 직접 포맷팅 (UTC 변환으로 인한 날짜 밀림 방지)
            const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // 이 요일에 이미 일정이 있는지 확인 (중복 방지)
            const existingTodo = todos.find(t =>
              t.title === routine.name &&
              t.date === dateString &&
              t.startTime === slot.startTime
            );
            if (existingTodo) continue;

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
      // 체크박스 해제 시 해당 시간표로 생성된 모든 일정 제거 (백엔드에서도 삭제)
      const routineTodos = todos.filter(t =>
        t.title === routine.name &&
        t.startTime &&
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

      // 프론트엔드 상태 업데이트
      setTodos(prev => {
        const filtered = prev.filter(t =>
          !(t.title === routine.name &&
            t.startTime &&
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
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
    memo?: string;
    location?: string;
    hasNotification?: boolean;
    alarmTimes?: string[];
    repeatType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
    type?: "todo" | "checklist";
    checklistItems?: string[];
    postponeMinutes?: number;
    postponeToNextDay?: boolean;
    memberId?: string;
    isRoutine?: boolean;
    routineId?: string;
  }

  const [todos, setTodos] = useState<TodoItem[]>([]);

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
    setShowTodoAddSheet(false);
  };

  const handleSaveDetailedTodo = async (formData: TodoFormData) => {
    // Calculate duration from start and end time
    const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
    const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);

    try {
      if (editingTodoId) {
        console.log("일정 수정 시작:", editingTodoId, formData);
        // 수정 모드 - API 호출
        const todoData = {
          title: formData.title,
          description: formData.memo || "",
          memo: formData.memo || "",
          location: formData.location || "",
          date: formData.date,
          start_time: formData.startTime,
          end_time: formData.endTime,
          all_day: formData.isAllDay,
          category: formData.category,
          status: todos.find(t => t.id === editingTodoId)?.completed ? 'completed' : 'pending',
          has_notification: formData.hasNotification,
          notification_times: formData.alarmTimes || [],
          repeat_type: formData.repeatType || "none",
          checklist_items: formData.checklistItems.filter(item => item.trim() !== ''),
        };

        console.log("일정 수정 데이터:", todoData);
        const response = await apiClient.updateTodo(editingTodoId, todoData);
        console.log("일정 수정 응답:", response);

        if (response && response.data) {
          const updatedTodo = {
            id: editingTodoId,
            title: formData.title,
            time: formData.startTime,
            duration: duration > 0 ? duration : 60,
            completed: todos.find(t => t.id === editingTodoId)?.completed || false,
            category: formData.category,
            date: formData.date,
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
          };

          setTodos((prev) =>
            prev.map(t => t.id === editingTodoId ? updatedTodo : t)
              .sort((a, b) => a.time.localeCompare(b.time))
          );
          toast.success("일정이 수정되었습니다.");
          setEditingTodoId(null);
        } else {
          console.error("응답 데이터 없음:", response);
          toast.error("일정 수정에 실패했습니다. 응답 데이터가 없습니다.");
        }
      } else {
        console.log("일정 추가 시작:", formData);
        // 추가 모드 - API 호출
        const todoData = {
          title: formData.title,
          description: formData.memo || "",
          memo: formData.memo || "",
          location: formData.location || "",
          date: formData.date,
          start_time: formData.startTime,
          end_time: formData.endTime,
          all_day: formData.isAllDay,
          category: formData.category,
          status: 'pending',
          has_notification: formData.hasNotification,
          notification_times: formData.alarmTimes || [],
          repeat_type: formData.repeatType || "none",
          checklist_items: formData.checklistItems.filter(item => item.trim() !== ''),
        };

        console.log("일정 추가 데이터:", todoData);
        try {
          const response = await apiClient.createTodo(todoData);
          console.log("일정 추가 응답:", response);
          console.log("일정 추가 응답 데이터:", response?.data);
          console.log("일정 추가 응답 상태:", response?.status);

          if (response && response.data) {
            // API 응답에서 날짜 형식 확인 및 변환
            let todoDate = formData.date;
            if (response.data.date) {
              // API 응답의 날짜가 Date 객체인 경우 문자열로 변환
              if (response.data.date instanceof Date) {
                const year = response.data.date.getFullYear();
                const month = response.data.date.getMonth() + 1;
                const day = response.data.date.getDate();
                todoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              } else {
                todoDate = response.data.date;
              }
            }

            const newTodo = {
              id: response.data.id,
              title: formData.title,
              time: formData.startTime,
              duration: duration > 0 ? duration : 60,
              completed: false,
              category: formData.category,
              date: todoDate, // 올바른 날짜 형식 사용
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
              isRoutine: false,
            };

            console.log("일정 추가 완료:", newTodo);
            console.log("일정 날짜:", newTodo.date);
            setTodos((prev) => {
              const updated = [...prev, newTodo].sort((a, b) => {
                // 날짜와 시간으로 정렬
                if (a.date !== b.date) {
                  return (a.date || '').localeCompare(b.date || '');
                }
                return a.time.localeCompare(b.time);
              });
              console.log("업데이트된 todos:", updated);
              console.log("해당 날짜의 일정:", updated.filter(t => t.date === newTodo.date));
              return updated;
            });
            toast.success("일정이 추가되었습니다.");
            setShowAddTodoModal(false);
            setEditingTodoId(null);
          } else {
            console.error("응답 데이터 없음:", response);
            toast.error("일정 추가에 실패했습니다. 응답 데이터가 없습니다.");
          }
        } catch (apiError: any) {
          console.error("일정 추가 API 에러:", apiError);
          console.error("에러 응답:", apiError.response);
          console.error("에러 데이터:", apiError.response?.data);
          throw apiError; // 상위 catch로 전달
        }
      }
    } catch (error: any) {
      console.error("일정 저장 실패:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      console.error("에러 스택:", error.stack);
      toast.error(`일정 저장에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
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

      // 먼저 프론트엔드 상태에서 제거 (즉시 UI 업데이트)
      setTodos((prev) => {
        const filtered = prev.filter((todo) => todo.id !== id);
        console.log("프론트엔드에서 일정 제거 완료, 남은 일정 수:", filtered.length);
        return filtered;
      });

      // 백엔드에 삭제 요청
      const response = await apiClient.deleteTodo(id);
      console.log("일정 삭제 응답:", response);
      console.log("일정 삭제 응답 상태:", response?.status);

      // API 호출 성공 여부 확인 (204 No Content는 응답 본문이 없을 수 있음)
      if (response && (response.status === 204 || response.status === 200)) {
        console.log("백엔드 삭제 성공 확인됨");
        toast.success("일정이 삭제되었습니다.");
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
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
        toast.success("일정이 삭제되었습니다.");
      } else {
        toast.error(`일정 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
      }
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      운동: "bg-[#E0F2FE] border-l-[#0EA5E9]",
      건강: "bg-[#FFF0EB] border-l-[#FF9B82]",
      업무: "bg-[#F3E8FF] border-l-[#A855F7]",
      생활: "bg-[#D1FAE5] border-l-[#10B981]",
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
        setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
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

  const handleTodoUpdate = (id: string, updates: { time: string; duration: number }) => {
    setTodos((prev) => {
      // 1. Check if it's an existing Todo
      const existingIndex = prev.findIndex(t => t.id === id);
      if (existingIndex !== -1) {
        return prev.map((todo) =>
          todo.id === id ? { ...todo, ...updates } : todo
        );
      }

      // 2. If not found, check if it's a Routine Instance
      if (id.startsWith('routine-')) {
        const parts = id.split('-');
        // Format: routine-{id}-{yyyy}-{mm}-{dd}
        const routineId = parts[1];
        const dateStr = parts.slice(2).join('-');

        const routine = routines.find(r => r.id === routineId);

        if (routine) {
          // Create a new "Exception" Todo
          const newExceptionTodo: TodoItem = {
            id: id, // Maintain the same ID to shadow the routine instance
            title: routine.name,
            time: updates.time, // New time
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
      }

      return prev;
    });
    toast.success("일정 시간이 변경되었습니다.");
  };

  const handleInputMethodSelect = (method: 'voice' | 'camera' | 'text') => {
    setShowInputMethodModal(false);

    if (method === 'voice') {
      toast.info('음성 입력을 시작합니다.');
    } else if (method === 'camera') {
      toast.info('이미지 촬영을 시작합니다.');
    } else {
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

    // Regular Todos만 반환 (시간표는 제외)
    // date 필드가 정확히 일치하는 것만 반환
    const regularTodos = todos.filter(t => {
      if (t.isRoutine) return false;
      // date가 정확히 일치하는 경우
      const matches = t.date === dateString;
      return matches;
    });

    return regularTodos.sort((a, b) => a.time.localeCompare(b.time));
  };

  const filteredRoutines = routines.filter(r => selectedMembers.includes(r.memberId));
  // For Todo List tab (Today)
  const displayTodos = getTodosForDate(new Date());

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col max-w-[375px] mx-auto relative pb-4">
      {/* Header - Profile, Search, Notification */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F3F4F6]">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
        >
          <span className="text-xl">{selectedEmoji}</span>
        </button>
        <input
          type="text"
          placeholder="검색"
          className="flex-1 px-4 py-2 bg-[#F9FAFB] rounded-full text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:bg-white transition-all"
        />
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
        <div className="bg-white px-4 py-3 border-b border-[#F3F4F6]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-[#1F2937]">시간표</h4>
            <button
              onClick={() => setShowMemberAddSheet(true)}
              className="px-3 py-1.5 text-sm font-medium bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors flex items-center gap-1"
            >
              <Users size={16} />
              추가
            </button>
          </div>
          {/* 가로 스크롤 가능한 사용자 목록 */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6]">
            {familyMembers.map((member) => {
              const isSelected = selectedMembers.includes(member.id);
              return (
                <div key={member.id} className="flex-shrink-0 relative group">
                  <button
                    onClick={() => toggleMemberSelection(member.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] ${isSelected
                      ? "bg-[#FF9B82] shadow-md scale-105"
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
                      {(selectedDate ? todos.filter(t => t.date === selectedDate) : displayTodos).map((todo) => (
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
                                  {todo.time} • {todo.duration}분
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
                              {todo.time} • {todo.duration}분
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
                      {/* 날짜 */}
                      {todo.date && (
                        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                          <Calendar size={18} className="text-[#9CA3AF]" />
                          <span>{new Date(todo.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
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
                              {todo.duration && <span className="text-xs text-[#9CA3AF]">({todo.duration}분)</span>}
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
                            onChange={(e) => {
                              setTodos(prev =>
                                prev.map(t =>
                                  t.id === todo.id
                                    ? { ...t, postponeToNextDay: e.target.checked }
                                    : t
                                )
                              );
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
          }}
          onSave={handleSaveDetailedTodo}
          initialData={
            editingTodoId
              ? todos.find(t => t.id === editingTodoId)
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