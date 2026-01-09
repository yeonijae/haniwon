import { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarChannel } from '../../types/sidebar';
import clsx from 'clsx';

interface SidebarChannelItemProps {
  id: string;
  channel: SidebarChannel;
  isSelected: boolean;
  isPinned: boolean;
  isEditing?: boolean;
  editingName?: string;
  inFolder?: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onRename?: (newName: string) => void;
  onCancelEdit?: () => void;
}

export default function SidebarChannelItem({
  id,
  channel,
  isSelected,
  isPinned,
  isEditing,
  editingName,
  inFolder = false,
  onSelect,
  onContextMenu,
  onRename,
  onCancelEdit,
}: SidebarChannelItemProps) {
  const [localName, setLocalName] = useState(editingName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'channel', channelId: channel.id },
    disabled: isEditing,
  });

  useEffect(() => {
    if (isEditing) {
      setLocalName(editingName || channel.name || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, editingName, channel.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDirectMessage = channel.type === 'direct';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onRename?.(localName);
    } else if (e.key === 'Escape') {
      onCancelEdit?.();
    }
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="px-2 py-1"
      >
        <div className="flex items-center gap-2">
          {isDirectMessage ? (
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          ) : (
            <span className="text-gray-400 flex-shrink-0">#</span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => onRename?.(localName)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-0.5 text-sm bg-gray-700 border border-gray-600 rounded text-white min-w-0"
          />
        </div>
      </div>
    );
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e);
  };

  const hasUnread = channel.unread_count > 0;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      className={clsx(
        'w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-1',
        'hover:bg-gray-700 cursor-grab active:cursor-grabbing',
        isSelected && 'bg-gray-700',
        hasUnread && !isSelected && 'text-white font-semibold'
      )}
    >
      {isDirectMessage ? (
        <div className={clsx(
          'w-2 h-2 rounded-full flex-shrink-0',
          hasUnread ? 'bg-blue-500' : 'bg-green-500'
        )} />
      ) : (
        <span className={clsx('flex-shrink-0', hasUnread ? 'text-white' : 'text-gray-400')}>#</span>
      )}
      <span className="truncate flex-1">{channel.name || (isDirectMessage ? 'DM' : '이름 없음')}</span>
      {hasUnread && (
        <span className="bg-red-400/80 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0">
          {channel.unread_count > 99 ? '99+' : channel.unread_count}
        </span>
      )}
      {isPinned && !hasUnread && (
        <span className="text-blue-400 text-xs flex-shrink-0" title="고정됨">📌</span>
      )}
    </button>
  );
}
