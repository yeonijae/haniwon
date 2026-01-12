import { useState } from 'react';
import TreatmentProgramAdmin from './TreatmentProgramAdmin';
import PackageTypeAdmin from './PackageTypeAdmin';

interface SettingsViewProps {
  user?: any;
}

type SettingsTab = 'treatment' | 'package';

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
      </div>

      {/* 탭 내용 */}
      <div className="settings-content">
        {activeTab === 'package' && <PackageTypeAdmin />}
        {activeTab === 'treatment' && <TreatmentProgramAdmin />}
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
          gap: 4px;
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .settings-tab {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #6b7280;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s;
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
          font-size: 14px;
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

export default SettingsView;
