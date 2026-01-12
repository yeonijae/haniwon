import { KeyboardEvent, ClipboardEvent, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';

export interface MentionableMember {
  id: string;
  user_id?: string; // 일부 API에서 사용
  display_name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

// 멘션 데이터 (표시용 텍스트와 실제 ID 매핑)
export interface MentionData {
  userId: string;
  displayName: string;
}

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onImagePaste?: (file: File) => void;
  pastedImage?: File | null;
  onRemoveImage?: () => void;
  placeholder?: string;
  shortcutNumber?: number; // 1-9 for Ctrl+N shortcut hint
  members?: MentionableMember[]; // 멘션 가능한 멤버 목록
  mentions?: MentionData[]; // 현재 입력된 멘션 목록
  onMentionsChange?: (mentions: MentionData[]) => void; // 멘션 변경 콜백
  currentUserId?: string; // 현재 사용자 ID (자기 자신 멘션 방지)
}

export interface MessageInputHandle {
  focus: () => void;
}

const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(({
  value,
  onChange,
  onSend,
  onImagePaste,
  pastedImage,
  onRemoveImage,
  placeholder = '메시지를 입력하세요...',
  shortcutNumber,
  members = [],
  mentions = [],
  onMentionsChange,
  currentUserId,
}, ref) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 멘션 관련 상태
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 멘션 검색 필터링 (자기 자신 제외)
  const filteredMembers = members
    .filter(member => {
      const memberId = member.user_id || member.id;
      // 자기 자신 제외
      if (currentUserId && memberId === currentUserId) return false;
      // 검색어 필터
      return member.display_name.toLowerCase().includes(mentionQuery.toLowerCase());
    })
    .slice(0, 8); // 최대 8개 표시

  useEffect(() => {
    if (pastedImage) {
      const url = URL.createObjectURL(pastedImage);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreview(null);
    }
  }, [pastedImage]);

  // 하이라이트 영역 스크롤 동기화
  useEffect(() => {
    const textarea = inputRef.current;
    const highlight = highlightRef.current;
    if (textarea && highlight) {
      const syncScroll = () => {
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
      };
      textarea.addEventListener('scroll', syncScroll);
      return () => textarea.removeEventListener('scroll', syncScroll);
    }
  }, []);

  // 멘션 선택 처리 - 표시용 텍스트만 입력창에 넣고, 멘션 데이터는 별도 저장
  const handleSelectMention = (member: MentionableMember) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.substring(0, mentionStartIndex);
    const afterMention = value.substring(mentionStartIndex + mentionQuery.length + 1); // +1 for @
    const memberId = member.user_id || member.id;

    // 입력창에는 @이름 형태로만 표시
    const displayText = `@${member.display_name} `;
    onChange(beforeMention + displayText + afterMention);

    // 멘션 데이터 추가 (중복 체크)
    const newMention: MentionData = {
      userId: memberId,
      displayName: member.display_name,
    };

    const alreadyExists = mentions.some(m => m.userId === memberId);
    if (!alreadyExists) {
      onMentionsChange?.([...mentions, newMention]);
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(0);

    // 포커스 유지
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 멘션 드롭다운이 열려있을 때 키보드 네비게이션
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMembers[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
        setMentionQuery('');
        setMentionStartIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for files first (works better in Electron)
    const files = clipboardData.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          console.log('Image pasted from files:', file.name, file.type);
          if (onImagePaste) {
            onImagePaste(file);
          }
          return;
        }
      }
    }

    // Fallback to items (for screenshots)
    const items = clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          console.log('Image pasted from items:', file?.name, file?.type);
          if (file && onImagePaste) {
            onImagePaste(file);
          }
          return;
        }
      }
    }
  };

  const handleInput = () => {
    const textarea = inputRef.current;
    const highlight = highlightRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      // 하이라이트 영역도 동기화
      if (highlight) {
        highlight.style.height = textarea.style.height;
      }
    }
  };

  // 멘션 감지 처리
  const handleTextChange = (newValue: string) => {
    onChange(newValue);

    // 텍스트에서 삭제된 멘션 감지하여 멘션 목록에서 제거
    const updatedMentions = mentions.filter(mention =>
      newValue.includes(`@${mention.displayName}`)
    );
    if (updatedMentions.length !== mentions.length) {
      onMentionsChange?.(updatedMentions);
    }

    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);

    // @ 이후의 텍스트 찾기
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // @ 바로 앞이 공백이거나 문장 시작인지 확인
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.substring(lastAtIndex + 1);
        // 공백이 포함되지 않은 경우에만 드롭다운 표시
        if (!query.includes(' ')) {
          setShowMentionDropdown(true);
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }

    // 조건에 맞지 않으면 드롭다운 숨기기
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // 멘션 하이라이트가 적용된 HTML 생성 (배경만 표시, 텍스트는 투명)
  const getHighlightedText = () => {
    if (mentions.length === 0) {
      // 멘션이 없으면 투명 텍스트만 (줄바꿈 유지)
      return value.replace(/\n/g, '<br/>') + '<br/>';
    }

    let result = value;
    // 멘션을 하이라이트로 감싸기 (배경만, 텍스트는 투명 유지)
    for (const mention of mentions) {
      const pattern = `@${mention.displayName}`;
      const replacement = `<span class="bg-blue-200 rounded">${pattern}</span>`;
      result = result.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }
    // 줄바꿈 유지
    return result.replace(/\n/g, '<br/>') + '<br/>';
  };

  const canSend = value.trim() || pastedImage;

  return (
    <div className="border-t border-gray-200 p-3 relative">
      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <img
            src={imagePreview}
            alt="붙여넣은 이미지"
            className="max-h-32 rounded-lg border border-gray-300"
          />
          <button
            onClick={onRemoveImage}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-sm"
            title="이미지 제거"
          >
            &times;
          </button>
        </div>
      )}

      {/* 멘션 드롭다운 */}
      {showMentionDropdown && filteredMembers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50"
        >
          <div className="p-2 text-xs text-gray-500 border-b">멘션할 사용자 선택</div>
          {filteredMembers.map((member, index) => (
            <button
              key={member.user_id || member.id}
              onClick={() => handleSelectMention(member)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 ${
                index === selectedMentionIndex ? 'bg-blue-50' : ''
              }`}
            >
              {getAbsoluteUrl(member.avatar_url) ? (
                <img
                  src={getAbsoluteUrl(member.avatar_url)!}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: member.avatar_color || '#3B82F6' }}
                >
                  {member.display_name?.[0] || '?'}
                </div>
              )}
              <span className="font-medium text-gray-900">{member.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Shortcut hint */}
        {shortcutNumber && shortcutNumber <= 9 && (
          <div className="flex-shrink-0 pb-2">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">Ctrl+{shortcutNumber}</kbd>
            </span>
          </div>
        )}

        {/* 입력창 컨테이너 (하이라이트 배경 포함) */}
        <div className="flex-1 relative">
          {/* 하이라이트 배경 레이어 (textarea 뒤) */}
          <div
            ref={highlightRef}
            className="absolute inset-0 px-3 py-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-words border border-transparent rounded-lg bg-white"
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              color: 'transparent',
            }}
            dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
          />
          {/* 실제 textarea (배경 투명) */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
              handleTextChange(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pastedImage ? '이미지와 함께 보낼 메시지...' : placeholder}
            rows={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none relative"
            style={{
              caretColor: 'black',
              background: 'transparent',
            }}
          />
        </div>

        <button
          onClick={onSend}
          disabled={!canSend}
          className="px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          title="전송 (Enter)"
        >
          <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
