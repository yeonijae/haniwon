import React from 'react';
import type { ExpandedReceiptItem } from '../receiptHelpers';
import { formatMoney } from '../receiptHelpers';

interface TodayReceiptDetailProps {
  receipt: ExpandedReceiptItem;
  selectedDate: string;
}

export default function TodayReceiptDetail({ receipt, selectedDate }: TodayReceiptDetailProps) {
  const coveredItems = receipt.treatments.filter(t => t.is_covered);
  const uncoveredItems = receipt.treatments.filter(t => !t.is_covered);

  const paymentMethods: { label: string; amount: number; icon: string; color: string }[] = [];
  if (receipt.card > 0) paymentMethods.push({ label: '카드', amount: receipt.card, icon: 'fa-credit-card', color: '#6b7280' });
  if (receipt.cash > 0) paymentMethods.push({ label: '현금', amount: receipt.cash, icon: 'fa-money-bill', color: '#16a34a' });
  if (receipt.transfer > 0) paymentMethods.push({ label: '이체', amount: receipt.transfer, icon: 'fa-building-columns', color: '#2563eb' });

  return (
    <div className="trd-container">
      <div className="trd-header-info">
        <span className="trd-visit-type">{receipt.insurance_type || '-'}</span>
        <span className="trd-total-badge">{formatMoney(receipt.total_amount)}원</span>
        <span className="trd-date">{selectedDate}</span>
      </div>

      {coveredItems.length > 0 && (
        <div className="trd-section">
          <h4 className="trd-section-title insurance">
            <i className="fa-solid fa-shield-halved" /> 급여 항목
          </h4>
          <div className="trd-insurance-items">
            {coveredItems.map((item, idx) => (
              <div key={idx} className="trd-item">
                <span className="trd-item-name">{item.name}</span>
                <span className="trd-item-amount">{(item.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="trd-subtotal">
            <span>본인부담금</span>
            <span className="amount">{formatMoney(receipt.insurance_self)}원</span>
          </div>
        </div>
      )}

      {uncoveredItems.length > 0 && (
        <div className="trd-section">
          <h4 className="trd-section-title general">
            <i className="fa-solid fa-receipt" /> 비급여 항목
          </h4>
          <table className="trd-table">
            <tbody>
              {uncoveredItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="trd-col-name">{item.name}</td>
                  <td className="trd-col-amount">{(item.amount || 0).toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="trd-total-row">
                <td>비급여 합계</td>
                <td className="trd-col-amount">{formatMoney(receipt.general_amount)}원</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="trd-grand-total">
        <span className="label">총 수납액</span>
        <span className="amount">{formatMoney(receipt.total_amount)}원</span>
      </div>

      {paymentMethods.length > 0 && (
        <div className="trd-payment-methods">
          {paymentMethods.map((pm, idx) => (
            <span key={idx} className="trd-pm-badge" style={{ color: pm.color }}>
              <i className={`fa-solid ${pm.icon}`} /> {pm.label} {pm.amount.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      <style>{`
        .trd-container { padding: 12px; font-size: 13px; }
        .trd-header-info { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
        .trd-visit-type { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #dbeafe; color: #1e40af; }
        .trd-total-badge { font-weight: 700; color: #374151; }
        .trd-date { color: #9ca3af; font-size: 12px; margin-left: auto; }
        .trd-section { margin-bottom: 14px; }
        .trd-section-title { font-size: 12px; font-weight: 700; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; }
        .trd-section-title.insurance { color: #2563eb; }
        .trd-section-title.general { color: #f59e0b; }
        .trd-insurance-items { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .trd-item { display: flex; justify-content: space-between; padding: 3px 6px; border-radius: 4px; background: #f9fafb; }
        .trd-item-name { color: #374151; }
        .trd-item-amount { font-weight: 600; color: #1e40af; }
        .trd-subtotal { display: flex; justify-content: space-between; margin-top: 6px; padding: 6px 8px; background: #eff6ff; border-radius: 6px; font-weight: 600; color: #1e40af; }
        .trd-table { width: 100%; border-collapse: collapse; }
        .trd-table td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
        .trd-col-name { color: #374151; }
        .trd-col-amount { text-align: right; font-weight: 600; white-space: nowrap; }
        .trd-total-row td { font-weight: 700; border-top: 2px solid #e5e7eb; color: #f59e0b; }
        .trd-grand-total { display: flex; justify-content: space-between; padding: 10px 12px; background: #1e293b; border-radius: 8px; color: white; margin-bottom: 10px; }
        .trd-grand-total .label { font-weight: 500; }
        .trd-grand-total .amount { font-size: 16px; font-weight: 800; }
        .trd-payment-methods { display: flex; gap: 10px; flex-wrap: wrap; }
        .trd-pm-badge { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }
      `}</style>
    </div>
  );
}
