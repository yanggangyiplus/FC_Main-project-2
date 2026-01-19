import { X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, children, size = 'md' }: ModalProps) {
  const widths = {
    sm: 'max-w-[400px]',
    md: 'max-w-[600px]',
    lg: 'max-w-[800px]'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-xl shadow-lg w-full ${widths[size]}`}
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  type?: 'warning' | 'error' | 'success' | 'info';
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type = 'warning',
  confirmText = '확인',
  cancelText = '취소'
}: ConfirmDialogProps) {
  const icons = {
    warning: { Icon: AlertTriangle, color: 'text-[#F59E0B]', bg: 'bg-[#FEF3C7]' },
    error: { Icon: AlertCircle, color: 'text-[#EF4444]', bg: 'bg-[#FEE2E2]' },
    success: { Icon: CheckCircle, color: 'text-[#10B981]', bg: 'bg-[#D1FAE5]' },
    info: { Icon: AlertCircle, color: 'text-[#6366F1]', bg: 'bg-[#EEF2FF]' }
  };

  const config = icons[type];
  const Icon = config.Icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <div className={`w-16 h-16 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon size={32} className={config.color} />
        </div>
        <h2 className="mb-3">{title}</h2>
        {description && (
          <p className="text-[#6B7280] mb-6">{description}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 h-12 rounded-lg text-white transition-colors ${type === 'error'
                ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                : 'bg-[#6366F1] hover:bg-[#5558E3]'
              }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface TodoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo: {
    id: string;
    title: string;
    completed?: boolean;
    time?: string;
    rule?: string;
    checklist?: Array<{ id: string; text: string; completed: boolean }>;
    notes?: string;
  };
}

export function TodoDetailModal({ isOpen, onClose, todo }: TodoDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#E5E7EB]">
          <div className="flex-1">
            <h2 className="mb-2">{todo.title}</h2>
            {todo.rule && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EEF2FF] text-xs text-[#6366F1]">
                🤖 [{todo.rule}] 룰에 의해 생성됨
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1">
            <X size={24} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {todo.time && (
            <div className="flex items-center gap-2 mb-6 text-[#6B7280]">
              <span>🕐</span>
              <span>{todo.time}</span>
            </div>
          )}

          {todo.checklist && todo.checklist.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs text-[#9CA3AF] uppercase mb-3">체크리스트</h4>
              <div className="space-y-2">
                {todo.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      className="w-5 h-5 rounded border-2 border-[#D1D5DB]"
                      readOnly
                    />
                    <span className={item.completed ? 'line-through text-[#9CA3AF]' : ''}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todo.notes && (
            <div>
              <h4 className="text-xs text-[#9CA3AF] uppercase mb-3">메모</h4>
              <p className="text-[#6B7280]">{todo.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#E5E7EB]">
          <button className="flex-1 h-12 border border-[#EF4444] text-[#EF4444] rounded-lg hover:bg-[#FEE2E2] transition-colors">
            삭제
          </button>
          <button className="flex-1 h-12 bg-[#6366F1] text-white rounded-lg hover:bg-[#5558E3] transition-colors">
            완료
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceModal({ isOpen, onClose }: VoiceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-[#6366F1] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h2 className="mb-2">음성으로 입력하기</h2>
          <p className="text-[#6B7280]">마이크 버튼을 눌러 시작하세요</p>
        </div>

        <div className="flex gap-3 mb-4">
          <button className="flex-1 h-10 border-b-2 border-[#6366F1] text-[#6366F1]">
            할 일
          </button>
          <button className="flex-1 h-10 text-[#9CA3AF]">
            일정
          </button>
          <button className="flex-1 h-10 text-[#9CA3AF]">
            메모
          </button>
        </div>

        <button className="w-20 h-20 bg-white border-2 border-[#6366F1] rounded-full flex items-center justify-center mx-auto mb-6 hover:bg-[#F9FAFB] transition-colors">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <button onClick={onClose} className="text-[#6B7280] hover:text-[#1F2937]">
          취소
        </button>
      </div>
    </Modal>
  );
}
