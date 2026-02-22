import { useState, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { DRAFT_BRANCH_TYPES } from '../types';
import { MEDICINE_CATEGORIES } from '../lib/api';
import './call-center/OutboundCallCenter.css';
import HerbalConsultationView from './HerbalConsultationView';
import MedicineUsageView from './MedicineUsageView';
import PackageManagementView from './PackageManagementView';
import DecoectionCalendarView from './DecoectionCalendarView';

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

type NonCoveredTab = 'all' | 'herbal-consultation' | 'medicine' | 'package' | 'decoction';

const PACKAGE_FILTER_CONFIG = [
  { key: 'all', label: '전체', color: '#64748b' },
  { key: 'treatment', label: '통마', color: '#3b82f6' },
  { key: 'membership', label: '멤버십', color: '#8b5cf6' },
  { key: 'low-remaining', label: '잔여알림', color: '#eab308' },
  { key: 'expire-soon', label: '만료알림', color: '#ef4444' },
];

function NonCoveredManagementView({ user }: NonCoveredManagementViewProps) {
  const [activeTab, setActiveTab] = useState<NonCoveredTab>('herbal-consultation');
  
  // 공통 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  });
  const [rangeMode, setRangeMode] = useState<'day' | '1w' | '1m' | '3m'>('day');
  const [refreshKey, setRefreshKey] = useState(0);

  // 기간 계산
  const getDateRange = useCallback(() => {
    const end = selectedDate;
    if (rangeMode === 'day') return { dateFrom: end, dateTo: end };
    const d = new Date(selectedDate + 'T00:00:00');
    if (rangeMode === '1w') d.setDate(d.getDate() - 6);
    else if (rangeMode === '1m') d.setMonth(d.getMonth() - 1);
    else if (rangeMode === '3m') d.setMonth(d.getMonth() - 3);
    const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { dateFrom: start, dateTo: end };
  }, [selectedDate, rangeMode]);

  const { dateFrom, dateTo } = getDateRange();
  
  // 날짜 이동
  const moveDate = (dir: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };
  const isToday = selectedDate === (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();

  // 카드/표 토글 (상비약)
  const [medicineViewMode, setMedicineViewMode] = useState<'card' | 'table'>('card');
  
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
    externalViewMode: medicineViewMode as 'card' | 'table',
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
      <div className="occ-header-bar">
        <div className="occ-date-nav">
          <button onClick={() => moveDate(-1)} className="occ-date-btn">◀</button>
          <div className="occ-date-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="occ-date-hidden"
              id="nc-date-picker"
            />
            <button className="occ-date-display" onClick={() => {
              const el = document.getElementById('nc-date-picker') as HTMLInputElement;
              el?.showPicker?.();
            }}>
              {(() => {
                const d = new Date(selectedDate + 'T00:00:00');
                const days = ['일','월','화','수','목','금','토'];
                return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
              })()}
            </button>
          </div>
          <button onClick={() => moveDate(1)} className="occ-date-btn">▶</button>
          {!isToday && (
            <button onClick={() => {
              const n = new Date();
              setSelectedDate(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`);
            }} className="occ-today-btn">오늘</button>
          )}
          <div className="occ-filter-group">
            {([['day', '1일'], ['1w', '1주일'], ['1m', '1개월'], ['3m', '3개월']] as const).map(([key, label]) => (
              <button key={key} className={`occ-filter-btn ${rangeMode === key ? 'active' : ''}`} onClick={() => setRangeMode(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="occ-filter-group occ-filter-calltype">
            {([['herbal-consultation', '약상담'], ['medicine', '상비약'], ['decoction', '탕전일정']] as const).map(([key, label]) => (
              <button key={key} className={`occ-filter-btn ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key as NonCoveredTab)}>
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 13, width: 120 }}
          />
        </div>
        <div className="occ-header-actions">
          <button className="occ-refresh-btn" onClick={handleRefresh}>
            <i className="fas fa-sync-alt"></i>
          </button>
          {activeTab === 'medicine' && (
            <div className="occ-filter-group">
              <button className={`occ-filter-btn ${medicineViewMode === 'card' ? 'active' : ''}`} onClick={() => setMedicineViewMode('card')}>카드</button>
              <button className={`occ-filter-btn ${medicineViewMode === 'table' ? 'active' : ''}`} onClick={() => setMedicineViewMode('table')}>표</button>
            </div>
          )}
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
      ) : activeTab === 'decoction' ? (
        <DecoectionCalendarView refreshKey={refreshKey} />
      ) : (
        <PackageManagementView {...packageProps} />
      )}

      <style>{`
        .nc-unified-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0;
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
