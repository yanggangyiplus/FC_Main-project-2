import { useState, useEffect } from "react";
import { X, Clock, FileText, Tag } from "lucide-react";
import { toast } from "sonner";
import { RoutineItem } from "./RoutineView";

interface FamilyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface RoutineAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyMembers: FamilyMember[];
  selectedMemberIds: string[];
  onAddRoutine: (routine: RoutineItem) => void;
  onUpdateRoutine: (routine: RoutineItem) => void;
  onDeleteRoutine: (id: string) => void;
  onToggleRoutineInCalendar?: (routine: RoutineItem, addToCalendar: boolean) => void;
  routines: RoutineItem[];
  todos?: Array<{ id: string; title?: string; startTime?: string; date?: string }>;
  initialRoutineId?: string | null;
}

export function RoutineAddModal({
  isOpen,
  onClose,
  familyMembers,
  selectedMemberIds,
  onAddRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onToggleRoutineInCalendar,
  routines,
  todos = [],
  initialRoutineId = null,
}: RoutineAddModalProps) {
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineStartTime, setNewRoutineStartTime] = useState("09:00");
  const [newRoutineEndTime, setNewRoutineEndTime] = useState("10:00");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([]);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [routineEndDate, setRoutineEndDate] = useState<string>("");
  const [selectedRoutineMemberIds, setSelectedRoutineMemberIds] = useState<string[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(initialRoutineId || null);

  // initialRoutineId가 변경되면 editingRoutineId 업데이트
  useEffect(() => {
    setEditingRoutineId(initialRoutineId || null);
  }, [initialRoutineId]);

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  // 로컬 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // hex 색상을 rgba로 변환하는 헬퍼 함수
  const hexToRgba = (hex: string, alpha: number = 0.8): string => {
    if (!hex || !hex.trim()) {
      return `rgba(255, 155, 130, ${alpha})`;
    }

    const cleanHex = hex.replace('#', '').trim();
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map(char => char + char).join('')
      : cleanHex;

    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return `rgba(255, 155, 130, ${alpha})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // 시작 시간과 종료 시간으로부터 duration 계산
  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const duration = endTotalMinutes - startTotalMinutes;
    return duration > 0 ? duration : 60;
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

    if (!editingRoutineId) {
      setAddToCalendar(false);
    }

    const colors = [
      "rgba(239, 68, 68, 0.6)",
      "rgba(34, 197, 94, 0.6)",
      "rgba(59, 130, 246, 0.6)",
      "rgba(251, 146, 60, 0.6)",
    ];

    const duration = calculateDuration(newRoutineStartTime, newRoutineEndTime);

    if (editingRoutineId) {
      const existingRoutine = routines.find(r => r.id === editingRoutineId);
      if (existingRoutine) {
        const updatedRoutine = {
          ...existingRoutine,
          name: newRoutineName,
          timeSlots: newRoutineDays.map(day => ({
            day,
            startTime: newRoutineStartTime,
            duration: duration
          })),
          addToCalendar: addToCalendar,
          hasEndDate: hasEndDate,
          endDate: hasEndDate ? routineEndDate : undefined,
        };
        onUpdateRoutine(updatedRoutine);

        if (onToggleRoutineInCalendar) {
          onToggleRoutineInCalendar(updatedRoutine, addToCalendar);
        }

        setEditingRoutineId(null);
        toast.success("시간표 항목이 수정되었습니다.");
      }
    } else {
      if (selectedRoutineMemberIds.length === 0) {
        toast.error("최소 1명 이상의 구성원을 선택해주세요.");
        return;
      }

      const targetMemberIds = selectedRoutineMemberIds;
      let addedCount = 0;

      targetMemberIds.forEach((memberId, index) => {
        if (!memberId || memberId.trim() === '') {
          return;
        }

        const member = familyMembers.find(m => m.id === memberId);
        if (!member) {
          return;
        }

        let routineColor: string;
        if (member?.color) {
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
          timeSlots: newRoutineDays.map(day => ({
            day,
            startTime: newRoutineStartTime,
            duration: duration
          })),
          addToCalendar: addToCalendar,
          hasEndDate: hasEndDate,
          endDate: hasEndDate ? routineEndDate : undefined,
        };
        onAddRoutine(newRoutine);

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

    // 초기화
    setNewRoutineName("");
    setNewRoutineStartTime("09:00");
    setNewRoutineEndTime("10:00");
    setNewRoutineDays([]);
    setHasEndDate(false);
    setSelectedRoutineMemberIds([]);
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setRoutineEndDate(formatLocalDate(oneYearLater));
    onClose();
  };

  const handleDeleteRoutine = () => {
    if (!editingRoutineId) return;
    onDeleteRoutine(editingRoutineId);
    setEditingRoutineId(null);
    onClose();
    toast.success("시간표 항목이 삭제되었습니다.");
  };

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setNewRoutineName("");
      setNewRoutineStartTime("09:00");
      setNewRoutineEndTime("10:00");
      setNewRoutineDays([]);
      setAddToCalendar(false);
      setHasEndDate(false);
      setSelectedRoutineMemberIds(selectedMemberIds.length > 0 ? selectedMemberIds : []);
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      setRoutineEndDate(formatLocalDate(oneYearLater));
      setEditingRoutineId(null);
    }
  }, [isOpen, selectedMemberIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 space-y-4 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {editingRoutineId ? "항목 수정" : "새 항목 추가"}
          </h3>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#1F2937] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

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
                const isSelectedInView = selectedMemberIds.includes(member.id);
                const isSelectedInPopup = selectedRoutineMemberIds.includes(member.id);
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
              onClick={onClose}
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
  );
}

