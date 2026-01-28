/**
 * 환자 응대 기록 표시 컴포넌트
 */

import React from 'react';
import type { ContactLog, ContactDirection, ContactChannel, ContactType } from '../../types/crm';

// 방향 라벨/아이콘
const DIRECTION_CONFIG: Record<ContactDirection, { label: string; icon: string; className: string }> = {
  inbound: { label: '인바운드', icon: 'fa-arrow-down', className: 'inbound' },
  outbound: { label: '아웃바운드', icon: 'fa-arrow-up', className: 'outbound' },
};

// 채널 라벨/아이콘
const CHANNEL_CONFIG: Record<ContactChannel, { label: string; icon: string }> = {
  phone: { label: '전화', icon: 'fa-phone' },
  kakao: { label: '카톡', icon: 'fa-comment' },
  sms: { label: 'SMS', icon: 'fa-message' },
  visit: { label: '방문', icon: 'fa-person-walking' },
  naver: { label: '네이버', icon: 'fa-n' },
};

// 유형 라벨
const TYPE_LABELS: Record<ContactType, string> = {
  // 인바운드
  inquiry: '문의',
  reservation: '예약',
  complaint: '컴플레인',
  other: '기타',
  // 아웃바운드
  delivery_call: '배송콜',
  visit_call: '내원콜',
  after_call: '애프터콜',
  marketing: '마케팅',
  follow_up: '후속연락',
};

interface PatientContactHistoryProps {
  logs: ContactLog[];
  compact?: boolean;
  onLogClick?: (log: ContactLog) => void;
}

const PatientContactHistory: React.FC<PatientContactHistoryProps> = ({
  logs,
  compact = false,
  onLogClick,
}) => {
  // 시간 포맷
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제 ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (logs.length === 0) {
    return (
      <div className="contact-history-empty">
        <i className="fa-solid fa-comments"></i>
        <span>응대 기록이 없습니다.</span>
      </div>
    );
  }

  return (
    <div className={`contact-history ${compact ? 'compact' : ''}`}>
      {logs.map(log => {
        const direction = DIRECTION_CONFIG[log.direction];
        const channel = CHANNEL_CONFIG[log.channel];
        const typeLabel = TYPE_LABELS[log.contact_type] || log.contact_type;

        return (
          <div
            key={log.id}
            className={`contact-log-item ${direction.className}`}
            onClick={() => onLogClick?.(log)}
          >
            <div className="log-header">
              <div className="log-badges">
                <span className={`badge direction ${direction.className}`}>
                  <i className={`fa-solid ${direction.icon}`}></i>
                  {!compact && direction.label}
                </span>
                <span className="badge channel">
                  <i className={`fa-solid ${channel.icon}`}></i>
                  {channel.label}
                </span>
                <span className="badge type">{typeLabel}</span>
              </div>
              <span className="log-time">{formatTime(log.created_at)}</span>
            </div>

            {log.content && (
              <div className="log-content">
                {compact ? (
                  <span className="content-preview">
                    {log.content.length > 50 ? log.content.slice(0, 50) + '...' : log.content}
                  </span>
                ) : (
                  <p>{log.content}</p>
                )}
              </div>
            )}

            {log.result && !compact && (
              <div className="log-result">
                <span className="result-label">결과:</span>
                <span className="result-text">{log.result}</span>
              </div>
            )}

            {log.created_by && !compact && (
              <div className="log-footer">
                <span className="log-author">{log.created_by}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PatientContactHistory;
