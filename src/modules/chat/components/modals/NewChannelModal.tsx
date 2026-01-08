import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

interface NewChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
}

export default function NewChannelModal({ isOpen, onClose, onChannelCreated }: NewChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'group' | 'private'>('group');
  const queryClient = useQueryClient();

  const createChannel = useMutation({
    mutationFn: async () => {
      const response = await api.post('/channels', {
        name,
        description,
        type,
      });
      return response.data.data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      onChannelCreated(channel.id);
      setName('');
      setDescription('');
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createChannel.mutate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">새 채널 만들기</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              채널 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 프로젝트-회의"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="채널에 대한 설명을 입력하세요"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              채널 유형
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="group"
                  checked={type === 'group'}
                  onChange={() => setType('group')}
                  className="text-blue-500"
                />
                <span className="text-sm">공개 채널 - 모든 멤버가 참여 가능</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="private"
                  checked={type === 'private'}
                  onChange={() => setType('private')}
                  className="text-blue-500"
                />
                <span className="text-sm">비공개 채널 - 초대된 멤버만 참여</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createChannel.isPending}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {createChannel.isPending ? '생성 중...' : '채널 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
