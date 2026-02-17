import React, { useEffect, useState } from 'react';
import type { PortalUser } from '@shared/types';
import type { ExpandedReceiptItem } from '../receiptHelpers';
import type { MssqlPatient } from '../../lib/patientSync';
import EmrMemoPanel from '../patient-dashboard/EmrMemoPanel';
import TodayReceiptDetail from './TodayReceiptDetail';
import InlineReceiptHistory from '../InlineReceiptHistory';

const MSSQL_API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface InsuranceDashboardProps {
  isOpen: boolean;
  patientId: number;
  patientName: string;
  chartNo: string;
  selectedDate: string;
  receipt: ExpandedReceiptItem | null;
  user: PortalUser;
  onClose: () => void;
}

export default function InsuranceDashboard({
  isOpen,
  patientId,
  patientName,
  chartNo,
  selectedDate,
  receipt,
  user,
  onClose,
}: InsuranceDashboardProps) {
  const [mssqlData, setMssqlData] = useState<MssqlPatient | null>(null);

  useEffect(() => {
    if (!isOpen || !patientId) return;
    (async () => {
      try {
        const res = await fetch(`${MSSQL_API_BASE}/api/patients/${patientId}`);
        if (res.ok) {
          const data = await res.json();
          setMssqlData(data);
        }
      } catch (err) {
        console.error('MSSQL 환자 데이터 로드 실패:', err);
      }
    })();
  }, [isOpen, patientId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <style>{STYLES}</style>
      <div className="ins-dash-overlay">
        <div className="ins-dash-container">
          {/* 헤더 */}
          <div className="ins-dash-header">
            <div className="ins-dash-title">
              <i className="fa-solid fa-shield-halved" style={{ color: '#2563eb', marginRight: 8 }} />
              급여 대시보드 — {patientName}
              <span className="ins-dash-chart">({chartNo.replace(/^0+/, '')})</span>
            </div>
            <button className="ins-dash-close" onClick={onClose}>
              <i className="fa-solid fa-times" />
            </button>
          </div>

          {/* 3단 레이아웃 */}
          <div className="ins-dash-body">
            {/* 왼쪽: 메모 */}
            <div className="ins-dash-col memo">
              <div className="ins-dash-col-title">
                <i className="fa-solid fa-sticky-note" /> 메모
              </div>
              <EmrMemoPanel
                doctorMemo={mssqlData?.doctor_memo}
                nurseMemo={mssqlData?.nurse_memo}
                etcMemo={mssqlData?.etc_memo}
                layout="vertical"
              />
            </div>

            {/* 가운데: 오늘 수납 */}
            <div className="ins-dash-col today">
              <div className="ins-dash-col-title">
                <i className="fa-solid fa-receipt" /> 오늘 수납 ({selectedDate})
              </div>
              <div className="ins-dash-col-content">
                {receipt ? (
                  <TodayReceiptDetail receipt={receipt} selectedDate={selectedDate} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>
                    {selectedDate} 수납 내역이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: 과거 수납 */}
            <div className="ins-dash-col history">
              <div className="ins-dash-col-title">
                <i className="fa-solid fa-clock-rotate-left" /> 과거 수납 내역
              </div>
              <div className="ins-dash-col-content">
                <InlineReceiptHistory
                  patientId={patientId}
                  patientName={patientName}
                  chartNo={chartNo}
                  currentDate={selectedDate}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const STYLES = `
  .ins-dash-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: #f8fafc;
  }
  .ins-dash-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .ins-dash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    flex-shrink: 0;
  }
  .ins-dash-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
  }
  .ins-dash-chart {
    font-weight: 400;
    color: #9ca3af;
    margin-left: 8px;
    font-size: 14px;
  }
  .ins-dash-close {
    border: none;
    background: none;
    font-size: 18px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .ins-dash-close:hover { background: #f3f4f6; color: #374151; }

  .ins-dash-body {
    display: grid;
    grid-template-columns: 280px 1fr 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .ins-dash-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .ins-dash-col.memo {
    border-right: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  .ins-dash-col.today {
    border-right: 1px solid #e5e7eb;
  }
  .ins-dash-col-title {
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 700;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .ins-dash-col-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* 세로 메모 레이아웃 */
  .ins-dash-col.memo .emr-memo-grid.vertical {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
  }
  .ins-dash-col.memo .emr-memo-grid.vertical .emr-memo-card {
    border-radius: 0;
    border-bottom: 1px solid #e5e7eb;
    margin: 0;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .ins-dash-col.memo .emr-memo-grid.vertical .emr-memo-content {
    max-height: none;
  }
`;
