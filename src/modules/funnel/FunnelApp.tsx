/**
 * 퍼널 관리 시스템
 * 리드 관리, 리타겟팅, DM발송 등
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import FunnelDashboard from './pages/FunnelDashboard';
import LeadManagement from './pages/LeadManagement';
import Retargeting from './pages/Retargeting';
import OutboundManagement from './pages/OutboundManagement';

interface FunnelAppProps {
  user: PortalUser;
}

type ViewMode = 'dashboard' | 'leads' | 'retargeting' | 'outbound';

const FunnelApp: React.FC<FunnelAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const menuItems = [
    { id: 'dashboard' as ViewMode, icon: 'fa-solid fa-chart-pie', label: '대시보드' },
    { id: 'leads' as ViewMode, icon: 'fa-solid fa-user-plus', label: '리드관리' },
    { id: 'retargeting' as ViewMode, icon: 'fa-solid fa-rotate', label: '리타겟팅' },
    { id: 'outbound' as ViewMode, icon: 'fa-solid fa-paper-plane', label: 'DM발송' },
  ];

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
          <i className="fas fa-filter text-3xl text-purple-500 mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-purple-500">퍼널 관리</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 오른쪽 - 뷰 전환 버튼 */}
        <nav className="flex items-center space-x-2 ml-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id)}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                viewMode === item.id
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-purple-500'
              }`}
            >
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span>{item.label}</span>
            </button>
          ))}
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
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {viewMode === 'dashboard' && <FunnelDashboard />}
        {viewMode === 'leads' && <LeadManagement />}
        {viewMode === 'retargeting' && <Retargeting />}
        {viewMode === 'outbound' && <OutboundManagement />}
      </div>
    </div>
  );
};

export default FunnelApp;
