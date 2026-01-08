import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ChatView from '../chat/ChatView';
import ContextMenu, { ContextMenuItem } from '../common/ContextMenu';
import { useState } from 'react';

type GridSize = 2 | 3 | 4 | 6 | 8 | 9;
type LayoutMode = 'grid' | 'vertical';

interface MainPanelProps {
  pinnedChannels: string[];
  gridSize: GridSize;
  layoutMode: LayoutMode;
  onReorder: (channels: string[]) => void;
  onUnpin: (channelId: string) => void;
  onGridSizeChange: (size: GridSize) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
}

const GRID_SIZES: GridSize[] = [2, 3, 4, 6, 8, 9];
const VERTICAL_SIZES = [1, 2, 3, 4];

const getGridClass = (size: GridSize) => {
  switch (size) {
    case 2: return 'grid-cols-2 grid-rows-1';
    case 3: return 'grid-cols-3 grid-rows-1';
    case 4: return 'grid-cols-2 grid-rows-2';
    case 6: return 'grid-cols-3 grid-rows-2';
    case 8: return 'grid-cols-4 grid-rows-2';
    case 9: return 'grid-cols-3 grid-rows-3';
    default: return 'grid-cols-2 grid-rows-2';
  }
};

interface SortableChatItemProps {
  channelId: string;
  onUnpin: (channelId: string) => void;
}

function SortableChatItem({ channelId, onUnpin }: SortableChatItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channelId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: '고정 해제',
      icon: '📌',
      onClick: () => onUnpin(channelId),
    },
  ];

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg overflow-hidden shadow-sm border flex flex-col"
        onContextMenu={handleContextMenu}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="h-2 bg-gray-200 hover:bg-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0"
          title="드래그하여 순서 변경"
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatView channelId={channelId} />
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function EmptyCell() {
  return (
    <div className="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
      <span className="text-gray-400 text-sm">빈 슬롯</span>
    </div>
  );
}

export default function MainPanel({
  pinnedChannels,
  gridSize,
  layoutMode,
  onReorder,
  onUnpin,
  onGridSizeChange,
  onLayoutModeChange,
}: MainPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pinnedChannels.indexOf(active.id as string);
      const newIndex = pinnedChannels.indexOf(over.id as string);
      onReorder(arrayMove(pinnedChannels, oldIndex, newIndex));
    }
  };

  // Calculate empty cells needed (for grid mode)
  const emptyCellsCount = layoutMode === 'grid' ? Math.max(0, gridSize - pinnedChannels.length) : 0;
  const emptyCells = Array(emptyCellsCount).fill(null);

  // For vertical mode, limit display count
  const displayChannels = layoutMode === 'vertical'
    ? pinnedChannels.slice(0, gridSize <= 4 ? gridSize : 4)
    : pinnedChannels;

  const currentSize = layoutMode === 'grid' ? gridSize : Math.min(gridSize, 4);

  return (
    <div className="flex-1 flex flex-col bg-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 border-b flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          메인 ({pinnedChannels.length}/{currentSize})
        </span>
        <div className="flex items-center gap-2">
          {/* Layout Mode Toggle */}
          <div className="flex items-center border rounded overflow-hidden">
            <button
              onClick={() => onLayoutModeChange('grid')}
              className={`px-2 py-1 text-xs ${
                layoutMode === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="그리드 배열"
            >
              ⊞
            </button>
            <button
              onClick={() => onLayoutModeChange('vertical')}
              className={`px-2 py-1 text-xs ${
                layoutMode === 'vertical'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="컬럼 배열"
            >
              |||
            </button>
          </div>

          {/* Size buttons */}
          <div className="flex items-center gap-1">
            {layoutMode === 'grid' ? (
              GRID_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => onGridSizeChange(size)}
                  className={`w-7 h-7 text-xs rounded ${
                    gridSize === size
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border'
                  }`}
                  title={`${size}칸 그리드`}
                >
                  {size}
                </button>
              ))
            ) : (
              VERTICAL_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => onGridSizeChange(size as GridSize)}
                  className={`w-7 h-7 text-xs rounded ${
                    gridSize === size
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border'
                  }`}
                  title={`${size}열 컬럼 배열`}
                >
                  {size}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 overflow-auto">
        {pinnedChannels.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">고정된 채널이 없습니다</p>
              <p className="text-sm text-gray-400">
                사이드바에서 채널을 우클릭하여<br />
                "메인에 고정"을 선택하세요
              </p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayChannels}
              strategy={layoutMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
              {layoutMode === 'grid' ? (
                <div className={`grid ${getGridClass(gridSize)} gap-2 h-full`}>
                  {displayChannels.map((channelId) => (
                    <SortableChatItem
                      key={channelId}
                      channelId={channelId}
                      onUnpin={onUnpin}
                    />
                  ))}
                  {emptyCells.map((_, index) => (
                    <EmptyCell key={`empty-${index}`} />
                  ))}
                </div>
              ) : (
                <div
                  className="grid gap-2 h-full"
                  style={{ gridTemplateColumns: `repeat(${Math.min(displayChannels.length, gridSize)}, 1fr)` }}
                >
                  {displayChannels.map((channelId) => (
                    <SortableChatItem
                      key={channelId}
                      channelId={channelId}
                      onUnpin={onUnpin}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
