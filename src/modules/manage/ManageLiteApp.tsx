import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import BillingReviewPage from './components/BillingReviewPage';

interface ManageLiteAppProps {
  user: PortalUser;
}

const ManageHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-clinic-background p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-clinic-primary mb-2">운영 관리</h1>
        <p className="text-clinic-text-secondary mb-6">기존 대시보드는 로딩하지 않도록 분리되었습니다.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/manage/billing-review"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-clinic-primary hover:bg-blue-50 transition"
          >
            <i className="fa-solid fa-file-invoice-dollar text-clinic-primary text-xl"></i>
            <div>
              <p className="font-semibold text-clinic-text-primary">청구 검토</p>
              <p className="text-sm text-clinic-text-secondary">청구 오류/점검 항목 확인</p>
            </div>
          </Link>

          <Link
            to="/manage/charting-review"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-clinic-primary hover:bg-blue-50 transition"
          >
            <i className="fa-solid fa-notes-medical text-clinic-primary text-xl"></i>
            <div>
              <p className="font-semibold text-clinic-text-primary">차팅 검토</p>
              <p className="text-sm text-clinic-text-secondary">차팅 내용 검토(준비중)</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

const ChartingReviewPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-clinic-background p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-notes-medical text-2xl text-clinic-primary"></i>
            <h2 className="text-2xl font-bold text-clinic-primary">차팅 검토</h2>
          </div>
          <Link to="/manage" className="text-sm text-clinic-primary hover:underline">운영관리 홈으로</Link>
        </div>
        <p className="text-clinic-text-secondary">차팅 검토 페이지입니다. 상세 기능은 이어서 확장 가능합니다.</p>
      </div>
    </div>
  );
};

const ManageLiteApp: React.FC<ManageLiteAppProps> = () => {
  return (
    <Routes>
      <Route path="/" element={<ManageHome />} />
      <Route path="/billing-review" element={<BillingReviewPage />} />
      <Route path="/charting-review" element={<ChartingReviewPage />} />
      <Route path="*" element={<Navigate to="/manage" replace />} />
    </Routes>
  );
};

export default ManageLiteApp;
