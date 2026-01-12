import { useState, useEffect } from "react";
import { Plus, X, Clock, FileText, Tag } from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/utils/formatDuration";

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
  addToCalendar?: boolean; // 캘린더에 일정으로 추가 여부
  endDate?: string; // 스케줄 종료 날짜 (선택사항)
  hasEndDate?: boolean; // 종료 날짜 사용 여부
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
  todos?: Array<{ id: string; title?: string; startTime?: string; date?: string }>; // 캘린더 일정 확인용
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
  const [hasEndDate, setHasEndDate] = useState(false);
  const [routineEndDate, setRoutineEndDate] = useState<string>("");
  const [selectedRoutineMemberIds, setSelectedRoutineMemberIds] = useState<string[]>([]);

  // Drag & Resize State
  const [draggedRoutine, setDraggedRoutine] = useState<{
    routineId: string;
    day: number;
    slotIndex: number;
    originalTime: string;
    originalDuration: number;
  } | null>(null);

  const [resizeMode, setResizeMode] = useState<'top' | 'bottom' | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [tempRoutineUpdate, setTempRoutineUpdate] = useState<{
    routineId: string;
    slotIndex: number;
    day: number;
    startTime: string;
    duration: number;
  } | null>(null);

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

  // 로컬 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getTimePosition = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  const getDurationHeight = (duration: number) => {
    return (duration / (24 * 60)) * 100;
  };

  // hex 색상을 rgba로 변환하는 헬퍼 함수
  const hexToRgba = (hex: string, alpha: number = 0.8): string => {
    if (!hex || !hex.trim()) {
      return `rgba(255, 155, 130, ${alpha})`; // 기본 색상
    }

    // # 제거
    const cleanHex = hex.replace('#', '').trim();

    // 3자리 hex 색상인 경우 6자리로 변환 (#RGB -> #RRGGBB)
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map(char => char + char).join('')
      : cleanHex;

    // RGB 값 추출
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    // 유효성 검사
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn(`Invalid hex color: ${hex}, using default`);
      return `rgba(255, 155, 130, ${alpha})`; // 기본 색상
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

    // 체크박스 상태 복원: routine.addToCalendar 필드를 우선 사용, 없으면 캘린더에 있는지 확인
    if (routine.addToCalendar !== undefined) {
      // 저장된 체크박스 상태 사용
      setAddToCalendar(routine.addToCalendar);
    } else {
      // 해당 시간표가 이미 캘린더에 추가되어 있는지 확인 (하위 호환성)
      const isInCalendar = todos.some(t =>
        t.title === routine.name &&
        t.startTime &&
        routine.timeSlots.some(slot => slot.startTime === t.startTime)
      );
      setAddToCalendar(isInCalendar);
    }

    // 종료 날짜 상태 복원
    setHasEndDate(routine.hasEndDate || false);
    if (routine.endDate) {
      setRoutineEndDate(routine.endDate);
    } else {
      // 기본값: 1년 후
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      setRoutineEndDate(formatLocalDate(oneYearLater));
    }

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

    // 새로 추가하는 경우에만 체크박스 초기화
    if (!editingRoutineId) {
      setAddToCalendar(false);
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
          }),
          addToCalendar: addToCalendar, // 체크박스 상태 전달
          hasEndDate: hasEndDate, // 종료 날짜 사용 여부
          endDate: hasEndDate ? routineEndDate : undefined, // 종료 날짜
        };
        onUpdateRoutine(updatedRoutine); // Use prop

        // 캘린더 추가/제거 처리
        if (onToggleRoutineInCalendar) {
          onToggleRoutineInCalendar(updatedRoutine, addToCalendar);
        }

        // 수정 모드에서는 체크박스 상태를 유지 (초기화하지 않음)
        setEditingRoutineId(null);
        toast.success("시간표 항목이 수정되었습니다.");
      }
    } else {
      // Create new - 선택된 가족 구성원마다 시간표 항목 생성
      // 팝업에서 선택된 구성원만 사용 (selectedRoutineMemberIds가 비어있으면 에러)
      if (selectedRoutineMemberIds.length === 0) {
        toast.error("최소 1명 이상의 구성원을 선택해주세요.");
        return;
      }

      const targetMemberIds = selectedRoutineMemberIds;

      let addedCount = 0;
      targetMemberIds.forEach((memberId, index) => {
        // memberId가 없거나 유효하지 않으면 건너뛰기
        if (!memberId || memberId.trim() === '') {
          console.warn(`유효하지 않은 memberId: ${memberId}, 건너뜀`);
          return;
        }

        const member = familyMembers.find(m => m.id === memberId);
        if (!member) {
          console.warn(`구성원을 찾을 수 없음: ${memberId}, 건너뜀`);
          return;
        }

        let routineColor: string;
        if (member?.color) {
          // hex 색상인 경우 rgba로 변환
          if (member.color.startsWith('#')) {
            routineColor = hexToRgba(member.color, 0.8);
          } else if (member.color.startsWith('rgba')) {
            routineColor = member.color;
          } else {
            routineColor = member.color.includes('rgba') ? member.color : `rgba(${member.color}, 0.8)`;
          }
        } else {
          routineColor = colors[(routines.length + index) % colors.length];
        }

        const newRoutine: RoutineItem = {
          id: `${Date.now()}-${index}`,
          memberId: memberId,
          name: newRoutineName,
          color: routineColor,
          category: "기타",
          timeSlots: newRoutineDays.map(day => {
            console.log(`시간표 저장: 요일 인덱스 ${day} = ${weekDays[day]}`);
            return { day, startTime: newRoutineStartTime, duration: duration };
          }),
          addToCalendar: addToCalendar, // 체크박스 상태 전달
          hasEndDate: hasEndDate, // 종료 날짜 사용 여부
          endDate: hasEndDate ? routineEndDate : undefined, // 종료 날짜
        };
        onAddRoutine(newRoutine); // Use prop

        // 캘린더 추가/제거 처리 (체크박스가 체크되어 있을 때만)
        if (addToCalendar && onToggleRoutineInCalendar) {
          onToggleRoutineInCalendar(newRoutine, addToCalendar);
        }

        addedCount++;
      });

      if (addedCount === 0) {
        toast.error("유효한 구성원이 선택되지 않았습니다.");
        return;
      }

      toast.success(`${newRoutineName} 항목이 ${addedCount}개 추가되었습니다.`);
    }

    setNewRoutineName("");
    setNewRoutineStartTime("09:00");
    setNewRoutineEndTime("10:00");
    setNewRoutineDays([]);
    setHasEndDate(false);
    setSelectedRoutineMemberIds([]); // 가족 구성원 선택 초기화
    // 기본값: 1년 후
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setRoutineEndDate(formatLocalDate(oneYearLater));
    // 체크박스 상태는 초기화하지 않음 (다음에 수정할 때 유지되도록)
    // setAddToCalendar(false); // 주석 처리
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
    setHasMoved(false);
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
    e.stopPropagation();

    const deltaY = e.clientY - dragStartY;

    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
      // Sensitivity logic - 컨테이너 높이 기준으로 계산
      const container = e.currentTarget as HTMLElement;
      const containerHeight = container.clientHeight || 480; // 기본값 480px (24시간 * 20px)
      // 각 시간 슬롯이 20px 높이이므로, 20px = 60분
      const minutesPerPixel = (24 * 60) / containerHeight;
      const minutesDelta = Math.round(deltaY * minutesPerPixel);

      console.log("드래그 중:", { deltaY, containerHeight, minutesDelta });

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

      // 드래그 중에는 임시 상태만 저장 (API 호출은 handleMouseUp에서)
      setTempRoutineUpdate({
        routineId: draggedRoutine.routineId,
        slotIndex: draggedRoutine.slotIndex,
        day: draggedRoutine.day,
        startTime: newTime,
        duration: newDuration
      });
    }
  };

  const handleMouseUp = () => {
    console.log("handleMouseUp 호출:", { draggedRoutine, hasMoved, tempRoutineUpdate });

    // 드래그가 아닌 클릭인 경우 수정 모드로 진입
    if (draggedRoutine && !hasMoved) {
      console.log("클릭 감지 - 수정 모드 진입");
      const routine = routines.find(r => r.id === draggedRoutine.routineId);
      if (routine) {
        handleEditClick(routine);
      }
    } else if (draggedRoutine && hasMoved && tempRoutineUpdate) {
      console.log("드래그 완료 - API 호출", tempRoutineUpdate);
      // 드래그가 끝났을 때만 API 호출
      const routineToUpdate = routines.find(r => r.id === tempRoutineUpdate.routineId);
      if (routineToUpdate) {
        const updatedRoutine = {
          ...routineToUpdate,
          timeSlots: routineToUpdate.timeSlots.map((slot, index) =>
            index === tempRoutineUpdate.slotIndex && slot.day === tempRoutineUpdate.day
              ? { ...slot, startTime: tempRoutineUpdate.startTime, duration: tempRoutineUpdate.duration }
              : slot
          )
        };
        console.log("업데이트할 시간표:", updatedRoutine);
        onUpdateRoutine(updatedRoutine);
      }
    }
    setDraggedRoutine(null);
    setResizeMode(null);
    setHasMoved(false);
    setTempRoutineUpdate(null);
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
        <div className="flex gap-2 items-center">
          {/* 추가 버튼을 제일 앞에 고정 (스크롤되지 않음) */}
          <button
            onClick={() => {
              setEditingRoutineId(null);
              setNewRoutineName("");
              setNewRoutineStartTime("09:00");
              setNewRoutineEndTime("10:00");
              setNewRoutineDays([]);
              setAddToCalendar(false);
              setSelectedRoutineMemberIds([]); // 빈 배열로 초기화 (사용자가 팝업에서 직접 선택하도록)
              setShowAddRoutine(true);
            }}
            className="px-3 py-2 h-[32px] rounded-full text-sm font-medium bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition-colors flex items-center justify-center gap-1 flex-shrink-0"
          >
            <Plus size={16} />
            추가
          </button>
          {/* 생성된 항목들 (스크롤 가능, 드래그 가능) */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#FF9B82] scrollbar-track-[#F3F4F6] flex-1 items-center pt-0.5">
            {routines
              .filter(r => selectedMemberIds.includes(r.memberId))
              .map((routine) => (
                <button
                  key={routine.id}
                  onClick={() => handleEditClick(routine)}
                  className="px-3 py-2 h-[32px] rounded-full text-sm font-medium text-white shadow-sm flex items-center justify-center gap-1 hover:opacity-90 transition-opacity flex-shrink-0"
                  style={{
                    backgroundColor: (() => {
                      const member = familyMembers.find(m => m.id === routine.memberId);
                      if (member?.color && member.color.trim()) {
                        if (member.color.startsWith('#')) {
                          return hexToRgba(member.color, 1.0);
                        } else if (member.color.startsWith('rgba')) {
                          return member.color.replace(/,\s*[\d.]+\)$/, ', 1.0)');
                        } else {
                          return hexToRgba('#FF9B82', 1.0);
                        }
                      }
                      return routine.color ? routine.color.replace("0.6", "1").replace("CC", "FF") : hexToRgba('#FF9B82', 1.0);
                    })()
                  }}
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
          </div>
        </div>
      </div>

      {/* Add Routine Modal */}
      {showAddRoutine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 space-y-4 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {editingRoutineId ? "항목 수정" : "새 항목 추가"}
              </h3>
              <button
                onClick={() => {
                  setShowAddRoutine(false);
                  setEditingRoutineId(null);
                }}
                className="text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                <X size={20} />
              </button>
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

            {/* 가족 구성원 선택 */}
            {familyMembers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-2">선택</label>
                <div className="flex flex-wrap gap-2">
                  {familyMembers.map((member) => {
                    // 시간표 보기에서 선택된 구성원인지 확인
                    const isSelectedInView = selectedMemberIds.includes(member.id);
                    // 팝업에서 선택된 구성원인지 확인
                    const isSelectedInPopup = selectedRoutineMemberIds.includes(member.id);
                    // 둘 중 하나라도 선택되어 있으면 선택된 것으로 표시
                    const isSelected = isSelectedInPopup || (selectedRoutineMemberIds.length === 0 && isSelectedInView);

                    return (
                      <button
                        key={member.id}
                        onClick={() => {
                          const newSelection = isSelectedInPopup
                            ? selectedRoutineMemberIds.filter(id => id !== member.id)
                            : [...selectedRoutineMemberIds, member.id];

                          setSelectedRoutineMemberIds(newSelection);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isSelected
                          ? "text-white shadow-sm"
                          : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                          }`}
                        style={
                          isSelected
                            ? (() => {
                              if (member.color && member.color.trim()) {
                                if (member.color.startsWith('#')) {
                                  return { backgroundColor: hexToRgba(member.color, 1.0), color: "white" };
                                } else if (member.color.startsWith('rgba')) {
                                  return { backgroundColor: member.color.replace(/,\s*[\d.]+\)$/, ', 1.0)'), color: "white" };
                                } else {
                                  return { backgroundColor: hexToRgba('#FF9B82', 1.0), color: "white" };
                                }
                              }
                              return { backgroundColor: hexToRgba('#FF9B82', 1.0), color: "white" };
                            })()
                            : undefined
                        }
                      >
                        <span className="text-base">{member.emoji}</span>
                        <span>{member.name}</span>
                      </button>
                    );
                  })}
                </div>
                {(selectedRoutineMemberIds.length > 0 || selectedMemberIds.length > 0) && (
                  <div className="mt-2 text-xs text-[#9CA3AF] flex items-center gap-1">
                    <span>선택됨:</span>
                    <span className="font-medium text-[#6B7280]">
                      {(selectedRoutineMemberIds.length > 0 ? selectedRoutineMemberIds : selectedMemberIds).map(id => {
                        const member = familyMembers.find(m => m.id === id);
                        return member ? `${member.emoji} ${member.name}` : null;
                      }).filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

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
            <div className="space-y-3">
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

              {/* 스케줄 종료날짜 체크박스 (캘린더 추가가 체크되어 있을 때만 표시) */}
              {addToCalendar && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasEndDate"
                      checked={hasEndDate}
                      onChange={(e) => {
                        setHasEndDate(e.target.checked);
                        if (!e.target.checked) {
                          // 기본값: 1년 후
                          const oneYearLater = new Date();
                          oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                          setRoutineEndDate(formatLocalDate(oneYearLater));
                        }
                      }}
                      className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-[#FF9B82] focus:ring-2"
                    />
                    <label htmlFor="hasEndDate" className="text-sm text-[#6B7280] cursor-pointer">
                      일정 종료날짜 지정
                    </label>
                  </div>

                  {hasEndDate && (
                    <div className="pl-6">
                      <label className="block text-xs text-[#6B7280] mb-1">종료 날짜</label>
                      <input
                        type="date"
                        value={routineEndDate}
                        onChange={(e) => setRoutineEndDate(e.target.value)}
                        min={formatLocalDate(new Date())}
                        className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {editingRoutineId && (
                <button
                  onClick={handleDeleteRoutine}
                  className="px-4 py-2 bg-[#FECACA] text-[#EF4444] rounded-lg text-sm font-medium hover:bg-[#FCA5A5] transition-colors"
                >
                  삭제
                </button>
              )}
              <div className="flex-1 flex gap-2 justify-end">
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

                      // 드래그 중인 경우 임시 업데이트 값 사용
                      const isDragging = draggedRoutine?.routineId === routine.id &&
                        draggedRoutine?.day === dayIndex &&
                        draggedRoutine?.slotIndex === slotIndex;

                      const displayStartTime = isDragging && tempRoutineUpdate
                        ? tempRoutineUpdate.startTime
                        : slot.startTime;
                      const displayDuration = isDragging && tempRoutineUpdate
                        ? tempRoutineUpdate.duration
                        : slot.duration;

                      const top = getTimePosition(displayStartTime);
                      const height = getDurationHeight(displayDuration);

                      // 각 구성원별로 다른 색상 적용 - routine.memberId로 직접 구성원 찾기
                      let memberColor: string;

                      // routine.memberId로 구성원을 직접 찾아서 색상 적용
                      const routineMember = familyMembers.find((m) => m.id === routine.memberId);

                      if (routineMember && routineMember.color && routineMember.color.trim()) {
                        // hex 색상인 경우 rgba로 변환
                        if (routineMember.color.startsWith('#')) {
                          memberColor = hexToRgba(routineMember.color, 0.8);
                        } else if (routineMember.color.startsWith('rgba')) {
                          memberColor = routineMember.color;
                        } else if (routineMember.color.startsWith('rgb')) {
                          // rgb를 rgba로 변환
                          memberColor = routineMember.color.replace('rgb', 'rgba').replace(')', ', 0.8)');
                        } else {
                          // 그 외의 경우 기본 색상 사용
                          console.warn(`Unknown color format: ${routineMember.color}, using default`);
                          memberColor = hexToRgba('#FF9B82', 0.8);
                        }
                      } else {
                        // 구성원 색상이 없거나 member를 찾지 못한 경우 기본 색상 사용 (routine.color 무시)
                        if (!routineMember) {
                          console.warn(`Member not found for routine.memberId: ${routine.memberId}`);
                        } else {
                          console.warn(`Member ${routineMember.name} has no color, using default`);
                        }
                        memberColor = hexToRgba('#FF9B82', 0.8);
                      }

                      // 최종 색상이 비어있거나 유효하지 않으면 기본 색상 사용
                      if (!memberColor || memberColor.trim() === '' || memberColor === 'rgba(NaN, NaN, NaN, 0.8)') {
                        console.warn(`Invalid color for member ${routineMember?.name}, using default`);
                        memberColor = hexToRgba('#FF9B82', 0.8);
                      }

                      return (
                        <div
                          key={`${routine.id}-${slotIndex}-${memberId}`}
                          className={`absolute left-0.5 right-0.5 rounded px-1 py-1 cursor-move text-white shadow-sm hover:shadow-md transition-shadow group ${isDragging
                            ? "ring-2 ring-white scale-105 z-20"
                            : "z-10"
                            }`}
                          style={{
                            backgroundColor: memberColor, // 가족 구성원 색상 우선 적용
                            top: `${top}%`,
                            height: `${Math.max(height, 3)}%`,
                            // Overlap adjustment? 
                            // Opacity to see overlaps?
                            opacity: selectedMemberIds.length > 1 ? 0.85 : 1,
                          }}
                          onMouseDown={(e) =>
                            handleMouseDown(e, routine.id, dayIndex, slotIndex, slot.startTime, slot.duration)
                          }
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
                <span>{hoveredRoutine.slot.startTime} ({formatDuration(hoveredRoutine.slot.duration)})</span>
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