/**
 * PatientReceiptHistory - 환자 수납이력 간략 카드 (원장실 사이드패널용)
 */
import React, { useState, useEffect } from 'react';
import { query } from '@shared/lib/postgres';

interface ReceiptItem {
  receipt_date: string;
  memo: string | null;
  count: number;
}

interface Props {
  patientId: number;
}

const PatientReceiptHistory: React.FC<Props> = ({ patientId }) => {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, [patientId]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      // 날짜별로 그룹화, 메모 합쳐서 표시
      const data = await query<ReceiptItem>(
        `SELECT receipt_date, 
                string_agg(DISTINCT memo, ' / ') FILTER (WHERE memo IS NOT NULL AND memo != '') as memo,
                COUNT(*)::int as count
         FROM cs_receipt_memos 
         WHERE patient_id = ${patientId}
         GROUP BY receipt_date
         ORDER BY receipt_date DESC
         LIMIT 20`
      );
      setItems(data || []);
    } catch (error) {
      console.error('수납이력 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const displayItems = expanded ? items : items.slice(0, 5);

  const formatDate = (dateStr: string) => {
    // YYYY-MM-DD → MM/DD
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return dateStr;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-semibold text-gray-600">
          수납이력 ({items.length})
        </span>
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-gray-400`}></i>
      </div>
      <div className="divide-y divide-gray-100">
        {displayItems.map((item, idx) => (
          <div key={idx} className="px-3 py-1.5 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                {formatDate(item.receipt_date)}
              </span>
            </div>
            {item.memo && (
              <p className="text-xs text-gray-500 truncate mt-0.5" title={item.memo}>
                {item.memo}
              </p>
            )}
          </div>
        ))}
      </div>
      {!expanded && items.length > 5 && (
        <div
          className="px-3 py-1.5 text-center text-xs text-blue-500 cursor-pointer hover:bg-blue-50 border-t border-gray-100"
          onClick={() => setExpanded(true)}
        >
          더보기 (+{items.length - 5})
        </div>
      )}
    </div>
  );
};

export default PatientReceiptHistory;
