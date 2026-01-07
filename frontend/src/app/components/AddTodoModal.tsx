import { X, Calendar, Clock, Tag, Bell, Repeat, Plus, Trash2, MapPin } from "lucide-react";
import { useState, useEffect } from "react";

interface AddTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (todo: TodoFormData) => void;
  initialData?: {
    id?: string;
    title?: string;
    date?: string;
    time?: string;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
    postponeToNextDay?: boolean;
    category?: string;
    checklistItems?: string[];
    memo?: string;
    location?: string;
    hasNotification?: boolean;
    alarmTimes?: string[];
    repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
}

export interface TodoFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean; // 하루종일 체크박스
  postponeToNextDay: boolean; // 다음날로 미루기 체크박스
  category: string;
  checklistItems: string[]; // 항상 체크리스트 항목 사용
  memo: string;
  location?: string; // 장소
  hasNotification: boolean;
  alarmTimes: string[];
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// 로컬 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function AddTodoModal({ isOpen, onClose, onSave, initialData }: AddTodoModalProps) {
  const [formData, setFormData] = useState<TodoFormData>({
    title: initialData?.title || '',
    date: initialData?.date || formatLocalDate(new Date()),
    startTime: initialData?.startTime || initialData?.time || '09:00',
    endTime: initialData?.endTime || '10:00',
    isAllDay: initialData?.isAllDay || false,
    postponeToNextDay: initialData?.postponeToNextDay || false,
    category: initialData?.category || '생활',
    checklistItems: initialData?.checklistItems && initialData.checklistItems.length > 0 ? initialData.checklistItems : [''],
    memo: initialData?.memo || '',
    location: initialData?.location || '',
    hasNotification: initialData?.hasNotification || false,
    alarmTimes: initialData?.alarmTimes || [],
    repeatType: initialData?.repeatType || 'none',
  });

  // initialData가 변경될 때 formData 업데이트
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        date: initialData.date || formatLocalDate(new Date()),
        startTime: initialData.startTime || initialData.time || '09:00',
        endTime: initialData.endTime || '10:00',
        isAllDay: initialData.isAllDay || false,
        postponeToNextDay: initialData.postponeToNextDay || false,
        category: initialData.category || '생활',
        checklistItems: initialData.checklistItems && initialData.checklistItems.length > 0 ? initialData.checklistItems : [''],
        memo: initialData.memo || '',
        location: initialData.location || '',
        hasNotification: initialData.hasNotification || false,
        alarmTimes: initialData.alarmTimes || [],
        repeatType: initialData.repeatType || 'none',
      });
    } else {
      // 초기화
      setFormData({
        title: '',
        date: formatLocalDate(new Date()),
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
        postponeToNextDay: false,
        category: '생활',
        checklistItems: [''],
        memo: '',
        hasNotification: false,
        alarmTimes: [],
        repeatType: 'none',
      });
    }
  }, [initialData, isOpen]);

  const categories = ['운동', '건강', '업무', '생활', '공부', '기타'];
  const repeatOptions = [
    { value: 'none', label: '없음' },
    { value: 'daily', label: '매일' },
    { value: 'weekly', label: '매주' },
    { value: 'monthly', label: '매월' },
    { value: 'yearly', label: '매년' },
  ];

  if (!isOpen) return null;

  const handleAddChecklistItem = () => {
    setFormData({
      ...formData,
      checklistItems: [...formData.checklistItems, ''],
    });
  };

  const handleRemoveChecklistItem = (index: number) => {
    const newItems = formData.checklistItems.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      checklistItems: newItems.length > 0 ? newItems : [''],
    });
  };

  const handleChecklistItemChange = (index: number, value: string) => {
    const newItems = [...formData.checklistItems];
    newItems[index] = value;
    setFormData({
      ...formData,
      checklistItems: newItems,
    });
  };

  const handleAddAlarm = () => {
    setFormData({
      ...formData,
      alarmTimes: [...formData.alarmTimes, '09:00'],
    });
  };

  const handleRemoveAlarm = (index: number) => {
    setFormData({
      ...formData,
      alarmTimes: formData.alarmTimes.filter((_, i) => i !== index),
    });
  };

  const handleAlarmTimeChange = (index: number, value: string) => {
    const newTimes = [...formData.alarmTimes];
    newTimes[index] = value;
    setFormData({
      ...formData,
      alarmTimes: newTimes,
    });
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('일정 제목을 입력해주세요.');
      return;
    }
    onSave(formData);
    onClose();
    // Reset form
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      isAllDay: false,
      postponeToNextDay: false,
      category: '생활',
      checklistItems: [''],
      memo: '',
      location: '',
      hasNotification: false,
      alarmTimes: [],
      repeatType: 'none',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-full max-w-[375px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#FF9B82] to-[#FFB499] border-b border-[#E5E7EB]">
          <h2 className="text-xl font-semibold text-white">일정 추가</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* 일정 제목 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">
                일정 제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="일정 제목을 입력하세요"
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
              />
            </div>

            {/* 날짜 설정 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2 flex items-center gap-2">
                <Calendar size={18} className="text-[#FF9B82]" />
                날짜 설정
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
              />
            </div>

            {/* 시작/종료 시간 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2 flex items-center gap-2">
                <Clock size={18} className="text-[#FF9B82]" />
                시작/종료 시간
              </label>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    disabled={formData.isAllDay}
                    className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    disabled={formData.isAllDay}
                    className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                  />
                </div>
              </div>
              {/* 하루종일 체크박스 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={(e) => {
                    const isAllDay = e.target.checked;
                    setFormData({
                      ...formData,
                      isAllDay,
                      startTime: isAllDay ? '00:00' : formData.startTime,
                      endTime: isAllDay ? '24:00' : formData.endTime,
                    });
                  }}
                  className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] rounded focus:ring-2 focus:ring-[#FF9B82]"
                />
                <span className="text-sm text-[#6B7280]">하루종일</span>
              </label>
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2 flex items-center gap-2">
                <Tag size={18} className="text-[#FF9B82]" />
                카테고리
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setFormData({ ...formData, category })}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${formData.category === category
                      ? 'bg-[#FF9B82] text-white border-[#FF9B82]'
                      : 'bg-white text-[#6B7280] border-[#D1D5DB] hover:border-[#FF9B82]'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* 체크리스트 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">
                체크리스트
              </label>
              <div className="space-y-2">
                {formData.checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                      placeholder={`항목 ${index + 1}`}
                      className="flex-1 px-4 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                    />
                    {formData.checklistItems.length > 1 && (
                      <button
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddChecklistItem}
                  className="w-full px-4 py-2 border-2 border-dashed border-[#D1D5DB] rounded-lg text-[#6B7280] hover:border-[#FF9B82] hover:text-[#FF9B82] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  항목 추가
                </button>
              </div>
            </div>

            {/* 장소 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2 flex items-center gap-2">
                <MapPin size={18} className="text-[#FF9B82]" />
                장소
              </label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="장소를 입력하세요"
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">
                메모
              </label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="메모를 입력하세요"
                rows={3}
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent resize-none"
              />
            </div>

            {/* 반복 설정 */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2 flex items-center gap-2">
                <Repeat size={18} className="text-[#FF9B82]" />
                반복 설정
              </label>
              <select
                value={formData.repeatType}
                onChange={(e) => setFormData({ ...formData, repeatType: e.target.value as any })}
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent appearance-none bg-white"
              >
                {repeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 알림 여부 */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-[#FF9B82]" />
                  <span className="text-sm font-medium text-[#1F2937]">알림 설정</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.hasNotification}
                    onChange={(e) => setFormData({ ...formData, hasNotification: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-8 bg-[#D1D5DB] rounded-full peer peer-checked:bg-[#FF9B82] transition-colors"></div>
                  <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                </div>
              </label>
            </div>

            {/* 알람 시간 */}
            {formData.hasNotification && (
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">
                  알람 시간
                </label>
                <div className="space-y-2">
                  {formData.alarmTimes.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleAlarmTimeChange(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                      />
                      <button
                        onClick={() => handleRemoveAlarm(index)}
                        className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddAlarm}
                    className="w-full px-4 py-2 border-2 border-dashed border-[#D1D5DB] rounded-lg text-[#6B7280] hover:border-[#FF9B82] hover:text-[#FF9B82] transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    알람 추가
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white border border-[#D1D5DB] text-[#6B7280] rounded-lg hover:bg-[#F3F4F6] transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors font-medium"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}