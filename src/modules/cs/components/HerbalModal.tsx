import React from 'react';
import HerbalPanel, { HerbalSaveData } from './HerbalPanel';

interface HerbalModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  onSave?: (data: HerbalSaveData) => void;
}

const HerbalModal: React.FC<HerbalModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  onSave,
}) => {
  if (!isOpen) return null;

  const handleSave = (data: HerbalSaveData) => {
    onSave?.(data);
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
    <div className="herbal-modal-backdrop" onClick={handleBackdropClick}>
      <div className="herbal-modal">
        <div className="herbal-modal-header">
          <h2>
            <i className="fa-solid fa-mortar-pestle"></i>
            {' '}한약 관리 - {patientName}
            <span className="patient-info">({displayChartNo})</span>
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="herbal-modal-body">
          <HerbalPanel
            patientId={patientId}
            patientName={patientName}
            chartNumber={chartNumber}
            receiptId={receiptId}
            receiptDate={receiptDate}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default HerbalModal;
