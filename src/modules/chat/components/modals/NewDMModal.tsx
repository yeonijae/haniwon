import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string | null;
  status: string;
}

interface NewDMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
}

export default function NewDMModal({ isOpen, onClose, onChannelCreated }: NewDMModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await api.get(`/users?q=${encodeURIComponent(searchQuery)}`);
      return response.data.data;
    },
    enabled: searchQuery.length > 0,
  });

  const createDM = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post('/channels/direct', { user_id: userId });
      return response.data.data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      onChannelCreated(channel.id);
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">새 대화 시작</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 또는 이메일로 검색..."
            className="mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">검색 중...</div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? '검색 결과가 없습니다' : '사용자 이름을 입력하세요'}
            </div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => createDM.mutate(user.id)}
                disabled={createDM.isPending}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0"
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
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{user.display_name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
