import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RoutineItem } from "./RoutineView";

interface DayCalendarProps {
  todos: Array<{
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
    date?: string;
  }>;
  routines?: RoutineItem[];
  onTodoUpdate?: (id: string, updates: { time: string; duration: number }) => void;
  onTodoClick?: (todoId: string) => void;
}

export function DayCalendar({ todos, routines = [], onTodoUpdate, onTodoClick }: DayCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
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
  };

  const nextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const getTodosForDate = () => {
    const dateStr = currentDate.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay();

    // 1. Regular Todos
    let regularTodos = todos.filter((todo) => todo.date === dateStr);

    if (dateStr === todayStr) {
      const todayMockTodos = todos.filter(t => !t.date || t.date === todayStr);
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
    setDragStartTime(time);
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
    if (!draggedTodo) return;

    // Basic touch move logic (same as before)
    const deltaY = e.touches[0].clientY - dragStartY;
    const minutesDelta = Math.round((deltaY / window.innerHeight) * (24 * 60));

    const [hours, minutes] = dragStartTime.split(":").map(Number);
    let newMinutes = hours * 60 + minutes + minutesDelta;

    newMinutes = Math.max(0, Math.min(24 * 60 - 30, newMinutes));

    const newHours = Math.floor(newMinutes / 60);
    const newMins = newMinutes % 60;
    const newTime = `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

    const todo = todos.find((t) => t.id === draggedTodo);
    if (todo && onTodoUpdate) {
      onTodoUpdate(draggedTodo, { time: newTime, duration: todo.duration });
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
    // 1. Sort by start time, then duration
    const sorted = [...items].sort((a, b) => {
      const [Ah, Am] = a.time.split(':').map(Number);
      const [Bh, Bm] = b.time.split(':').map(Number);
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
      const [h, m] = item.time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + item.duration;

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
        const [h, m] = item.time.split(':').map(Number);
        const start = h * 60 + m;
        const end = start + item.duration;

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

                    <div className="font-semibold text-sm pointer-events-none">{todo.title}</div>
                    <div className="text-xs mt-1 opacity-90 pointer-events-none">
                      {todo.time} - {todo.duration}분
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
