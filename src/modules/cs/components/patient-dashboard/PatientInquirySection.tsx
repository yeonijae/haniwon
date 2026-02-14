/**
 * 환자 인콜/응대 이력 섹션 (대시보드용)
 */
import React from 'react';
import type { ContactLog } from '../../types/crm';

interface PatientInquirySectionProps {
  contactLogs: ContactLog[];
  isLoading: boolean;
}

// 채널 아이콘
const CHANNEL_ICONS: Record<string, string> = {
  phone: '📞',
  kakao: '💬',
  visit: '🏥',
  naver: '🟢',
  other: '📋',
};

// 상대 시간 포맷
const formatRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return dateStr.slice(0, 10);
};

const PatientInquirySection: React.FC<PatientInquirySectionProps> = ({
  contactLogs,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  return (
    <div className="dashboard-section-content">
      {contactLogs.length === 0 ? (
        <div className="section-empty">응대 기록이 없습니다.</div>
      ) : (
        <div className="contact-log-list">
          {contactLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="contact-log-item">
              <span className="log-channel">
                {CHANNEL_ICONS[log.channel] || '📋'}
              </span>
              <span className="log-type">{log.contact_type}</span>
              <span className="log-content">{log.content || ''}</span>
              <span className="log-date">{formatRelativeDate(log.created_at)}</span>
              <span className="log-staff">{log.created_by || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientInquirySection;
