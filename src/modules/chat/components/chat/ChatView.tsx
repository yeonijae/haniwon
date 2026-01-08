import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useSocketEvent, useSocketEmit } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';

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
}

export default function ChatView({ channelId, targetMessageId, onTargetMessageReached }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const queryClient = useQueryClient();
  const emit = useSocketEmit();
  const { user } = useAuthStore();

  const { data: channel } = useQuery<Channel>({
    queryKey: ['channel', channelId],
    queryFn: async () => { const response = await api.get(`/channels/${channelId}`); return response.data.data; },
  });

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', channelId],
    queryFn: async () => { const response = await api.get(`/channels/${channelId}/messages`); return response.data.data; },
  });

  useEffect(() => {
    emit('channel:join', { channel_id: channelId });
    return () => { emit('channel:leave', { channel_id: channelId }); };
  }, [channelId, emit]);

  const handleNewMessage = useCallback((message: Message) => {
    if (message.channel_id === channelId && !message.parent_id) {
      // Only add to main message list if it's not a thread reply
      queryClient.setQueryData<Message[]>(['messages', channelId], (old = []) => [...old, message]);
      if (message.sender.id !== user?.id) emit('message:read', { channel_id: channelId, message_id: message.id });
    }
  }, [channelId, queryClient, emit, user?.id]);
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

  // Scroll to end on new messages (unless targeting a specific message)
  useEffect(() => {
    if (!targetMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, targetMessageId]);

  // Scroll to target message when specified
  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
      const targetElement = document.getElementById(`message-${targetMessageId}`);
      if (targetElement) {
        // Scroll to the target message
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message temporarily
        setHighlightedMessageId(targetMessageId);
        // Remove highlight after animation
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2000);
        // Notify parent that we've reached the target
        onTargetMessageReached?.();
      }
    }
  }, [targetMessageId, messages, onTargetMessageReached]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender.id !== user?.id) {
        emit('message:read', { channel_id: channelId, message_id: lastMessage.id });
        // Invalidate channels query to update unread count in sidebar
        queryClient.invalidateQueries({ queryKey: ['channels'] });
      }
    }
  }, [messages, channelId, emit, user?.id, queryClient]);

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
      emit('message:send', { channel_id: channelId, content, type: 'image', temp_id: crypto.randomUUID(), metadata: { image_url: imageUrl } });
    } else {
      // Send text message
      emit('message:send', { channel_id: channelId, content: inputValue.trim(), type: 'text', temp_id: crypto.randomUUID() });
    }

    setInputValue('');
    setPastedImage(null);
  };

  const handleReaction = (messageId: string, emoji: string) => { emit('reaction:toggle', { message_id: messageId, emoji }); };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="text-gray-500">메시지 로딩 중...</div></div>;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Channel Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{channel?.type === 'direct' ? '@' : '#'}</span>
          <h2 className="font-semibold text-gray-900">{channel?.name || '채널'}</h2>
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? <div className="text-center text-gray-500 py-8">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</div>
          : messages.map((message, index) => {
            // Find if this is the first unread message
            const lastReadId = channel?.last_read_message_id;
            const isFirstUnread = lastReadId &&
              index > 0 &&
              messages[index - 1].id === lastReadId &&
              message.sender.id !== user?.id;

            return (
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={`transition-colors duration-500 ${
                  highlightedMessageId === message.id ? 'bg-yellow-100 ring-2 ring-yellow-400 rounded-lg' : ''
                }`}
              >
                {isFirstUnread && (
                  <div className="flex items-center gap-2 py-2 my-2">
                    <div className="flex-1 h-px bg-red-400" />
                    <span className="text-xs text-red-500 font-medium px-2">새 메시지</span>
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
      {typingUsers.length > 0 && <div className="px-4 py-2 text-sm text-gray-500">{typingUsers.map((u) => u.display_name).join(', ')}{typingUsers.length === 1 ? '님이 입력 중...' : '님들이 입력 중...'}</div>}
      {isUploading && <div className="px-4 py-2 text-sm text-blue-500">이미지 업로드 중...</div>}
      <MessageInput
        value={inputValue}
        onChange={handleInputChange}
        onSend={handleSend}
        onImagePaste={setPastedImage}
        pastedImage={pastedImage}
        onRemoveImage={() => setPastedImage(null)}
      />
    </div>
  );
}
