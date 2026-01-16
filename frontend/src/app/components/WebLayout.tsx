import { Home, Calendar, Search, Settings, RefreshCw, ChevronRight, Menu, X } from 'lucide-react';
import { MomFlowLogo } from './MomFlowLogo';
import { ReactNode, useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useIsMobile } from './ui/use-mobile';

interface WebLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

/**
 * 반응형 레이아웃 컴포넌트
 * - 모바일: 하단 탭바 + 사이드바는 Sheet로 표시
 * - 태블릿: 축소된 사이드바 (아이콘만)
 * - 데스크톱: 전체 사이드바
 */
export function WebLayout({ children, currentPage = 'today' }: WebLayoutProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // 네비게이션 아이템 렌더링 함수
  const renderNavItems = (isCompact = false) => (
    <nav className="flex-1 px-3 py-4">
      <NavItem
        icon={Home}
        label="오늘"
        active={currentPage === 'today'}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        isCompact={isCompact}
      />
      <NavItem
        icon={Calendar}
        label="캘린더"
        active={currentPage === 'calendar'}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        isCompact={isCompact}
      />
      <NavItem
        icon={Search}
        label="검색"
        active={currentPage === 'search'}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        isCompact={isCompact}
      />
      <NavItem
        icon={Settings}
        label="설정"
        active={currentPage === 'settings'}
        hasSubmenu
        expanded={expandedMenu === 'settings'}
        onClick={() => setExpandedMenu(expandedMenu === 'settings' ? null : 'settings')}
        isCompact={isCompact}
      />
      {expandedMenu === 'settings' && !isCompact && (
        <div className="ml-8 space-y-1 mt-1">
          <SubNavItem label="계정 관리" />
          <SubNavItem label="룰(규칙) 관리" />
          <SubNavItem label="알림 설정" />
        </div>
      )}
    </nav>
  );

  // 모바일: 하단 탭바 + Sheet 사이드바
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-[#FAFAFA]">
        {/* 모바일 헤더 */}
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-4 flex items-center justify-between shrink-0">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-[#F3F4F6] rounded-lg">
                <Menu size={24} className="text-[#6B7280]" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] p-0">
              <div className="h-full flex flex-col">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-[#E5E7EB]">
                  <MomFlowLogo size="sm" />
                </div>
                {renderNavItems(false)}
                {/* Sync Status */}
                <div className="p-4 border-t border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                    <span>마지막 동기화: 방금 전</span>
                    <button className="p-1 hover:bg-[#F3F4F6] rounded">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold">MomFlow</h1>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto pb-16">
          <div className="max-w-full mx-auto p-4 sm:p-6">
            {children}
          </div>
        </main>

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 z-10">
          <TabButton icon={Home} label="오늘" active={currentPage === 'today'} />
          <TabButton icon={Calendar} label="캘린더" active={currentPage === 'calendar'} />
          <TabButton icon={Search} label="검색" active={currentPage === 'search'} />
          <TabButton icon={Settings} label="설정" active={currentPage === 'settings'} />
        </div>
      </div>
    );
  }

  // 태블릿/데스크톱: 사이드바 레이아웃
  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6]">
      {/* Sidebar - 태블릿에서는 축소, 데스크톱에서는 전체 */}
      <aside className="hidden md:flex md:w-16 lg:w-[280px] bg-white/80 backdrop-blur-sm border-r border-[#E5E7EB]/50 flex-col transition-all duration-300 shadow-sm lg:shadow-lg">
        {/* Logo - 데스크톱에서 개선 */}
        <div className="h-20 lg:h-24 flex items-center px-3 lg:px-6 justify-center lg:justify-start border-b border-[#E5E7EB]/50 lg:bg-gradient-to-r lg:from-[#EEF2FF] lg:to-transparent">
          <MomFlowLogo size="sm" />
        </div>

        {/* Navigation */}
        <div className="flex-1 px-2 lg:px-4 py-4">
          {renderNavItems(true)}
        </div>

        {/* Sync Status - 태블릿에서는 숨김 */}
        <div className="hidden lg:block p-4 border-t border-[#E5E7EB]/50 bg-[#FAFAFA]/50">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="font-medium">마지막 동기화: 방금 전</span>
            <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content - 데스크톱에서 개선 */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto p-6 md:p-8 lg:p-10 xl:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  hasSubmenu = false,
  expanded = false,
  onClick,
  isCompact = false
}: {
  icon: any;
  label: string;
  active?: boolean;
  hasSubmenu?: boolean;
  expanded?: boolean;
  onClick: () => void;
  isCompact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full h-12 flex items-center gap-3 px-3 lg:px-4 rounded-xl mb-1.5 transition-all duration-200
        ${active 
          ? 'bg-gradient-to-r from-[#EEF2FF] to-[#E0E7FF] text-[#6366F1] shadow-sm font-medium' 
          : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#4B5563] hover:translate-x-1'
        }
        ${isCompact ? 'justify-center lg:justify-start' : ''}
      `}
      title={isCompact ? label : undefined}
    >
      <Icon size={20} className={active ? 'text-[#6366F1]' : ''} />
      <span className={`flex-1 text-left font-medium ${isCompact ? 'hidden lg:inline' : ''}`}>{label}</span>
      {hasSubmenu && !isCompact && (
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      )}
    </button>
  );
}

function SubNavItem({ label }: { label: string }) {
  return (
    <button className="w-full h-9 flex items-center px-3 lg:px-6 rounded-lg text-sm text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#4B5563] transition-all duration-200 hover:translate-x-1">
      {label}
    </button>
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
