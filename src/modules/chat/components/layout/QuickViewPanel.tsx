import { useState, useRef, useCallback, useEffect } from 'react';
import ChatView from '../chat/ChatView';

interface QuickViewPanelProps {
  channelId: string | null;
  targetMessageId?: string | null;
  onPinChannel: (channelId: string) => void;
  onTargetMessageReached?: () => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const STORAGE_KEY = 'hanichat-quickview-width';

export default function QuickViewPanel({ channelId, targetMessageId, onPinChannel, onTargetMessageReached }: QuickViewPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save width to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !panelRef.current) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const newWidth = e.clientX - panelRect.left;

    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (isCollapsed) {
    return (
      <div className="w-10 bg-gray-100 border-r flex flex-col items-center py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-8 h-8 rounded bg-white border shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-500"
          title="퀵뷰 펼치기"
        >
          ❯
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="border-r bg-white flex flex-col relative"
      style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">퀵뷰</span>
        <div className="flex items-center gap-1">
          {channelId && (
            <button
              onClick={() => onPinChannel(channelId)}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              title="메인에 고정"
            >
              고정
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center text-gray-500"
            title="퀵뷰 접기"
          >
            ❮
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {channelId ? (
          <ChatView
            channelId={channelId}
            targetMessageId={targetMessageId}
            onTargetMessageReached={onTargetMessageReached}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-sm">채널을 선택하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        title="드래그하여 너비 조정"
      />
    </div>
  );
}
