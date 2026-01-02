import React from 'react';
import YakchimPanel, { YakchimSaveData } from './YakchimPanel';

interface YakchimModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  onSave?: (data: YakchimSaveData) => void;
}

const YakchimModal: React.FC<YakchimModalProps> = ({
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

  const handleSave = (data: YakchimSaveData) => {
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
    <div className="yakchim-modal-backdrop" onClick={handleBackdropClick}>
      <div className="yakchim-modal">
        <div className="yakchim-modal-header">
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
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default YakchimModal;
