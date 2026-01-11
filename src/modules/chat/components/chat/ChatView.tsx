import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useSocketEvent, useSocketEmit } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import { generateUUID } from '../../utils/uuid';
import MessageItem from './MessageItem';
import MessageInput, { MessageInputHandle } from './MessageInput';

interface Message {
  id: string;
  channel_id?: string;
  content: string;
  type: string;
  sender: { id: string; display_name: string; avatar_url: string | null; avatar_color: string | null; };
  created_at: string;
  is_edited: boolean;
  thread_count: number;
  parent_id?: string | null;
  reactions?: Array<{ emoji: string; count: number; has_reacted: boolean; }>;
  read_by?: Array<{ user_id: string; read_at: string; }>;
}

interface ProfileUpdateData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Channel {
  id: string;
  type: 'direct' | 'group' | 'topic';
  name: string | null;
  last_read_message_id: string | null;
  unread_count: number;
}

interface TypingUser { user_id: string; display_name: string; }
interface ChatViewProps {
  channelId: string;
  targetMessageId?: string | null;
  onTargetMessageReached?: () => void;
  shortcutNumber?: number; // 1-9 for Ctrl+N shortcut hint
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>; // For drag handle on header
  isSelected?: boolean; // 사용자가 직접 클릭해서 선택한 경우에만 true
}

export interface ChatViewHandle {
  focusInput: () => void;
}

