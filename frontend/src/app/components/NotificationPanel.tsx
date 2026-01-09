import { X, Clock, CheckCircle2 } from "lucide-react";
import { formatDuration } from "@/utils/formatDuration";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Array<{
    id: string;
    title: string;
    time: string;
    duration: number;
    completed: boolean;
    category: string;
  }>;
}

export function NotificationPanel({ isOpen, onClose, todos }: NotificationPanelProps) {
  if (!isOpen) return null;

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const sortedTodos = [...todos].sort((a, b) => a.time.localeCompare(b.time));

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      공부: "bg-[#E0F2FE] text-[#0EA5E9]",
      업무: "bg-[#F3E8FF] text-[#A855F7]",
      약속: "bg-[#FCE7F3] text-[#EC4899]",
      생활: "bg-[#D1FAE5] text-[#10B981]",
      건강: "bg-[#FFF0EB] text-[#FF9B82]",
      구글: "bg-[#E8F5E9] text-[#00085c]",
      기타: "bg-[#FEF3C7] text-[#F59E0B]",
    };
    return colors[category] || colors["기타"];
  };

  const getTimeStatus = (time: string) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    if (time < currentTime) {
      return "past";
    } else if (time === currentTime) {
      return "now";
    } else {
      return "upcoming";
    }
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* 팝업 컨테이너 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-[400px] w-full max-h-[85vh] flex flex-col pointer-events-auto transform transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: 'slideUp 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF9B82] to-[#FFB399] px-5 py-4 text-white rounded-t-2xl relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">오늘의 알림</h2>
            </div>
            <p className="text-sm text-white/90">{today}</p>
            {/* 우측 상단 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {sortedTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center mb-3">
                  <Clock size={32} className="text-[#D1D5DB]" />
                </div>
                <p className="text-[#9CA3AF] text-center text-sm">
                  오늘 등록된 일정이 없습니다.
                </p>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-2">
                {sortedTodos.map((todo) => {
                  const timeStatus = getTimeStatus(todo.time);

                  return (
                    <div
                      key={todo.id}
                      className={`flex gap-3 p-3 rounded-lg border transition-all ${todo.completed
                        ? "bg-[#F9FAFB] border-[#E5E7EB]"
                        : timeStatus === "now"
                          ? "bg-[#FFF0EB] border-[#FF9B82] shadow-sm"
                          : timeStatus === "past"
                            ? "bg-white border-[#F3F4F6]"
                            : "bg-white border-[#E5E7EB]"
                        }`}
                    >
                      {/* Time Indicator */}
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${todo.completed
                            ? "bg-[#10B981] text-white"
                            : timeStatus === "now"
                              ? "bg-[#FF9B82] text-white animate-pulse"
                              : timeStatus === "past"
                                ? "bg-[#D1D5DB] text-white"
                                : "bg-[#FFE8E0] text-[#FF9B82]"
                            }`}
                        >
                          {todo.completed ? (
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                          ) : (
                            <Clock size={16} strokeWidth={2.5} />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className={`font-medium text-sm ${todo.completed
                              ? "line-through text-[#9CA3AF]"
                              : "text-[#1F2937]"
                              }`}
                          >
                            {todo.title}
                          </h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getCategoryColor(
                              todo.category
                            )}`}
                          >
                            {todo.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`font-medium ${todo.completed
                              ? "text-[#9CA3AF]"
                              : timeStatus === "now"
                                ? "text-[#FF9B82]"
                                : "text-[#6B7280]"
                              }`}
                          >
                            {todo.time}
                          </span>
                          <span className="text-[#D1D5DB]">•</span>
                          <span className="text-[#9CA3AF]">{formatDuration(todo.duration)}</span>
                        </div>

                        {timeStatus === "now" && !todo.completed && (
                          <div className="mt-1 text-xs text-[#FF9B82] font-medium flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-[#FF9B82] rounded-full animate-pulse" />
                            진행 중
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Footer */}
          <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#FAFAFA] rounded-b-2xl">
            <div className="flex items-center justify-around text-center">
              <div>
                <div className="text-lg font-bold text-[#FF9B82]">{sortedTodos.length}</div>
                <div className="text-xs text-[#6B7280]">전체</div>
              </div>
              <div className="w-px h-8 bg-[#E5E7EB]" />
              <div>
                <div className="text-lg font-bold text-[#10B981]">
                  {sortedTodos.filter((t) => t.completed).length}
                </div>
                <div className="text-xs text-[#6B7280]">완료</div>
              </div>
              <div className="w-px h-8 bg-[#E5E7EB]" />
              <div>
                <div className="text-lg font-bold text-[#6B7280]">
                  {sortedTodos.filter((t) => !t.completed).length}
                </div>
                <div className="text-xs text-[#6B7280]">남음</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}