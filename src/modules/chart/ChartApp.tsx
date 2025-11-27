import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import PrescriptionManagement from './pages/PrescriptionManagement';
import DosageInstructionManagement from './pages/DosageInstructionManagement';
import DosageInstructionCreator from './pages/DosageInstructionCreator';

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

const ChartApp: React.FC<ChartAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (menu: string) => {
    console.log(`${menu} 클릭됨`);
  };

  const isActive = (path: string) => {
    const basePath = '/chart';
    const fullPath = path === '/' ? basePath : `${basePath}${path}`;

    if (path === '/') {
      return location.pathname === basePath || location.pathname === `${basePath}/`;
    }
    return location.pathname.startsWith(fullPath);
  };

  const navigateTo = (path: string) => {
    const targetPath = path === '/' ? '/chart' : `/chart${path}`;
    navigate(targetPath);
  };

  return (
    <div className="h-screen bg-clinic-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-clinic-surface shadow-md flex items-center justify-between px-4 py-2 flex-shrink-0">
        {/* 왼쪽 영역 - 로고 및 제목 */}
        <div
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-notes-medical text-3xl text-clinic-primary mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-clinic-primary">진료 관리 시스템</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 오른쪽 영역 - 메뉴 + 사용자 정보 */}
        <div className="flex items-center space-x-3">
          {/* 네비게이션 메뉴 */}
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => navigateTo('/')}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                isActive('/')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
            >
              <i className="fas fa-chart-line text-xl mb-1"></i>
              <span>대시보드</span>
            </button>

            <button
              onClick={() => navigateTo('/treatment-records')}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                isActive('/treatment-records')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
            >
              <i className="fas fa-history text-xl mb-1"></i>
              <span>진료내역</span>
            </button>

            <button
              onClick={() => navigateTo('/patients')}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                isActive('/patients')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
            >
              <i className="fas fa-users text-xl mb-1"></i>
              <span>환자차트</span>
            </button>

            <button
              onClick={() => navigateTo('/prescriptions')}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                isActive('/prescriptions')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
            >
              <i className="fas fa-prescription text-xl mb-1"></i>
              <span>처방관리</span>
            </button>

            <button
              onClick={() => navigateTo('/dosage-instructions')}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-20 ${
                isActive('/dosage-instructions')
                  ? 'bg-clinic-primary text-white'
                  : 'text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary'
              }`}
            >
              <i className="fas fa-capsules text-xl mb-1"></i>
              <span>복용법</span>
            </button>

            <button
              onClick={() => handleMenuClick('설정')}
              className="flex flex-col items-center justify-center px-3 py-2 text-sm font-medium text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary rounded-lg transition-colors duration-200 w-20"
            >
              <i className="fas fa-gear text-xl mb-1"></i>
              <span>설정</span>
            </button>
          </nav>

          {/* 사용자 정보 */}
          <div className="flex items-center space-x-3 border-l pl-3">
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
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/treatment-records" element={<TreatmentRecordsPage />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/prescriptions" element={<PrescriptionManagement />} />
          <Route path="/dosage-instructions" element={<DosageInstructionManagement />} />
          <Route path="/dosage-instructions/create" element={<DosageInstructionCreator />} />
        </Routes>
      </div>
    </div>
  );
};

export default ChartApp;
