import { useState } from 'react';
import type { PortalUser } from '@shared/types';
import { useFontScale } from '@shared/hooks/useFontScale';
import CSSidebar from './components/CSSidebar';
import ReservationView from './components/ReservationView';
import ReceiptView from './components/ReceiptView';
import InquiryView from './components/InquiryView';
import PatientSearchView from './components/PatientSearchView';
import './styles/cs.css';

interface CSAppProps {
  user: PortalUser;
}

export type CSMenuType = 'reservation' | 'receipt' | 'inquiry' | 'search';

const MENU_TITLES: Record<CSMenuType, string> = {
  reservation: '예약관리',
  receipt: '수납관리',
  inquiry: '문의접수',
  search: '환자검색',
};

function CSApp({ user }: CSAppProps) {
  const [activeMenu, setActiveMenu] = useState<CSMenuType>('reservation');
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('cs');

  function handleClose() {
    window.close();
  }

  function renderContent() {
    switch (activeMenu) {
      case 'reservation':
        return <ReservationView user={user} />;
      case 'receipt':
        return <ReceiptView user={user} />;
      case 'inquiry':
        return <InquiryView user={user} />;
      case 'search':
        return <PatientSearchView user={user} />;
      default:
        return null;
    }
  }

  return (
    <div className="cs-app">
      <CSSidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        userName={user.name}
        onClose={handleClose}
      />
      <div className="cs-main">
        <header className="cs-header">
          <h1 className="cs-header-title">{MENU_TITLES[activeMenu]}</h1>
          <div className="font-scale-controls">
            <button
              className="font-scale-btn"
              onClick={decreaseScale}
              disabled={!canDecrease}
              title="글씨 축소"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
            <span className="font-scale-value" onClick={resetScale} title="기본 크기로 복원">
              {scalePercent}%
            </span>
            <button
              className="font-scale-btn"
              onClick={increaseScale}
              disabled={!canIncrease}
              title="글씨 확대"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>
        </header>
        <div className="cs-content" style={{ zoom: scale }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default CSApp;
