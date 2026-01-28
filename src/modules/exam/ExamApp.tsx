import { useState } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { Routes, Route, useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import ExamManagement from './pages/ExamManagement';

interface ExamAppProps {
  user: PortalUser;
}

const ExamApp: React.FC<ExamAppProps> = ({ user }) => {
  useDocumentTitle('검사결과');
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={`bg-white shadow-lg flex flex-col flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-48'
        }`}
      >
        {/* 로고 영역 */}
        <div
          className={`flex items-center cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200 ${
            isCollapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'
          }`}
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-microscope text-2xl text-purple-600"></i>
          {!isCollapsed && (
            <div className="ml-3 flex flex-col">
              <h1 className="text-base font-bold text-purple-600 leading-tight">검사결과</h1>
              <p className="text-xs text-gray-400">연이재한의원</p>
            </div>
          )}
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          <button
            onClick={() => navigate('/exam')}
            className={`w-full flex items-center rounded-lg transition-colors duration-200 ${
              isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'
            } bg-purple-600 text-white`}
          >
            <i className={`fas fa-folder-open text-lg ${isCollapsed ? '' : 'w-6'}`}></i>
            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium">검사관리</span>
            )}
          </button>
        </nav>

        {/* 하단 영역 */}
        <div className="border-t border-gray-200 p-2">
          {/* 사용자 정보 */}
          {!isCollapsed && (
            <div className="px-2 py-2 mb-2">
              <p className="font-semibold text-sm text-gray-700 truncate">
                {user?.name || '관리자'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
              </p>
            </div>
          )}

          {/* 접기/펼치기 버튼 */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center rounded-lg transition-colors duration-200 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-purple-600 ${
              isCollapsed ? 'justify-center px-2' : 'px-3'
            }`}
            title={isCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'} text-sm ${isCollapsed ? '' : 'w-6'}`}></i>
            {!isCollapsed && (
              <span className="ml-3 text-sm">메뉴 접기</span>
            )}
          </button>

          {/* 닫기 버튼 */}
          <button
            onClick={() => window.close()}
            className={`w-full flex items-center rounded-lg transition-colors duration-200 py-2.5 text-gray-400 hover:bg-red-50 hover:text-red-500 ${
              isCollapsed ? 'justify-center px-2' : 'px-3'
            }`}
            title="닫기"
          >
            <i className={`fas fa-xmark text-lg ${isCollapsed ? '' : 'w-6'}`}></i>
            {!isCollapsed && (
              <span className="ml-3 text-sm">닫기</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<ExamManagement />} />
        </Routes>
      </main>
    </div>
  );
};

export default ExamApp;
