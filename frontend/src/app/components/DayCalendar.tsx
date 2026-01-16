import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RoutineItem } from "./RoutineView";
import { formatDuration } from "@/utils/formatDuration";

interface DayCalendarProps {
  todos: Array<{
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
    date?: string;
    endDate?: string; // 종료 날짜 (기간 일정)
  }>;
  routines?: RoutineItem[];
  selectedDate?: string | null; // 선택된 날짜
  onDateChange?: (date: string) => void; // 날짜 변경 콜백
  onTodoUpdate?: (id: string, updates: { time: string; duration: number }) => void;
  onTodoClick?: (todoId: string) => void;
}

export function DayCalendar({ todos, routines = [], selectedDate, onDateChange, onTodoUpdate, onTodoClick }: DayCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => selectedDate ? new Date(selectedDate) : new Date());

  // selectedDate가 변경되면 currentDate도 업데이트
  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(new Date(selectedDate));
    }
  }, [selectedDate]);
  const [draggedTodo, setDraggedTodo] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState<'top' | 'bottom' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartTime, setDragStartTime] = useState("");
  const [dragStartDuration, setDragStartDuration] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  const timeSlots = [
    "00:00", "02:00", "04:00", "06:00", "08:00", "10:00",
    "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"
  ];

  const prevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    if (onDateChange) {
      onDateChange(newDate.toISOString().split('T')[0]);
    }
  };

  const nextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    if (onDateChange) {
      onDateChange(newDate.toISOString().split('T')[0]);
    }
  };

  const getTodosForDate = () => {
    const dateStr = currentDate.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay();

    // 1. Regular Todos - 기간 일정인 경우 시작일부터 종료일까지 모든 날짜에 표시
    let regularTodos = todos.filter((todo) => {
      if (!todo.date) return false;

      // 시작일과 동일한 경우
      if (todo.date === dateStr) return true;

      // 기간 일정인 경우: 시작일과 종료일 사이에 포함되는지 확인
      if (todo.endDate && todo.endDate !== todo.date) {
        const startDate = new Date(todo.date);
        const endDate = new Date(todo.endDate);
        const currentDateObj = new Date(dateStr);

        // 날짜 비교 (시간 제외)
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        currentDateObj.setHours(0, 0, 0, 0);

        return currentDateObj >= startDate && currentDateObj <= endDate;
      }

      return false;
    });

    if (dateStr === todayStr) {
      const todayMockTodos = todos.filter(t => !t.date || t.date === todayStr);
      regularTodos = [...regularTodos, ...todayMockTodos.filter(t => !regularTodos.find(rt => rt.id === t.id))];
    }

    // 시간표는 캘린더에 표시하지 않음 (체크박스로 선택했을 때만 일정으로 추가됨)
    return regularTodos;
  };

  const getTimePosition = (time: string) => {
    if (!time || typeof time !== 'string' || !time.includes(':')) {
      return 0; // 기본 위치
    }
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  const getDurationHeight = (duration: number) => {
    return (duration / (24 * 60)) * 100;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      공부: "bg-[#0EA5E9] text-white",
      업무: "bg-[#A855F7] text-white",
      약속: "bg-[#EC4899] text-white",
      생활: "bg-[#10B981] text-white",
      건강: "bg-[#FF9B82] text-white",
      구글: "bg-[#00085c] text-white",
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
    setResizeMode(null); // Move mode default
    setHasMoved(false);
  };

  const handleResizeStart = (e: React.MouseEvent, todoId: string, time: string, duration: number, mode: 'top' | 'bottom') => {
    e.stopPropagation();
    setDraggedTodo(todoId);
    setDragStartY(e.clientY);
    setDragStartTime(time);
    setDragStartDuration(duration);
    setResizeMode(mode);
    setHasMoved(false);
  };

  const handleTouchStart = (e: React.TouchEvent, todoId: string, time: string, duration: number) => {
    // Touch resize implementation omitted for simplicity, keeping basic touch move
    setDraggedTodo(todoId);
    setDragStartY(e.touches[0].clientY);
    setDragStartTime(time || '09:00');
    setDragStartDuration(duration || 60);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTodo) return;

    const deltaY = e.clientY - dragStartY;

    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
      const minutesDelta = Math.round((deltaY / window.innerHeight) * (24 * 60));
      const [startHours, startMinutes] = dragStartTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;

      let newStartTotalMinutes = startTotalMinutes;
      let newDuration = dragStartDuration;

      if (resizeMode === 'bottom') {
        newDuration = Math.max(30, dragStartDuration + minutesDelta);
      } else if (resizeMode === 'top') {
        newStartTotalMinutes = Math.max(0, startTotalMinutes + minutesDelta);
        const endTime = startTotalMinutes + dragStartDuration;
        newDuration = endTime - newStartTotalMinutes;

        if (newDuration < 30) {
          newDuration = 30;
          newStartTotalMinutes = endTime - 30;
        }
      } else {
        // Move
        newStartTotalMinutes = Math.max(0, Math.min(24 * 60 - dragStartDuration, startTotalMinutes + minutesDelta));
      }

      const newHours = Math.floor(newStartTotalMinutes / 60);
      const newMins = newStartTotalMinutes % 60;
      const newTime = `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

      const todo = todos.find((t) => t.id === draggedTodo);
      if (todo && onTodoUpdate) {
        onTodoUpdate(draggedTodo, { time: newTime, duration: newDuration });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedTodo || !dragStartTime) return;

    // Basic touch move logic (same as before)
    const deltaY = e.touches[0].clientY - dragStartY;
    const minutesDelta = Math.round((deltaY / window.innerHeight) * (24 * 60));

    const [hours, minutes] = (dragStartTime || '09:00').split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;
    
    let newMinutes = hours * 60 + minutes + minutesDelta;
    const currentDuration = dragStartDuration || 60;
    newMinutes = Math.max(0, Math.min(24 * 60 - currentDuration, newMinutes));

    const newHours = Math.floor(newMinutes / 60);
    const newMins = newMinutes % 60;
    const newTime = `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

    const todo = todos.find((t) => t.id === draggedTodo);
    if (todo && onTodoUpdate) {
      onTodoUpdate(draggedTodo, { time: newTime, duration: currentDuration });
    }
  };

  const handleMouseUp = () => {
    setDraggedTodo(null);
    setResizeMode(null);
    setHasMoved(false);
  };

  const handleTouchEnd = () => {
    setDraggedTodo(null);
  };

  const isToday = () => {
    const today = new Date();
    return (
      currentDate.getDate() === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const dayTodos = getTodosForDate();

  // Overlap Layout Algorithm
  const getOverlapLayout = (items: typeof dayTodos) => {
    // 1. Filter out items without valid time and set default time if needed
    const validItems = items.map(item => ({
      ...item,
      time: item.time || '09:00' // 기본 시간 설정
    })).filter(item => typeof item.time === 'string' && item.time.includes(':'));

    // 1. Sort by start time, then duration
    const sorted = [...validItems].sort((a, b) => {
      const [Ah, Am] = (a.time || '09:00').split(':').map(Number);
      const [Bh, Bm] = (b.time || '09:00').split(':').map(Number);
      const startA = Ah * 60 + Am;
      const startB = Bh * 60 + Bm;
      if (startA !== startB) return startA - startB;
      return b.duration - a.duration;
    });

    // 2. Identify Clusters
    const clusters: (typeof items)[] = [];
    let currentCluster: (typeof items) = [];
    let clusterMaxEnd = -1;

    sorted.forEach(item => {
      const [h, m] = (item.time || '09:00').split(':').map(Number);
      const start = h * 60 + m;
      const end = start + (item.duration || 60); // 기본 1시간

      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterMaxEnd = end;
      } else {
        if (start < clusterMaxEnd) {
          currentCluster.push(item);
          clusterMaxEnd = Math.max(clusterMaxEnd, end);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
          clusterMaxEnd = end;
        }
      }
    });
    if (currentCluster.length) clusters.push(currentCluster);

    // 3. Layout within clusters
    const layoutMap: { [key: string]: { left: number; width: number } } = {};

    clusters.forEach(cluster => {
      const columns: number[] = [];

      cluster.forEach(item => {
        const [h, m] = (item.time || '09:00').split(':').map(Number);
        const start = h * 60 + m;
        const end = start + (item.duration || 60);

        let colIndex = columns.findIndex(colEnd => colEnd <= start);

        if (colIndex === -1) {
          colIndex = columns.length;
          columns.push(end);
        } else {
          columns[colIndex] = end;
        }

        layoutMap[item.id] = { left: colIndex, width: 0 };
      });

      const totalCols = columns.length;

      cluster.forEach(item => {
        const info = layoutMap[item.id];
        info.left = (info.left / totalCols) * 100;
        info.width = 100 / totalCols;
      });
    });

    return layoutMap;
  };

  const layout = getOverlapLayout(dayTodos);

  return (
    <div className="bg-white select-none">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <button
          onClick={prevDay}
          className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-[#6B7280]" />
        </button>
        <h2 className="font-semibold text-[#1F2937]">
          {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월 {currentDate.getDate()}일
          {isToday() && (
            <span className="ml-2 text-sm bg-[#FF9B82] text-white px-2 py-0.5 rounded-full">
              오늘
            </span>
          )}
        </h2>
        <button
          onClick={nextDay}
          className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-[#6B7280]" />
        </button>
      </div>

      {/* Time Grid */}
      <div
        className="overflow-auto max-h-[600px]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex">
          {/* Time Labels */}
          <div className="w-16 border-r border-[#F3F4F6] flex-shrink-0">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-24 border-b border-[#F3F4F6] px-2 py-1 text-xs text-[#6B7280] flex items-start"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Day Column */}
          <div className="flex-1 relative">
            {/* Time Slots Background */}
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className={`h-24 border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors ${index % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
              />
            ))}

            {/* Todos */}
            <div className="absolute inset-0 px-2">
              {dayTodos.map((todo) => {
                const top = getTimePosition(todo.time);
                const height = getDurationHeight(todo.duration);
                const layoutInfo = layout[todo.id] || { left: 0, width: 100 };

                return (
                  <div
                    key={todo.id}
                    className={`absolute ${getCategoryColor(todo.category)} rounded-lg px-3 py-2 cursor-move shadow-md hover:shadow-lg transition-all ${draggedTodo === todo.id ? "opacity-70 ring-2 ring-white scale-105 z-20" : "z-10"
                      } ${todo.completed ? "opacity-50 line-through" : ""}`}
                    style={{
                      top: `${top}%`,
                      height: `${Math.max(height, 4)}%`,
                      left: `${layoutInfo.left}%`,
                      width: `${layoutInfo.width}%`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, todo.id, todo.time, todo.duration)}
                    onTouchStart={(e) => handleTouchStart(e, todo.id, todo.time, todo.duration)}
                    onClick={(e) => {
                      if (!hasMoved && onTodoClick) {
                        e.stopPropagation();
                        onTodoClick(todo.id);
                      }
                    }}
                  >
                    {/* Resize Handle Top */}
                    <div
                      className="absolute top-0 left-0 right-0 h-3 cursor-n-resize hover:bg-black/10 z-30"
                      onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'top')}
                    />

                    <div className={`font-semibold text-sm pointer-events-none ${todo.completed ? 'line-through opacity-70' : ''}`}>{todo.title}</div>
                    <div className="text-xs mt-1 opacity-90 pointer-events-none">
                      {todo.time} - {formatDuration(todo.duration || 60)}
                    </div>
                    <div className="text-xs mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-full pointer-events-none">
                      {todo.category}
                    </div>

                    {/* Resize Handle Bottom */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize hover:bg-black/10 z-30"
                      onMouseDown={(e) => handleResizeStart(e, todo.id, todo.time, todo.duration, 'bottom')}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
