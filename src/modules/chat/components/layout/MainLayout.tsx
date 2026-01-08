import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import QuickViewPanel from './QuickViewPanel';
import MainPanel from './MainPanel';
import { channelLayoutApi, ChannelLayoutData } from '../../api';

type GridSize = 2 | 3 | 4 | 6 | 8 | 9;
type LayoutMode = 'grid' | 'vertical';

const DISPLAY_SETTINGS_KEY = 'hanichat-display-settings';

interface DisplaySettings {
  zoom: number; // 50 ~ 150 (%)
  fontSize: number; // 8 ~ 20 (px)
}

const DEFAULT_DISPLAY: DisplaySettings = {
  zoom: 100,
  fontSize: 14,
};

function loadDisplaySettings(): DisplaySettings {
  try {
    const saved = localStorage.getItem(DISPLAY_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        zoom: parsed.zoom || DEFAULT_DISPLAY.zoom,
        fontSize: parsed.fontSize || DEFAULT_DISPLAY.fontSize,
      };
    }
  } catch (e) {
    console.error('Failed to load display settings:', e);
  }
  return DEFAULT_DISPLAY;
}

function saveDisplaySettings(settings: DisplaySettings) {
  try {
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save display settings:', e);
  }
}

export default function MainLayout() {
  const queryClient = useQueryClient();
  const [quickViewChannelId, setQuickViewChannelId] = useState<string | null>(null);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [pinnedChannels, setPinnedChannels] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_DISPLAY.zoom);
  const [fontSize, setFontSize] = useState(DEFAULT_DISPLAY.fontSize);

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
      setIsLayoutLoaded(true);
    }
  }, [layoutData, isLayoutLoaded]);

  // Load display settings on mount
  useEffect(() => {
    const displaySettings = loadDisplaySettings();
    setZoom(displaySettings.zoom);
    setFontSize(displaySettings.fontSize);
  }, []);

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

  // Save layout state when it changes
  useEffect(() => {
    if (!isLayoutLoaded) return;
    debouncedSave({ pinnedChannels, gridSize, layoutMode });
  }, [pinnedChannels, gridSize, layoutMode, isLayoutLoaded, debouncedSave]);

  // Save and apply display settings
  useEffect(() => {
    saveDisplaySettings({ zoom, fontSize });
    // Apply zoom to document
    document.documentElement.style.setProperty('--app-zoom', `${zoom / 100}`);
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
  }, [zoom, fontSize]);

  const handleSelectChannel = (channelId: string, messageId?: string) => {
    // If channel is pinned, don't show in quickview
    if (!pinnedChannels.includes(channelId)) {
      setQuickViewChannelId(channelId);
      setTargetMessageId(messageId || null);
    }
  };

  const clearTargetMessage = () => {
    setTargetMessageId(null);
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
        targetMessageId={targetMessageId}
        onPinChannel={handlePinChannel}
        onTargetMessageReached={clearTargetMessage}
      />

      {/* Main Panel - 고정된 채널 그리드 */}
      <MainPanel
        pinnedChannels={pinnedChannels}
        gridSize={gridSize}
        layoutMode={layoutMode}
        onReorder={handleReorderChannels}
        onUnpin={handleUnpinChannel}
        onGridSizeChange={handleGridSizeChange}
        onLayoutModeChange={setLayoutMode}
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
                  setZoom(DEFAULT_DISPLAY.zoom);
                  setFontSize(DEFAULT_DISPLAY.fontSize);
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
