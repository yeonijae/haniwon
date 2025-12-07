import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  maxWidth?: string; // 커스텀 최대 너비 (예: '1000px')
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, wide = false, fullWidth = false, fullHeight = false, maxWidth }) => {
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

  const modalWidthClass = maxWidth
    ? 'w-full'
    : fullWidth
      ? 'w-full max-w-[98vw]'
      : wide
        ? 'w-full max-w-[95vw]'
        : 'w-full max-w-2xl';

  const customMaxWidthStyle = maxWidth ? { maxWidth } : {};

  const modalHeightClass = fullHeight ? 'h-[95vh]' : 'max-h-[90vh]';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
    >
      <div
        className={`bg-white rounded-lg shadow-xl mx-4 ${modalWidthClass} ${modalHeightClass} flex flex-col`}
        style={customMaxWidthStyle}
      >
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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