import React, { useState, useEffect, useRef, useCallback } from 'react';
import UncoveredItemInfo from './UncoveredItemInfo';
import UncoveredMemoSection from './UncoveredMemoSection';
import YakchimContent from './contents/YakchimContent';
import HerbalContent from './contents/HerbalContent';
import NokryongContent from './contents/NokryongContent';
import MedicineContent from './contents/MedicineContent';
import PackageContent from './contents/PackageContent';
import MembershipContent from './contents/MembershipContent';
import OtherContent from './contents/OtherContent';

export type UncoveredItemType = 'yakchim' | 'herbal' | 'nokryong' | 'medicine' | 'package' | 'membership' | 'other';

export interface UncoveredModalProps {
  isOpen: boolean;
  itemName: string;
  itemType: UncoveredItemType;
  amount: number;
  detailId?: number;
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  isEditMode?: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

/** 각 Content 컴포넌트에 전달되는 공통 props */
export interface ContentComponentProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  itemName: string;
  amount: number;
  detailId?: number;
  isEditMode?: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onMemoRefresh: () => void;
}

const UncoveredItemModal: React.FC<UncoveredModalProps> = ({
  isOpen,
  itemName,
  itemType,
  amount,
  detailId,
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  isEditMode,
  onSuccess,
  onClose,
}) => {
  const [memoRefreshTrigger, setMemoRefreshTrigger] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 열릴 때 위치 초기화
  useEffect(() => {
    if (isOpen) setPos(null);
  }, [isOpen]);

  // 드래그 핸들러
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // 헤더 영역에서만 드래그 시작 (닫기 버튼 제외)
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left + rect.width / 2,
      origY: rect.top + rect.height / 2,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const centerX = dragRef.current.origX + dx;
      const centerY = dragRef.current.origY + dy;
      setPos({
        x: centerX - window.innerWidth / 2,
        y: centerY - window.innerHeight / 2,
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMemoRefresh = () => {
    setMemoRefreshTrigger(prev => prev + 1);
  };

  const contentProps: ContentComponentProps = {
    patientId,
    patientName,
    chartNumber,
    receiptId,
    receiptDate,
    itemName,
    amount,
    detailId,
    isEditMode,
    onSuccess,
    onClose,
    onMemoRefresh: handleMemoRefresh,
  };

  const renderContent = () => {
    switch (itemType) {
      case 'yakchim':
        return <YakchimContent {...contentProps} />;
      case 'herbal':
        return <HerbalContent {...contentProps} />;
      case 'nokryong':
        return <NokryongContent {...contentProps} />;
      case 'medicine':
        return <MedicineContent {...contentProps} />;
      case 'package':
        return <PackageContent {...contentProps} />;
      case 'membership':
        return <MembershipContent {...contentProps} />;
      case 'other':
        return <OtherContent {...contentProps} />;
      default:
        return <OtherContent {...contentProps} />;
    }
  };

  const modalStyle: React.CSSProperties = {
    position: 'relative',
    width: 640,
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: 0,
    borderRadius: 8,
    ...(pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : {}),
  };

  return (
    <div className="modal-overlay">
      <div
        ref={modalRef}
        className="uncovered-modal modal-content"
        style={modalStyle}
      >
        {/* 닫기 버튼 (절대 위치) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: '#9CA3AF',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1,
            zIndex: 1,
          }}
          title="닫기 (ESC)"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* 항목 정보 헤더 (드래그 핸들) */}
        <div onMouseDown={handleDragStart} style={{ cursor: 'grab', userSelect: 'none' }}>
          <UncoveredItemInfo
            itemName={itemName}
            amount={amount}
            patientName={patientName}
            chartNumber={chartNumber}
            receiptDate={receiptDate}
          />
        </div>

        {/* 유형별 액션 콘텐츠 */}
        {renderContent()}

        {/* 메모 섹션 */}
        <UncoveredMemoSection
          patientId={patientId}
          chartNumber={chartNumber}
          patientName={patientName}
          receiptId={receiptId}
          receiptDate={receiptDate}
          detailId={detailId}
          refreshTrigger={memoRefreshTrigger}
        />
      </div>
    </div>
  );
};

export default UncoveredItemModal;
