import { ArrowLeft, Users, Edit2, Trash2, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import { MemberAddSheet } from "./MemberAddSheet";

interface FamilyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
  phone?: string;
  memo?: string;
}

interface ProfileManagementScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: () => void; // 프로필 업데이트 시 부모 컴포넌트에 알림
}

export function ProfileManagementScreen({ isOpen, onClose, onProfileUpdate }: ProfileManagementScreenProps) {
  // 프로필 관리 상태
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showMemberAddSheet, setShowMemberAddSheet] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserEmoji, setCurrentUserEmoji] = useState("🐼");

  // 프로필 로드
  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  // 프로필 목록 로드
  const loadProfiles = async () => {
    try {
      // 현재 사용자 정보 로드
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse && userResponse.data) {
        setCurrentUserName(userResponse.data.name || "나");
        setCurrentUserEmoji(userResponse.data.avatar_emoji || "🐼");
      }

      // 가족 구성원 로드
      const familyResponse = await apiClient.getFamilyMembers();
      if (familyResponse.data && Array.isArray(familyResponse.data)) {
        const defaultColors = [
          "#9B82FF",
          "#9ae3a9",
          "#FFD482",
          "#82D4FF",
          "#FF82D4",
          "#FF9B82",
        ];

        const formattedMembers = familyResponse.data.map((member: any, index: number) => {
          let memberColor = member.color_code || member.color;
          if (!memberColor || memberColor.trim() === '') {
            memberColor = defaultColors[index % defaultColors.length];
          }

          return {
            id: member.id,
            name: member.name,
            emoji: member.emoji || "🐼",
            color: memberColor,
            phone: member.phone_number,
            memo: member.notes,
          };
        });

        // "나" 항목을 맨 앞에 추가
        formattedMembers.unshift({
          id: "me",
          name: currentUserName || "나",
          emoji: currentUserEmoji || "🐼",
          color: "rgba(255, 155, 130, 0.6)",
        });

        setFamilyMembers(formattedMembers);
      }
    } catch (error) {
      console.error("프로필 로드 실패:", error);
    }
  };

  // 프로필 저장 핸들러
  const handleSaveMember = async (member: { name: string; phone: string; memo: string; emoji: string; color?: string }) => {
    try {
      if (editingMemberId) {
        if (editingMemberId === "me") {
          const userData = {
            name: member.name,
            avatar_emoji: member.emoji,
          };
          const userResponse = await apiClient.updateUser(userData);
          if (userResponse && userResponse.data) {
            setCurrentUserName(member.name);
            setCurrentUserEmoji(member.emoji);
            setFamilyMembers((prev) =>
              prev.map((m) =>
                m.id === "me"
                  ? { ...m, name: member.name, emoji: member.emoji }
                  : m
              )
            );
            toast.success(`${member.name}님이 수정되었습니다!`);
            setEditingMemberId(null);
            setShowMemberAddSheet(false);
            if (onProfileUpdate) onProfileUpdate();
          }
          return;
        }

        // 랜덤 색상 생성 (hex 형식)
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        const memberData: any = {
          name: member.name,
          emoji: member.emoji || "🐼",
          color: member.color || hexColor,
          relation: "other",
        };
        
        // phone_number와 notes는 스키마에 없을 수 있으므로 조건부로 추가
        if (member.phone) {
          memberData.phone_number = member.phone;
        }
        if (member.memo) {
          memberData.notes = member.memo;
        }

        const response = await apiClient.updateFamilyMember(editingMemberId, memberData);
        if (response && response.data) {
          setFamilyMembers((prev) =>
            prev.map((m) =>
              m.id === editingMemberId
                ? {
                    ...m,
                    name: member.name,
                    emoji: member.emoji,
                    phone: member.phone,
                    memo: member.memo,
                    color: member.color || m.color,
                  }
                : m
            )
          );
          toast.success(`${member.name}님이 수정되었습니다!`);
          setEditingMemberId(null);
          setShowMemberAddSheet(false);
          if (onProfileUpdate) onProfileUpdate();
        }
      } else {
        // 랜덤 색상 생성 (rgba 형식이 아닌 hex 형식으로)
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        const memberData = {
          name: member.name,
          emoji: member.emoji || "🐼",
          color: member.color || hexColor,
          relation: "other",
          phone_number: member.phone || null,
          notes: member.memo || null,
        };

        console.log("프로필 추가 요청 데이터:", memberData);
        const response = await apiClient.createFamilyMember(memberData);
        console.log("프로필 추가 응답:", response);
        
        if (response && response.data) {
          const newMember: FamilyMember = {
            id: response.data.id,
            name: member.name,
            emoji: member.emoji || "🐼",
            color: response.data.color_code || response.data.color || hexColor,
            phone: response.data.phone_number,
            memo: response.data.notes,
          };
          setFamilyMembers((prev) => [...prev, newMember]);
          toast.success(`${member.name}님이 추가되었습니다!`);
          setShowMemberAddSheet(false);
          if (onProfileUpdate) onProfileUpdate();
        } else {
          console.error("응답 데이터가 없습니다:", response);
          toast.error("프로필 추가에 실패했습니다. 응답 데이터가 없습니다.");
        }
      }
    } catch (error: any) {
      console.error("프로필 저장 실패:", error);
      toast.error(`프로필 저장에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
    }
  };

  // 프로필 삭제 핸들러
  const handleDeleteMember = async (memberId: string) => {
    const member = familyMembers.find(m => m.id === memberId);
    if (member && window.confirm(`${member.name}님을 삭제하시겠습니까?`)) {
      try {
        if (memberId === "me") {
          toast.error("기본 사용자는 삭제할 수 없습니다.");
          return;
        }

        const response = await apiClient.deleteFamilyMember(memberId);
        setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
        toast.success(`${member.name}님이 삭제되었습니다.`);
        if (onProfileUpdate) onProfileUpdate();
      } catch (error: any) {
        console.error("프로필 삭제 실패:", error);
        toast.error(`프로필 삭제에 실패했습니다: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col max-w-[375px] mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-[#F3F4F6]">
        <button onClick={onClose} className="p-1">
          <ArrowLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="flex-1 font-semibold text-[#1F2937]">프로필 관리</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#FAFAFA]">
        {/* Profile Management */}
        <div className="bg-white p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-[#1F2937]">프로필 관리</h3>
            <button
              onClick={() => {
                setEditingMemberId(null);
                setShowMemberAddSheet(true);
              }}
              className="px-3 py-1.5 text-sm font-medium bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
              추가
            </button>
          </div>
          <div className="space-y-2">
            {familyMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                    style={{
                      backgroundColor: member.color.startsWith('#')
                        ? member.color
                        : member.color.replace(/,\s*[\d.]+\)$/, ', 0.2)'),
                    }}
                  >
                    {member.emoji}
                  </div>
                  <div>
                    <div className="font-medium text-[#1F2937]">{member.name}</div>
                    {member.id === "me" && (
                      <div className="text-xs text-[#6B7280]">기본 사용자</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingMemberId(member.id);
                      setShowMemberAddSheet(true);
                    }}
                    className="p-1.5 rounded-lg bg-[#6366F1] text-white hover:bg-[#5558E3] transition-colors"
                    title="수정"
                  >
                    <Edit2 size={14} />
                  </button>
                  {member.id !== "me" && (
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      className="p-1.5 rounded-lg bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member Add Sheet */}
      {showMemberAddSheet && (
        <MemberAddSheet
          isOpen={showMemberAddSheet}
          onClose={() => {
            setShowMemberAddSheet(false);
            setEditingMemberId(null);
          }}
          onSave={handleSaveMember}
          initialData={
            editingMemberId
              ? familyMembers.find((m) => m.id === editingMemberId)
              : undefined
          }
        />
      )}
    </div>
  );
}