const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(({ channelId, targetMessageId, onTargetMessageReached, shortcutNumber, dragHandleProps, isSelected = false }, ref) => {
  const [inputValue, setInputValue] = useState('');
  const messageInputRef = useRef<MessageInputHandle>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      messageInputRef.current?.focus();
    },
  }));
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showNewMessageDivider, setShowNewMessageDivider] = useState(true);
  const [showUnreadBackground, setShowUnreadBackground] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasScrolledToUnreadRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 초기 last_read_message_id를 저장해서 읽음 처리 후에도 구분선/배경색 유지
  const initialLastReadIdRef = useRef<string | null>(null);
  const dividerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const lastMarkedRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const emit = useSocketEmit();
  const { user } = useAuthStore();

  const { data: channel } = useQuery<Channel>({
    queryKey: ['channel', channelId],
    queryFn: async () => { const response = await api.get(`/channels/${channelId}`); return response.data.data; },
  });

  const { data: messages = [], isLoading, refetch } = useQuery<Message[]>({
    queryKey: ['messages', channelId],
    queryFn: async () => {
      const response = await api.get(`/channels/${channelId}/messages`);
      return response.data.data;
    },
  });

  // targetMessageId가 설정되면 해당 메시지 주변을 로드
  const loadedAroundRef = useRef<string | null>(null);

  useEffect(() => {
    if (targetMessageId && !isLoading && loadedAroundRef.current !== targetMessageId) {
      // 현재 로드된 메시지에 target이 있는지 확인
      const messageExists = messages.some(m => m.id === targetMessageId);
      if (!messageExists) {
        loadedAroundRef.current = targetMessageId;
        // 해당 메시지 주변을 로드
        api.get(`/channels/${channelId}/messages?around_message_id=${targetMessageId}`)
          .then(response => {
            queryClient.setQueryData(['messages', channelId], response.data.data);
          })
          .catch(err => console.error('Failed to load messages around target:', err));
      }
    }
    // targetMessageId가 null로 바뀌면 ref 초기화
    if (!targetMessageId) {
      loadedAroundRef.current = null;
    }
  }, [targetMessageId, channelId, messages, isLoading, queryClient]);

  useEffect(() => {
    // 채널 변경 시 상태 초기화
    hasScrolledToTargetRef.current = false;
    loadedAroundRef.current = null;
    lastMarkedRef.current = null;
    hasScrolledToUnreadRef.current = false;
    initialLastReadIdRef.current = null; // 초기 읽음 위치 리셋
    setShowNewMessageDivider(true);
    setShowUnreadBackground(true);
    // 이전 타이머 정리
    if (dividerTimerRef.current) clearTimeout(dividerTimerRef.current);
    if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
    emit('channel:join', { channel_id: channelId });
    return () => { emit('channel:leave', { channel_id: channelId }); };
  }, [channelId, emit]);

  // 채널 데이터 로드 시 또는 선택 시 초기 last_read_message_id 저장
  useEffect(() => {
    if (isSelected && channel?.id === channelId && channel?.last_read_message_id && initialLastReadIdRef.current === null) {
      initialLastReadIdRef.current = channel.last_read_message_id;
    }
  }, [isSelected, channelId, channel?.id, channel?.last_read_message_id]);

  // 선택 해제 시 상태 리셋 (다음 선택 또는 새 메시지를 위해)
  useEffect(() => {
    if (!isSelected) {
      // 선택 해제되면 상태 리셋하여 새 메시지가 읽지 않음으로 표시되도록
      initialLastReadIdRef.current = null;
      hasScrolledToUnreadRef.current = false;
      setShowNewMessageDivider(true);
      setShowUnreadBackground(true);
      // 타이머 정리
      if (dividerTimerRef.current) clearTimeout(dividerTimerRef.current);
      if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
    }
  }, [isSelected]);

  // 채널 선택 시 읽지 않은 첫 메시지로 스크롤
  useEffect(() => {
    const lastReadId = initialLastReadIdRef.current || channel?.last_read_message_id;
    if (!isSelected || !lastReadId || messages.length === 0 || hasScrolledToUnreadRef.current) return;

    const lastReadIndex = messages.findIndex(m => m.id === lastReadId);
    if (lastReadIndex === -1 || lastReadIndex >= messages.length - 1) {
      // 읽지 않은 메시지가 없으면 맨 아래로
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 읽지 않은 첫 메시지로 스크롤 (DOM 렌더링 대기)
    const firstUnreadMessage = messages[lastReadIndex + 1];
    if (firstUnreadMessage) {
      // DOM이 준비될 때까지 약간 대기
      requestAnimationFrame(() => {
        const element = document.getElementById(`message-${firstUnreadMessage.id}`);
        if (element && !hasScrolledToUnreadRef.current) {
          hasScrolledToUnreadRef.current = true;
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // 스크롤 후 1초 뒤에 배경색 숨기기
          if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = setTimeout(() => {
            setShowUnreadBackground(false);
          }, 1000);

          // 스크롤 후 5초 뒤에 구분선 숨기기
          if (dividerTimerRef.current) clearTimeout(dividerTimerRef.current);
          dividerTimerRef.current = setTimeout(() => {
            setShowNewMessageDivider(false);
          }, 5000);
        }
      });
    }
    // cleanup에서 타이머 취소하지 않음 - 채널 변경 시에만 취소됨
  }, [channelId, isSelected, channel?.last_read_message_id, messages]);

  const handleNewMessage = useCallback((message: Message) => {
    if (message.channel_id === channelId && !message.parent_id) {
      // Only add to main message list if it's not a thread reply
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) => [...old, message]);
      // 선택된 채널에서만 읽음 처리
      if (isSelected && message.sender.id !== user?.id) {
        emit('message:read', { channel_id: channelId, message_id: message.id });
      }
      // 채널 목록 갱신 (unread_count 업데이트)
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    }
  }, [channelId, queryClient, emit, user?.id, isSelected]);
  useSocketEvent('message:new', handleNewMessage);

  // Handle thread:new event to update parent message's thread_count
  const handleThreadNew = useCallback((data: { parent_id: string; message: Message }) => {
    queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) =>
      old.map((msg) => msg.id === data.parent_id ? { ...msg, thread_count: msg.thread_count + 1 } : msg)
    );
  }, [channelId, queryClient]);
  useSocketEvent('thread:new', handleThreadNew);

  const handleReadUpdate = useCallback((data: { channel_id: string; message_id: string; user_id: string; read_at: string }) => {
    if (data.channel_id === channelId) {
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) =>
        old.map((msg) => msg.id === data.message_id ? { ...msg, read_by: [...(msg.read_by || []), { user_id: data.user_id, read_at: data.read_at }] } : msg)
      );
    }
  }, [channelId, queryClient]);
  useSocketEvent('message:read_update', handleReadUpdate);

  const handleTypingUpdate = useCallback((data: { channel_id: string; user_id: string; display_name: string; is_typing: boolean }) => {
    if (data.channel_id === channelId && data.user_id !== user?.id) {
      if (data.is_typing) {
        setTypingUsers((prev) => prev.some((u) => u.user_id === data.user_id) ? prev : [...prev, { user_id: data.user_id, display_name: data.display_name }]);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
      }
    }
  }, [channelId, user?.id]);
  useSocketEvent('typing:update', handleTypingUpdate);

  const handleReactionUpdate = useCallback((data: { message_id: string; channel_id: string; reactions: Message['reactions'] }) => {
    if (data.channel_id === channelId) {
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) => old.map((msg) => msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg));
    }
  }, [channelId, queryClient]);
  useSocketEvent('reaction:update', handleReactionUpdate);

  // Handle user profile updates - update sender info in messages
  const handleProfileUpdate = useCallback((data: ProfileUpdateData) => {
    queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) =>
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
  }, [channelId, queryClient]);
  useSocketEvent('user:profile_update', handleProfileUpdate);

  // Handle message updates (edits)
  const handleMessageUpdated = useCallback((updatedMessage: Message) => {
    if (updatedMessage.channel_id === channelId) {
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) =>
        old.map((msg) => msg.id === updatedMessage.id ? { ...msg, content: updatedMessage.content, is_edited: true } : msg)
      );
    }
  }, [channelId, queryClient]);
  useSocketEvent('message:updated', handleMessageUpdated);

  // Handle message deletions
  const handleMessageDeleted = useCallback((data: { id: string; channel_id: string }) => {
    if (data.channel_id === channelId) {
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) =>
        old.filter((msg) => msg.id !== data.id)
      );
    }
  }, [channelId, queryClient]);
  useSocketEvent('message:deleted', handleMessageDeleted);

  // 스크롤 완료 후 원위치로 돌아가지 않도록 ref로 추적
  const hasScrolledToTargetRef = useRef(false);

  // Scroll to end on new messages (only for new messages, not after target scroll)
  useEffect(() => {
    // targetMessageId가 있거나, 방금 target으로 스크롤했으면 맨 아래로 스크롤하지 않음
    if (targetMessageId || hasScrolledToTargetRef.current) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, targetMessageId]);

  // Scroll to target message when specified
  useEffect(() => {
    if (!targetMessageId || messages.length === 0) return;

    // 먼저 메시지가 현재 로드된 목록에 있는지 확인
    const messageInList = messages.some(m => m.id === targetMessageId);
    if (!messageInList) {
      // 메시지가 아직 로드되지 않음 - 다음 렌더에서 다시 시도
      return;
    }

    // Try to find and scroll to the target message with retries
    let attempts = 0;
    const maxAttempts = 10;
    const retryDelay = 100;

    const tryScrollToMessage = () => {
      const targetElement = document.getElementById(`message-${targetMessageId}`);
      if (targetElement) {
        // 스크롤 완료 표시 - 이후 자동 스크롤 방지
        hasScrolledToTargetRef.current = true;
        // Scroll to the target message
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message temporarily
        setHighlightedMessageId(targetMessageId);
        // Remove highlight after animation
        setTimeout(() => {
          setHighlightedMessageId(null);
          // Notify parent that we've reached the target
          onTargetMessageReached?.();
        }, 2000);
      } else if (attempts < maxAttempts) {
        // Retry after a short delay (DOM might not be ready yet)
        attempts++;
        setTimeout(tryScrollToMessage, retryDelay);
      } else {
        // Message not found after all retries
        onTargetMessageReached?.();
      }
    };

    // 약간의 지연 후 스크롤 시도 (DOM 렌더링 대기)
    setTimeout(tryScrollToMessage, 50);
  }, [targetMessageId, messages, onTargetMessageReached]);

  // 선택된 채널일 때만 마지막 메시지를 읽음 처리 (클릭해서 선택한 경우만)
  useEffect(() => {
    if (!isSelected) return; // 선택되지 않은 채널은 읽음 처리하지 않음
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // 이미 같은 메시지를 읽음 처리했으면 스킵
      if (lastMarkedRef.current === lastMessage.id) return;
      lastMarkedRef.current = lastMessage.id;

      // 마지막 메시지를 읽음 처리 (내가 보낸 것도 포함 - last_read_at 업데이트)
      emit('message:read', { channel_id: channelId, message_id: lastMessage.id });
      // Invalidate queries to update unread count and last_read_message_id
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channel', channelId] });
    }
  }, [messages, channelId, emit, queryClient, isSelected]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) { emit('typing:start', { channel_id: channelId }); lastTypingEmitRef.current = now; }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { emit('typing:stop', { channel_id: channelId }); }, 3000);
  };

  const handleSend = async () => {
    if (!inputValue.trim() && !pastedImage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emit('typing:stop', { channel_id: channelId });

    let imageUrl: string | null = null;

    // Upload image if present
    if (pastedImage) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', pastedImage);
        const response = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = response.data.data?.url || response.data.url;
      } catch (error) {
        console.error('Failed to upload image:', error);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Send message
    if (imageUrl) {
      // Send image message
      const content = inputValue.trim() ? `${inputValue.trim()}\n![image](${imageUrl})` : `![image](${imageUrl})`;
      emit('message:send', { channel_id: channelId, content, type: 'image', temp_id: generateUUID(), metadata: { image_url: imageUrl } });
    } else {
      // Send text message
      emit('message:send', { channel_id: channelId, content: inputValue.trim(), type: 'text', temp_id: generateUUID() });
    }

    setInputValue('');
    setPastedImage(null);
  };

  const handleReaction = (messageId: string, emoji: string) => { emit('reaction:toggle', { message_id: messageId, emoji }); };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="text-gray-500">메시지 로딩 중...</div></div>;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Channel Header (also drag handle if props provided) */}
      <div
        {...dragHandleProps}
        className={`px-4 py-2 border-b flex items-center justify-between flex-shrink-0 ${isSelected ? 'bg-gray-200' : 'bg-gray-50'} ${dragHandleProps ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{channel?.type === 'direct' ? '@' : '#'}</span>
          <h2 className="font-semibold text-gray-900">{channel?.name || '채널'}</h2>
          {/* 선택되지 않은 경우 읽지 않은 메시지 뱃지 표시 */}
          {!isSelected && channel?.unread_count > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {channel.unread_count > 99 ? '99+' : channel.unread_count}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <div ref={messagesContainerRef} className="h-full overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? <div className="text-center text-gray-500 py-8">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</div>
          : messages.map((message, index) => {
            // Find if this is the first unread message (초기 읽음 위치 기준으로 계산)
            const lastReadId = initialLastReadIdRef.current || channel?.last_read_message_id;
            const lastReadIndex = lastReadId ? messages.findIndex(m => m.id === lastReadId) : -1;
            const isFirstUnread = lastReadId &&
              index > 0 &&
              messages[index - 1].id === lastReadId &&
              message.sender.id !== user?.id;

            // Check if message is unread (after last_read_message_id and not from me)
            const isUnread = lastReadId &&
              lastReadIndex !== -1 &&
              index > lastReadIndex &&
              message.sender.id !== user?.id;

            return (
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={`transition-colors duration-500 rounded-lg ${
                  highlightedMessageId === message.id
                    ? 'bg-yellow-100 ring-2 ring-yellow-400'
                    : isUnread && showUnreadBackground
                      ? 'bg-amber-50'
                      : ''
                }`}
              >
                {isFirstUnread && showNewMessageDivider && (
                  <div className={`flex items-center gap-2 py-2 my-2 transition-opacity duration-500 ${showNewMessageDivider ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex-1 h-px bg-red-400" />
                    <span className="text-xs text-red-500 font-medium px-2">여기서부터 새 메시지</span>
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  channelId={channelId}
                  onReaction={(emoji) => handleReaction(message.id, emoji)}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {typingUsers.length > 0 && <div className="px-4 py-2 text-sm text-gray-500">{typingUsers.map((u) => u.display_name).join(', ')}{typingUsers.length === 1 ? '님이 입력 중...' : '님들이 입력 중...'}</div>}
      {isUploading && <div className="px-4 py-2 text-sm text-blue-500">이미지 업로드 중...</div>}
      <MessageInput
        ref={messageInputRef}
        value={inputValue}
        onChange={handleInputChange}
        onSend={handleSend}
        onImagePaste={setPastedImage}
        pastedImage={pastedImage}
        onRemoveImage={() => setPastedImage(null)}
        shortcutNumber={shortcutNumber}
      />
    </div>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
