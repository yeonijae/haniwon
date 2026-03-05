import { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import { ensureDecoctionTables } from './lib/api';
import DecoctionSidebar from './components/DecoctionSidebar';
import ReadyMedicineView from './components/ReadyMedicineView';
import DecoctionQueueView from './components/DecoctionQueueView';
import HerbDashboardView from './components/HerbDashboardView';
import HerbInventoryView from './components/HerbInventoryView';
import HerbOrderManagementView from './components/HerbOrderManagementView';
import HerbPriceManagementView from './components/HerbPriceManagementView';
import HerbUsageStatsView from './components/HerbUsageStatsView';
import SettingsModal from '../inventory/components/SettingsModal';
import DecoctionDashboardView from './components/DecoctionDashboardView';
import SupplyList from '../inventory/pages/SupplyList';
import './styles/decoction.css';

type MainTabType = 'dashboard' | 'herb' | 'ready' | 'queue' | 'purchase';
type HerbTabType = 'dashboard' | 'manage' | 'orders' | 'prices' | 'usage';

interface MainTabItem {
  id: MainTabType;
  label: string;
}

interface HerbTabItem {
  id: HerbTabType;
  label: string;
}

const MAIN_TABS: MainTabItem[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'herb', label: '약재' },
  { id: 'ready', label: '상비약' },
  { id: 'queue', label: '탕전' },
  { id: 'purchase', label: '구입' },
];

const HERB_TABS: HerbTabItem[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'manage', label: '약재관리' },
  { id: 'orders', label: '주문관리' },
  { id: 'prices', label: '단가관리' },
  { id: 'usage', label: '사용통계' },
];

interface DecoctionAppProps {
  user: PortalUser;
}

export default function DecoctionApp({ user }: DecoctionAppProps) {
  const [mainTab, setMainTab] = useState<MainTabType>('dashboard');
  const [herbTab, setHerbTab] = useState<HerbTabType>('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    ensureDecoctionTables().catch(console.error);
  }, []);

  function renderHerbContent() {
    switch (herbTab) {
      case 'dashboard':
        return <HerbDashboardView />;
      case 'manage':
        return <HerbInventoryView />;
      case 'orders':
        return <HerbOrderManagementView />;
      case 'prices':
        return <HerbPriceManagementView />;
      case 'usage':
        return <HerbUsageStatsView />;
      default:
        return null;
    }
  }

  function renderMainContent() {
    switch (mainTab) {
      case 'dashboard':
        return <DecoctionDashboardView />;
      case 'herb':
        return (
          <>
            <nav className="decoction-subtabs" style={{ marginBottom: 12 }}>
              {HERB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`decoction-subtab ${herbTab === tab.id ? 'active' : ''}`}
                  onClick={() => setHerbTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            {renderHerbContent()}
          </>
        );
      case 'ready':
        return <ReadyMedicineView />;
      case 'queue':
        return <DecoctionQueueView user={user} />;
      case 'purchase':
        return <SupplyList />;
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
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`decoction-tab ${mainTab === tab.id ? 'active' : ''}`}
                  onClick={() => setMainTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
              <button
                className="decoction-tab"
                onClick={() => setShowSettings(true)}
                title="재고관리 설정 열기"
              >
                설정
              </button>
            </nav>
            <div className="decoction-header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>👤 {user.name}</span>
            </div>
          </header>
          <div className="decoction-main">
            {renderMainContent()}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
