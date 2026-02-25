import { useState, useEffect, useCallback } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { useFontScale } from '@shared/hooks/useFontScale';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { fetchDoctorsWithDbStatus } from '@modules/staff/api/staffApi';
import type { StaffMember } from '@modules/staff/types';
import HeaderPatientSearch from '@modules/cs/components/HeaderPatientSearch';
import DoctorActingSidebar from './components/DoctorActingSidebar';
import DoctorTaskSidebar from './components/DoctorTaskSidebar';
import PatientChartModal from './components/PatientChartModal';
import './styles/doctor.css';

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
import TreatmentHistory from './pages/TreatmentHistory';
import TreatmentReflection from './pages/TreatmentReflection';
import Metrics from './pages/Metrics';
import MyMetrics from './pages/MyMetrics';

interface ChartAppProps {
  user: PortalUser;
}

interface TabItem {
  id: string;
  path: string;
  label: string;
  icon: string;
}

const TAB_ITEMS: TabItem[] = [
  { id: 'treatment-records', path: '/treatment-records', label: '진료내역', icon: '📋' },
  { id: 'transcripts', path: '/transcripts', label: '녹취', icon: '🎙️' },
  { id: 'patients', path: '/patients', label: '차트', icon: '📁' },
  { id: 'prescriptions', path: '/prescriptions', label: '처방전', icon: '💊' },
  { id: 'dosage', path: '/dosage-instructions', label: '복용법', icon: '📝' },
  { id: 'reflection', path: '/reflection', label: '진료회고', icon: '🔍' },
  { id: 'metrics', path: '/metrics', label: '지표관리', icon: '📊' },
];

