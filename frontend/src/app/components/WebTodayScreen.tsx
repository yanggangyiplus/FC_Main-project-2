import { RefreshCw, Plus, Mic, Calendar as CalendarIcon } from 'lucide-react';
import { WebLayout } from './WebLayout';
import { TodoItem } from './TodoItem';
import { useState } from 'react';
import { motion } from 'framer-motion';

const mockTodos = [
  { id: '1', title: '소아과 예약 확인하기', time: '오전 10:00', rule: '병원', completed: false },
  { id: '2', title: '독감 예방접종 준비물 챙기기', time: '오전 10:30', rule: '병원', completed: false },
  { id: '3', title: '학교 준비물 챙기기', time: '오전 7:30', completed: true },
  { id: '4', title: '저녁 식재료 구매하기', time: '오후 5:00', completed: false },
];

export function WebTodayScreen() {
  const [todos, setTodos] = useState(mockTodos);

  const handleToggle = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;

  return (
    <WebLayout currentPage="today">
      {/* Header - 반응형, 데스크톱에서 개선 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 md:mb-10 lg:mb-12">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#1F2937] to-[#4B5563] bg-clip-text text-transparent">
            오늘
          </h1>
          <p className="text-[#6B7280] text-sm md:text-base lg:text-lg font-medium">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button className="h-11 sm:h-12 px-4 sm:px-5 border border-[#E5E7EB] rounded-xl hover:bg-white hover:border-[#D1D5DB] hover:shadow-sm transition-all duration-200 flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#4B5563]">
            <RefreshCw size={18} />
            <span className="hidden sm:inline">지금 동기화</span>
          </button>
          <button className="h-11 sm:h-12 px-4 sm:px-5 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-xl hover:from-[#5558E3] hover:to-[#7C3AED] hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium shadow-md">
            <Plus size={18} />
            <span className="hidden sm:inline">할 일 추가</span>
            <span className="sm:hidden">추가</span>
          </button>
        </div>
      </div>

      {/* Content Grid - 반응형: 모바일은 세로, 태블릿/데스크톱은 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 md:gap-8 lg:gap-10">
        {/* Todo List - 데스크톱에서 개선 */}
        <div className="space-y-4">
          {todos.map(todo => (
            <motion.div
              key={todo.id}
              whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transition-all duration-300 cursor-pointer border border-[#F3F4F6] hover:border-[#E5E7EB]"
            >
              <TodoItem
                {...todo}
                onToggle={handleToggle}
              />
            </motion.div>
          ))}
        </div>

        {/* Right Sidebar - 모바일에서는 하단, 태블릿/데스크톱에서는 우측, 데스크톱에서 개선 */}
        <div className="space-y-5 md:space-y-6 lg:space-y-6 order-first lg:order-last">
          {/* Mini Calendar Widget - 데스크톱에서 개선 */}
          <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-md hover:shadow-lg transition-shadow duration-300 border border-[#F3F4F6]">
            <h3 className="mb-5 text-xl lg:text-2xl font-bold text-[#1F2937]">
              {new Date().toLocaleDateString('ko-KR', { month: 'long' })}
            </h3>
            <MiniCalendar />
          </div>

          {/* Summary Card - 데스크톱에서 개선 */}
          <div className="bg-gradient-to-br from-white to-[#FAFAFA] rounded-2xl p-5 lg:p-6 shadow-md hover:shadow-lg transition-shadow duration-300 border border-[#F3F4F6]">
            <h3 className="mb-4 text-lg lg:text-xl font-bold text-[#1F2937]">오늘의 할 일</h3>
            <div className="mb-2">
              <div className="flex justify-between mb-3">
                <span className="text-[#6B7280] text-sm font-medium">진행 상황</span>
                <span className="font-bold text-sm text-[#6366F1]">{completedCount}/{totalCount} 완료</span>
              </div>
              <div className="h-3 bg-[#F3F4F6] rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Add via Voice - 데스크톱에서 개선 */}
          <div className="bg-gradient-to-br from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] rounded-2xl p-6 lg:p-8 text-white text-center shadow-lg hover:shadow-xl transition-all duration-300 border border-[#6366F1]/20">
            <div className="bg-white/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Mic size={32} className="text-white" />
            </div>
            <h4 className="mb-2 text-white font-bold text-base lg:text-lg">음성으로 추가하기</h4>
            <p className="text-sm lg:text-base text-white/90 mb-4">빠르게 할 일을 추가해보세요</p>
            <button className="w-full h-11 lg:h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg">
              시작하기
            </button>
          </div>
        </div>
      </div>

      {/* FAB - 모바일에서는 하단 탭바 위, 데스크톱에서는 우측 하단, 데스크톱에서 개선 */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:from-[#5558E3] hover:to-[#7C3AED] transition-all duration-300 z-10 border-2 border-white/20"
      >
        <Mic size={24} className="text-white md:size-7 lg:size-8" />
      </motion.button>
    </WebLayout>
  );
}

/**
 * 미니 캘린더 컴포넌트
 * 현재 월의 날짜를 표시
 */
function MiniCalendar() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = now.getDate();

  return (
    <div>
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((day, i) => (
          <div key={day} className={`text-center text-xs font-medium ${i === 0 ? 'text-[#EF4444]' : 'text-[#9CA3AF]'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(date => {
          const isToday = date === today;

          return (
            <button
              key={date}
              className={`
                aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors
                ${isToday ? 'bg-[#6366F1] text-white font-semibold' : 'hover:bg-[#F3F4F6] text-[#6B7280]'}
              `}
            >
              <span>{date}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
