import { useState } from 'react';
import type { PortalUser } from '@shared/types';
import { DRAFT_BRANCH_TYPES } from '../types';
import { MEDICINE_CATEGORIES } from '../lib/api';
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

const PACKAGE_FILTER_CONFIG = [
  { key: 'all', label: '전체', color: '#64748b' },
  { key: 'treatment', label: '통마', color: '#3b82f6' },
  { key: 'membership', label: '멤버십', color: '#8b5cf6' },
  { key: 'low-remaining', label: '잔여알림', color: '#eab308' },
  { key: 'expire-soon', label: '만료알림', color: '#ef4444' },
];

function NonCoveredManagementView({ user }: NonCoveredManagementViewProps) {
  const [activeTab, setActiveTab] = useState<NonCoveredTab>('all');
  
  // 공통 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 약상담 필터
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  
  // 상비약 필터
  const [filterCategory, setFilterCategory] = useState('all');
  
  // 패키지 필터
  const [packageFilter, setPackageFilter] = useState('all');

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const herbalProps = {
    user,
    searchTerm,
    dateFrom,
    dateTo,
    filterBranch: activeTab === 'herbal-consultation' ? filterBranch : 'all',
    filterStatus: activeTab === 'herbal-consultation' ? filterStatus : 'all',
    sortField: activeTab === 'herbal-consultation' ? sortField : 'created_at',
    refreshKey,
  };

  const medicineProps = {
    searchTerm,
    dateFrom,
    dateTo,
    filterCategory: activeTab === 'medicine' ? filterCategory : 'all',
    refreshKey,
  };

  const packageProps = {
    searchTerm,
    dateFrom,
    dateTo,
    packageFilter: activeTab === 'package' ? packageFilter : 'all',
    refreshKey,
  };

  return (
    <div className="noncovered-management">
      {/* 통합 헤더 */}
      <div className="nc-unified-header">
        <div className="nc-header-tabs">
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

        <div className="nc-header-filters">
          <input
            type="text"
            className="noncovered-search"
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* 약상담 탭 필터 */}
          {activeTab === 'herbal-consultation' && <>
            <select
              className="noncovered-filter"
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
            >
              <option value="all">전체 분기</option>
              {DRAFT_BRANCH_TYPES.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <select
              className="noncovered-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">전체 상태</option>
              <option value="draft">초안</option>
              <option value="scheduled">탕전배정</option>
            </select>
            <select
              className="noncovered-filter"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="created_at">작성일순</option>
              <option value="decoction_date">탕전일순</option>
              <option value="patient_name">환자명순</option>
            </select>
          </>}

          {/* 상비약 탭 필터 */}
          {activeTab === 'medicine' && (
            <select
              className="noncovered-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">전체 카테고리</option>
              {MEDICINE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* 패키지 탭 필터 — 뱃지형 */}
          {activeTab === 'package' && (
            <div className="header-badges">
              {PACKAGE_FILTER_CONFIG.map(cfg => (
                <span
                  key={cfg.key}
                  className={`header-badge clickable ${packageFilter === cfg.key ? 'active' : ''}`}
                  style={{ '--badge-color': cfg.color } as React.CSSProperties}
                  onClick={() => setPackageFilter(cfg.key)}
                >
                  {cfg.label}
                </span>
              ))}
            </div>
          )}

          {/* 공통: 날짜 */}
          <div className="date-range-filter">
            <input type="date" className="date-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="date-separator">~</span>
            <input type="date" className="date-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button className="date-clear-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>
            )}
          </div>

          <button className="noncovered-refresh-btn" onClick={handleRefresh}>
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {activeTab === 'all' ? (
        <div className="noncovered-all-sections">
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">💊 약상담</span>
              <div className="noncovered-section-line" />
            </div>
            <HerbalConsultationView {...herbalProps} />
          </div>
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">💊 상비약</span>
              <div className="noncovered-section-line" />
            </div>
            <MedicineUsageView {...medicineProps} />
          </div>
          <div className="noncovered-section">
            <div className="noncovered-section-divider">
              <span className="noncovered-section-title">📦 패키지</span>
              <div className="noncovered-section-line" />
            </div>
            <PackageManagementView {...packageProps} />
          </div>
        </div>
      ) : activeTab === 'herbal-consultation' ? (
        <HerbalConsultationView {...herbalProps} />
      ) : activeTab === 'medicine' ? (
        <MedicineUsageView {...medicineProps} />
      ) : (
        <PackageManagementView {...packageProps} />
      )}

      <style>{`
        .nc-unified-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          flex-wrap: wrap;
        }

        .nc-header-tabs {
          display: flex;
          gap: 4px;
        }

        .nc-header-filters {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .nc-header-filters .noncovered-search {
          padding: 5px 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          font-size: 12px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
          width: 140px;
        }

        .nc-header-filters .noncovered-filter {
          padding: 5px 8px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          font-size: 12px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
        }

        .nc-header-filters .date-range-filter {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .nc-header-filters .date-input {
          padding: 4px 6px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          font-size: 12px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
        }

        .nc-header-filters .date-separator {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
        }

        .nc-header-filters .date-clear-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          padding: 2px 4px;
        }

        .nc-header-filters .date-clear-btn:hover {
          color: #ef4444;
        }

        .nc-header-filters .header-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          align-items: center;
        }

        .nc-header-filters .header-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--badge-color) 15%, transparent);
          color: var(--badge-color);
          font-weight: 600;
          white-space: nowrap;
        }

        .nc-header-filters .header-badge.clickable {
          cursor: pointer;
          transition: all 0.15s;
        }

        .nc-header-filters .header-badge.clickable:hover {
          background: color-mix(in srgb, var(--badge-color) 25%, transparent);
        }

        .nc-header-filters .header-badge.clickable.active {
          background: var(--badge-color);
          color: #fff;
        }

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