const ChartApp: React.FC<ChartAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle('원장실');

  // 원장 선택
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<StaffMember | null>(null);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [chartModal, setChartModal] = useState<{ patientId: string; chartNumber?: string } | null>(null);
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('doctor');

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!showDoctorDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.doctor-select-wrapper')) {
        setShowDoctorDropdown(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showDoctorDropdown]);

  // 원장 목록 로드
  const FALLBACK_DOCTORS: StaffMember[] = [
    { id: 1, name: '강희종', role: 'doctor', status: 'active' } as unknown as StaffMember,
    { id: 2, name: '김대현', role: 'doctor', status: 'active' } as unknown as StaffMember,
    { id: 3, name: '임세열', role: 'doctor', status: 'active' } as unknown as StaffMember,
    { id: 4, name: '전인재', role: 'doctor', status: 'active' } as unknown as StaffMember,
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchDoctorsWithDbStatus();
        const active = list.filter(d => d.status === 'active');
        if (active.length > 0) {
          setDoctors(active);
          const me = active.find(d => d.name === user.name);
          if (me) setSelectedDoctor(me);
          else setSelectedDoctor(active[0]);
        } else {
          throw new Error('활성 원장 없음');
        }
      } catch (e) {
        console.error('원장 목록 로드 오류, fallback 사용:', e);
        setDoctors(FALLBACK_DOCTORS);
        const me = FALLBACK_DOCTORS.find(d => d.name === user.name);
        setSelectedDoctor(me || FALLBACK_DOCTORS[0]);
      }
    };
    load();
  }, [user.name]);

  const isTabActive = (path: string) => {
    const fullPath = `/doctor${path}`;
    return location.pathname.startsWith(fullPath);
  };

  const handleTabClick = (path: string) => {
    navigate(`/doctor${path}`);
  };

  const handlePatientSelect = useCallback((patient: { id: number; chart_number: string | null }) => {
    setChartModal({ patientId: String(patient.id), chartNumber: patient.chart_number || undefined });
  }, []);

  const handleDoctorSelect = (doctor: StaffMember) => {
    setSelectedDoctor(doctor);
    setShowDoctorDropdown(false);
  };

  return (
    <div className="doctor-app">
      {/* 헤더 */}
      <header className="doctor-header">
        <div className="doctor-header-left">
          <span className="doctor-logo">🏥</span>
          <span className="doctor-title">원장실</span>
        </div>

        <nav className="doctor-nav">
          {TAB_ITEMS.map(tab => (
            <button
              key={tab.id}
              className={`doctor-nav-item ${isTabActive(tab.path) ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.path)}
            >
              <span className="doctor-nav-icon">{tab.icon}</span>
              <span className="doctor-nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="doctor-header-tools">
          <HeaderPatientSearch onPatientSelect={handlePatientSelect} hideRegister />

          {/* 원장 선택 */}
          <div className="doctor-select-wrapper">
            <button
              className="doctor-select-btn"
              onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
            >
              <span>👨‍⚕️ {selectedDoctor?.alias || selectedDoctor?.name || '원장선택'}</span>
              <span>▾</span>
            </button>
            {showDoctorDropdown && (
              <div className="doctor-select-dropdown">
                {doctors.map(doc => (
                  <button
                    key={doc.id}
                    className={`doctor-select-option ${selectedDoctor?.id === doc.id ? 'active' : ''}`}
                    onClick={() => handleDoctorSelect(doc)}
                  >
                    <div
                      className="doctor-avatar"
                      style={{ backgroundColor: doc.profile_color || '#3B82F6' }}
                    >
                      {(doc.alias?.[0] || doc.name[0])}
                    </div>
                    <span>{doc.alias || doc.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 글자크기 조절 */}
          <div className="font-scale-controls">
            <button
              className="font-scale-btn"
              onClick={decreaseScale}
              disabled={!canDecrease}
              title="글씨 축소"
            >A-</button>
            <span className="font-scale-value" onClick={resetScale} title="기본 크기로 복원">
              {scalePercent}%
            </span>
            <button
              className="font-scale-btn"
              onClick={increaseScale}
              disabled={!canIncrease}
              title="글씨 확대"
            >A+</button>
          </div>

          {/* 설정 */}
          <button
            className="doctor-settings-btn"
            onClick={() => navigate('/doctor/settings')}
            title="설정"
          >
            <i className="fas fa-gear"></i>
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div className="doctor-body">
        {/* 왼쪽: 액팅 대기열 */}
        {selectedDoctor && (
          <DoctorActingSidebar
            doctorId={selectedDoctor.id}
            onPatientClick={(pid, chart) => setChartModal({ patientId: pid, chartNumber: chart })}
          />
        )}

        {/* 메인 콘텐츠 */}
        <main className="doctor-main" style={{ position: 'relative' }}>
          <div className="doctor-content" style={{ zoom: scale }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/treatment-records" element={<TreatmentHistory />} />
              <Route path="/transcripts" element={<MedicalTranscripts />} />
              <Route path="/patients" element={<PatientList onPatientClick={(pid, chart) => setChartModal({ patientId: pid, chartNumber: chart })} />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/my-metrics" element={<MyMetrics />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/prescriptions" element={<PrescriptionManagement />} />
              <Route path="/prescription-definitions" element={<PrescriptionDefinitions />} />
              <Route path="/dosage-instructions" element={<DosageInstructionManagement />} />
              <Route path="/dosage-instructions/create" element={<DosageInstructionCreator />} />
              <Route path="/reflection" element={<TreatmentReflection />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>

          {/* 환자통합차트 — 콘텐츠 내 오버레이 */}
          {chartModal && (
            <PatientChartModal
              patientId={chartModal.patientId}
              chartNumber={chartModal.chartNumber}
              onClose={() => setChartModal(null)}
            />
          )}
        </main>

        {/* 오른쪽: 업무 대기 (처방전, 복용법) */}
        {selectedDoctor && (
          <DoctorTaskSidebar
            doctorId={selectedDoctor.id}
            doctorName={selectedDoctor.name}
            onPatientClick={(pid, chart) => setChartModal({ patientId: pid, chartNumber: chart })}
          />
        )}
      </div>

      {/* 빈 공간 - 드롭다운은 useEffect로 닫힘 */}
    </div>
  );
};

export default ChartApp;
