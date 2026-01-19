import { RefreshCw, Mic, Home, Calendar, Search, Settings, LogOut } from 'lucide-react';
import { TodoItem } from './TodoItem';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const mockTodos = [
  { id: '1', title: '소아과 예약 확인하기', description: '아이 건강검진', time: '오전 10:00', rule: '병원', completed: false, overdue: false, status: 'pending', priority: 'high', date: new Date().toISOString().split('T')[0] },
  { id: '2', title: '독감 예방접종 준비물 챙기기', description: '서류 및 기본정보 확인', time: '오전 10:30', rule: '병원', completed: false, overdue: false, status: 'pending', priority: 'high', date: new Date().toISOString().split('T')[0] },
  { id: '3', title: '학교 준비물 챙기기', description: '미술용품', time: '오전 7:30', completed: true, overdue: false, status: 'completed', priority: 'medium', date: new Date().toISOString().split('T')[0] },
  { id: '4', title: '저녁 식재료 구매하기', description: '마트 방문', time: '오후 5:00', completed: false, overdue: false, status: 'pending', priority: 'medium', date: new Date().toISOString().split('T')[0] },
  { id: '5', title: '미술 학원 준비물 챙기기', description: '스케치북, 색연필', time: '오후 2:00', draft: true, completed: false, overdue: false, status: 'draft', priority: 'low', date: new Date().toISOString().split('T')[0] },
  { id: '6', title: '숙제 확인하기', description: '수학, 국어', time: '어제', completed: false, overdue: true, status: 'overdue', priority: 'high', date: new Date().toISOString().split('T')[0] },
];

export function TodayScreen() {
  const [todos, setTodos] = useState(mockTodos);
  const [showVoice, setShowVoice] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 사용자 정보 로드 (한 번만)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiClient.getCurrentUser();
        setUser(response.data);
        console.log('User loaded:', response.data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load user:', error);
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // 할 일 로드 (한 번만)
  useEffect(() => {
    const loadTodos = async () => {
      try {
        // /todos/today 엔드포인트 사용 (오늘 할 일만 조회)
        const response = await apiClient.getTodosToday();
        console.log('Todos loaded:', response.data);
        // API 응답 형식에 맞게 처리
        if (response.data && Array.isArray(response.data)) {
          // Backend 데이터를 Frontend 형식으로 변환
          const formattedTodos = response.data.map((todo: any) => ({
            id: todo.id,
            title: todo.title,
            description: todo.description,
            time: todo.start_time ? `${todo.start_time}` : undefined,
            rule: todo.category,
            completed: todo.status === 'completed',
            draft: todo.status === 'draft',
            overdue: todo.status === 'overdue',
            status: todo.status,
            priority: todo.priority,
            date: todo.date
          }));
          setTodos(formattedTodos);
        }
      } catch (error) {
        console.error('Failed to load todos:', error);
        // API 호출 실패 시 목업 데이터 사용
      }
    };

    loadTodos();
  }, []);

  const handleBack = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    try {
      apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/';
  };

  const handleToggle = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const handleConfirm = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, draft: false } : todo
    ));
  };

  const handleDelete = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-[#6B7280]">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto relative">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 p-2 hover:bg-white rounded-lg transition-colors z-20"
      >
        <ArrowLeft size={24} className="text-[#6B7280]" />
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 p-2 hover:bg-white rounded-lg transition-colors z-20"
      >
        <LogOut size={24} className="text-[#6B7280]" />
      </button>

      {/* Header - 반응형 */}
      <div className="h-14 bg-white border-b border-[#E5E7EB] px-3 sm:px-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">오늘</h2>
            <span className="text-xs text-[#6B7280] hidden sm:inline">{new Date().toLocaleDateString('ko-KR')}</span>
          </div>
          {user && <p className="text-xs text-[#9CA3AF] truncate">환영합니다, {user.name}!</p>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <span className="text-[10px] sm:text-xs text-[#9CA3AF] hidden sm:inline">방금 전</span>
          <button className="p-1 hover:bg-[#F3F4F6] rounded">
            <RefreshCw size={18} className="text-[#6B7280] sm:size-5" />
          </button>
        </div>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-auto">
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="text-6xl mb-4">✓</div>
            <p className="mb-2">오늘 할 일을 모두 마쳤어요!</p>
            <p className="text-[#6B7280]">음성으로 새 할 일을 추가해보세요</p>
          </div>
        ) : (
          <div>
            {todos.map(todo => (
              <TodoItem
                key={todo.id}
                {...todo}
                onToggle={handleToggle}
                onConfirm={handleConfirm}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB - 반응형: 모바일에서는 하단 탭바 위, 데스크톱에서는 우측 하단 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowVoice(!showVoice)}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 md:w-16 md:h-16 bg-[#6366F1] rounded-full flex items-center justify-center shadow-lg hover:bg-[#5558E3] transition-colors z-10"
      >
        <Mic size={24} className="text-white md:size-7" />
      </motion.button>

      {/* Bottom Tab Bar - 모바일에서만 표시 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 z-10">
        <TabButton icon={Home} label="오늘" active />
        <TabButton icon={Calendar} label="캘린더" />
        <TabButton icon={Search} label="검색" />
        <TabButton icon={Settings} label="설정" />
      </div>

      {/* Voice Overlay Demo */}
      {showVoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowVoice(false)}>
          <div className="text-white text-center">
            <p className="mb-4">음성 녹음 오버레이</p>
            <p className="text-sm text-white/60">화면을 탭하여 닫기</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) {
  return (
    <button className={`flex flex-col items-center justify-center gap-1 py-2 px-4 ${active ? 'text-[#6366F1]' : 'text-[#9CA3AF]'}`}>
      <Icon size={24} />
      <span className="text-[10px]">{label}</span>
    </button>
  );
}