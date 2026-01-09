import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  avatar_color: string | null;
  status: string;
  role: string;
  joined_at: string;
}

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

export default function ChannelMembersModal({ isOpen, onClose, channelId, channelName }: ChannelMembersModalProps) {
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['channelMembers', channelId],
    queryFn: async () => {
      const response = await api.get(`/channels/${channelId}/members`);
      return response.data.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return '온라인';
      case 'away': return '자리 비움';
      case 'busy': return '바쁨';
      default: return '오프라인';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">참여자 목록</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">#{channelName} ({members.length}명)</p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">로딩 중...</div>
          ) : members.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              참여자가 없습니다
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.user_id}
                className="p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="relative">
                  {getAbsoluteUrl(member.avatar_url) ? (
                    <img
                      src={getAbsoluteUrl(member.avatar_url)!}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: member.avatar_color || '#3B82F6' }}
                    >
                      {member.display_name?.[0] || '?'}
                    </div>
                  )}
                  {/* Status indicator */}
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                    title={getStatusText(member.status)}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {member.display_name}
                    {member.role === 'admin' && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">관리자</span>
                    )}
                    {member.role === 'owner' && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">소유자</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                </div>
                <div className="text-xs text-gray-400">
                  {getStatusText(member.status)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
