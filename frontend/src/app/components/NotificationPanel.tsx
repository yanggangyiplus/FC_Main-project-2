import { X, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatDuration } from "@/utils/formatDuration";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Array<{
    id: string;
    title: string;
    date?: string;
    time?: string;
    startTime?: string;
    duration: number;
    completed: boolean;
    category: string;
    hasNotification?: boolean;
    has_notification?: boolean;
    notificationReminders?: Array<{ value: number; unit: string }>;
    notification_reminders?: Array<{ value: number; unit: string }>;
  }>;
  readNotificationIds?: Set<string>;
  readUpcomingNotificationIds?: Set<string>;
  readPastNotificationIds?: Set<string>;
  onMarkAsRead?: (todoId: string, notificationType?: 'past' | 'upcoming') => void;
  onTodoClick?: (todoId: string) => void;
}

export function NotificationPanel({ 
  isOpen, 
  onClose, 
  todos, 
  readNotificationIds = new Set(), 
  readUpcomingNotificationIds = new Set(),
  readPastNotificationIds = new Set(),
  onMarkAsRead, 
  onTodoClick 
}: NotificationPanelProps) {
  const [activeTab, setActiveTab] = useState<"past" | "upcoming">("upcoming");
  
  // 탭별 읽음 상태 관리
  const readTodos = useMemo(() => {
    return activeTab === 'past' ? readPastNotificationIds : readUpcomingNotificationIds;
  }, [activeTab, readPastNotificationIds, readUpcomingNotificationIds]);

  // 알림이 설정된 일정만 필터링
  const notifications = useMemo(() => {
    return todos.filter(todo => {
      const hasNotification = todo.hasNotification || todo.has_notification || false;
      const notificationReminders = todo.notificationReminders || todo.notification_reminders || [];
      return hasNotification && Array.isArray(notificationReminders) && notificationReminders.length > 0;
    });
  }, [todos]);

  // 알림 시간 기준으로 지나간 알림과 예정된 알림 분리
  const { pastNotifications, upcomingNotifications } = useMemo(() => {
    const now = new Date();
    const currentDateTime = now.getTime();

    const past: Array<typeof notifications[0] & { notificationTime: Date }> = [];
    const upcoming: Array<typeof notifications[0] & { notificationTime: Date }> = [];

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
          past.push({ ...todo, notificationTime: notificationDateTime });
        } else {
          upcoming.push({ ...todo, notificationTime: notificationDateTime });
        }
      });
    });

    // 지나간 알림: 최신부터 과거순 (알림 시간 내림차순)
    past.sort((a, b) => {
      return b.notificationTime.getTime() - a.notificationTime.getTime();
    });

    // 예정된 알림: 현재부터 미래순 (알림 시간 오름차순)
    upcoming.sort((a, b) => {
      return a.notificationTime.getTime() - b.notificationTime.getTime();
    });

    return { pastNotifications: past, upcomingNotifications: upcoming };
  }, [notifications]);

  // 확인 안된 지나간 알림 개수
  const unreadPastCount = useMemo(() => {
    return pastNotifications.filter(todo => !readPastNotificationIds.has(todo.id)).length;
  }, [pastNotifications, readPastNotificationIds]);

  // 확인 안된 예정된 알림 개수
  const unreadUpcomingCount = useMemo(() => {
    return upcomingNotifications.filter(todo => !readUpcomingNotificationIds.has(todo.id)).length;
  }, [upcomingNotifications, readUpcomingNotificationIds]);

  const handleMarkAsRead = (todoId: string) => {
    const notificationType = activeTab === 'past' ? 'past' : 'upcoming';
    if (onMarkAsRead) {
      onMarkAsRead(todoId, notificationType);
    }
  };

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return "오늘";
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return "내일";
    } else {
      return date.toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    }
  };

  if (!isOpen) return null;

  const displayNotifications = activeTab === "past" ? pastNotifications : upcomingNotifications;

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
              <h2 className="font-semibold">알림</h2>
            </div>
            {/* 우측 상단 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#E5E7EB] bg-white">
            <button
              onClick={() => setActiveTab("past")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === "past"
                  ? "text-[#FF9B82] border-b-2 border-[#FF9B82]"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              지나간 알림
              {unreadPastCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-[#EF4444] text-white text-xs font-bold rounded-full">
                  {unreadPastCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === "upcoming"
                  ? "text-[#FF9B82] border-b-2 border-[#FF9B82]"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              예정된 알림
              {unreadUpcomingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-[#10B981] text-white text-xs font-bold rounded-full">
                  {unreadUpcomingCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center mb-3">
                  <Clock size={32} className="text-[#D1D5DB]" />
                </div>
                <p className="text-[#9CA3AF] text-center text-sm">
                  {activeTab === "past" ? "지나간 알림이 없습니다." : "예정된 알림이 없습니다."}
                </p>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-2">
                {displayNotifications.map((todo) => {
                  const isUnread = !readTodos.has(todo.id);
                  const todoTime = todo.time || todo.startTime || "";

                  return (
                    <div
                      key={todo.id}
                      className={`flex gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        todo.completed
                          ? "bg-[#F9FAFB] border-[#E5E7EB]"
                          : isUnread && activeTab === "past"
                          ? "bg-[#FEF2F2] border-[#FECACA]"
                          : isUnread && activeTab === "upcoming"
                          ? "bg-[#F0FDF4] border-[#BBF7D0]"
                          : "bg-white border-[#E5E7EB]"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        // 알림 클릭 시 읽음 처리 (일정 상세보기 열기 전에)
                        handleMarkAsRead(todo.id);
                        if (onTodoClick) {
                          onTodoClick(todo.id);
                        }
                      }}
                    >
                      {/* Time Indicator */}
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            todo.completed
                              ? "bg-[#10B981] text-white"
                              : activeTab === "past"
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
                        {isUnread && (
                          <div
                            className={`w-2 h-2 rounded-full mt-1 ${
                              activeTab === "past" ? "bg-[#EF4444]" : "bg-[#10B981]"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className={`font-medium text-sm ${
                              todo.completed
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

                        <div className="flex items-center gap-2 text-xs mb-1">
                          {/* 알림 시간 표시 */}
                          {('notificationTime' in todo) && (
                            <span className="text-[#6B7280] font-medium">
                              {formatDate(todo.notificationTime.toISOString().split('T')[0])} {todo.notificationTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {!('notificationTime' in todo) && todo.date && (
                            <span className="text-[#6B7280]">{formatDate(todo.date)}</span>
                          )}
                          {todoTime && !('notificationTime' in todo) && (
                            <>
                              <span className="text-[#D1D5DB]">•</span>
                              <span
                                className={`font-medium ${
                                  todo.completed ? "text-[#9CA3AF]" : "text-[#6B7280]"
                                }`}
                              >
                                {todoTime}
                              </span>
                            </>
                          )}
                          {todo.duration > 0 && (
                            <>
                              <span className="text-[#D1D5DB]">•</span>
                              <span className="text-[#9CA3AF]">{formatDuration(todo.duration)}</span>
                            </>
                          )}
                        </div>

                        {(() => {
                          const reminders = todo.notificationReminders || todo.notification_reminders || [];
                          const reminder = reminders.length > 0 ? reminders[0] : null;
                          return reminder && (
                            <div className="text-xs text-[#9CA3AF] mt-1">
                              일정: {todo.date && formatDate(todo.date)} {todoTime && todoTime}
                              {' • '}
                              알림: {reminder.value}{reminder.unit === 'minutes' ? '분' : reminder.unit === 'hours' ? '시간' : reminder.unit === 'days' ? '일' : '주'} 전
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
