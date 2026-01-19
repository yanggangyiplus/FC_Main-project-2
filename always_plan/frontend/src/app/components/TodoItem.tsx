import { Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface TodoItemProps {
  id: string;
  title: string;
  time?: string;
  rule?: string;
  completed?: boolean;
  draft?: boolean;
  overdue?: boolean;
  onToggle?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
}

export function TodoItem({
  id,
  title,
  time,
  rule,
  completed = false,
  draft = false,
  overdue = false,
  onToggle,
  onConfirm,
  onDelete,
  onClick
}: TodoItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        h-[72px] bg-white flex items-center px-4 gap-3
        ${draft ? 'border border-dashed border-[#6366F1]' : 'border-b border-[#F3F4F6]'}
        ${overdue ? 'border-l-4 border-l-[#EF4444]' : ''}
        ${completed ? 'bg-[#F9FAFB] opacity-50' : ''}
      `}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle?.(id)}
        className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${completed ? 'bg-[#6366F1] border-[#6366F1] scale-100' : 'border-[#D1D5DB] hover:border-[#6366F1]'}
        `}
      >
        {completed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Check size={16} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={() => onClick?.(id)}>
        <div className={`truncate ${completed ? 'line-through text-[#9CA3AF]' : 'text-[#1F2937]'}`}>
          {title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {time && (
            <span className="text-xs text-[#9CA3AF]">{time}</span>
          )}
          {rule && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF2FF] text-xs text-[#6366F1]">
              🤖 {rule}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {draft ? (
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm?.(id)}
            className="px-3 py-1 text-xs bg-[#6366F1] text-white rounded hover:bg-[#5558E3]"
          >
            확인
          </button>
          <button
            onClick={() => onDelete?.(id)}
            className="px-3 py-1 text-xs border border-[#EF4444] text-[#EF4444] rounded hover:bg-[#FEE2E2]"
          >
            삭제
          </button>
        </div>
      ) : (
        <ChevronRight size={20} className="text-[#D1D5DB]" />
      )}
    </motion.div>
  );
}
