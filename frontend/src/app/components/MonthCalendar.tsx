import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { RoutineItem } from "./RoutineView";

interface MonthCalendarProps {
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
  routines?: RoutineItem[]; // Added routines prop
  selectedDate?: string | null; // 선택된 날짜
  onDateSelect?: (date: string) => void;
  onTodoClick?: (todoId: string) => void;
}

export function MonthCalendar({ todos, routines = [], selectedDate, onDateSelect, onTodoClick }: MonthCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();
    const currentDateObj = new Date(dateStr);

    // 1. Todos - 기간 일정인 경우 시작일부터 종료일까지 모든 날짜에 표시
    const dayTodos = todos
      .filter((todo) => {
        if (!todo.date) return false;
        
        // 시작일과 동일한 경우
        if (todo.date === dateStr) return true;
        
        // 기간 일정인 경우: 시작일과 종료일 사이에 포함되는지 확인
        if (todo.endDate && todo.endDate !== todo.date) {
          const startDate = new Date(todo.date);
          const endDate = new Date(todo.endDate);
          
          // 날짜 비교 (시간 제외)
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          currentDateObj.setHours(0, 0, 0, 0);
          
          return currentDateObj >= startDate && currentDateObj <= endDate;
        }
        
        return false;
      })
      .map(t => ({ title: t.title, type: 'todo' })); // You might want color from category here if available

    // 시간표는 캘린더에 표시하지 않음 (체크박스로 선택했을 때만 일정으로 추가됨)
    return dayTodos;
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const events = getEventsForDay(day);
    const hasEvent = events.length > 0;
    const isTodayDate = isToday(day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isSelectedDate = selectedDate === dateStr && !isTodayDate;

    days.push(
      <button
        key={day}
        onClick={() => {
          onDateSelect?.(dateStr);
        }}
        onMouseEnter={() => setHoveredDate(day)}
        onMouseLeave={() => setHoveredDate(null)}
        className={`aspect-square flex flex-col items-center justify-center rounded-md sm:rounded-lg relative transition-all hover:bg-[#FFF0EB] ${
          isTodayDate
            ? "bg-[#FF9B82] text-white font-bold"
            : isSelectedDate
            ? "bg-[#FFE8E0] text-[#1F2937]"
            : "text-[#1F2937]"
        }`}
      >
        <span className="text-xs sm:text-sm">{day}</span>
        {hasEvent && !isTodayDate && (
          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-[#EF4444] rounded-full" />
        )}
        {hasEvent && isTodayDate && (
          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-white rounded-full" />
        )}

        {/* Tooltip */}
        {hoveredDate === day && hasEvent && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-32 bg-white/95 backdrop-blur-sm border border-[#FFD4C8] rounded-lg shadow-xl z-50 overflow-hidden text-left pointer-events-none fade-in-scale">
            <div className="bg-[#FFF0EB] px-2 py-1 border-b border-[#FFD4C8]">
              <span className="text-[10px] font-bold text-[#FF9B82]">{month + 1}월 {day}일</span>
            </div>
            <div className="p-1.5 space-y-0.5">
              {events.slice(0, 3).map((e, i) => {
                // Find corresponding todo ID
                const todoForEvent = todos.find(t => t.title === e.title && t.date === `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
                return (
                  <div
                    key={i}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (todoForEvent && onTodoClick) {
                        onTodoClick(todoForEvent.id);
                      }
                    }}
                    className="text-[10px] text-[#4B5563] truncate flex items-center gap-1 cursor-pointer hover:bg-[#FFF0EB] px-1 py-0.5 rounded transition-colors pointer-events-auto"
                  >
                    <span className={`w-1 h-1 rounded-full ${e.type === 'todo' ? 'bg-[#3B82F6]' : 'bg-[#10B981]'}`}></span>
                    {e.title}
                  </div>
                );
              })}
              {events.length > 3 && (
                <div className="text-[9px] text-[#9CA3AF] pl-2">+ {events.length - 3}건 더보기</div>
              )}
            </div>
          </div>
        )}
      </button>
    );
  }

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white">
      {/* Calendar Header - 반응형 */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <button
          onClick={prevMonth}
          className="p-1.5 sm:p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <ChevronLeft size={18} className="text-[#6B7280] sm:size-5" />
        </button>
        <h2 className="font-semibold text-sm sm:text-base text-[#1F2937]">
          {year}년 {month + 1}월
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 sm:p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <ChevronRight size={18} className="text-[#6B7280] sm:size-5" />
        </button>
      </div>

      {/* Calendar Grid - 반응형 */}
      <div className="px-2 sm:px-4 py-2 sm:py-3">
        {/* Week days */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`text-center text-[10px] sm:text-xs font-medium py-1 sm:py-2 ${index === 0
                ? "text-[#EF4444]"
                : index === 6
                  ? "text-[#3B82F6]"
                  : "text-[#6B7280]"
                }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">{days}</div>
      </div>
    </div>
  );
}
