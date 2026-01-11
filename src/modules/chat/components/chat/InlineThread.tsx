import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useSocketEvent, useSocketEmit } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';
import { useEmojiPresetsStore } from '../../stores/emojiPresetsStore';
import { generateUUID } from '../../utils/uuid';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Message {
  id: string;
  channel_id?: string;
  content: string;
  type: string;
  sender: { id: string; display_name: string; avatar_url: string | null; avatar_color: string | null };
  created_at: string;
  is_edited: boolean;
  thread_count: number;
  parent_id?: string | null;
  reactions?: Array<{ emoji: string; count: number; has_reacted: boolean }>;
}

interface ProfileUpdateData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface InlineThreadProps {
  parentId: string;
  channelId: string;
  depth?: number;
}

const MAX_DEPTH = 5; // 최대 중첩 깊이

function ReplyItem({
  reply,
  channelId,
  depth,
  onReaction,
}: {
  reply: Message;
  channelId: string;
  depth: number;
  onReaction: (messageId: string, emoji: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emit = useSocketEmit();
  const { emojis: emojiList } = useEmojiPresetsStore();
  const formattedTime = format(new Date(reply.created_at), 'a h:mm', { locale: ko });

  // Parse content to extract text and images
  const parseContent = (content: string) => {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: string[] = [];
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      const imageUrl = getAbsoluteUrl(match[2]) || match[2];
      images.push(imageUrl);
    }
    const text = content.replace(imageRegex, '').replace(/<[^>]*>/g, '').trim();
    return { text, images };
  };

  const { text: displayContent, images } = parseContent(reply.content);

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    emit('message:send', {
      channel_id: channelId,
      content: replyContent.trim(),
      type: 'text',
      parent_id: reply.id,
      temp_id: generateUUID(),
    });
    setReplyContent('');
    setShowReplyInput(false);
    setIsExpanded(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
    if (e.key === 'Escape') {
      setShowReplyInput(false);
      setReplyContent('');
    }
  };

  return (
    <div className="relative">
      {/* 연결선 */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

      <div className="flex gap-2 pl-8 py-2 hover:bg-gray-50 rounded group relative">
        {/* 가로 연결선 */}
        <div className="absolute left-4 top-5 w-4 h-px bg-gray-200" />

        <div className="flex-shrink-0">
          {getAbsoluteUrl(reply.sender?.avatar_url) ? (
            <img src={getAbsoluteUrl(reply.sender?.avatar_url)!} alt={reply.sender.display_name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: reply.sender?.avatar_color || '#3B82F6' }}
            >
              {reply.sender?.display_name?.[0] || '?'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-gray-900 text-sm">{reply.sender?.display_name || '알 수 없음'}</span>
            <span className="text-xs text-gray-500">{formattedTime}</span>
            {reply.is_edited && <span className="text-xs text-gray-400">(수정됨)</span>}
          </div>

          {displayContent && (
            <div className="text-gray-700 text-sm mt-0.5 whitespace-pre-wrap break-words">{displayContent}</div>
          )}

          {images.length > 0 && (
            <div className="mt-1 space-y-1">
              {images.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt="첨부 이미지"
                  className="max-w-xs max-h-40 object-contain rounded border border-gray-200 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(src, '_blank')}
                />
              ))}
            </div>
          )}

          {/* 리액션 표시 */}
          {reply.reactions && reply.reactions.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {reply.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => onReaction(reply.id, reaction.emoji)}
                  className={`px-1.5 py-0.5 rounded-full text-xs border ${
                    reaction.has_reacted ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-200'
                  }`}
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          )}

          {/* 답글 수 및 확장 버튼 */}
          <div className="flex items-center gap-2 mt-1">
            {reply.thread_count > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 text-xs hover:underline"
              >
                {isExpanded ? '답글 접기' : `${reply.thread_count}개의 답글`}
              </button>
            )}
            {depth < MAX_DEPTH && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-gray-500 text-xs hover:text-blue-600"
              >
                답글
              </button>
            )}
          </div>

          {/* 인라인 답글 입력 */}
          {showReplyInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="답글을 입력하세요..."
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleSendReply}
                disabled={!replyContent.trim()}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                전송
              </button>
            </div>
          )}
        </div>

        {/* 호버 액션 버튼 */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1 bg-white shadow-md rounded-lg border p-1">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm"
              title="반응 추가"
            >
              😊
            </button>
            {depth < MAX_DEPTH && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm"
                title="답글 달기"
              >
                💬
              </button>
            )}
          </div>
          {showEmojiPicker && (
            <div className="absolute right-0 top-8 bg-white shadow-lg rounded-lg border p-2 flex gap-1 z-10">
              {emojiList.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction(reply.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:bg-gray-100 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 중첩 답글 */}
      {isExpanded && reply.thread_count > 0 && (
        <div className="ml-4">
          <InlineThread parentId={reply.id} channelId={channelId} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

export default function InlineThread({ parentId, channelId, depth = 1 }: InlineThreadProps) {
  const queryClient = useQueryClient();
  const emit = useSocketEmit();

  // Fetch thread replies
  const { data: replies = [], isLoading } = useQuery<Message[]>({
    queryKey: ['thread', parentId],
    queryFn: async () => {
      const response = await api.get(`/messages/${parentId}/thread`);
      return response.data.data;
    },
  });

  // Handle new message in thread
  const handleNewMessage = useCallback(
    (message: Message) => {
      if (message.parent_id === parentId) {
        queryClient.setQueryData<Message[]>(['thread', parentId], (old = []) => {
          // 중복 방지
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
      }
    },
    [parentId, queryClient]
  );
  useSocketEvent('message:new', handleNewMessage);

  // Handle thread:new for nested replies
  const handleThreadNew = useCallback(
    (data: { parent_id: string; message: Message }) => {
      // Update thread_count for replies in this thread
      queryClient.setQueryData<Message[]>(['thread', parentId], (old = []) =>
        old.map((msg) =>
          msg.id === data.parent_id ? { ...msg, thread_count: msg.thread_count + 1 } : msg
        )
      );
    },
    [parentId, queryClient]
  );
  useSocketEvent('thread:new', handleThreadNew);

  // Handle reaction update
  const handleReactionUpdate = useCallback(
    (data: { message_id: string; reactions: Message['reactions'] }) => {
      queryClient.setQueryData<Message[]>(['thread', parentId], (old = []) =>
        old.map((msg) => (msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg))
      );
    },
    [parentId, queryClient]
  );
  useSocketEvent('reaction:update', handleReactionUpdate);

  // Handle user profile updates - update sender info in thread replies
  const handleProfileUpdate = useCallback(
    (data: ProfileUpdateData) => {
      queryClient.setQueryData<Message[]>(['thread', parentId], (old = []) =>
        old.map((msg) =>
          msg.sender.id === data.user_id
            ? {
                ...msg,
                sender: {
                  ...msg.sender,
                  display_name: data.display_name,
                  avatar_url: data.avatar_url,
                  avatar_color: data.avatar_color,
                },
              }
            : msg
        )
      );
    },
    [parentId, queryClient]
  );
  useSocketEvent('user:profile_update', handleProfileUpdate);

  const handleReaction = (messageId: string, emoji: string) => {
    emit('reaction:toggle', { message_id: messageId, emoji });
  };

  if (isLoading) {
    return <div className="pl-8 py-2 text-sm text-gray-500">답글 로딩 중...</div>;
  }

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {replies.map((reply, index) => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          channelId={channelId}
          depth={depth}
          onReaction={handleReaction}
        />
      ))}
    </div>
  );
}
