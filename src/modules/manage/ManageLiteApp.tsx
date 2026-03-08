import React from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import BillingReviewPage from './components/BillingReviewPage';

interface ManageLiteAppProps {
  user: PortalUser;
}

const ManageHome: React.FC = () => {
  return (
    <div className="p-6 text-sm text-clinic-text-secondary">
      운영관리 화면입니다. 상단 버튼으로 페이지를 선택해주세요.
    </div>
  );
};

const ChartingReviewPage: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-5xl bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <i className="fa-solid fa-notes-medical text-2xl text-clinic-primary"></i>
          <h2 className="text-2xl font-bold text-clinic-primary">차팅 검토</h2>
        </div>
        <p className="text-clinic-text-secondary">차팅 검토 페이지입니다. 상세 기능은 이어서 확장 가능합니다.</p>
      </div>
    </div>
  );
};

const ManageLiteApp: React.FC<ManageLiteAppProps> = () => {
  const location = useLocation();
  const isBilling = location.pathname.includes('/billing-review');
  const isCharting = location.pathname.includes('/charting-review');

  return (
    <div className="cs-app-new">
      <header className="cs-top-header">
        <div className="cs-top-header-left" style={{ marginRight: 0 }}>
          <span className="cs-logo">🖥️</span>
          <span className="cs-title">운영관리</span>
        </div>

        <nav className="cs-top-nav">
          <Link to="/manage/billing-review" className={`cs-top-nav-item no-underline ${isBilling ? 'active' : ''}`}>
            <span className="cs-top-nav-icon"><i className="fa-solid fa-file-invoice-dollar"></i></span>
            <span className="cs-top-nav-label">청구 검토</span>
          </Link>
          <Link to="/manage/charting-review" className={`cs-top-nav-item no-underline ${isCharting ? 'active' : ''}`}>
            <span className="cs-top-nav-icon"><i className="fa-solid fa-notes-medical"></i></span>
            <span className="cs-top-nav-label">차팅 검토</span>
          </Link>
        </nav>
      </header>

      <div className="cs-main-new">
        <div className="cs-content">
          <Routes>
            <Route path="/" element={<ManageHome />} />
            <Route path="/billing-review" element={<BillingReviewPage />} />
            <Route path="/charting-review" element={<ChartingReviewPage />} />
            <Route path="*" element={<Navigate to="/manage" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default ManageLiteApp;
