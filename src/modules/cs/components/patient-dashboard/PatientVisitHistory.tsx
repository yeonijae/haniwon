/**
 * 환자 진료/수납 이력 컴포넌트
 * MSSQL에서 Receipt/Detail 데이터 조회
 */

import React, { useState, useEffect } from 'react';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface VisitRecord {
  date: string;
  doctor: string;
  treatType: string;
  items: string[];
  totalAmount: number;
  paidAmount: number;
}

interface PatientVisitHistoryProps {
  mssqlPatientId: number;
  chartNumber: string;
  limit?: number;
}

const PatientVisitHistory: React.FC<PatientVisitHistoryProps> = ({
  mssqlPatientId,
  chartNumber,
  limit = 20,
}) => {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVisits = async () => {
      if (!mssqlPatientId && !chartNumber) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // unified-server API로 수납 이력 조회
        const response = await fetch(`${MSSQL_API_URL}/api/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: `
              SELECT TOP ${limit}
                CONVERT(VARCHAR, r.ReceiptDate, 23) as date,
                r.Doctor as doctor,
                r.TreatGubun as treatType,
                r.TotalMoney as totalAmount,
                r.PayMoney as paidAmount
              FROM Receipt r
              WHERE r.ChartNo = '${chartNumber.replace(/'/g, "''")}'
              ORDER BY r.ReceiptDate DESC, r.ReceiptNo DESC
            `
          })
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // 결과 파싱
        const rows = data.rows || [];
        const visitRecords: VisitRecord[] = rows.map((row: any) => ({
          date: row.date || row[0],
          doctor: row.doctor || row[1] || '',
          treatType: row.treatType || row[2] || '',
          items: [],
          totalAmount: Number(row.totalAmount || row[3] || 0),
          paidAmount: Number(row.paidAmount || row[4] || 0),
        }));

        setVisits(visitRecords);
      } catch (err: any) {
        console.error('진료 이력 조회 오류:', err);
        setError(err.message || '진료 이력을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVisits();
  }, [mssqlPatientId, chartNumber, limit]);

  // 금액 포맷
  const formatMoney = (amount: number): string => {
    return amount.toLocaleString() + '원';
  };

  // 진료 구분 라벨
  const getTreatTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      '1': '건보',
      '2': '자보',
      '3': '산재',
      '4': '비급여',
    };
    return labels[type] || type || '-';
  };

  if (isLoading) {
    return (
      <div className="visit-history-loading">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <span>진료 이력 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="visit-history-error">
        <i className="fa-solid fa-exclamation-circle"></i>
        <span>{error}</span>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="visit-history-empty">
        <i className="fa-solid fa-calendar-xmark"></i>
        <span>진료 이력이 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="visit-history">
      <table className="visit-history-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>담당의</th>
            <th>구분</th>
            <th className="text-right">총액</th>
            <th className="text-right">수납</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit, idx) => (
            <tr key={idx}>
              <td className="visit-date">{visit.date}</td>
              <td className="visit-doctor">{visit.doctor || '-'}</td>
              <td className="visit-type">
                <span className={`type-badge type-${visit.treatType}`}>
                  {getTreatTypeLabel(visit.treatType)}
                </span>
              </td>
              <td className="visit-amount text-right">{formatMoney(visit.totalAmount)}</td>
              <td className="visit-paid text-right">{formatMoney(visit.paidAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientVisitHistory;
