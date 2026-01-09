import { KeyboardEvent, ClipboardEvent, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onImagePaste?: (file: File) => void;
  pastedImage?: File | null;
  onRemoveImage?: () => void;
  placeholder?: string;
  shortcutNumber?: number; // 1-9 for Ctrl+N shortcut hint
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
}, ref) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (pastedImage) {
      const url = URL.createObjectURL(pastedImage);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreview(null);
    }
  }, [pastedImage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const canSend = value.trim() || pastedImage;

  return (
    <div className="border-t border-gray-200 p-3">
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

      <div className="flex items-end gap-2">
        {/* Shortcut hint */}
        {shortcutNumber && shortcutNumber <= 9 && (
          <div className="flex-shrink-0 pb-2">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">Ctrl+{shortcutNumber}</kbd>
            </span>
          </div>
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={pastedImage ? '이미지와 함께 보낼 메시지...' : placeholder}
          rows={1}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
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
