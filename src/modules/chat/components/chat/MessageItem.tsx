import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSocketEmit } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';
import InlineThread from './InlineThread';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

interface Message {
  id: string;
  content: string;
  type: string;
  sender: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    avatar_color: string | null;
  };
  created_at: string;
  is_edited: boolean;
  thread_count: number;
  reactions?: Array<{
    emoji: string;
    count: number;
    has_reacted: boolean;
  }>;
  read_by?: Array<{
    user_id: string;
    read_at: string;
  }>;
}

interface MessageItemProps {
  message: Message;
  channelId?: string;
  onReaction?: (emoji: string) => void;
  showThreadControls?: boolean;
}

// Parse message content to extract text and images
function parseMessageContent(content: string): { text: string; images: string[] } {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images: string[] = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const imageUrl = getAbsoluteUrl(match[2]) || match[2];
    images.push(imageUrl);
  }

  // Remove image markdown from text
  const text = content.replace(imageRegex, '').trim();

  return { text, images };
}

export default function MessageItem({ message, channelId, onReaction, showThreadControls = true }: MessageItemProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isThreadExpanded, setIsThreadExpanded] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const emit = useSocketEmit();
  const { user } = useAuthStore();

  const isOwnMessage = user?.id === message.sender?.id;

  const formattedTime = format(new Date(message.created_at), 'a h:mm', { locale: ko });
  const { text: displayContent, images } = parseMessageContent(message.content.replace(/<[^>]*>/g, ''));
  const readCount = message.read_by?.length || 0;

  const handleSendReply = () => {
    if (!replyContent.trim() || !channelId) return;
    emit('message:send', {
      channel_id: channelId,
      content: replyContent.trim(),
      type: 'text',
      parent_id: message.id,
      temp_id: crypto.randomUUID(),
    });
    setReplyContent('');
    setShowReplyInput(false);
    setIsThreadExpanded(true);
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

  const toggleThread = () => {
    setIsThreadExpanded(!isThreadExpanded);
  };

  const handleReplyClick = () => {
    setShowReplyInput(!showReplyInput);
    if (!showReplyInput) {
      setIsThreadExpanded(true);
    }
  };

  // Edit handlers
  const handleStartEdit = () => {
    setEditContent(message.content.replace(/<[^>]*>/g, ''));
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    emit('message:edit', {
      message_id: message.id,
      content: editContent.trim(),
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Delete handlers
  const handleDelete = () => {
    emit('message:delete', { message_id: message.id });
    setShowDeleteConfirm(false);
  };

  return (
    <div>
      <div className="flex gap-3 hover:bg-gray-50 p-2 rounded-lg group relative">
        <div className="flex-shrink-0">
          {getAbsoluteUrl(message.sender?.avatar_url) ? (
            <img src={getAbsoluteUrl(message.sender?.avatar_url)!} alt={message.sender.display_name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: message.sender?.avatar_color || '#3B82F6' }}
            >
              {message.sender?.display_name?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-gray-900">{message.sender?.display_name || '알 수 없음'}</span>
            <span className="text-xs text-gray-500">{formattedTime}</span>
            {message.is_edited && <span className="text-xs text-gray-400">(수정됨)</span>}
            {readCount > 0 && <span className="text-xs text-blue-500" title={`${readCount}명이 읽음`}>✓ {readCount}</span>}
          </div>
          {isEditing ? (
            <div className="mt-1">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={Math.min(editContent.split('\n').length + 1, 5)}
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  저장
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  취소
                </button>
                <span className="text-xs text-gray-400 self-center">Enter로 저장, Esc로 취소</span>
              </div>
            </div>
          ) : (
            <>
              {displayContent && <div className="text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{displayContent}</div>}
            </>
          )}
          {images.length > 0 && !isEditing && (
            <div className="mt-2 space-y-2">
              {images.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt="첨부 이미지"
                  className="max-w-full max-h-[50vh] object-contain rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(src, '_blank')}
                />
              ))}
            </div>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {message.reactions.map((reaction) => (
                <button key={reaction.emoji} onClick={() => onReaction?.(reaction.emoji)}
                  className={`px-2 py-1 rounded-full text-sm border ${reaction.has_reacted ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-200'}`}>
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          )}

          {/* 스레드 컨트롤 */}
          {showThreadControls && channelId && (
            <div className="flex items-center gap-2 mt-1">
              {message.thread_count > 0 && (
                <button
                  className="text-blue-600 text-sm hover:underline"
                  onClick={toggleThread}
                >
                  {isThreadExpanded ? '답글 접기' : `${message.thread_count}개의 답글`}
                </button>
              )}
              <button
                className="text-gray-500 text-sm hover:text-blue-600"
                onClick={handleReplyClick}
              >
                답글
              </button>
            </div>
          )}

          {/* 인라인 답글 입력 */}
          {showReplyInput && channelId && (
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
        {!isEditing && (
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-1 bg-white shadow-md rounded-lg border p-1">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="반응 추가">😊</button>
              {showThreadControls && channelId && (
                <button onClick={handleReplyClick} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="답글 달기">💬</button>
              )}
              {isOwnMessage && (
                <>
                  <button onClick={handleStartEdit} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="수정">✏️</button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="삭제">🗑️</button>
                </>
              )}
            </div>
            {showEmojiPicker && (
              <div className="absolute right-0 top-8 bg-white shadow-lg rounded-lg border p-2 flex gap-1 z-10">
                {EMOJI_LIST.map((emoji) => (
                  <button key={emoji} onClick={() => { onReaction?.(emoji); setShowEmojiPicker(false); }} className="p-1 hover:bg-gray-100 rounded text-lg">{emoji}</button>
                ))}
              </div>
            )}
            {showDeleteConfirm && (
              <div className="absolute right-0 top-8 bg-white shadow-lg rounded-lg border p-3 z-10 min-w-[200px]">
                <p className="text-sm text-gray-700 mb-2">메시지를 삭제하시겠습니까?</p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 인라인 스레드 */}
      {isThreadExpanded && channelId && message.thread_count > 0 && (
        <div className="ml-12 border-l-2 border-gray-200">
          <InlineThread parentId={message.id} channelId={channelId} />
        </div>
      )}
    </div>
  );
}
