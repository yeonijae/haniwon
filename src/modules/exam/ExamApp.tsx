import { useState } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { Routes, Route } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import HeaderPatientSearch from '@modules/cs/components/HeaderPatientSearch';
import type { LocalPatient } from '@modules/cs/lib/patientSync';
import ExamManagement from './pages/ExamManagement';
import ExamWaitingSidebar from './components/ExamWaitingSidebar';
import './styles/exam.css';

interface ExamAppProps {
  user: PortalUser;
}

const ExamApp: React.FC<ExamAppProps> = ({ user }) => {
  useDocumentTitle('검사결과');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [settingsOpenSignal, setSettingsOpenSignal] = useState(0);

  const handlePatientSelect = (patient: LocalPatient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(patient.name);
  };

  const handleWaitingPatientSelect = (patientId: number, patientName: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
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
              />
            } />
          </Routes>
        </section>
      </main>
    </div>
  );
};

export default ExamApp;
