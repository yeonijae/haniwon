/**
 * 환자 수납 이력 섹션 (대시보드용)
 */
import React from 'react';
import type { ReceiptHistoryItem } from '../../../manage/lib/api';

interface PatientReceiptHistoryProps {
  receipts: ReceiptHistoryItem[];
  isLoading: boolean;
}

// 금액 포맷 (천단위 콤마)
const formatAmount = (amount: number): string => {
  return amount.toLocaleString();
};

const PatientReceiptHistory: React.FC<PatientReceiptHistoryProps> = ({
  receipts,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  return (
    <div className="dashboard-section-content">
      {/* 수납 목록 */}
      {receipts.length === 0 ? (
        <div className="section-empty">수납 이력이 없습니다.</div>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>종별</th>
              <th className="text-right">총액</th>
              <th className="text-right">미수</th>
              <th>진료</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td className="td-date">{receipt.receipt_date || '-'}</td>
                <td>{receipt.insurance_type || '-'}</td>
                <td className="text-right">{formatAmount(receipt.total_amount)}</td>
                <td className={`text-right ${(receipt.unpaid ?? 0) > 0 ? 'text-danger' : ''}`}>
                  {receipt.unpaid ? formatAmount(receipt.unpaid) : '-'}
                </td>
                <td className="td-treatment">
                  {receipt.treatment_summary && (
                    <span className="treatment-tags">
                      {receipt.treatment_summary.acupuncture && <span className="tag">침</span>}
                      {receipt.treatment_summary.choona && <span className="tag">추나</span>}
                      {receipt.treatment_summary.yakchim && <span className="tag">약침</span>}
                      {receipt.treatment_summary.uncovered?.map((item) => (
                        <span key={item.id} className="tag uncovered">{item.name}</span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PatientReceiptHistory;
