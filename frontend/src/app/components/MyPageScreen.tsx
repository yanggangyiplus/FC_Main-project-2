import { ArrowLeft, Edit2, User, Smile } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MyPageScreenProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  selectedEmoji: string;
  onUserNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
}

// 중복 제거된 이모지 리스트 (동물 + 사람)
const EMOJI_LIST = [
  // 동물 이모지
  "🐼", "🐻", "🐨", "🐯", "🦁", "🐶", "🐱", "🐰", "🐭", "🐹", "🐷", "🐸", "🐵", "🦊", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦡", "🐾", "🦃", "🐓", "🐔", "🐣", "🐤", "🐥", "🐦", "🐧", "🦅", "🦆", "🦢", "🦉", "🦩", "🦚", "🦜", "🐦‍⬛", "🪿", "🦤", "🪶",
  // 사람 이모지
  "👤", "👥", "👨", "👩", "👨‍🦱", "👩‍🦱", "👨‍🦰", "👩‍🦰", "👨‍🦳", "👩‍🦳", "👨‍🦲", "👩‍🦲", "👶", "👧", "👦", "🧑", "🧑‍🦱", "🧑‍🦰", "🧑‍🦳", "🧑‍🦲", "👨‍👩‍👧", "👨‍👩‍👦", "👨‍👩‍👧‍👦", "👨‍👨‍👦", "👩‍👩‍👧", "👴", "👵", "🧓", "👱", "👱‍♂️", "👱‍♀️"
];

export function MyPageScreen({ isOpen, onClose, userName, userEmail, selectedEmoji, onUserNameChange, onEmojiChange }: MyPageScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (tempName.trim()) {
      onUserNameChange(tempName.trim());
      setIsEditing(false);
      toast.success("이름이 변경되었습니다!");
    } else {
      toast.error("이름을 입력해주세요.");
    }
  };

  const handleCancel = () => {
    setTempName(userName);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col max-w-[375px] mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-[#F3F4F6]">
        <button onClick={onClose} className="p-1">
          <ArrowLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="flex-1 font-semibold text-[#1F2937]">마이페이지</h1>
      </div>

      {/* Profile Section */}
      <div className="flex-1 overflow-auto bg-[#FAFAFA]">
        <div className="bg-white p-6 mb-4">
          <div className="flex flex-col items-center">
            {/* Profile Image with Emoji Picker Button */}
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD4C8] to-[#FF9B82] flex items-center justify-center">
                <span className="text-5xl">{selectedEmoji}</span>
              </div>
              {/* Emoji Picker Button - 우측 하단 원에 걸치게 */}
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute bottom-0 right-0 w-8 h-8 bg-[#FF9B82] rounded-full flex items-center justify-center border-2 border-white shadow-lg hover:bg-[#FF8A6D] transition-colors"
              >
                <Smile size={16} className="text-white" />
              </button>
            </div>

            {/* Emoji Picker Modal */}
            {showEmojiPicker && (
              <>
                <div
                  className="fixed inset-0 bg-black/20 z-40"
                  onClick={() => setShowEmojiPicker(false)}
                />
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl z-50 border-2 border-[#E5E7EB] p-4 max-h-[60vh] overflow-y-auto">
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
                    {EMOJI_LIST.map((emoji, index) => (
                      <button
                        key={`emoji-${index}-${emoji}`}
                        onClick={() => {
                          onEmojiChange(emoji);
                          setShowEmojiPicker(false);
                          toast.success("프로필 이모지가 변경되었습니다!");
                        }}
                        className={`w-10 h-10 text-2xl rounded-lg hover:bg-[#F3F4F6] transition-colors flex items-center justify-center ${selectedEmoji === emoji ? 'bg-[#FFE8E0] ring-2 ring-[#FF9B82]' : ''
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Name Section */}
            <div className="w-full max-w-sm">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F9FAFB] rounded-lg text-center text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#FF9B82] transition-all"
                    placeholder="이름을 입력하세요"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2.5 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2.5 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-xl font-semibold text-[#1F2937]">{userName}</h2>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setTempName(userName);
                    }}
                    className="p-2 bg-[#FFF0EB] rounded-lg hover:bg-[#FFE8E0] transition-colors"
                  >
                    <Edit2 size={16} className="text-[#FF9B82]" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="bg-white p-6">
          <h3 className="font-medium text-[#1F2937] mb-4">계정 정보</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
              <span className="text-[#6B7280]">이메일</span>
              <span className="text-[#1F2937]">{userEmail}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
              <span className="text-[#6B7280]">가입일</span>
              <span className="text-[#1F2937]">2024.01.05</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
              <span className="text-[#6B7280]">멤버십</span>
              <span className="text-[#FF9B82] font-medium">프리미엄</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
