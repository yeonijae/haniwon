/**
 * 환자관리 앱
 * 대시보드, 복약관리, 배송콜, 내원콜, 애프터콜 등
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// 대시보드 컴포넌트
import PatientCareDashboard from './components/PatientCareDashboard';

// 복약관리 페이지 (환자별 복약차트만)
import MedicationChartPage from './components/MedicationChartPage';

// 배송콜, 내원콜, 애프터콜, 초진메세지 페이지
import DeliveryCallPage from './components/DeliveryCallPage';
import VisitCallPage from './components/VisitCallPage';
import AfterCallPage from './components/AfterCallPage';
import FirstVisitMessagePage from './components/FirstVisitMessagePage';

interface PatientCareAppProps {
  user: PortalUser;
}

type ViewMode = 'dashboard' | 'medication' | 'delivery' | 'visit' | 'aftercall' | 'firstvisit';

const PatientCareApp: React.FC<PatientCareAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-md flex items-center px-4 py-2 flex-shrink-0">
        {/* 왼쪽 영역 - 로고 및 제목 */}
        <div
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-clipboard-list text-3xl text-orange-500 mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-orange-500">환자관리 시스템</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 오른쪽 - 뷰 전환 버튼 */}
        <nav className="flex items-center space-x-2 ml-auto">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'dashboard'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-chart-line text-xl mb-1"></i>
            <span>대시보드</span>
          </button>
          <button
            onClick={() => setViewMode('firstvisit')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'firstvisit'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-user-plus text-xl mb-1"></i>
            <span>초진콜</span>
          </button>
          <button
            onClick={() => setViewMode('medication')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'medication'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-pills text-xl mb-1"></i>
            <span>복약관리</span>
          </button>
          <button
            onClick={() => setViewMode('delivery')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'delivery'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-truck text-xl mb-1"></i>
            <span>배송콜</span>
          </button>
          <button
            onClick={() => setViewMode('visit')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'visit'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-hospital text-xl mb-1"></i>
            <span>내원콜</span>
          </button>
          <button
            onClick={() => setViewMode('aftercall')}
            className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
              viewMode === 'aftercall'
                ? 'bg-orange-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'
            }`}
          >
            <i className="fas fa-user-check text-xl mb-1"></i>
            <span>애프터콜</span>
          </button>
        </nav>

        {/* 사용자 정보 */}
        <div className="flex items-center space-x-3 ml-4">
          <div className="text-right">
            <p className="font-semibold text-sm text-gray-800">{user?.name || '관리자'}</p>
            <p className="text-xs text-gray-500">
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
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'dashboard' && (
          <PatientCareDashboard onNavigate={setViewMode} />
        )}

        {viewMode === 'medication' && (
          <MedicationChartPage />
        )}

        {viewMode === 'delivery' && (
          <DeliveryCallPage />
        )}

        {viewMode === 'visit' && (
          <VisitCallPage />
        )}

        {viewMode === 'aftercall' && (
          <AfterCallPage />
        )}

        {viewMode === 'firstvisit' && (
          <FirstVisitMessagePage />
        )}
      </div>
    </div>
  );
};

export default PatientCareApp;
