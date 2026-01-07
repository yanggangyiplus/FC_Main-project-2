import { useState, useEffect } from 'react';
import { X, Smile, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

// 중복 제거된 이모지 리스트 (동물 + 사람)
const EMOJI_LIST = [
  // 동물 이모지
  "🐼", "🐻", "🐨", "🐯", "🦁", "🐶", "🐱", "🐰", "🐭", "🐹", "🐷", "🐸", "🐵", "🦊", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦡", "🐾", "🦃", "🐓", "🐔", "🐣", "🐤", "🐥", "🐦", "🐧", "🦅", "🦆", "🦢", "🦉", "🦩", "🦚", "🦜", "🐦‍⬛", "🪿", "🦤", "🪶",
  // 사람 이모지
  "👤", "👥", "👨", "👩", "👨‍🦱", "👩‍🦱", "👨‍🦰", "👩‍🦰", "👨‍🦳", "👩‍🦳", "👨‍🦲", "👩‍🦲", "👶", "👧", "👦", "🧑", "🧑‍🦱", "🧑‍🦰", "🧑‍🦳", "🧑‍🦲", "👨‍👩‍👧", "👨‍👩‍👦", "👨‍👩‍👧‍👦", "👨‍👨‍👦", "👩‍👩‍👧", "👴", "👵", "🧓", "👱", "👱‍♂️", "👱‍♀️"
];

interface MemberAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (member: { name: string; phone: string; memo: string; emoji: string }) => void;
  initialData?: { id?: string; name?: string; phone?: string; memo?: string; emoji?: string };
}

export function MemberAddSheet({ isOpen, onClose, onSave, initialData }: MemberAddSheetProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [emoji, setEmoji] = useState(initialData?.emoji || '🐼');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSave = () => {
    if (!name) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    
    // Validate memo length (though maxlength attribute handles it mostly)
    if (memo.length > 30) {
      toast.error('소개는 30자 이내로 입력해주세요.');
      return;
    }

    if (onSave) {
      onSave({ name, phone, memo, emoji });
    } else {
      toast.success('멤버가 추가되었습니다.');
    }
    
    // Reset and close
    setName('');
    setPhone('');
    setMemo('');
    setEmoji('🐼');
    onClose();
  };

  // initialData가 변경될 때 form 업데이트
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');
      setMemo(initialData.memo || '');
      setEmoji(initialData.emoji || '🐼');
    } else {
      setName('');
      setPhone('');
      setMemo('');
      setEmoji('🐼');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-[375px] mx-auto bg-white rounded-t-[20px] shadow-2xl" style={{ height: '70vh' }}>
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-[#F3F4F6] rounded-t-[20px]">
        <h2 className="font-bold text-[#1F2937]">멤버 추가</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
        >
          <X size={24} className="text-[#6B7280]" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto" style={{ height: 'calc(70vh - 64px - 80px)' }}>
        <p className="text-sm text-[#6B7280] mb-6">
          새로운 가족 구성원이나 지인을 목록에 추가합니다.
        </p>

        <div className="space-y-6">
          {/* Profile Emoji */}
          <div className="space-y-2">
            <Label className="text-base font-medium">프로필 이모지</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center">
                  <span className="text-4xl">{emoji}</span>
                </div>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-[#FF9B82] rounded-full flex items-center justify-center border-2 border-white shadow-lg hover:bg-[#FF8A6D] transition-colors"
                >
                  <Smile size={14} className="text-white" />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#6B7280]">프로필에 표시될 이모지를 선택하세요</p>
              </div>
            </div>
          </div>

          {/* Emoji Picker Modal */}
          {showEmojiPicker && (
            <>
              <div
                className="fixed inset-0 bg-black/20 z-50"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl z-[60] border-2 border-[#E5E7EB] p-4 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#1F2937]">이모지 선택</h3>
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  >
                    <ArrowLeft size={20} className="text-[#6B7280]" />
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {EMOJI_LIST.map((emojiOption, index) => (
                    <button
                      key={`emoji-${index}-${emojiOption}`}
                      onClick={() => {
                        setEmoji(emojiOption);
                        setShowEmojiPicker(false);
                      }}
                      className={`w-10 h-10 text-2xl rounded-lg hover:bg-[#F3F4F6] transition-colors flex items-center justify-center ${
                        emoji === emojiOption ? 'bg-[#FFE8E0] ring-2 ring-[#FF9B82]' : ''
                      }`}
                    >
                      {emojiOption}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-medium">이름</Label>
            <Input
              id="name"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-lg bg-[#F9FAFB] border-[#E5E7EB]"
            />
          </div>

          {/* Phone Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-base font-medium">전화번호</Label>
            <Input
              id="phone"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 text-lg bg-[#F9FAFB] border-[#E5E7EB]"
              type="tel"
            />
          </div>

          {/* Memo Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="memo" className="text-base font-medium">간단 소개</Label>
              <span className="text-xs text-[#9CA3AF]">{memo.length}/30자</span>
            </div>
            <Textarea
              id="memo"
              placeholder="멤버에 대한 간단한 설명을 입력하세요 (30자 이내)"
              value={memo}
              onChange={(e) => {
                if (e.target.value.length <= 30) {
                  setMemo(e.target.value);
                }
              }}
              className="min-h-[100px] bg-[#F9FAFB] border-[#E5E7EB] resize-none text-base"
              maxLength={30}
            />
          </div>
        </div>
      </div>

      {/* Footer Button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[375px] mx-auto bg-white border-t border-[#E5E7EB] p-4">
        <Button 
          onClick={handleSave}
          className="w-full h-14 text-lg font-bold bg-[#FF9B82] hover:bg-[#FF8A6D] text-white rounded-xl"
        >
          추가하기
        </Button>
      </div>
    </div>
  );
}