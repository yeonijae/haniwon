import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { fetchReceiptDetails, type ReceiptDetailItem } from '../lib/api';

interface ReceiptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  receiptDate: string;
  insuranceSelf?: number;
  generalAmount?: number;
}

export function ReceiptDetailModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNo,
  receiptDate,
  insuranceSelf,
  generalAmount,
}: ReceiptDetailModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState<ReceiptDetailItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 드래그 기능
  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });

  // ESC 키로 닫기
  useEscapeKey(onClose, isOpen);

  // 데이터 로드
  useEffect(() => {
    if (!isOpen) return;

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchReceiptDetails(patientId, receiptDate);
        setDetails(data);
      } catch (err) {
        setError('진료상세내역을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [isOpen, patientId, receiptDate]);

  if (!isOpen) return null;

  // 급여/비급여 항목 분리
  const insuranceItems = details.filter(d => d.is_insurance);
  const generalItems = details.filter(d => !d.is_insurance);

  // 합계 계산
  const insuranceTotal = insuranceItems.reduce((sum, d) => sum + (d.amount || 0), 0);
  const generalTotal = generalItems.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div
      className="receipt-detail-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        className={`modal-container receipt-detail-modal ${modalClassName}`}
        style={{ ...modalStyle, width: '480px', maxHeight: '80vh', background: 'white', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="modal-header" onMouseDown={handleMouseDown}>
          <h3 className="modal-title">
            <i className="fa-solid fa-file-invoice-dollar"></i>
            진료상세내역
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 환자 정보 */}
        <div className="receipt-detail-patient-info">
          <span className="patient-name">{patientName}</span>
          <span className="chart-no">({chartNo.replace(/^0+/, '')})</span>
          <span className="receipt-date">{receiptDate}</span>
        </div>

        {/* 내용 */}
        <div className="modal-body">
          {isLoading && (
            <div className="receipt-detail-loading">
              <i className="fa-solid fa-spinner fa-spin"></i> 불러오는 중...
            </div>
          )}

          {error && (
            <div className="receipt-detail-error">
              <i className="fa-solid fa-circle-exclamation"></i> {error}
            </div>
          )}

          {!isLoading && !error && details.length === 0 && (
            <div className="receipt-detail-empty">
              <i className="fa-solid fa-file-circle-question"></i>
              <p>진료상세내역이 없습니다.</p>
            </div>
          )}

          {!isLoading && !error && details.length > 0 && (
            <div className="receipt-detail-content">
              {/* 급여 항목 */}
              {insuranceItems.length > 0 && (
                <div className="receipt-detail-section">
                  <h4 className="section-title insurance">
                    <i className="fa-solid fa-shield-halved"></i>
                    급여 항목
                  </h4>
                  <table className="receipt-detail-table">
                    <thead>
                      <tr>
                        <th className="col-name">항목명</th>
                        <th className="col-count">횟수</th>
                        <th className="col-amount">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insuranceItems.map((item, idx) => {
                        const totalCount = (item.days || 1) * (item.daily_dose || 1);
                        return (
                          <tr key={idx}>
                            <td className="col-name">{item.item_name}</td>
                            <td className="col-count">{totalCount}</td>
                            <td className="col-amount">{(item.amount || 0).toLocaleString()}원</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan={2}>본인부담금</td>
                        <td className="col-amount">{(insuranceSelf || insuranceTotal).toLocaleString()}원</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 비급여 항목 */}
              {generalItems.length > 0 && (
                <div className="receipt-detail-section">
                  <h4 className="section-title general">
                    <i className="fa-solid fa-receipt"></i>
                    비급여 항목
                  </h4>
                  <table className="receipt-detail-table">
                    <thead>
                      <tr>
                        <th className="col-name">항목명</th>
                        <th className="col-count">횟수</th>
                        <th className="col-amount">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalItems.map((item, idx) => {
                        const totalCount = (item.days || 1) * (item.daily_dose || 1);
                        return (
                          <tr key={idx}>
                            <td className="col-name">{item.item_name}</td>
                            <td className="col-count">{totalCount}</td>
                            <td className="col-amount">{(item.amount || 0).toLocaleString()}원</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan={2}>비급여 합계</td>
                        <td className="col-amount">{(generalAmount || generalTotal).toLocaleString()}원</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 총합계 */}
              <div className="receipt-detail-grand-total">
                <span className="label">총 수납액</span>
                <span className="amount">
                  {((insuranceSelf || insuranceTotal) + (generalAmount || generalTotal)).toLocaleString()}원
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>

      <style>{`
        .receipt-detail-modal {
          display: flex;
          flex-direction: column;
        }

        .receipt-detail-patient-info {
          padding: 8px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .receipt-detail-patient-info .patient-name {
          font-weight: 600;
          color: #212529;
        }

        .receipt-detail-patient-info .chart-no {
          color: #6c757d;
        }

        .receipt-detail-patient-info .receipt-date {
          margin-left: auto;
          color: #495057;
        }

        .receipt-detail-modal .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .receipt-detail-loading,
        .receipt-detail-error,
        .receipt-detail-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #6c757d;
          gap: 8px;
        }

        .receipt-detail-error {
          color: #dc3545;
        }

        .receipt-detail-section {
          margin-bottom: 20px;
        }

        .receipt-detail-section .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 8px 0;
          padding: 6px 10px;
          border-radius: 4px;
        }

        .receipt-detail-section .section-title.insurance {
          background: #e3f2fd;
          color: #1565c0;
        }

        .receipt-detail-section .section-title.general {
          background: #fff3e0;
          color: #e65100;
        }

        .receipt-detail-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .receipt-detail-table th,
        .receipt-detail-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e9ecef;
        }

        .receipt-detail-table th {
          background: #f8f9fa;
          font-weight: 500;
          color: #495057;
          text-align: left;
        }

        .receipt-detail-table .col-name {
          width: auto;
        }

        .receipt-detail-table .col-count {
          width: 60px;
          text-align: center;
        }

        .receipt-detail-table .col-amount {
          width: 100px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .receipt-detail-table tfoot .total-row {
          font-weight: 600;
          background: #f8f9fa;
        }

        .receipt-detail-table tfoot .total-row td {
          border-bottom: none;
        }

        .receipt-detail-grand-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #212529;
          color: white;
          border-radius: 6px;
          margin-top: 12px;
        }

        .receipt-detail-grand-total .label {
          font-weight: 500;
        }

        .receipt-detail-grand-total .amount {
          font-size: 18px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .receipt-detail-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          cursor: grab;
          user-select: none;
        }

        .receipt-detail-modal .modal-header:active {
          cursor: grabbing;
        }

        .receipt-detail-modal .modal-title {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .receipt-detail-modal .modal-close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: #6b7280;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
        }

        .receipt-detail-modal .modal-close-btn:hover {
          background: #e5e7eb;
          color: #1f2937;
        }

        .receipt-detail-modal .modal-footer {
          padding: 12px 16px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
        }

        .receipt-detail-modal .modal-footer .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }

        .receipt-detail-modal .modal-footer .btn:hover {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}
