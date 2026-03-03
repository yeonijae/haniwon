import { useMemo, useState, useEffect } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { Routes, Route } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import HeaderPatientSearch from '@modules/cs/components/HeaderPatientSearch';
import type { LocalPatient } from '@modules/cs/lib/patientSync';
import ExamManagement from './pages/ExamManagement';
import ExamComparePopup from './pages/ExamComparePopup';
import ExamWaitingSidebar from './components/ExamWaitingSidebar';
import { getExamDoctors, getExamNavigationPatients } from './services/examService';
import './styles/exam.css';

interface ExamAppProps {
  user: PortalUser;
}

const ExamApp: React.FC<ExamAppProps> = ({ user }) => {
  useDocumentTitle('검사결과');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [settingsOpenSignal, setSettingsOpenSignal] = useState(0);
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [rangePreset, setRangePreset] = useState<7 | 30 | 90>(30);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctorOptions, setDoctorOptions] = useState<string[]>([]);
  const [navPatients, setNavPatients] = useState<Array<{ patient_id: number; patient_name: string }>>([]);

  const handlePatientSelect = (patient: LocalPatient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(patient.name);
  };

  const handleWaitingPatientSelect = (patientId: number, patientName: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
  };

  const dateKey = useMemo(() => {
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [baseDate]);

  const dateLabel = useMemo(() => {
    const w = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateKey}(${w[baseDate.getDay()]})`;
  }, [dateKey, baseDate]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [doctors, patients] = await Promise.all([
          getExamDoctors(dateKey, rangePreset),
          getExamNavigationPatients(dateKey, rangePreset, doctorFilter === 'all' ? undefined : doctorFilter),
        ]);
        setDoctorOptions(doctors);
        setNavPatients(patients.map((p) => ({ patient_id: p.patient_id, patient_name: p.patient_name })));
      } catch (e) {
        console.error('검사 헤더 필터 로드 실패:', e);
      }
    };
    loadFilters();
  }, [dateKey, rangePreset, doctorFilter]);

  const currentNavIndex = navPatients.findIndex((p) => p.patient_id === selectedPatientId);

  const movePatient = (dir: -1 | 1) => {
    if (navPatients.length === 0) return;
    const start = currentNavIndex >= 0 ? currentNavIndex : 0;
    const nextIndex = Math.min(navPatients.length - 1, Math.max(0, start + dir));
    const next = navPatients[nextIndex];
    if (next) {
      setSelectedPatientId(next.patient_id);
      setSelectedPatientName(next.patient_name);
    }
  };

  return (
    <div className="exam-app">
      {/* 헤더 */}
      <header className="exam-header">
        <div className="exam-header-left">
          <span className="exam-logo">🔬</span>
          <span className="exam-title">검사결과</span>

        </div>

        <div className="exam-header-center">
          <HeaderPatientSearch onPatientSelect={handlePatientSelect} hideRegister />
        </div>

        <div className="exam-header-right">
          <div className="exam-header-filter-row">
            <button className="exam-portal-btn" onClick={() => setBaseDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="exam-header-date-label">{dateLabel}</span>
            <button className="exam-portal-btn" onClick={() => setBaseDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}>
              <i className="fas fa-chevron-right"></i>
            </button>

            <select className="exam-header-select" value={rangePreset} onChange={(e) => setRangePreset(Number(e.target.value) as 7 | 30 | 90)}>
              <option value={7}>1주일</option>
              <option value={30}>1개월</option>
              <option value={90}>3개월</option>
            </select>

            <select className="exam-header-select" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
              <option value="all">담당의 전체</option>
              {doctorOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <button className="exam-portal-btn" onClick={() => movePatient(-1)} disabled={navPatients.length === 0}>
              이전 환자
            </button>
            <button className="exam-portal-btn" onClick={() => movePatient(1)} disabled={navPatients.length === 0}>
              다음 환자
            </button>
          </div>

          <button
            className="exam-portal-btn"
            onClick={() => setSettingsOpenSignal((v) => v + 1)}
            title="검사결과 설정"
          >
            <i className="fas fa-gear"></i>
            설정
          </button>
          <div className="exam-user-info">
            <span className="exam-user-name">{user?.name || '관리자'}</span>
            <span className="exam-user-role">
              {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
            </span>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="exam-main">
        <ExamWaitingSidebar
          onSelectPatient={handleWaitingPatientSelect}
          selectedPatientId={selectedPatientId}
        />

        <section className="exam-content-area">
          <Routes>
            <Route path="/" element={
              <ExamManagement
                selectedPatientId={selectedPatientId}
                selectedPatientName={selectedPatientName}
                settingsOpenSignal={settingsOpenSignal}
                baseDate={dateKey}
                rangePreset={rangePreset}
                doctorFilter={doctorFilter}
              />
            } />
            <Route path="/compare-popup" element={<ExamComparePopup />} />
          </Routes>
        </section>
      </main>
    </div>
  );
};

export default ExamApp;
