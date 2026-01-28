import { useState } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import PrescriptionManagement from './pages/PrescriptionManagement';
import PrescriptionDefinitions from './pages/PrescriptionDefinitions';
import DosageInstructionManagement from './pages/DosageInstructionManagement';
import DosageInstructionCreator from './pages/DosageInstructionCreator';
import MedicalTranscripts from './pages/MedicalTranscripts';
import Settings from './pages/Settings';

// Components
import TreatmentRecordList from '@shared/components/TreatmentRecordList';

// 진료내역 페이지 컴포넌트
const TreatmentRecordsPage: React.FC = () => {
  return (
    <div className="h-full bg-white">
      <TreatmentRecordList />
    </div>
  );
};

interface ChartAppProps {
  user: PortalUser;
}

// 네비게이션 메뉴 아이템 정의
const menuItems = [
  { path: '/', label: '대시보드', icon: 'fa-chart-line' },
  { path: '/treatment-records', label: '진료내역', icon: 'fa-history' },
  { path: '/transcripts', label: '진료녹취', icon: 'fa-microphone' },
  { path: '/patients', label: '환자차트', icon: 'fa-users' },
  { path: '/prescriptions', label: '처방관리', icon: 'fa-prescription' },
  { path: '/prescription-definitions', label: '처방정의', icon: 'fa-book-medical' },
  { path: '/dosage-instructions', label: '복용법', icon: 'fa-capsules' },
];

const ChartApp: React.FC<ChartAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  useDocumentTitle('진료관리');

  const isActive = (path: string) => {
    const basePath = '/doctor';
    const fullPath = path === '/' ? basePath : `${basePath}${path}`;

    if (path === '/') {
      return location.pathname === basePath || location.pathname === `${basePath}/`;
    }
    return location.pathname.startsWith(fullPath);
  };

  const navigateTo = (path: string) => {
    const targetPath = path === '/' ? '/doctor' : `/doctor${path}`;
    navigate(targetPath);
  };

  return (
    <div className="h-screen bg-clinic-background flex overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={`bg-clinic-surface shadow-lg flex flex-col flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-48'
        }`}
      >
        {/* 로고 영역 */}
        <div
          className={`flex items-center cursor-pointer hover:bg-clinic-background transition-colors border-b border-gray-200 ${
            isCollapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'
          }`}
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-notes-medical text-2xl text-clinic-primary"></i>
          {!isCollapsed && (
            <div className="ml-3 flex flex-col">
              <h1 className="text-base font-bold text-clinic-primary leading-tight">진료관리</h1>
              <p className="text-xs text-gray-400">연이재한의원</p>
            </div>
          )}
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigateTo(item.path)}
              className={`w-full flex items-center rounded-lg transition-colors duration-200 ${
                isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'
              } ${
                isActive(item.path)
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <i className={`fas ${item.icon} text-lg ${isCollapsed ? '' : 'w-6'}`}></i>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}

          {/* 설정 버튼 - 구분선 후 */}
          <div className="pt-4 mt-4 border-t border-gray-200">
            <button
              onClick={() => navigateTo('/settings')}
              className={`w-full flex items-center rounded-lg transition-colors duration-200 ${
                isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'
              } ${
                isActive('/settings')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
              title={isCollapsed ? '설정' : undefined}
            >
              <i className={`fas fa-gear text-lg ${isCollapsed ? '' : 'w-6'}`}></i>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-medium">설정</span>
              )}
            </button>
          </div>
        </nav>

        {/* 하단 영역 - 사용자 정보 + 접기/펼치기 + 닫기 */}
        <div className="border-t border-gray-200 p-2">
          {/* 사용자 정보 */}
          {!isCollapsed && (
            <div className="px-2 py-2 mb-2">
              <p className="font-semibold text-sm text-clinic-text-primary truncate">
                {user?.name || '관리자'}
              </p>
              <p className="text-xs text-clinic-text-secondary">
                {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
              </p>
            </div>
          )}

          {/* 접기/펼치기 버튼 */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center rounded-lg transition-colors duration-200 py-2.5 text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary ${
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/treatment-records" element={<TreatmentRecordsPage />} />
          <Route path="/transcripts" element={<MedicalTranscripts />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/prescriptions" element={<PrescriptionManagement />} />
          <Route path="/prescription-definitions" element={<PrescriptionDefinitions />} />
          <Route path="/dosage-instructions" element={<DosageInstructionManagement />} />
          <Route path="/dosage-instructions/create" element={<DosageInstructionCreator />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
};

export default ChartApp;
