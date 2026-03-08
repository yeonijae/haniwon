import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
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
  return (
    <div className="min-h-screen bg-clinic-background">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-clinic-text-primary">운영관리</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/manage/billing-review"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-clinic-text-primary hover:bg-gray-50 transition"
          >
            <i className="fa-solid fa-file-invoice-dollar text-clinic-primary"></i>
            청구 검토
          </Link>
          <Link
            to="/manage/charting-review"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-clinic-text-primary hover:bg-gray-50 transition"
          >
            <i className="fa-solid fa-notes-medical text-clinic-primary"></i>
            차팅 검토
          </Link>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<ManageHome />} />
        <Route path="/billing-review" element={<BillingReviewPage />} />
        <Route path="/charting-review" element={<ChartingReviewPage />} />
        <Route path="*" element={<Navigate to="/manage" replace />} />
      </Routes>
    </div>
  );
};

export default ManageLiteApp;
