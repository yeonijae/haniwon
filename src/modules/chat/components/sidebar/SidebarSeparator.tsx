import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SidebarSeparatorProps {
  id: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export default function SidebarSeparator({ id, onContextMenu }: SidebarSeparatorProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={handleContextMenu}
      className="py-2 px-2 cursor-grab active:cursor-grabbing"
    >
      <div className="border-t border-gray-600 hover:border-gray-500" />
    </div>
  );
}
