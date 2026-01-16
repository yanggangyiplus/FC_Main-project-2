import { X, Users, Heart, GraduationCap, Dumbbell, Palette, MapPin, Baby, Church, Briefcase } from 'lucide-react';

interface CommunityScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const communityCategories = [
  { id: '1', name: '가족', icon: Users, color: 'bg-[#FFE8E0]', iconColor: 'text-[#FF9B82]' },
  { id: '2', name: '친구', icon: Heart, color: 'bg-[#FCE7F3]', iconColor: 'text-[#EC4899]' },
  { id: '3', name: '학교', icon: GraduationCap, color: 'bg-[#E0F2FE]', iconColor: 'text-[#0EA5E9]' },
  { id: '4', name: '운동', icon: Dumbbell, color: 'bg-[#DCFCE7]', iconColor: 'text-[#22C55E]' },
  { id: '5', name: '취미', icon: Palette, color: 'bg-[#FEF3C7]', iconColor: 'text-[#F59E0B]' },
  { id: '6', name: '동네주민', icon: MapPin, color: 'bg-[#E0E7FF]', iconColor: 'text-[#6366F1]' },
  { id: '7', name: '학부모', icon: Baby, color: 'bg-[#FED7AA]', iconColor: 'text-[#F97316]' },
  { id: '8', name: '종교', icon: Church, color: 'bg-[#F3E8FF]', iconColor: 'text-[#A855F7]' },
  { id: '9', name: '직장', icon: Briefcase, color: 'bg-[#D1FAE5]', iconColor: 'text-[#10B981]' },
];

export function CommunityScreen({ isOpen, onClose }: CommunityScreenProps) {
  if (!isOpen) return null;

  const handleCategoryClick = (categoryName: string) => {
    console.log('Selected category:', categoryName);
    // TODO: Navigate to category detail screen or perform action
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6]">
        <h2 className="text-lg font-bold text-[#1F2937]">커뮤니티</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <X size={20} className="text-[#6B7280]" />
        </button>
      </div>

      {/* Category Grid */}
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 64px - 64px)' }}>
        <div className="grid grid-cols-3 gap-4">
          {communityCategories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.name)}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-[#F3F4F6] hover:border-[#FF9B82] hover:shadow-md transition-all duration-200"
              >
                <div className={`w-16 h-16 ${category.color} rounded-2xl flex items-center justify-center`}>
                  <Icon size={32} className={category.iconColor} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#1F2937]">{category.name}</span>
              </button>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-[#F9FAFB] rounded-2xl border border-[#F3F4F6]">
          <p className="text-sm text-[#6B7280] text-center">
            관심 있는 커뮤니티를 선택하여<br />
            일정과 정보를 공유해보세요!
          </p>
        </div>
      </div>
    </div>
  );
}
