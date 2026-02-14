import { useState } from 'react';
import type { PortalUser } from '@shared/types';
import HerbalConsultationView from './HerbalConsultationView';
import MedicineUsageView from './MedicineUsageView';
import PackageManagementView from './PackageManagementView';

// Legacy exports - used by PatientTimelineModal
export const EVENT_TYPES = [
  { code: 'program_start', icon: '🎯', label: '프로그램 등록', color: '#10b981' },
  { code: 'program_usage', icon: '💊', label: '사용', color: '#3b82f6' },
  { code: 'program_complete', icon: '✅', label: '완료', color: '#6b7280' },
  { code: 'happy_call', icon: '📞', label: '해피콜', color: '#f59e0b' },
  { code: 'follow_up', icon: '📋', label: '후속체크', color: '#8b5cf6' },
  { code: 'memo', icon: '📝', label: '메모', color: '#64748b' },
  { code: 'reservation', icon: '📅', label: '예약', color: '#06b6d4' },
  { code: 'complaint', icon: '⚠️', label: '이슈', color: '#ef4444' },
] as const;

export type EventTypeCode = typeof EVENT_TYPES[number]['code'];

interface NonCoveredManagementViewProps {
  user: PortalUser;
}

type NonCoveredTab = 'all' | 'herbal-consultation' | 'medicine' | 'package';

function NonCoveredManagementView({ user }: NonCoveredManagementViewProps) {
  const [activeTab, setActiveTab] = useState<NonCoveredTab>('all');

  return (
    <div className="noncovered-management">
      {/* 서브탭 */}
      <div className="noncovered-tabs">
        <button
          className={`noncovered-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="fa-solid fa-th-large"></i>
          전체
        </button>
        <button
          className={`noncovered-tab ${activeTab === 'herbal-consultation' ? 'active' : ''}`}
          onClick={() => setActiveTab('herbal-consultation')}
        >
          <i className="fa-solid fa-mortar-pestle"></i>
          약상담
        </button>
        <button
          className={`noncovered-tab ${activeTab === 'medicine' ? 'active' : ''}`}
          onClick={() => setActiveTab('medicine')}
        >
          <i className="fa-solid fa-pills"></i>
          상비약
        </button>
        <button
          className={`noncovered-tab ${activeTab === 'package' ? 'active' : ''}`}
          onClick={() => setActiveTab('package')}
        >
          <i className="fa-solid fa-box"></i>
          패키지
        </button>
      </div>

      {activeTab === 'all' ? (
        <div className="noncovered-all-sections">
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">💊 약상담</span>
              <div className="noncovered-section-line" />
            </div>
            <HerbalConsultationView user={user} />
          </div>
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">💊 상비약</span>
              <div className="noncovered-section-line" />
            </div>
            <MedicineUsageView />
          </div>
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">📦 패키지</span>
              <div className="noncovered-section-line" />
            </div>
            <PackageManagementView />
          </div>
        </div>
      ) : activeTab === 'herbal-consultation' ? (
        <HerbalConsultationView user={user} />
      ) : activeTab === 'medicine' ? (
        <MedicineUsageView />
      ) : (
        <PackageManagementView />
      )}

      <style>{`
        .noncovered-all-sections {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .noncovered-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .noncovered-section-divider {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .noncovered-section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
        }

        .noncovered-section-line {
          flex: 1;
          height: 2px;
          background: var(--border-color, #e2e8f0);
        }
      `}</style>
    </div>
  );
}

export default NonCoveredManagementView;
