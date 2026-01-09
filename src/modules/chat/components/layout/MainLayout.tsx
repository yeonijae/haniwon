import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import QuickViewPanel from './QuickViewPanel';
import MainPanel, { MainPanelHandle } from './MainPanel';
import { channelLayoutApi, ChannelLayoutData } from '../../api';

type GridSize = 2 | 3 | 4 | 6 | 8 | 9;
type LayoutMode = 'grid' | 'vertical';

const DEFAULT_ZOOM = 100;
const DEFAULT_FONT_SIZE = 14;

export default function MainLayout() {
  const queryClient = useQueryClient();
  const [quickViewChannelId, setQuickViewChannelId] = useState<string | null>(null);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);
  const [pinnedChannels, setPinnedChannels] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  // 전역 선택 상태: 'quickview' 또는 고정된 채널 ID
  const [selectedArea, setSelectedArea] = useState<'quickview' | string | null>(null);

  // Ref for MainPanel to focus pinned channels
  const mainPanelRef = useRef<MainPanelHandle>(null);

  // Global keyboard shortcut handler for Ctrl+1~9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1 ~ Ctrl+9 for quick focus to pinned channels
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const key = e.key;
        if (key >= '1' && key <= '9') {
          const index = parseInt(key, 10) - 1;
          if (index < pinnedChannels.length) {
            e.preventDefault();
            mainPanelRef.current?.focusChannel(index);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinnedChannels.length]);

  // Fetch layout from DB
  const { data: layoutData } = useQuery<ChannelLayoutData>({
    queryKey: ['channelLayout'],
    queryFn: channelLayoutApi.get,
    staleTime: Infinity,
  });

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: (data: Partial<ChannelLayoutData>) => {
      // Merge with existing data from cache
      const currentData = queryClient.getQueryData<ChannelLayoutData>(['channelLayout']);
      const mergedData: ChannelLayoutData = {
        items: currentData?.items || [],
        hiddenChannels: currentData?.hiddenChannels || [],
        pinnedChannels: data.pinnedChannels ?? currentData?.pinnedChannels ?? [],
        gridSize: data.gridSize ?? currentData?.gridSize ?? 4,
        layoutMode: data.layoutMode ?? currentData?.layoutMode ?? 'grid',
        zoom: data.zoom ?? currentData?.zoom ?? DEFAULT_ZOOM,
        fontSize: data.fontSize ?? currentData?.fontSize ?? DEFAULT_FONT_SIZE,
      };
      return channelLayoutApi.save(mergedData);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['channelLayout'], data);
    },
    onError: (error) => console.error('Failed to save layout:', error),
  });

  // Load layout from DB on initial fetch
  useEffect(() => {
    if (layoutData && !isLayoutLoaded) {
      setPinnedChannels(layoutData.pinnedChannels || []);
      setGridSize((layoutData.gridSize as GridSize) || 4);
      setLayoutMode((layoutData.layoutMode as LayoutMode) || 'grid');
      setZoom(layoutData.zoom ?? DEFAULT_ZOOM);
      setFontSize(layoutData.fontSize ?? DEFAULT_FONT_SIZE);
      setIsLayoutLoaded(true);
    }
  }, [layoutData, isLayoutLoaded]);

  // Debounced save to DB
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback((data: Partial<ChannelLayoutData>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveLayoutMutation.mutate(data);
    }, 500);
  }, [saveLayoutMutation]);

  // Save layout state when it changes (including zoom and fontSize)
  useEffect(() => {
    if (!isLayoutLoaded) return;
    debouncedSave({ pinnedChannels, gridSize, layoutMode, zoom, fontSize });
  }, [pinnedChannels, gridSize, layoutMode, zoom, fontSize, isLayoutLoaded, debouncedSave]);

  // Apply display settings to document
  useEffect(() => {
    document.documentElement.style.setProperty('--app-zoom', `${zoom / 100}`);
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
  }, [zoom, fontSize]);

  const handleSelectChannel = (channelId: string, messageId?: string) => {
    // If channel is pinned, just set targetMessageId for MainPanel
    // Otherwise show in quickview
    if (!pinnedChannels.includes(channelId)) {
      setQuickViewChannelId(channelId);
      setSelectedArea('quickview'); // 퀵뷰 선택
    }
    // Always set targetMessageId and targetChannelId if provided (for both quickview and pinned)
    if (messageId) {
      setTargetMessageId(messageId);
      setTargetChannelId(channelId);
    } else {
      setTargetMessageId(null);
      setTargetChannelId(null);
    }
  };

  // 고정된 채널 선택 핸들러
  const handleSelectPinnedChannel = (channelId: string) => {
    setSelectedArea(channelId); // 해당 고정 채널 선택 (퀵뷰 선택 해제)
  };

  const clearTargetMessage = () => {
    setTargetMessageId(null);
    setTargetChannelId(null);
  };

  const handlePinChannel = (channelId: string) => {
    if (!pinnedChannels.includes(channelId)) {
      setPinnedChannels((prev) => [...prev, channelId]);
      // If it was in quickview, clear it
      if (quickViewChannelId === channelId) {
        setQuickViewChannelId(null);
      }
    }
  };

  const handleUnpinChannel = (channelId: string) => {
    setPinnedChannels((prev) => prev.filter((id) => id !== channelId));
  };

  const handleReorderChannels = (newOrder: string[]) => {
    setPinnedChannels(newOrder);
  };

  const handleGridSizeChange = (size: GridSize) => {
    setGridSize(size);
  };

  return (
    <div
      className="flex bg-gray-100 overflow-hidden"
      style={{
        zoom: `${zoom}%`,
        fontSize: `${fontSize}px`,
        width: `${10000 / zoom}vw`,
        height: `${10000 / zoom}vh`,
      }}
    >
      {/* Sidebar - 채널 목록 */}
      <Sidebar
        selectedChannelId={quickViewChannelId}
        pinnedChannels={pinnedChannels}
        onSelectChannel={handleSelectChannel}
        onPinChannel={handlePinChannel}
        onUnpinChannel={handleUnpinChannel}
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* QuickView Panel - 선택한 채널 임시 표시 */}
      <QuickViewPanel
        channelId={quickViewChannelId}
        targetMessageId={targetChannelId === quickViewChannelId ? targetMessageId : null}
        onPinChannel={handlePinChannel}
        onTargetMessageReached={clearTargetMessage}
        isSelected={selectedArea === 'quickview'}
        onSelect={() => setSelectedArea('quickview')}
      />

      {/* Main Panel - 고정된 채널 그리드 */}
      <MainPanel
        ref={mainPanelRef}
        pinnedChannels={pinnedChannels}
        gridSize={gridSize}
        layoutMode={layoutMode}
        targetMessageId={targetMessageId}
        targetChannelId={targetChannelId}
        onReorder={handleReorderChannels}
        onUnpin={handleUnpinChannel}
        onGridSizeChange={handleGridSizeChange}
        onLayoutModeChange={setLayoutMode}
        onTargetMessageReached={clearTargetMessage}
        selectedChannelId={selectedArea !== 'quickview' ? selectedArea : null}
        onSelectChannel={handleSelectPinnedChannel}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">화면 설정</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Zoom Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                화면 비율: {zoom}%
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-lg"
                  disabled={zoom <= 50}
                >
                  -
                </button>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="10"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setZoom(Math.min(150, zoom + 10))}
                  className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-lg"
                  disabled={zoom >= 150}
                >
                  +
                </button>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50%</span>
                <span>100%</span>
                <span>150%</span>
              </div>
            </div>

            {/* Font Size Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                글꼴 크기: {fontSize}px
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(Math.max(8, fontSize - 1))}
                  className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-lg"
                  disabled={fontSize <= 8}
                >
                  -
                </button>
                <input
                  type="range"
                  min="8"
                  max="20"
                  step="1"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                  className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-lg"
                  disabled={fontSize >= 20}
                >
                  +
                </button>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>8px</span>
                <span>14px</span>
                <span>20px</span>
              </div>
            </div>

            {/* Preview */}
            <div className="mb-4 p-3 bg-gray-100 rounded">
              <p className="text-gray-600" style={{ fontSize: `${fontSize}px` }}>
                미리보기: 안녕하세요!
              </p>
            </div>

            {/* Reset Button */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setZoom(DEFAULT_ZOOM);
                  setFontSize(DEFAULT_FONT_SIZE);
                }}
                className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
              >
                기본값으로 재설정
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
