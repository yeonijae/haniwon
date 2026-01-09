import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';
import { useAuthStore } from '../../stores/authStore';

interface User {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string | null;
  status: string;
}

interface ChannelMember {
  id: string;
  role: string;
}

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

export default function InviteMemberModal({ isOpen, onClose, channelId, channelName }: InviteMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  // 채널 멤버 목록 조회 (이미 있는 멤버 제외 + 현재 유저 role 확인)
  const { data: channelMembers = [] } = useQuery<ChannelMember[]>({
    queryKey: ['channel-members', channelId],
    queryFn: async () => {
      const response = await api.get(`/channels/${channelId}/members`);
      return response.data.data;
    },
    enabled: isOpen,
  });

  // 현재 유저가 admin인지 확인
  const currentUserRole = channelMembers.find(m => m.id === currentUser?.id)?.role;
  const isAdmin = currentUserRole === 'admin';

  // 모든 사용자 목록 조회
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.data;
    },
    enabled: isOpen,
  });

  // 이미 채널에 있는 멤버 ID 목록
  const existingMemberIds = new Set(channelMembers.map(m => m.id));

  // 초대 가능한 사용자 (채널에 없는 사용자만)
  const availableUsers = allUsers.filter(u => !existingMemberIds.has(u.id));

  // 검색 필터 적용
  const filteredUsers = searchQuery.trim()
    ? availableUsers.filter(u =>
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableUsers;

  const inviteMembers = useMutation({
    mutationFn: async () => {
      const userIds = selectedUsers.map(u => u.id);
      await api.post(`/channels/${channelId}/members`, { user_ids: userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel', channelId] });
      setSelectedUsers([]);
      setSearchQuery('');
      onClose();
    },
  });

  if (!isOpen) return null;

  const toggleUser = (user: User) => {
    setSelectedUsers(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleInvite = () => {
    if (selectedUsers.length > 0) {
      inviteMembers.mutate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">멤버 초대</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">#{channelName}에 초대</p>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 또는 이메일로 검색..."
            className="mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {selectedUsers.length > 0 && (
          <div className="p-3 border-b bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {user.display_name}
                  <button
                    onClick={() => toggleUser(user)}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-60 overflow-y-auto">
          {!isAdmin ? (
            <div className="p-4 text-center text-gray-500">
              채널 관리자만 멤버를 초대할 수 있습니다.
            </div>
          ) : isLoading ? (
            <div className="p-4 text-center text-gray-500">로딩 중...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? '검색 결과가 없습니다' : '초대 가능한 사용자가 없습니다'}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUsers.some(u => u.id === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="relative">
                    {getAbsoluteUrl(user.avatar_url) ? (
                      <img src={getAbsoluteUrl(user.avatar_url)!} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: user.avatar_color || '#3B82F6' }}
                      >
                        {user.display_name?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{user.display_name}</div>
                  </div>
                  {isSelected && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleInvite}
            disabled={!isAdmin || selectedUsers.length === 0 || inviteMembers.isPending}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {inviteMembers.isPending
              ? '초대 중...'
              : selectedUsers.length > 0
                ? `${selectedUsers.length}명 초대하기`
                : '초대할 멤버를 선택하세요'}
          </button>
        </div>
      </div>
    </div>
  );
}
