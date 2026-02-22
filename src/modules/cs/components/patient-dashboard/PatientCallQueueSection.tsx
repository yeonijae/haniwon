/**
 * 환자 해피콜 대기열 섹션 (대시보드용)
 */
import React from 'react';
import type { CallQueueItem } from '../../types/crm';

interface PatientCallQueueSectionProps {
  callQueue: CallQueueItem[];
  isLoading: boolean;
}

// 콜 유형 라벨
const CALL_TYPE_LABELS: Record<string, string> = {
  delivery: '배송콜',
  churn_risk_1: '이탈방지(1차)',
  churn_risk_3: '이탈방지(3차)',
  unconsumed: '미소진',
  vip_care: 'VIP케어',
  custom: '커스텀',
};

// 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  completed: '완료',
  no_answer: '부재',
  postponed: '연기',
  canceled: '취소',
};

const PatientCallQueueSection: React.FC<PatientCallQueueSectionProps> = ({
  callQueue,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  const pending = callQueue.filter(q => q.status === 'pending');
  const completed = callQueue.filter(q => q.status !== 'pending');

  return (
    <div className="dashboard-section-content">
      {callQueue.length === 0 ? (
        <div className="section-empty">해피콜 이력이 없습니다.</div>
      ) : (
        <>
          {/* 대기 중 */}
          {pending.length > 0 && (
            <div className="callqueue-group">
              <h5 className="group-label">대기 중 ({pending.length}건)</h5>
              {pending.map((item) => (
                <div key={item.id} className="callqueue-item pending">
                  <span className="cq-type">{CALL_TYPE_LABELS[item.call_type] || item.call_type}</span>
                  <span className="cq-date">{item.due_date || '-'}</span>
                  <span className="cq-reason">{item.related_type || ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* 완료/처리됨 */}
          {completed.length > 0 && (
            <div className="callqueue-group">
              <h5 className="group-label">처리됨</h5>
              {completed.slice(0, 5).map((item) => (
                <div key={item.id} className={`callqueue-item ${item.status}`}>
                  <span className="cq-type">{CALL_TYPE_LABELS[item.call_type] || item.call_type}</span>
                  <span className="cq-status">{STATUS_LABELS[item.status] || item.status}</span>
                  <span className="cq-date">{item.completed_at || item.due_date || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PatientCallQueueSection;
