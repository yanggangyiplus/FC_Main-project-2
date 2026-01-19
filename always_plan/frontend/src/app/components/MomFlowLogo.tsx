import { Calendar, Heart } from 'lucide-react';

export function MomFlowLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 16, text: 'text-lg' },
    md: { icon: 24, text: 'text-2xl' },
    lg: { icon: 32, text: 'text-4xl' }
  };

  const config = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Calendar size={config.icon} className="text-[#6366F1]" />
        <Heart size={config.icon * 0.5} className="absolute -bottom-1 -right-1 text-[#F59E0B] fill-[#F59E0B]" />
      </div>
      <span className={`${config.text} font-bold text-[#6366F1]`}>Always Plan</span>
    </div>
  );
}
