import { useState } from 'react';
import TreatmentProgramAdmin from './TreatmentProgramAdmin';
import PackageTypeAdmin from './PackageTypeAdmin';
import MedicinePurposeAdmin from './MedicinePurposeAdmin';
import HerbalSettingsAdmin from './HerbalSettingsAdmin';
import MemoTypeAdmin from './MemoTypeAdmin';

interface SettingsViewProps {
  user?: any;
}

type SettingsTab = 'treatment' | 'package' | 'medicine' | 'herbal' | 'memo';

function SettingsView({ user }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('package');

  return (
    <div className="settings-view">
      {/* 탭 네비게이션 */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'package' ? 'active' : ''}`}
          onClick={() => setActiveTab('package')}
        >
          <i className="fa-solid fa-boxes-stacked"></i>
          패키지/멤버십 종류
        </button>
        <button
          className={`settings-tab ${activeTab === 'treatment' ? 'active' : ''}`}
          onClick={() => setActiveTab('treatment')}
        >
          <i className="fa-solid fa-kit-medical"></i>
          진료 프로그램
        </button>
        <button
          className={`settings-tab ${activeTab === 'medicine' ? 'active' : ''}`}
          onClick={() => setActiveTab('medicine')}
        >
          <i className="fa-solid fa-pills"></i>
          상비약 사용목적
        </button>
        <button
          className={`settings-tab ${activeTab === 'herbal' ? 'active' : ''}`}
          onClick={() => setActiveTab('herbal')}
        >
          <i className="fa-solid fa-seedling"></i>
          한약 관리
        </button>
        <button
          className={`settings-tab ${activeTab === 'memo' ? 'active' : ''}`}
          onClick={() => setActiveTab('memo')}
        >
          <i className="fa-solid fa-comment-dots"></i>
          메모 종류
        </button>
      </div>

      {/* 탭 내용 */}
      <div className="settings-content">
        {activeTab === 'package' && <PackageTypeAdmin />}
        {activeTab === 'treatment' && <TreatmentProgramAdmin />}
        {activeTab === 'medicine' && <MedicinePurposeAdmin />}
        {activeTab === 'herbal' && <HerbalSettingsAdmin />}
        {activeTab === 'memo' && <MemoTypeAdmin />}
      </div>

      <style>{`
        .settings-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .settings-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .settings-tab {
          padding: 8px 14px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .settings-tab:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .settings-tab.active {
          background: #3b82f6;
          color: white;
        }

        .settings-tab i {
          font-size: 12px;
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        /* 각 Admin 컴포넌트 너비 오버라이드 */
        .settings-content > div {
          max-width: 100% !important;
          width: 100% !important;
        }
      `}</style>
    </div>
  );
}

export default SettingsView;
