import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SidebarItem, SidebarChannel } from '../../types/sidebar';
import SidebarChannelItem from './SidebarChannelItem';
import clsx from 'clsx';

interface SidebarFolderProps {
  id: string;
  name: string;
  isExpanded: boolean;
  children: SidebarItem[];
  channels: Map<string, SidebarChannel>;
  selectedChannelId: string | null;
  pinnedChannels: string[];
  editingChannelId?: string | null;
  editingChannelName?: string;
  onToggle: () => void;
  onSelectChannel: (channelId: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onChannelContextMenu?: (e: React.MouseEvent, channelId: string) => void;
  onRenameChannel?: (channelId: string, newName: string) => void;
  onCancelChannelEdit?: () => void;
}

export default function SidebarFolder({
  id,
  name,
  isExpanded,
  children,
  channels,
  selectedChannelId,
  pinnedChannels,
  editingChannelId,
  editingChannelName,
  onToggle,
  onSelectChannel,
  onContextMenu,
  onChannelContextMenu,
  onRenameChannel,
  onCancelChannelEdit,
}: SidebarFolderProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-drop-${id}`,
    data: { type: 'folder', folderId: id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const channelCount = children.filter(c => c.type === 'channel').length;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e);
  };

  // Filter valid channel items
  const validChildren = children.filter((item) => {
    if (item.type === 'channel' && item.channelId) {
      return channels.has(item.channelId);
    }
    return false;
  });

  return (
    <div ref={setSortableRef} style={style}>
      {/* Folder Header */}
      <div
        ref={setDroppableRef}
        {...attributes}
        {...listeners}
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none rounded',
          'hover:bg-gray-700 text-gray-300 hover:text-white',
          isOver && 'bg-blue-600/30 ring-1 ring-blue-500'
        )}
      >
        <span className="text-base flex-shrink-0">{isExpanded ? '📂' : '📁'}</span>
        <span className="flex-1 text-sm font-medium truncate">{name}</span>
        {!isExpanded && channelCount > 0 && (
          <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded-full">
            {channelCount}
          </span>
        )}
      </div>

      {/* Folder Children with tree style */}
      {isExpanded && validChildren.length > 0 && (
        <div className="ml-2">
          <SortableContext
            items={validChildren.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {validChildren.map((item, index) => {
              if (item.type === 'channel' && item.channelId) {
                const channel = channels.get(item.channelId);
                if (!channel) return null;
                const isLast = index === validChildren.length - 1;
                return (
                  <div key={item.id} className="flex items-stretch">
                    {/* Tree branch */}
                    <div className="flex flex-col items-center w-4 flex-shrink-0">
                      <div className={clsx(
                        'w-px bg-gray-600',
                        isLast ? 'h-3' : 'flex-1'
                      )} />
                      <div className="w-2 h-px bg-gray-600" style={{ marginTop: isLast ? 0 : undefined }} />
                      {!isLast && <div className="w-px bg-gray-600 flex-1" />}
                    </div>
                    {/* Channel item */}
                    <div className="flex-1 min-w-0">
                      <SidebarChannelItem
                        id={item.id}
                        channel={channel}
                        isSelected={selectedChannelId === item.channelId}
                        isPinned={pinnedChannels.includes(item.channelId)}
                        isEditing={editingChannelId === item.channelId}
                        editingName={editingChannelName}
                        onSelect={() => onSelectChannel(item.channelId!)}
                        onContextMenu={(e) => onChannelContextMenu?.(e, item.channelId!)}
                        onRename={(newName) => onRenameChannel?.(item.channelId!, newName)}
                        onCancelEdit={onCancelChannelEdit}
                        inFolder={true}
                      />
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </SortableContext>
        </div>
      )}

      {/* Empty folder message */}
      {isExpanded && validChildren.length === 0 && (
        <div className="ml-6 py-1 text-xs text-gray-500 italic">
          비어있음
        </div>
      )}
    </div>
  );
}
