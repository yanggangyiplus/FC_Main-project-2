import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Clock, Tag, FileText } from "lucide-react";
import { RoutineItem } from "./RoutineView";
import { formatDuration } from "@/utils/formatDuration";

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
  }>;
  routines?: RoutineItem[];
  onTodoUpdate?: (id: string, updates: { time: string; duration: number }) => void;
  onTodoClick?: (todoId: string) => void;
}

export function WeekCalendar({ todos, routines = [], onTodoUpdate, onTodoClick }: WeekCalendarProps) {
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
      const todayMockTodos = todos.filter(t => !t.date || t.date === todayStr);
      // Merge unique
      regularTodos = [...regularTodos, ...todayMockTodos.filter(t => !regularTodos.find(rt => rt.id === t.id))];
    }

    // 시간표는 캘린더에 표시하지 않음 (체크박스로 선택했을 때만 일정으로 추가됨)
    return regularTodos;
  };

  const getTimePosition = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  const getDurationHeight = (duration: number) => {
    return (duration / (24 * 60)) * 100;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      운동: "bg-[#0EA5E9] text-white",
      건강: "bg-[#FF9B82] text-white",
      업무: "bg-[#A855F7] text-white",
      생활: "bg-[#10B981] text-white",
      기타: "bg-[#F59E0B] text-white",
    };
    return colors[category] || colors["기타"];
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
              {timeSlots.map((time) => (
                <div key={time} className="h-20 border-b border-[#F3F4F6] px-2 py-1 text-xs text-[#6B7280]">
                  {time}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {weekDates.map((date, dayIndex) => {
              const dayTodos = getTodosForDate(date);
              return (
                <div key={dayIndex} className="relative border-r border-[#F3F4F6]">
                  {timeSlots.map((time) => (
                    <div key={time} className="h-20 border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors" />
                  ))}

                  {/* Todo Items */}
                  {dayTodos.map((todo) => {
                    const top = getTimePosition(todo.time);
                    const height = getDurationHeight(todo.duration);

                    return (
                      <div
                        key={todo.id}
                        className={`absolute left-1 right-1 ${getCategoryColor(todo.category)} rounded px-1 py-1 cursor-pointer shadow-sm hover:shadow-md transition-shadow group ${draggedTodo === todo.id ? "opacity-70 ring-2 ring-white z-20" : "z-10"
                          } ${activeTodoId === todo.id ? "ring-2 ring-yellow-400" : ""}`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(height, 3)}%`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, todo.id, todo.time, todo.duration)}
                        onMouseEnter={(e) => handleMouseEnter(e, todo.id)}
                        onMouseLeave={() => setHoveredTodo(null)}
                        onMouseUp={() => handleItemClick(todo.id)}
                      >
                        {/* RESIZE HANDLE - TOP */}
                        <div
                          className="absolute top-0 left-0 right-0 h-3 cursor-n-resize hover:bg-black/10 z-30"
                          onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'top')}
                        />

                        {/* Content */}
                        <div className="text-xs font-medium truncate pointer-events-none">{todo.title}</div>
                        <div className="text-xs opacity-90 pointer-events-none">{todo.time}</div>

                        {/* RESIZE HANDLE - BOTTOM */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize hover:bg-black/10 z-30"
                          onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'bottom')}
                        />
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
                      <Tag size={12} /> <span className={`px-1.5 py-0.5 rounded ${getCategoryColor(todo.category)}`}>{todo.category}</span>
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