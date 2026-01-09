import { X, Calendar, Clock, Tag, Bell, Repeat, Plus, Trash2, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface AddTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (todo: TodoFormData) => void;
  initialData?: {
    id?: string;
    title?: string;
    date?: string;
    endDate?: string; // 종료 날짜 (여러 날 선택 시)
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
    notificationReminders?: NotificationReminder[]; // 새로운 알림 형식
    repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'weekends' | 'custom';
    repeatEndDate?: string; // 반복 종료 날짜
    repeatPattern?: any; // 반복 패턴 JSON
  };
}

// 알림 리마인더 타입
export interface NotificationReminder {
  value: number; // 숫자 (예: 30)
  unit: 'minutes' | 'hours' | 'days' | 'weeks'; // 단위 (분, 시간, 일, 주)
}

export interface TodoFormData {
  title: string;
  date: string; // 시작 날짜
  endDate?: string; // 종료 날짜 (여러 날 선택 시)
  startTime: string;
  endTime: string;
  isAllDay: boolean; // 하루종일 체크박스
  postponeToNextDay: boolean; // 다음날로 미루기 체크박스
  category: string;
  checklistItems: string[]; // 항상 체크리스트 항목 사용
  memo: string;
  location?: string; // 장소
  hasNotification: boolean;
  alarmTimes: string[]; // 구버전 호환 (시간 형식)
  notificationReminders: NotificationReminder[]; // 새로운 형식 (숫자/단위)
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'weekends' | 'custom';
  repeatEndDate?: string; // 반복 종료 날짜
  repeatPattern?: any; // 반복 패턴 JSON
  customRepeatInterval?: number; // 맞춤 반복 주기 (숫자)
  customRepeatUnit?: 'days' | 'weeks' | 'months' | 'years'; // 맞춤 반복 단위
  customRepeatDays?: number[]; // 맞춤 반복 요일 (0: 일, 1: 월, ..., 6: 토)
  customRepeatEndType?: 'never' | 'date' | 'count'; // 맞춤 반복 종료 타입
  customRepeatEndDate?: string; // 맞춤 반복 종료 날짜
  customRepeatCount?: number; // 맞춤 반복 횟수
}

