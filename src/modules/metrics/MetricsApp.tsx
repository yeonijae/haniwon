/**
 * 지표관리 모듈 (통합포탈용)
 * 원장실의 지표관리 페이지를 재사용
 */

import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import type { PortalUser } from '@shared/types';
import Metrics from '../doctor/pages/Metrics';

interface MetricsAppProps {
  user: PortalUser;
}

function MetricsApp({ user }: MetricsAppProps) {
  const navigate = useNavigate();
  useDocumentTitle('지표관리');

  return (
    <div className="h-screen bg-clinic-background flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-clinic-primary transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
            <span className="text-sm">포탈로 돌아가기</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <i className="fas fa-chart-pie text-clinic-primary text-xl"></i>
            <h1 className="text-lg font-bold text-gray-800">지표관리</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.name || '사용자'}</span>
        </div>
      </header>

      {/* 메인 콘텐츠 - 원장실 Metrics 컴포넌트 재사용 */}
      <main className="flex-1 overflow-hidden">
        <Metrics />
      </main>
    </div>
  );
}

export default MetricsApp;
