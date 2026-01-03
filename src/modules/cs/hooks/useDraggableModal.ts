import { useState, useRef, useEffect, useCallback } from 'react';

interface DraggableModalOptions {
  isOpen: boolean;
}

export function useDraggableModal({ isOpen }: DraggableModalOptions) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달이 열릴 때 위치 초기화
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 닫기 버튼, 입력 필드, 버튼 등은 드래그 시작점에서 제외
    const target = e.target as HTMLElement;
    if (
      target.closest('.modal-close-btn') ||
      target.closest('.close-btn') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea')
    ) {
      return;
    }

    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  // 드래그 중
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return {
    modalRef,
    position,
    isDragging,
    handleMouseDown,
    modalStyle: {
      transform: `translate(${position.x}px, ${position.y}px)`,
    },
    modalClassName: isDragging ? 'dragging' : '',
  };
}