// 로컬 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function AddTodoModal({ isOpen, onClose, onSave, initialData }: AddTodoModalProps) {
  // 초기값 계산: 하루종일이면 시간 필드를 빈 문자열로 설정
  const isAllDayInitial = initialData?.isAllDay || false;
  const startTimeInitial = isAllDayInitial ? '' : (initialData?.startTime || initialData?.time || '09:00');
  const endTimeInitial = isAllDayInitial ? '' : (initialData?.endTime || '10:00');

  // 시작 날짜 기본값
  const initialStartDate = initialData?.date || formatLocalDate(new Date());

  // notification_reminders를 NotificationReminder[]로 변환하는 헬퍼 함수
  const parseNotificationReminders = (reminders: any): NotificationReminder[] => {
    if (!reminders) return [];
    if (Array.isArray(reminders)) {
      return reminders.map((r: any) => {
        if (typeof r === 'object' && r.value && r.unit) {
          return { value: Number(r.value), unit: r.unit };
        }
        return null;
      }).filter((r): r is NotificationReminder => r !== null);
    }
    try {
      const parsed = typeof reminders === 'string' ? JSON.parse(reminders) : reminders;
      if (Array.isArray(parsed)) {
        return parsed.map((r: any) => {
          if (typeof r === 'object' && r.value && r.unit) {
            return { value: Number(r.value), unit: r.unit };
          }
          return null;
        }).filter((r): r is NotificationReminder => r !== null);
      }
    } catch (e) {
      console.error('Failed to parse notification reminders:', e);
    }
    return [];
  };

  const [formData, setFormData] = useState<TodoFormData>({
    title: initialData?.title || '',
    date: initialStartDate,
    endDate: initialData?.endDate || initialStartDate, // 종료 날짜 기본값을 시작 날짜와 동일하게 설정
    startTime: startTimeInitial,
    endTime: endTimeInitial,
    isAllDay: isAllDayInitial,
    postponeToNextDay: initialData?.postponeToNextDay || false,
    category: initialData?.category || '생활',
    checklistItems: initialData?.checklistItems && initialData.checklistItems.length > 0
      ? initialData.checklistItems.filter(item => item.trim() !== '')
      : [''],
    memo: initialData?.memo || '',
    location: initialData?.location || '',
    hasNotification: initialData?.hasNotification || false,
    alarmTimes: initialData?.alarmTimes || [], // 구버전 호환
    notificationReminders: initialData?.notificationReminders
      ? (Array.isArray(initialData.notificationReminders)
        ? initialData.notificationReminders.map((r: any) => ({ value: r.value || 30, unit: r.unit || 'minutes' }))
        : parseNotificationReminders(initialData.notificationReminders))
      : [],
    repeatType: initialData?.repeatType || 'none',
    repeatEndDate: initialData?.repeatEndDate,
    repeatPattern: initialData?.repeatPattern,
    customRepeatInterval: initialData?.repeatPattern?.interval || 1,
    customRepeatUnit: initialData?.repeatPattern?.unit || 'days',
    customRepeatDays: initialData?.repeatPattern?.days || [],
    customRepeatEndType: initialData?.repeatPattern?.endType || 'never',
    customRepeatEndDate: initialData?.repeatPattern?.endDate,
    customRepeatCount: initialData?.repeatPattern?.count || 10,
  });

  // 추출 상태 관리
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);

  // initialData가 변경될 때 formData 업데이트
  useEffect(() => {
    if (initialData) {
      // 하루종일이면 시간 필드를 빈 문자열로 설정
      const isAllDay = initialData.isAllDay || false;
      const startTime = isAllDay ? '' : (initialData.startTime || initialData.time || '09:00');
      const endTime = isAllDay ? '' : (initialData.endTime || '10:00');

      const startDate = initialData.date || formatLocalDate(new Date());
      setFormData({
        title: initialData.title || '',
        date: startDate,
        endDate: initialData.endDate || startDate, // 종료 날짜 기본값을 시작 날짜와 동일하게 설정
        startTime: startTime,
        endTime: endTime,
        isAllDay: isAllDay,
        postponeToNextDay: initialData.postponeToNextDay || false,
        category: initialData.category || '생활',
        checklistItems: initialData.checklistItems && initialData.checklistItems.length > 0
          ? initialData.checklistItems.filter(item => item && item.trim() !== '')
          : [],
        memo: initialData.memo || '',
        location: initialData.location || '',
        hasNotification: initialData.hasNotification || false,
        alarmTimes: initialData.alarmTimes || [], // 구버전 호환
        notificationReminders: initialData?.notificationReminders
          ? (Array.isArray(initialData.notificationReminders)
            ? initialData.notificationReminders.map((r: any) => ({ value: r.value || 30, unit: r.unit || 'minutes' }))
            : parseNotificationReminders(initialData.notificationReminders))
          : [],
        repeatType: initialData.repeatType || 'none',
        repeatEndDate: initialData?.repeatEndDate,
        repeatPattern: initialData?.repeatPattern,
        customRepeatInterval: initialData?.repeatPattern?.interval || 1,
        customRepeatUnit: initialData?.repeatPattern?.freq === 'weeks' ? 'weeks' :
          initialData?.repeatPattern?.freq === 'months' ? 'months' :
            initialData?.repeatPattern?.freq === 'years' ? 'years' : 'days',
        customRepeatDays: initialData?.repeatPattern?.days || [],
        customRepeatEndType: initialData?.repeatPattern?.endType ||
          (initialData?.repeatPattern?.endDate ? 'date' :
            (initialData?.repeatPattern?.count ? 'count' : 'never')),
        customRepeatEndDate: initialData?.repeatPattern?.endDate,
        customRepeatCount: initialData?.repeatPattern?.count || 10,
      });
    } else {
      // 초기화
      const defaultDate = formatLocalDate(new Date());
      setFormData({
        title: '',
        date: defaultDate,
        endDate: defaultDate, // 종료 날짜 기본값을 시작 날짜와 동일하게 설정
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
        postponeToNextDay: false,
        category: '생활',
        checklistItems: [''],
        memo: '',
        hasNotification: false,
        alarmTimes: [],
        notificationReminders: [],
        repeatType: 'none',
        repeatEndDate: undefined,
        repeatPattern: undefined,
        customRepeatInterval: 1,
        customRepeatUnit: 'days',
        customRepeatDays: [],
        customRepeatEndType: 'never',
        customRepeatCount: 10,
      });
    }
  }, [initialData, isOpen]);

  // initialData가 변경되면 hasExtracted 리셋
  useEffect(() => {
    if (initialData) {
      setHasExtracted(false);
    }
  }, [initialData]);

  // 모달이 열릴 때 메모 텍스트가 있고 제목이 비어있으면 자동으로 정보 추출
  useEffect(() => {
    if (isOpen && formData.memo.trim() && !formData.title.trim() && !hasExtracted && !isExtracting) {
      const extractInfo = async () => {
        try {
          setIsExtracting(true);
          toast.loading('일정 정보를 추출하는 중...');
          const response = await apiClient.extractTodoInfo(formData.memo);

          if (response && response.data) {
            const info = response.data;

            // notification_reminders 파싱
            let notificationReminders: NotificationReminder[] = [];
            if (info.notification_reminders && Array.isArray(info.notification_reminders)) {
              notificationReminders = info.notification_reminders.map((r: any) => ({
                value: Number(r.value) || 30,
                unit: r.unit || 'minutes'
              }));
            }

            // 추출된 정보로 폼 업데이트 (모든 필드 자동 채움)
            setFormData(prev => ({
              ...prev,
              title: info.title || prev.title,
              date: info.date || prev.date,
              endDate: info.end_date || info.date || prev.endDate,
              startTime: info.start_time || (info.all_day ? '' : (prev.startTime || '09:00')),
              endTime: info.end_time || (info.all_day ? '' : (prev.endTime || '10:00')),
              isAllDay: info.all_day !== undefined ? info.all_day : prev.isAllDay,
              category: info.category || prev.category,
              checklistItems: info.checklist && info.checklist.length > 0 ? info.checklist : prev.checklistItems,
              location: info.location || prev.location,
              memo: info.memo || prev.memo,
              repeatType: info.repeat_type || prev.repeatType,
              repeatEndDate: info.repeat_end_date || prev.repeatEndDate,
              repeatPattern: info.repeat_pattern || prev.repeatPattern,
              hasNotification: info.has_notification !== undefined ? info.has_notification : prev.hasNotification,
              alarmTimes: info.notification_times || prev.alarmTimes,
              notificationReminders: notificationReminders.length > 0 ? notificationReminders : prev.notificationReminders,
            }));

            setHasExtracted(true);
            toast.dismiss();
            toast.success('일정 정보가 자동으로 추출되었습니다.');
          }
          setIsExtracting(false);
        } catch (error) {
          console.error('일정 정보 추출 실패:', error);
          toast.dismiss();
          toast.error('일정 정보 추출에 실패했습니다. 직접 입력해주세요.');
          setIsExtracting(false);
        }
      };

      extractInfo();
    }
  }, [isOpen, formData.memo, formData.title, hasExtracted, isExtracting]);

  const categories = ['공부', '업무', '약속', '생활', '건강', '구글', '기타'];
  const repeatOptions = [
    { value: 'none', label: '없음' },
    { value: 'daily', label: '매일' },
    { value: 'weekly', label: '매주' },
    { value: 'monthly', label: '매월' },
    { value: 'yearly', label: '매년' },
    { value: 'weekdays', label: '매주 주중' },
    { value: 'weekends', label: '매주 주말' },
    { value: 'custom', label: '맞춤' },
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

  // 알림 리마인더 핸들러
  const handleAddReminder = () => {
    setFormData({
      ...formData,
      notificationReminders: [...formData.notificationReminders, { value: 30, unit: 'minutes' }],
    });
  };

  const handleRemoveReminder = (index: number) => {
    setFormData({
      ...formData,
      notificationReminders: formData.notificationReminders.filter((_, i) => i !== index),
    });
  };

  const handleReminderValueChange = (index: number, value: number) => {
    const newReminders = [...formData.notificationReminders];
    newReminders[index] = { ...newReminders[index], value };
    setFormData({
      ...formData,
      notificationReminders: newReminders,
    });
  };

  const handleReminderUnitChange = (index: number, unit: 'minutes' | 'hours' | 'days' | 'weeks') => {
    const newReminders = [...formData.notificationReminders];
    newReminders[index] = { ...newReminders[index], unit };
    setFormData({
      ...formData,
      notificationReminders: newReminders,
    });
  };

  // 구버전 호환을 위한 알람 시간 핸들러 (필요시 유지)
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

  const handleSave = async () => {
    // 메모 텍스트가 있고 아직 추출하지 않았으면 자동으로 정보 추출
    if (formData.memo.trim() && !hasExtracted) {
      try {
        setIsExtracting(true);
        toast.loading('일정 정보를 추출하는 중...');
        const response = await apiClient.extractTodoInfo(formData.memo);

        if (response && response.data) {
          const info = response.data;

          // notification_reminders 파싱
          let notificationReminders: NotificationReminder[] = [];
          if (info.notification_reminders && Array.isArray(info.notification_reminders)) {
            notificationReminders = info.notification_reminders.map((r: any) => ({
              value: Number(r.value) || 30,
              unit: r.unit || 'minutes'
            }));
          }

          // 추출된 정보로 폼 업데이트 (모든 필드 자동 채움)
          setFormData({
            ...formData,
            title: info.title || formData.title,
            date: info.date || formData.date,
            endDate: info.end_date || info.date || formData.endDate,
            startTime: info.start_time || (info.all_day ? '' : (formData.startTime || '09:00')),
            endTime: info.end_time || (info.all_day ? '' : (formData.endTime || '10:00')),
            isAllDay: info.all_day !== undefined ? info.all_day : formData.isAllDay,
            category: info.category || formData.category,
            checklistItems: info.checklist && info.checklist.length > 0 ? info.checklist : formData.checklistItems,
            location: info.location || formData.location,
            memo: info.memo || formData.memo,
            repeatType: info.repeat_type || formData.repeatType,
            repeatEndDate: info.repeat_end_date || formData.repeatEndDate,
            repeatPattern: info.repeat_pattern || formData.repeatPattern,
            hasNotification: info.has_notification !== undefined ? info.has_notification : formData.hasNotification,
            alarmTimes: info.notification_times || formData.alarmTimes,
            notificationReminders: notificationReminders.length > 0 ? notificationReminders : formData.notificationReminders,
          });

          setHasExtracted(true);
          toast.dismiss();
          toast.success('일정 정보가 자동으로 추출되었습니다. 확인 후 저장해주세요.');
          setIsExtracting(false);
          return; // 추출 후 사용자가 확인할 수 있도록 return
        }
        toast.dismiss();
        setIsExtracting(false);
      } catch (error) {
        console.error('일정 정보 추출 실패:', error);
        toast.dismiss();
        toast.error('일정 정보 추출에 실패했습니다. 직접 입력해주세요.');
        setIsExtracting(false);
      }
    }

    // 추출이 완료되었거나 메모가 없으면 저장 진행
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
      notificationReminders: [],
      repeatType: 'none',
      repeatEndDate: undefined,
      repeatPattern: undefined,
    });
    setHasExtracted(false);
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
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">시작 날짜 *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData({
                        ...formData,
                        date: newDate,
                        // 종료 날짜가 시작 날짜보다 이전이면 종료 날짜도 시작 날짜와 동일하게 업데이트
                        // 종료 날짜가 없거나 시작 날짜와 동일한 경우에도 시작 날짜와 동일하게 유지
                        endDate: formData.endDate && formData.endDate < newDate ? newDate : (formData.endDate || newDate)
                      });
                    }}
                    className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">종료 날짜 (선택사항)</label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    min={formData.date} // 시작 날짜 이후만 선택 가능
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
                    className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                    placeholder="종료 날짜를 선택하면 여러 날에 일정이 생성됩니다"
                  />
                  {formData.endDate && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      {formData.date}부터 {formData.endDate}까지 일정이 생성됩니다.
                    </p>
                  )}
                </div>
              </div>
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
                      endTime: isAllDay ? '' : formData.endTime,
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
                onChange={(e) => {
                  const newRepeatType = e.target.value as any;
                  setFormData({
                    ...formData,
                    repeatType: newRepeatType,
                    // 반복이 없음으로 변경되면 반복 종료일도 초기화
                    repeatEndDate: newRepeatType === 'none' ? undefined : formData.repeatEndDate
                  });
                }}
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent appearance-none bg-white mb-3"
              >
                {repeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* 반복이 선택된 경우 반복 종료일 설정 */}
              {formData.repeatType && formData.repeatType !== 'none' && (
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">반복 종료일 (선택사항)</label>
                  <input
                    type="date"
                    value={formData.repeatEndDate || ''}
                    min={formData.date} // 시작 날짜 이후만 선택 가능
                    onChange={(e) => setFormData({ ...formData, repeatEndDate: e.target.value || undefined })}
                    className="w-full px-4 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                    placeholder="반복 종료일을 선택하세요"
                  />
                  {formData.repeatEndDate && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      {formData.date}부터 {formData.repeatEndDate}까지 반복됩니다.
                    </p>
                  )}
                </div>
              )}
              {/* 맞춤 반복인 경우 추가 설정 */}
              {formData.repeatType === 'custom' && (
                <div className="mt-3 p-4 bg-[#F9FAFB] rounded-lg space-y-4">
                  {/* 반복 주기 */}
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] mb-2">
                      반복 주기
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={formData.customRepeatInterval || 1}
                        onChange={(e) => setFormData({
                          ...formData,
                          customRepeatInterval: parseInt(e.target.value) || 1
                        })}
                        className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-sm"
                      />
                      <select
                        value={formData.customRepeatUnit || 'days'}
                        onChange={(e) => setFormData({
                          ...formData,
                          customRepeatUnit: e.target.value as 'days' | 'weeks' | 'months' | 'years'
                        })}
                        className="flex-1 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-sm"
                      >
                        <option value="days">일</option>
                        <option value="weeks">주</option>
                        <option value="months">월</option>
                        <option value="years">년</option>
                      </select>
                    </div>
                  </div>

                  {/* 반복 요일 (주 단위인 경우만 표시) */}
                  {formData.customRepeatUnit === 'weeks' && (
                    <div>
                      <label className="block text-xs font-medium text-[#6B7280] mb-2">
                        반복 요일
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 0, label: '일' },
                          { value: 1, label: '월' },
                          { value: 2, label: '화' },
                          { value: 3, label: '수' },
                          { value: 4, label: '목' },
                          { value: 5, label: '금' },
                          { value: 6, label: '토' },
                        ].map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              const currentDays = formData.customRepeatDays || [];
                              const isSelected = currentDays.includes(day.value);
                              setFormData({
                                ...formData,
                                customRepeatDays: isSelected
                                  ? currentDays.filter(d => d !== day.value)
                                  : [...currentDays, day.value].sort(),
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${(formData.customRepeatDays || []).includes(day.value)
                              ? 'bg-[#FF9B82] text-white'
                              : 'bg-white border border-[#D1D5DB] text-[#6B7280] hover:bg-[#F9FAFB]'
                              }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 종료 */}
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] mb-2">
                      종료
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="customRepeatEnd"
                          value="never"
                          checked={formData.customRepeatEndType === 'never'}
                          onChange={(e) => setFormData({
                            ...formData,
                            customRepeatEndType: 'never'
                          })}
                          className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] focus:ring-[#FF9B82]"
                        />
                        <span className="text-sm text-[#6B7280]">없음</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="customRepeatEnd"
                          value="date"
                          checked={formData.customRepeatEndType === 'date'}
                          onChange={(e) => setFormData({
                            ...formData,
                            customRepeatEndType: 'date'
                          })}
                          className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] focus:ring-[#FF9B82]"
                        />
                        <span className="text-sm text-[#6B7280]">날짜:</span>
                        {formData.customRepeatEndType === 'date' && (
                          <input
                            type="date"
                            value={formData.customRepeatEndDate || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customRepeatEndDate: e.target.value
                            })}
                            min={formData.date}
                            className="flex-1 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-sm"
                          />
                        )}
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="customRepeatEnd"
                          value="count"
                          checked={formData.customRepeatEndType === 'count'}
                          onChange={(e) => setFormData({
                            ...formData,
                            customRepeatEndType: 'count'
                          })}
                          className="w-4 h-4 text-[#FF9B82] border-[#D1D5DB] focus:ring-[#FF9B82]"
                        />
                        <span className="text-sm text-[#6B7280]">다음</span>
                        {formData.customRepeatEndType === 'count' && (
                          <>
                            <input
                              type="number"
                              min="1"
                              value={formData.customRepeatCount || 10}
                              onChange={(e) => setFormData({
                                ...formData,
                                customRepeatCount: parseInt(e.target.value) || 10
                              })}
                              className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-sm"
                            />
                            <span className="text-sm text-[#6B7280]">회 반복</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              )}
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

            {/* 알림 리마인더 */}
            {formData.hasNotification && (
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">
                  알림 설정
                </label>
                <div className="space-y-2">
                  {formData.notificationReminders.map((reminder, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={reminder.value}
                        onChange={(e) => handleReminderValueChange(index, parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                        placeholder="30"
                      />
                      <select
                        value={reminder.unit}
                        onChange={(e) => handleReminderUnitChange(index, e.target.value as 'minutes' | 'hours' | 'days' | 'weeks')}
                        className="flex-1 px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent"
                      >
                        <option value="minutes">분 전</option>
                        <option value="hours">시간 전</option>
                        <option value="days">일 전</option>
                        <option value="weeks">주 전</option>
                      </select>
                      <button
                        onClick={() => handleRemoveReminder(index)}
                        className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddReminder}
                    className="w-full px-4 py-2 border-2 border-dashed border-[#D1D5DB] rounded-lg text-[#6B7280] hover:border-[#FF9B82] hover:text-[#FF9B82] transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    알림 추가
                  </button>
                </div>
                {formData.notificationReminders.length > 0 && (
                  <p className="text-xs text-[#6B7280] mt-2">
                    예: {formData.notificationReminders.map(r => `${r.value}${r.unit === 'minutes' ? '분' : r.unit === 'hours' ? '시간' : r.unit === 'days' ? '일' : '주'} 전`).join(', ')}
                  </p>
                )}
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
            disabled={isExtracting}
            className="flex-1 px-6 py-3 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtracting ? '추출 중...' : (hasExtracted && formData.memo.trim() ? '저장' : (formData.memo.trim() ? '정보 추출' : '저장'))}
          </button>
        </div>
      </div>
    </div>
  );
}