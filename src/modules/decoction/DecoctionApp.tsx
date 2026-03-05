import { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { ensureDecoctionTables } from './lib/api';
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
  { id: 'dashboard', label: '약재현황' },
  { id: 'manage', label: '약재관리' },
  { id: 'orders', label: '주문관리' },
  { id: 'prices', label: '단가관리' },
  { id: 'usage', label: '사용통계' },
];

interface DecoctionAppProps {
  user: PortalUser;
}

export default function DecoctionApp({ user }: DecoctionAppProps) {
  useDocumentTitle('탕전실|연이재한의원');
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
        <div className="decoction-right" style={{ width: '100%' }}>
          <header className="decoction-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
              <span className="decoction-logo">🏭</span>
              <span className="decoction-title">탕전실</span>
            </div>
            <nav className="decoction-tabs" style={{ flex: 1, marginLeft: 16 }}>
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
                onClick={() => {
                  setMainTab('herb');
                  setHerbTab('dashboard');
                }}
                title="약재 현황 보기"
              >
                약재현황
              </button>
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
