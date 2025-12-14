import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  fullScreen?: boolean; // 화면 꽉 채우기
  maxWidth?: string; // 커스텀 최대 너비 (예: '1000px')
  headerExtra?: React.ReactNode; // 제목 옆에 추가할 컴포넌트
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, wide = false, fullWidth = false, fullHeight = false, fullScreen = false, maxWidth, headerExtra }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const modalWidthClass = fullScreen
    ? 'w-[98vw]'
    : maxWidth
      ? 'w-full'
      : fullWidth
        ? 'w-full max-w-[98vw]'
        : wide
          ? 'w-full max-w-[95vw]'
          : 'w-full max-w-2xl';

  const customMaxWidthStyle = maxWidth ? { maxWidth } : {};

  const modalHeightClass = fullScreen ? 'h-[95vh]' : fullHeight ? 'h-[95vh]' : 'max-h-[90vh]';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
    >
      <div
        className={`bg-white rounded-lg shadow-xl mx-4 ${modalWidthClass} ${modalHeightClass} flex flex-col`}
        style={customMaxWidthStyle}
      >
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <h3 className="text-xl font-semibold">{title}</h3>
            {headerExtra && <div className="flex-1">{headerExtra}</div>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            <i className="fa-solid fa-times text-2xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;