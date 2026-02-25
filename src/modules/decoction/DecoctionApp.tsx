import { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import { ensureDecoctionTables } from './lib/api';
import DecoctionSidebar from './components/DecoctionSidebar';
import HerbInventoryView from './components/HerbInventoryView';
import ReadyMedicineView from './components/ReadyMedicineView';
import DecoctionQueueView from './components/DecoctionQueueView';
import PurchaseRequestView from './components/PurchaseRequestView';
import WorkScheduleView from './components/WorkScheduleView';
import './styles/decoction.css';

type TabType = 'herbs' | 'ready' | 'queue' | 'purchase' | 'schedule';

interface TabItem {
  id: TabType;
  icon: string;
  label: string;
}

const TABS: TabItem[] = [
  { id: 'herbs', icon: '🌿', label: '약재관리' },
  { id: 'ready', icon: '💊', label: '상비약' },
  { id: 'queue', icon: '🔥', label: '탕전관리' },
  { id: 'purchase', icon: '📋', label: '구입요청' },
  { id: 'schedule', icon: '📅', label: '근무표' },
];

interface DecoctionAppProps {
  user: PortalUser;
}

export default function DecoctionApp({ user }: DecoctionAppProps) {
  const [activeTab, setActiveTab] = useState<TabType>('herbs');

  useEffect(() => {
    ensureDecoctionTables().catch(console.error);
  }, []);

  function renderContent() {
    switch (activeTab) {
      case 'herbs':
        return <HerbInventoryView />;
      case 'ready':
        return <ReadyMedicineView />;
      case 'queue':
        return <DecoctionQueueView user={user} />;
      case 'purchase':
        return <PurchaseRequestView />;
      case 'schedule':
        return <WorkScheduleView />;
      default:
        return null;
    }
  }

  return (
    <div className="decoction-app">
      <div className="decoction-body">
        {/* 좌측: 사이드바 (로고+대기목록) */}
        <div className="decoction-sidebar-wrap">
          <div className="decoction-sidebar-logo">
            <span className="decoction-logo">🏭</span>
            <span className="decoction-title">탕전실</span>
          </div>
          <DecoctionSidebar />
        </div>
        {/* 우측: 탭+콘텐츠 */}
        <div className="decoction-right">
          <header className="decoction-header">
            <nav className="decoction-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`decoction-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
            <div className="decoction-header-right">
              <span>👤 {user.name}</span>
            </div>
          </header>
          <div className="decoction-main">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
