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
  const [userEmail, setUserEmail] = useState("momflow@email.com");
  const [userName, setUserName] = useState("홍길동");
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

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: "1", name: "나", emoji: selectedEmoji, color: "rgba(255, 155, 130, 0.6)" },
    { id: "2", name: "아이1", emoji: "👧", color: "rgba(16, 185, 129, 0.6)" },
    { id: "3", name: "아이2", emoji: "👦", color: "rgba(245, 158, 11, 0.6)" },
    { id: "4", name: "배우자", emoji: "👨", color: "rgba(168, 85, 247, 0.6)" },
  ]);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(["1"]);

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

  const handleRoutineAdd = (routine: RoutineItem) => {
    setRoutines(prev => [...prev, routine]);
  };

  const handleRoutineUpdate = (updatedRoutine: RoutineItem) => {
    setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutine : r));
  };

  const handleRoutineDelete = (id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
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
    repeatType?: "none" | "daily" | "weekly" | "monthly";
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

  const handleSaveDetailedTodo = (formData: TodoFormData) => {
    // Calculate duration from start and end time
    const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
    const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);

    if (editingTodoId) {
      // 수정 모드
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
        memo: formData.memo,
        location: formData.location,
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
      // 추가 모드
      const newTodo = {
        id: Date.now().toString(),
        title: formData.title,
        time: formData.startTime,
        duration: duration > 0 ? duration : 60,
        completed: false,
        category: formData.category,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isAllDay: formData.isAllDay,
        memo: formData.memo,
        location: formData.location,
        hasNotification: formData.hasNotification,
        alarmTimes: formData.alarmTimes,
        repeatType: formData.repeatType,
        checklistItems: formData.checklistItems.filter(item => item.trim() !== ''),
        postponeToNextDay: formData.postponeToNextDay,
      };

      setTodos((prev) =>
        [...prev, newTodo].sort((a, b) => a.time.localeCompare(b.time))
      );
      toast.success("일정이 추가되었습니다.");
    }
  };

  const toggleTodoComplete = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    toast.success("일정이 삭제되었습니다.");
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

  const handleSaveMember = (member: any) => {
    if (editingMemberId) {
      // 수정 모드 - 시간표 프로필은 기본 프로필과 분리
      setFamilyMembers((prev) =>
        prev.map((m) =>
          m.id === editingMemberId
            ? {
              ...m,
              name: member.name || m.name,
              emoji: member.emoji || m.emoji, // 시간표 전용 프로필 이모지
              phone: member.phone || m.phone,
              memo: member.memo || m.memo,
            }
            : m
        )
      );
      toast.success(`${member.name}님이 수정되었습니다!`);
      setEditingMemberId(null);
    } else {
      // 추가 모드 - 시간표 프로필은 기본 프로필과 분리해서 저장
      const newMember: FamilyMember = {
        id: Date.now().toString(),
        name: member.name,
        emoji: member.emoji || "🐼", // 시간표 전용 프로필 이모지 (기본 프로필과 분리)
        color: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`,
        phone: member.phone,
        memo: member.memo,
      };
      setFamilyMembers((prev) => [...prev, newMember]);
      toast.success(`${member.name}님이 추가되었습니다!`);
    }
  };

  const handleDeleteMember = (memberId: string) => {
    const member = familyMembers.find(m => m.id === memberId);
    if (member && window.confirm(`${member.name}님을 삭제하시겠습니까?`)) {
      setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
      toast.success(`${member.name}님이 삭제되었습니다.`);
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

  /* Helper to Merge Routines and Todos for a specific date */
  const getTodosForDate = (targetDate: Date) => {
    const dayOfWeek = targetDate.getDay(); // 0 (Sun) - 6 (Sat)
    const dateString = targetDate.toISOString().split('T')[0];

    // 1. Regular Todos for this date (or no date = daily?) 
    const regularTodos = todos.filter(t => !t.date || t.date === dateString);

    // 2. Routine Instances (Filtered by Selected Members)
    const activeRoutines = routines.filter(r => selectedMembers.includes(r.memberId));

    const routineTodos: any[] = []; // Use any or TodoItem interface if available
    activeRoutines.forEach(routine => {
      routine.timeSlots.forEach(slot => {
        if (slot.day === dayOfWeek) {
          const instanceId = `routine-${routine.id}-${dateString}`;

          // Check if this instance is already "shadowed" by a real Todo (exception)
          // The exception would have the SAME ID.
          const isShadowed = regularTodos.some(t => t.id === instanceId);

          if (!isShadowed) {
            routineTodos.push({
              id: instanceId, // Unique ID
              title: routine.name,
              time: slot.startTime,
              duration: slot.duration,
              completed: false,
              category: routine.category || "기타",
              date: dateString,
              memberId: routine.memberId,
              isRoutine: true,
              routineId: routine.id,
              memo: routine.memo,
            });
          }
        }
      });
    });

    return [...regularTodos, ...routineTodos].sort((a, b) => a.time.localeCompare(b.time));
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
            </div>

            {/* Divider */}
            <div className="h-2 bg-[#F3F4F6]" />

            {/* Logout */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                toast.success("로그아웃 되었습니다.");
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
                    routines={filteredRoutines}
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
                  routines={filteredRoutines}
                  onTodoUpdate={handleTodoUpdate}
                  onTodoClick={(todoId) => setSelectedTodoForDetail(todoId)}
                />
              )}

              {/* Day Calendar */}
              {calendarView === "day" && (
                <DayCalendar
                  todos={todos}
                  routines={filteredRoutines}
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
                {displayTodos.map((todo) => (
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
                ))}
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
                    onClick={() => {
                      if (window.confirm('이 일정을 삭제하시겠습니까?')) {
                        setTodos(prev => prev.filter(t => t.id !== todo.id));
                        setSelectedTodoForDetail(null);
                        toast.success('일정이 삭제되었습니다.');
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
          initialData={editingTodoId ? todos.find(t => t.id === editingTodoId) : undefined}
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
        onUserNameChange={setUserName}
        onEmojiChange={setSelectedEmoji}
      />

      {/* Settings Screen */}
      <SettingsScreen
        isOpen={showSettingsScreen}
        onClose={() => setShowSettingsScreen(false)}
      />
    </div>
  );
}