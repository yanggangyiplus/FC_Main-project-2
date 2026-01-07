import { useState, useEffect } from "react";
import { Plus, X, Clock, FileText, Tag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

// 시간표 관리 컴포넌트
export interface RoutineItem {
  id: string;
  memberId: string; // Owner of the routine
  name: string;
  color: string;
  memo?: string; // Added memo
  category?: string; // Added category for consistence
  timeSlots: {
    day: number; // 0-6 (일-토)
    startTime: string;
    duration: number;
  }[];
}

interface FamilyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface RoutineViewProps {
  currentUserEmoji: string;
  currentUserName?: string;
  selectedMemberIds?: string[];
  familyMembers?: FamilyMember[];
  routines: RoutineItem[];
  onAddRoutine: (routine: RoutineItem) => void;
  onUpdateRoutine: (routine: RoutineItem) => void;
  onDeleteRoutine: (id: string) => void;
  onToggleRoutineInCalendar?: (routine: RoutineItem, addToCalendar: boolean) => void;
  todos?: Array<{ id: string }>; // 캘린더 일정 확인용
}

export function RoutineView({
  currentUserEmoji,
  currentUserName = "나",
  selectedMemberIds = ["1"],
  familyMembers = [],
  routines,
  onAddRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onToggleRoutineInCalendar,
  todos = [],
}: RoutineViewProps) {

  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineStartTime, setNewRoutineStartTime] = useState("09:00");
  const [newRoutineEndTime, setNewRoutineEndTime] = useState("10:00");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([]);
  const [addToCalendar, setAddToCalendar] = useState(false);

  // Drag & Resize State
  const [draggedRoutine, setDraggedRoutine] = useState<{
    routineId: string;
    day: number;
    slotIndex: number;
    originalTime: string;
    originalDuration: number;
  } | null>(null);

  const [resizeMode, setResizeMode] = useState<'top' | 'bottom' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);

  // Popup State
  const [hoveredRoutine, setHoveredRoutine] = useState<{
    routine: RoutineItem;
    slot: { startTime: string; duration: number };
    position: { x: number; y: number }
  } | null>(null);

  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    routineId: string;
    slotIndex: number;
    startTime: string;
    duration: number;
  } | null>(null);

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const timeSlots = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];

  const getTimePosition = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  const getDurationHeight = (duration: number) => {
    return (duration / (24 * 60)) * 100;
  };

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  // 시작 시간과 종료 시간으로부터 duration 계산
  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const duration = endTotalMinutes - startTotalMinutes;
    return duration > 0 ? duration : 60; // 최소 60분
  };

  const handleEditClick = (routine: RoutineItem) => {
    setEditingRoutineId(routine.id);
    setNewRoutineName(routine.name);
    // Assuming uniform time for simple editing, else pick first slot
    const firstSlot = routine.timeSlots[0];
    if (firstSlot) {
      setNewRoutineStartTime(firstSlot.startTime);
      // duration을 종료 시간으로 변환
      const [startHours, startMinutes] = firstSlot.startTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = startTotalMinutes + firstSlot.duration;
      const endHours = Math.floor(endTotalMinutes / 60) % 24;
      const endMins = endTotalMinutes % 60;
      setNewRoutineEndTime(`${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`);
    } else {
      setNewRoutineStartTime("09:00");
      setNewRoutineEndTime("10:00");
    }
    setNewRoutineDays(routine.timeSlots.map(s => s.day));

    // 해당 시간표가 이미 캘린더에 추가되어 있는지 확인
    const isInCalendar = todos.some(t => t.id.startsWith(`routine-calendar-${routine.id}-`));
    setAddToCalendar(isInCalendar);

    setShowAddRoutine(true);
  };

  const handleDeleteRoutine = () => {
    if (!editingRoutineId) return;
    onDeleteRoutine(editingRoutineId); // Use prop
    setEditingRoutineId(null);
    setShowAddRoutine(false);
    toast.success("시간표 항목이 삭제되었습니다.");
  };

  const handleAddRoutine = () => {
    if (!newRoutineName.trim()) {
      toast.error("시간표 항목 이름을 입력해주세요.");
      return;
    }

    if (newRoutineDays.length === 0) {
      toast.error("최소 1개 이상의 요일을 선택해주세요.");
      return;
    }

    const colors = [
      "rgba(239, 68, 68, 0.6)",
      "rgba(34, 197, 94, 0.6)",
      "rgba(59, 130, 246, 0.6)",
      "rgba(251, 146, 60, 0.6)",
    ];

    // 종료 시간으로부터 duration 계산
    const duration = calculateDuration(newRoutineStartTime, newRoutineEndTime);

    if (editingRoutineId) {
      // Update existing
      const existingRoutine = routines.find(r => r.id === editingRoutineId);
      if (existingRoutine) {
        const updatedRoutine = {
          ...existingRoutine,
          name: newRoutineName,
          timeSlots: newRoutineDays.map(day => {
            console.log(`시간표 수정: 요일 인덱스 ${day} = ${weekDays[day]}`);
            return {
              day,
              startTime: newRoutineStartTime,
              duration: duration
            };
          })
        };
        onUpdateRoutine(updatedRoutine); // Use prop

        // 캘린더 추가/제거 처리
        if (onToggleRoutineInCalendar) {
          onToggleRoutineInCalendar(updatedRoutine, addToCalendar);
        }

        setEditingRoutineId(null);
        toast.success("시간표 항목이 수정되었습니다.");
      }
    } else {
      // Create new
      const newRoutine: RoutineItem = {
        id: Date.now().toString(),
        memberId: selectedMemberIds[0] || "1",
        name: newRoutineName,
        color: colors[routines.length % colors.length],
        category: "기타",
        timeSlots: newRoutineDays.map(day => {
          console.log(`시간표 저장: 요일 인덱스 ${day} = ${weekDays[day]}`);
          return { day, startTime: newRoutineStartTime, duration: duration };
        }),
      };
      onAddRoutine(newRoutine); // Use prop

      // 캘린더 추가/제거 처리
      if (onToggleRoutineInCalendar) {
        onToggleRoutineInCalendar(newRoutine, addToCalendar);
      }

      toast.success(`${newRoutineName} 항목이 추가되었습니다.`);
    }

    setNewRoutineName("");
    setNewRoutineStartTime("09:00");
    setNewRoutineEndTime("10:00");
    setNewRoutineDays([]);
    setAddToCalendar(false);
    setShowAddRoutine(false);
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    routineId: string,
    day: number,
    slotIndex: number,
    time: string,
    duration: number
  ) => {
    e.stopPropagation();
    setDraggedRoutine({ routineId, day, slotIndex, originalTime: time, originalDuration: duration });
    setDragStartY(e.clientY);
    setResizeMode(null); // Move
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    routineId: string,
    day: number,
    slotIndex: number,
    time: string,
    duration: number,
    mode: 'top' | 'bottom'
  ) => {
    e.stopPropagation();
    setDraggedRoutine({ routineId, day, slotIndex, originalTime: time, originalDuration: duration });
    setDragStartY(e.clientY);
    setResizeMode(mode);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedRoutine) return;

    // Prevent default selection
    e.preventDefault();

    const deltaY = e.clientY - dragStartY;

    if (Math.abs(deltaY) > 5) {
      // Sensitivity logic
      const minutesDelta = Math.round((deltaY / window.innerHeight) * (24 * 60));

      const [hours, minutes] = draggedRoutine.originalTime.split(":").map(Number);
      const startTotalMinutes = hours * 60 + minutes;

      let newStartTotalMinutes = startTotalMinutes;
      let newDuration = draggedRoutine.originalDuration;

      if (resizeMode === 'bottom') {
        newDuration = Math.max(15, draggedRoutine.originalDuration + minutesDelta);
        // Snap to 15
        newDuration = Math.round(newDuration / 15) * 15;
      } else if (resizeMode === 'top') {
        // newStart = oldStart + delta
        newStartTotalMinutes = Math.max(0, startTotalMinutes + minutesDelta);
        // Snap
        newStartTotalMinutes = Math.round(newStartTotalMinutes / 15) * 15;

        const endTime = startTotalMinutes + draggedRoutine.originalDuration;
        newDuration = endTime - newStartTotalMinutes;

        if (newDuration < 15) {
          newDuration = 15;
          newStartTotalMinutes = endTime - 15;
        }
      } else {
        // Moving
        newStartTotalMinutes = Math.max(0, Math.min(24 * 60 - draggedRoutine.originalDuration, startTotalMinutes + minutesDelta));
        newStartTotalMinutes = Math.round(newStartTotalMinutes / 15) * 15;
      }

      const newHours = Math.floor(newStartTotalMinutes / 60);
      const newMins = newStartTotalMinutes % 60;
      // Wrap hours 0-23
      const validHours = Math.max(0, Math.min(23, newHours));
      const newTime = `${String(validHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

      // Find routine and update it via prop
      const routineToUpdate = routines.find(r => r.id === draggedRoutine.routineId);
      if (routineToUpdate) {
        const updatedRoutine = {
          ...routineToUpdate,
          timeSlots: routineToUpdate.timeSlots.map((slot, index) =>
            index === draggedRoutine.slotIndex && slot.day === draggedRoutine.day
              ? { ...slot, startTime: newTime, duration: newDuration }
              : slot
          )
        };
        onUpdateRoutine(updatedRoutine);
      }
    }
  };

  const handleMouseUp = () => {
    setDraggedRoutine(null);
    setResizeMode(null);
  };

  const handleMouseEnter = (e: React.MouseEvent, routine: RoutineItem, slot: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredRoutine({
      routine,
      slot,
      position: { x: rect.left + rect.width / 2, y: rect.top }
    });
  };

  const handleMouseLeave = () => {
    setHoveredRoutine(null);
  };

  // Helper to check if a member has any routine on a specific day
  const hasRoutineOnDay = (memberId: string, dayIndex: number) => {
    return routines.some(r => r.memberId === memberId && r.timeSlots.some(s => s.day === dayIndex));
  };

  return (
    <div className="space-y-4 select-none">
      {/* Routine Items (Titles) - Filtered by selected members? Use case implies showing all available categories or active ones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-[#1F2937] px-1">시간표 항목</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {routines
            .filter(r => selectedMemberIds.includes(r.memberId))
            .map((routine) => (
              <button
                key={routine.id}
                onClick={() => handleEditClick(routine)}
                className="px-3 py-2 rounded-full text-sm font-medium text-white shadow-sm flex items-center gap-1 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: routine.color.replace("0.6", "1") }}
              >
                {/* Show member emoji if multiple selected? */}
                {selectedMemberIds.length > 1 && (
                  <span className="text-xs bg-white/20 px-1 rounded">
                    {familyMembers.find(m => m.id === routine.memberId)?.emoji}
                  </span>
                )}
                {routine.name}
              </button>
            ))}
          <button
            onClick={() => {
              setEditingRoutineId(null);
              setNewRoutineName("");
              setNewRoutineStartTime("09:00");
              setNewRoutineEndTime("10:00");
              setNewRoutineDays([]);
              setAddToCalendar(false);
              setShowAddRoutine(true);
            }}
            className="px-3 py-2 rounded-full text-sm font-medium bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition-colors flex items-center gap-1"
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      {/* Add Routine Input */}
      {showAddRoutine && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-[#6B7280]">
            {editingRoutineId ? "항목 수정" : "새 항목 추가"}
          </div>
          {/* Simplified for brevity - Assume same logic as before but uses newRoutineName etc */}
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-2">항목 이름</label>
            <input
              type="text"
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              placeholder="예: 태권도, 약복용"
              className="w-full px-3 py-2 bg-[#F9FAFB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9B82] border border-[#E5E7EB]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#6B7280] mb-2">시작 시간</label>
              <input
                type="time"
                value={newRoutineStartTime}
                onChange={(e) => setNewRoutineStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#F9FAFB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9B82] border border-[#E5E7EB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6B7280] mb-2">종료 시간</label>
              <input
                type="time"
                value={newRoutineEndTime}
                onChange={(e) => setNewRoutineEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#F9FAFB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9B82] border border-[#E5E7EB]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-2">요일 선택</label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day, index) => (
                <button
                  key={index}
                  onClick={() =>
                    setNewRoutineDays(prev =>
                      prev.includes(index)
                        ? prev.filter(id => id !== index)
                        : [...prev, index]
                    )
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${newRoutineDays.includes(index)
                    ? "bg-[#FF9B82] text-white shadow-sm"
                    : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* 캘린더 추가 체크박스 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addToCalendar"
              checked={addToCalendar}
              onChange={(e) => setAddToCalendar(e.target.checked)}
              className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-[#FF9B82] focus:ring-2"
            />
            <label htmlFor="addToCalendar" className="text-sm text-[#6B7280] cursor-pointer">
              캘린더에 일정으로 추가
            </label>
          </div>

          {/* 버튼 영역: 위에 삭제, 아래에 취소/수정 */}
          <div className="pt-2 flex flex-col gap-2">
            {/* 삭제 버튼 - 맨 위에 배치 (첫 번째) */}
            {editingRoutineId && (
              <button
                onClick={handleDeleteRoutine}
                className="w-full px-4 py-2 bg-[#FECACA] text-[#EF4444] rounded-lg text-sm font-medium hover:bg-[#FCA5A5] transition-colors"
                style={{ order: 1 }}
              >
                삭제
              </button>
            )}
            {/* 취소/수정 버튼 - 아래에 배치 (두 번째) */}
            <div className="flex gap-2" style={{ order: 2 }}>
              <button
                onClick={() => {
                  setShowAddRoutine(false);
                  setEditingRoutineId(null);
                }}
                className="px-4 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg text-sm font-medium hover:bg-[#E5E7EB] transition-colors"
                style={{ flex: editingRoutineId ? 0.5 : 0.3 }}
              >
                취소
              </button>
              <button
                onClick={handleAddRoutine}
                className="px-4 py-2 bg-[#FF9B82] text-white rounded-lg text-sm font-medium hover:bg-[#FF8A6D] transition-colors"
                style={{ flex: editingRoutineId ? 0.5 : 0.7 }}
              >
                {editingRoutineId ? "수정" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Calendar */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden relative">
        {/* Week Days Header */}
        <div className="grid grid-cols-8 border-b border-[#F3F4F6] bg-[#FAFAFA]">
          <div className="px-2 py-2 text-xs text-[#9CA3AF]"></div>
          {weekDays.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={`text-center py-2 relative ${dayIndex === 0 ? "text-[#EF4444]" : dayIndex === 6 ? "text-[#3B82F6]" : "text-[#1F2937]"
                }`}
            >
              {/* Day Name */}
              <div className="text-sm font-medium">{day}</div>

              {/* DOT INDICATORS */}
              <div className="flex justify-center gap-0.5 mt-1 h-2">
                {selectedMemberIds.map(memId => {
                  const member = familyMembers.find(m => m.id === memId);
                  if (!member || !hasRoutineOnDay(memId, dayIndex)) return null;
                  return (
                    <div
                      key={memId}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: member.color.replace('0.6', '1') }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div
          className="overflow-auto max-h-[400px]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); handleMouseLeave(); }}
        >
          <div className="grid grid-cols-8">
            {/* Time Labels */}
            <div className="border-r border-[#F3F4F6]">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="h-20 border-b border-[#F3F4F6] px-1 py-1 text-xs text-[#6B7280]"
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {weekDays.map((_, dayIndex) => (
              <div key={dayIndex} className="relative border-r border-[#F3F4F6] last:border-r-0">
                {/* Time Slots Background */}
                {timeSlots.map((time) => (
                  <div key={time} className="h-20 border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors" />
                ))}

                {/* Routine Items for selected members */}
                {selectedMemberIds.map((memberId) => {
                  const member = familyMembers.find((m) => m.id === memberId);

                  // Filter routines for this member
                  const memberRoutines = routines.filter(r => r.memberId === memberId);

                  return memberRoutines.map((routine) => {
                    return routine.timeSlots.map((slot, slotIndex) => {
                      if (slot.day !== dayIndex) return null;

                      const top = getTimePosition(slot.startTime);
                      const height = getDurationHeight(slot.duration);

                      return (
                        <div
                          key={`${routine.id}-${slotIndex}-${memberId}`}
                          className={`absolute left-0.5 right-0.5 rounded px-1 py-1 cursor-move text-white shadow-sm hover:shadow-md transition-shadow group ${draggedRoutine?.routineId === routine.id &&
                            draggedRoutine?.day === dayIndex &&
                            draggedRoutine?.slotIndex === slotIndex
                            ? "ring-2 ring-white scale-105 z-20"
                            : "z-10"
                            }`}
                          style={{
                            backgroundColor: routine.color, // Use routine color
                            top: `${top}%`,
                            height: `${Math.max(height, 3)}%`,
                            // Overlap adjustment? 
                            // Opacity to see overlaps?
                            opacity: selectedMemberIds.length > 1 ? 0.85 : 1,
                          }}
                          onMouseDown={(e) =>
                            handleMouseDown(e, routine.id, dayIndex, slotIndex, slot.startTime, slot.duration)
                          }
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(routine);
                          }}
                          onMouseEnter={(e) => handleMouseEnter(e, routine, slot)}
                          onMouseLeave={handleMouseLeave}
                        >
                          {/* Top Resize Handle */}
                          <div
                            className="absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:bg-black/10 z-30"
                            onMouseDown={(e) => handleResizeStart(e, routine.id, dayIndex, slotIndex, slot.startTime, slot.duration, 'top')}
                          />

                          <div className="text-[10px] font-medium truncate pointer-events-none flex items-center gap-1">
                            {/* Emoji if multiple */}
                            {selectedMemberIds.length > 1 && member && (
                              <span className="opacity-80 text-[8px]">{member.emoji}</span>
                            )}
                            {routine.name}
                          </div>

                          {/* 삭제 버튼 - 위에 배치 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRoutine(routine.id);
                            }}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-[#EF4444] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#DC2626] z-10"
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>

                          {/* 수정 버튼 - 아래에 배치 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(routine);
                            }}
                            className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#6366F1] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#5558E3] z-10"
                            title="수정"
                          >
                            <Pencil size={12} />
                          </button>

                          {/* Bottom Resize Handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10 z-30"
                            onMouseDown={(e) => handleResizeStart(e, routine.id, dayIndex, slotIndex, slot.startTime, slot.duration, 'bottom')}
                          />
                        </div>
                      );
                    });
                  });
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Popover */}
      {hoveredRoutine && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-48 pointer-events-none"
          style={{
            top: `${hoveredRoutine.position.y - 10}px`,
            left: `${hoveredRoutine.position.x}px`,
            transform: "translate(-50%, -100%)"
          }}
        >
          <div className="p-3">
            <h3 className="font-semibold text-[#1F2937] text-sm mb-2">{hoveredRoutine.routine.name}</h3>
            <div className="bg-[#FAFAFA] rounded p-2 text-xs text-[#6B7280] space-y-1">
              <div className="flex items-center gap-2">
                <Clock size={12} />
                <span>{hoveredRoutine.slot.startTime} ({hoveredRoutine.slot.duration}분)</span>
              </div>
              {hoveredRoutine.routine.category && (
                <div className="flex items-center gap-2">
                  <Tag size={12} />
                  <span>{hoveredRoutine.routine.category}</span>
                </div>
              )}
              {hoveredRoutine.routine.memo && (
                <div className="pt-2 mt-2 border-t border-[#E5E7EB] flex items-start gap-1">
                  <FileText size={12} className="mt-0.5" />
                  <div className="flex-1">
                    <span className="block mb-0.5">메모:</span>
                    <p className="whitespace-pre-wrap bg-white p-1 rounded border border-[#E5E7EB] line-clamp-3 text-[#1F2937]">
                      {hoveredRoutine.routine.memo}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}