import React, { useState, useRef, useEffect, useCallback } from 'react';
import YakchimPanel from './YakchimPanel';

interface YakchimModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  // 처리 필요 항목들 (0원 약침, 약침포인트, 멤버십)
  pendingItems?: { name: string; amount: number }[];
  onSave?: () => void;
}

const YakchimModal: React.FC<YakchimModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  pendingItems = [],
  onSave,
}) => {
  // 드래그 상태
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
    // 헤더 영역에서만 드래그 시작 (닫기 버튼 제외)
    if ((e.target as HTMLElement).closest('.modal-close-btn')) return;

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

  if (!isOpen) return null;

  const handleSave = () => {
    onSave?.();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 차트번호에서 앞자리 0 제거
  const displayChartNo = chartNumber.replace(/^0+/, '');

  return (
    <div className="yakchim-modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={modalRef}
        className={`yakchim-modal ${isDragging ? 'dragging' : ''}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        <div
          className="yakchim-modal-header draggable"
          onMouseDown={handleMouseDown}
        >
          <h2>
            <i className="fa-solid fa-syringe"></i>
            {' '}약침 관리 - {patientName}
            <span className="patient-info">({displayChartNo})</span>
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="yakchim-modal-body">
          <YakchimPanel
            patientId={patientId}
            patientName={patientName}
            chartNumber={chartNumber}
            receiptId={receiptId}
            receiptDate={receiptDate}
            pendingItems={pendingItems}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default YakchimModal;
