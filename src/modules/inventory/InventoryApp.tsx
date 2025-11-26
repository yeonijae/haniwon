import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import Dashboard from './pages/Dashboard';
import HerbList from './pages/HerbList';
import DecoctionList from './pages/DecoctionList';
import PrescriptionList from './pages/PrescriptionList';
import ReadyMedicineList from './pages/ReadyMedicineList';
import MaterialList from './pages/MaterialList';
import SupplyList from './pages/SupplyList';
import DeliveryList from './pages/DeliveryList';

// Components
import SettingsModal from './components/SettingsModal';

type ViewType = 'dashboard' | 'herbs' | 'prescriptions' | 'decoctions' | 'medicines' | 'materials' | 'deliveries' | 'supplies';

interface InventoryAppProps {
  user: PortalUser;
}

const InventoryApp: React.FC<InventoryAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  const menuItems = [
    { id: 'dashboard' as ViewType, icon: 'fa-solid fa-house', label: '대시보드' },
    { id: 'herbs' as ViewType, icon: 'fa-solid fa-leaf', label: '약재관리' },
    { id: 'prescriptions' as ViewType, icon: 'fa-solid fa-file-prescription', label: '처방전' },
    { id: 'decoctions' as ViewType, icon: 'fa-solid fa-fire-burner', label: '탕전관리' },
    { id: 'medicines' as ViewType, icon: 'fa-solid fa-pills', label: '상비약' },
    { id: 'materials' as ViewType, icon: 'fa-solid fa-box', label: '자재관리' },
    { id: 'supplies' as ViewType, icon: 'fa-solid fa-clipboard-list', label: '물품관리' },
    { id: 'deliveries' as ViewType, icon: 'fa-solid fa-truck', label: '배송관리' },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'herbs': return <HerbList />;
      case 'prescriptions': return <PrescriptionList />;
      case 'decoctions': return <DecoctionList />;
      case 'medicines': return <ReadyMedicineList />;
      case 'materials': return <MaterialList />;
      case 'supplies': return <SupplyList />;
      case 'deliveries': return <DeliveryList />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-clinic-background overflow-hidden">
      {/* Header */}
      <header className="bg-clinic-surface shadow-md flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-box-open text-3xl text-clinic-primary mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-clinic-primary">재고 관리 시스템</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <nav className="flex items-center space-x-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                  currentView === item.id
                    ? 'bg-clinic-primary text-white'
                    : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
                }`}
              >
                <i className={`${item.icon} text-xl mb-1`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="border-l pl-4 ml-2 flex items-center space-x-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex flex-col items-center justify-center px-3 py-2 text-sm font-medium text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary rounded-lg transition-colors duration-200 w-20"
            >
              <i className="fa-solid fa-gear text-xl mb-1"></i>
              <span>설정</span>
            </button>

            <div className="text-right">
              <p className="font-semibold text-sm text-clinic-text-primary">{user?.name || '관리자'}</p>
              <p className="text-xs text-clinic-text-secondary">
                {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
              </p>
            </div>

            <button
              onClick={() => window.close()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="닫기"
              aria-label="닫기"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};

export default InventoryApp;
