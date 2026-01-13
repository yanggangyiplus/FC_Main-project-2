import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Clock, Tag, FileText } from "lucide-react";
import { formatDuration } from "@/utils/formatDuration";

interface FamilyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface WeekCalendarProps {
  todos: Array<{
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
    date?: string;
    endDate?: string; // 종료 날짜 (기간 일정)
    memo?: string;
    memberId?: string; // 담당 프로필 ID
    isAllDay?: boolean; // 하루종일 일정 여부
  }>;
  familyMembers?: FamilyMember[]; // 프로필 목록
  selectedMembers?: string[]; // 선택된 프로필 ID 목록
  onTodoUpdate?: (id: string, updates: { time: string; duration: number }) => void;
  onTodoClick?: (todoId: string) => void;
}

export function WeekCalendar({ todos, familyMembers = [], selectedMembers = [], onTodoUpdate, onTodoClick }: WeekCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTodo, setDraggedTodo] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState<'top' | 'bottom' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartTime, setDragStartTime] = useState("");
  const [dragStartDuration, setDragStartDuration] = useState(0);
  const [selectedTodo, setSelectedTodo] = useState<string | null>(null);
  const [hoveredTodo, setHoveredTodo] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);

  // Helper to remove duplicated logic and ensure consistent dates
  const getWeekDates = (date: Date) => {
    const current = new Date(date);
    const day = current.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = current.getDate() - day; // Adjust to Sunday

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(diff + i);
      weekDates.push(d);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(currentDate);
  const timeSlots = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];

  const prevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const getTodosForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = date.getDay();

    // 1. Regular Todos - 기간 일정인 경우 시작일부터 종료일까지 모든 날짜에 표시
    let regularTodos = todos.filter((todo) => {
      if (!todo.date) return false;

      // 프로필 필터링
      if (selectedMembers.length > 0) {
        // 프로필이 선택되어 있는 경우:
        // - 담당 프로필이 있는 일정: 선택된 프로필에 포함되어야 함
        // - 담당 프로필이 없는 일정: 표시 (프로필이 선택되어 있어도 담당 프로필 없는 일정은 표시)
        if (todo.memberId && !selectedMembers.includes(todo.memberId)) {
          return false;
        }
        // todo.memberId가 없으면 (담당 프로필이 없으면) 표시
      } else {
        // 모든 프로필이 꺼져 있는 경우: 담당 프로필이 없는 일정만 표시
        if (todo.memberId) {
          return false;
        }
      }

      // 시작일과 동일한 경우
      if (todo.date === dateStr) return true;

      // 기간 일정인 경우: 시작일과 종료일 사이에 포함되는지 확인
      if (todo.endDate && todo.endDate !== todo.date) {
        const startDate = new Date(todo.date);
        const endDate = new Date(todo.endDate);
        const currentDate = new Date(dateStr);

        // 날짜 비교 (시간 제외)
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        return currentDate >= startDate && currentDate <= endDate;
      }

      return false;
    });

    // Fallback for "Today's" mock todos that might not have a date
    if (dateStr === todayStr) {
      const todayMockTodos = todos.filter(t => {
        // 프로필 필터링 적용
        if (selectedMembers.length > 0) {
          if (t.memberId && !selectedMembers.includes(t.memberId)) {
            return false;
          }
          // t.memberId가 없으면 표시
        } else {
          // 모든 프로필이 꺼져 있으면 담당 프로필이 없는 일정만 표시
          if (t.memberId) {
            return false;
          }
        }
        return !t.date || t.date === todayStr;
      });
      // Merge unique
      regularTodos = [...regularTodos, ...todayMockTodos.filter(t => !regularTodos.find(rt => rt.id === t.id))];
    }

    return regularTodos;
  };

  const getTimePosition = (time: string) => {
    // 하루종일 일정은 시간 그리드 시작 부분에 표시 (0% 위치)
    if (!time || time === '') {
      return 0; // 시간 그리드의 맨 위 (0시 0분 위치)
    }
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  const getDurationHeight = (duration: number, isAllDay: boolean = false) => {
    // 하루종일 일정은 고정 높이
    if (isAllDay) {
      return 6; // 약 6% 높이
    }
    return (duration / (24 * 60)) * 100;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      공부: "#0EA5E9",
      업무: "#A855F7",
      약속: "#EC4899",
      생활: "#10B981",
      건강: "#FF9B82",
      구글: "#00085c",
      기타: "#F59E0B",
    };
    return colors[category] || colors["기타"];
  };

  // 프로필 색상 가져오기
  const getMemberColor = (memberId?: string): string | undefined => {
    if (!memberId) return undefined;
    const member = familyMembers.find(m => m.id === memberId);
    if (!member) return undefined;
    
    // rgba 형식인 경우 opacity 제거하고 hex로 변환
    if (member.color.startsWith('rgba')) {
      const rgbaMatch = member.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    // hex 형식인 경우 그대로 반환
    return member.color.startsWith('#') ? member.color : `#${member.color}`;
  };

  const handleMouseDown = (e: React.MouseEvent, todoId: string, time: string, duration: number) => {
    e.stopPropagation();
    setDraggedTodo(todoId);
    setDragStartY(e.clientY);
    setDragStartTime(time);
    setDragStartDuration(duration);
    setResizeMode(null); // Default meaning: Move mode
    setHasMoved(false);
  };

  const handleResizeStart = (e: React.MouseEvent, todoId: string, time: string, duration: number, mode: 'top' | 'bottom') => {
    e.stopPropagation(); // Prevent triggering drag-move
    setDraggedTodo(todoId);
    setDragStartY(e.clientY);
    setDragStartTime(time);
    setDragStartDuration(duration);
    setResizeMode(mode);
    setHasMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTodo) return;

    const deltaY = e.clientY - dragStartY;

    // Threshold to prevent accidental moves
    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);

      const minutesDelta = Math.round((deltaY / window.innerHeight) * (24 * 60));
      const [startHours, startMinutes] = dragStartTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;

      let newStartTotalMinutes = startTotalMinutes;
      let newDuration = dragStartDuration;

      if (resizeMode === 'bottom') {
        // RESIZING BOTTOM: Start time fixed, duration changes
        newDuration = Math.max(30, dragStartDuration + minutesDelta);
      } else if (resizeMode === 'top') {
        // RESIZING TOP: Start time changes, duration changes to keep end time fixed
        // newStart = oldStart + delta
        newStartTotalMinutes = Math.max(0, startTotalMinutes + minutesDelta);

        // End time should remain constant: oldStart + oldDuration
        const endTimeInMinutes = startTotalMinutes + dragStartDuration;

        // New Duration = EndTime - NewStart
        newDuration = endTimeInMinutes - newStartTotalMinutes;

        // Constraint: Minimum duration 30 mins
        if (newDuration < 30) {
          newDuration = 30;
          newStartTotalMinutes = endTimeInMinutes - 30; // Push start back if needed
        }
      } else {
        // MOVING (Default)
        newStartTotalMinutes = Math.max(0, Math.min(24 * 60 - dragStartDuration, startTotalMinutes + minutesDelta));
      }

      // Format HH:MM
      const newHours = Math.floor(newStartTotalMinutes / 60);
      const newMins = newStartTotalMinutes % 60;
      const newTime = `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

      if (onTodoUpdate) {
        onTodoUpdate(draggedTodo, { time: newTime, duration: newDuration });
      }
    }
  };

  const handleGlobalMouseUp = () => {
    if (draggedTodo) {
      setDraggedTodo(null);
      setResizeMode(null);
      setHasMoved(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Touch logic omitted for brevity in resize, keeping basic move or just stopping propagation
    e.stopPropagation();
  };

  // Click handling (only if not moved)
  const handleItemClick = (todoId: string) => {
    if (!hasMoved) {
      if (onTodoClick) {
        onTodoClick(todoId);
      } else {
        setSelectedTodo(selectedTodo === todoId ? null : todoId);
      }
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, todoId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredTodo(todoId);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const activeTodoId = selectedTodo || hoveredTodo;

  return (
    <div className="bg-white relative select-none">
      {/* Calendar Header */}
      <div>
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
          <button onClick={prevWeek} className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-[#6B7280]" />
          </button>
          <h2 className="font-semibold text-[#1F2937]">
            {weekDates[0].getMonth() + 1}월 {weekDates[0].getDate()}일 - {weekDates[6].getMonth() + 1}월 {weekDates[6].getDate()}일
          </h2>
          <button onClick={nextWeek} className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors">
            <ChevronRight size={20} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-8 border-b border-[#F3F4F6] bg-[#FAFAFA]">
          <div className="px-2 py-2 text-xs text-[#9CA3AF]"></div>
          {weekDates.map((date, index) => {
            const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
            return (
              <div key={index} className="text-center py-2">
                <div className={`text-xs font-medium ${index === 0 ? "text-[#EF4444]" : index === 6 ? "text-[#3B82F6]" : "text-[#1F2937]"}`}>
                  {dayNames[index]}
                </div>
                <div className={`text-sm mt-1 ${isToday(date) ? "bg-[#FF9B82] text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto font-bold" : ""}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div
          className="overflow-auto max-h-[500px]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleGlobalMouseUp}
          onMouseLeave={handleGlobalMouseUp}
        >
          <div className="grid grid-cols-8">
            {/* Time Labels */}
            <div className="border-r border-[#F3F4F6]">
              {/* 일정을 위한 공간 - 동적 높이 계산 */}
              {(() => {
                // 모든 날짜의 하루종일 일정 개수 중 최대값 찾기
                let maxAllDayCount = 0;
                weekDates.forEach((date) => {
                  const dayTodos = getTodosForDate(date);
                  const allDayCount = dayTodos.filter(todo => {
                    const isAllDay = todo.isAllDay || !todo.time || todo.time === '';
                    return isAllDay;
                  }).length;
                  if (allDayCount > maxAllDayCount) {
                    maxAllDayCount = allDayCount;
                  }
                });
                // 최소 높이 48px (h-12), 일정이 많을수록 높이 증가 (각 일정당 약 28px)
                const minHeight = 48;
                const perItemHeight = 28;
                const dynamicHeight = Math.max(minHeight, minHeight + (maxAllDayCount > 1 ? (maxAllDayCount - 1) * perItemHeight : 0));
                
                return (
                  <div 
                    className="border-b border-[#F3F4F6] px-2 py-1 text-xs text-[#9CA3AF] flex items-center"
                    style={{ height: `${dynamicHeight}px` }}
                  >
                    일정
                  </div>
                );
              })()}
              {timeSlots.map((time) => (
                <div key={time} className="h-16 border-b border-[#F3F4F6] px-2 py-1 text-xs text-[#6B7280]">
                  {time}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {weekDates.map((date, dayIndex) => {
              const dayTodos = getTodosForDate(date);
              const allDayTodos = dayTodos.filter(todo => {
                const isAllDay = todo.isAllDay || !todo.time || todo.time === '';
                return isAllDay;
              });
              
              // 하루종일 일정 개수에 따라 높이 계산
              const minHeight = 48; // 최소 높이 (h-12 = 48px)
              const perItemHeight = 28; // 각 일정당 높이
              const allDayHeight = Math.max(minHeight, minHeight + (allDayTodos.length > 1 ? (allDayTodos.length - 1) * perItemHeight : 0));
              
              return (
                <div key={dayIndex} className="relative border-r border-[#F3F4F6]">
                  {/* 일정을 위한 공간 - 동적 높이 */}
                  <div 
                    className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors relative"
                    style={{ height: `${allDayHeight}px` }}
                  >
                    {allDayTodos.map((todo, index) => {
                      const memberColor = getMemberColor(todo.memberId);
                      const categoryColor = getCategoryColor(todo.category);
                      const backgroundColor = memberColor || categoryColor;

                      const getBackgroundColorWithOpacity = (color: string | undefined): string | undefined => {
                        if (!color) return undefined;
                        if (color.startsWith('#')) {
                          const hex = color.replace('#', '');
                          const r = parseInt(hex.substring(0, 2), 16);
                          const g = parseInt(hex.substring(2, 4), 16);
                          const b = parseInt(hex.substring(4, 6), 16);
                          // 하루종일 일정: 색상을 더 진하게 (80% 밝기)하고 불투명하게
                          const darkerR = Math.floor(r * 0.8);
                          const darkerG = Math.floor(g * 0.8);
                          const darkerB = Math.floor(b * 0.8);
                          return `rgba(${darkerR}, ${darkerG}, ${darkerB}, 1.0)`;
                        }
                        return color;
                      };

                      // 각 일정의 위치 계산 (위에서부터 순서대로 배치)
                      const itemTop = 4 + (index * perItemHeight); // 첫 번째는 4px 아래, 이후는 각각 28px씩 아래

                      return (
                        <div
                          key={todo.id}
                          className="absolute left-1 right-1 rounded px-1.5 py-0.5 cursor-pointer shadow-sm hover:shadow-md transition-shadow flex items-center"
                          style={{
                            top: `${itemTop}px`,
                            height: `${perItemHeight - 4}px`, // 각 일정의 높이 (여백 제외)
                            backgroundColor: getBackgroundColorWithOpacity(backgroundColor),
                            color: backgroundColor ? 'white' : undefined,
                          }}
                          onMouseEnter={(e) => handleMouseEnter(e, todo.id)}
                          onMouseLeave={() => setHoveredTodo(null)}
                          onClick={() => handleItemClick(todo.id)}
                        >
                          <div className="text-xs font-medium truncate pointer-events-none flex-1">
                            {todo.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {timeSlots.map((time) => (
                    <div key={time} className="h-16 border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors" />
                  ))}

                  {/* Todo Items (일반 일정만, 하루종일 일정 제외) */}
                  {dayTodos.filter(todo => {
                    const isAllDay = todo.isAllDay || !todo.time || todo.time === '';
                    return !isAllDay; // 하루종일 일정은 위에서 이미 표시했으므로 제외
                  }).map((todo) => {
                    const isAllDay = false; // 필터링 후이므로 항상 false
                    const top = getTimePosition(todo.time);
                    const height = getDurationHeight(todo.duration, isAllDay);
                    
                    // 프로필 색상 또는 카테고리 색상 결정
                    const memberColor = getMemberColor(todo.memberId);
                    const categoryColor = getCategoryColor(todo.category);
                    const backgroundColor = memberColor || categoryColor;

                    // 배경색에 opacity 적용 (hex 색상을 rgba로 변환)
                    // 하루종일 일정은 불투명하고 진하게 (opacity 1.0, 색상 더 진하게)
                    const getBackgroundColorWithOpacity = (color: string | undefined, isAllDay: boolean = false): string | undefined => {
                      if (!color) return undefined;
                      // hex 색상을 rgba로 변환
                      if (color.startsWith('#')) {
                        const hex = color.replace('#', '');
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        
                        if (isAllDay) {
                          // 하루종일 일정: 색상을 더 진하게 (80% 밝기)하고 불투명하게
                          const darkerR = Math.floor(r * 0.8);
                          const darkerG = Math.floor(g * 0.8);
                          const darkerB = Math.floor(b * 0.8);
                          return `rgba(${darkerR}, ${darkerG}, ${darkerB}, 1.0)`;
                        } else {
                          // 일반 일정: 투명도 적용
                          return `rgba(${r}, ${g}, ${b}, 0.7)`;
                        }
                      }
                      return color;
                    };

                    return (
                      <div
                        key={todo.id}
                        className={`absolute left-1 right-1 rounded px-1 py-1 cursor-pointer shadow-sm hover:shadow-md transition-shadow group ${draggedTodo === todo.id ? "opacity-70 ring-2 ring-white z-20" : "z-10"
                          } ${activeTodoId === todo.id ? "ring-2 ring-yellow-400" : ""}`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(height, 3)}%`,
                          backgroundColor: getBackgroundColorWithOpacity(backgroundColor, isAllDay),
                          color: backgroundColor ? 'white' : undefined,
                        }}
                        onMouseDown={!isAllDay ? (e) => handleMouseDown(e, todo.id, todo.time, todo.duration) : undefined}
                        onMouseEnter={(e) => handleMouseEnter(e, todo.id)}
                        onMouseLeave={() => setHoveredTodo(null)}
                        onMouseUp={() => handleItemClick(todo.id)}
                      >
                        {/* RESIZE HANDLE - TOP (하루종일 일정은 리사이즈 불가) */}
                        {!isAllDay && (
                          <div
                            className="absolute top-0 left-0 right-0 h-3 cursor-n-resize hover:bg-black/10 z-30"
                            onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'top')}
                          />
                        )}

                        {/* Content */}
                        <div className="text-xs font-medium truncate pointer-events-none">
                          {todo.title}
                        </div>
                        <div className={`text-xs opacity-90 pointer-events-none ${backgroundColor ? 'text-white' : ''}`}>
                          {isAllDay ? '하루종일' : todo.time}
                        </div>

                        {/* RESIZE HANDLE - BOTTOM (하루종일 일정은 리사이즈 불가) */}
                        {!isAllDay && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize hover:bg-black/10 z-30"
                            onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'bottom')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Todo Detail Popover */}
      {activeTodoId && popupPosition && (() => {
        const todo = todos.find(t => t.id === activeTodoId);
        if (!todo) return null;
        const isHoverOnly = !selectedTodo && !!hoveredTodo;

        return (
          <>
            {!isHoverOnly && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedTodo(null)} />}

            <div
              className={`fixed z-50 bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-48 ${isHoverOnly ? "pointer-events-none" : ""}`}
              style={{
                top: `${popupPosition.y - 10}px`,
                left: `${popupPosition.x}px`,
                transform: "translate(-50%, -100%)"
              }}
            >
              <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-[#1F2937] text-sm flex-1 truncate">{todo.title}</h3>
                </div>
                <div className="space-y-2">
                  <div className="bg-[#FAFAFA] rounded p-2 text-xs text-[#6B7280] space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock size={12} /> <span>{todo.time} ({formatDuration(todo.duration)})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag size={12} /> <span className="px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: getCategoryColor(todo.category) }}>{todo.category}</span>
                    </div>
                    {todo.memo && (
                      <div className="pt-2 mt-2 border-t border-[#E5E7EB] flex items-start gap-1">
                        <FileText size={12} className="mt-0.5" />
                        <div className="flex-1">
                          <span className="block mb-0.5">메모:</span>
                          <p className="whitespace-pre-wrap bg-white p-1 rounded border line-clamp-3 text-[#1F2937]">{todo.memo}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}