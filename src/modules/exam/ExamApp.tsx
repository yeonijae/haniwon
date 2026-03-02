import { useState } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { Routes, Route, useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import HeaderPatientSearch from '@modules/cs/components/HeaderPatientSearch';
import type { LocalPatient } from '@modules/cs/lib/patientSync';
import ExamManagement from './pages/ExamManagement';
import './styles/exam.css';

interface ExamAppProps {
  user: PortalUser;
}

const ExamApp: React.FC<ExamAppProps> = ({ user }) => {
  useDocumentTitle('검사결과');
  const navigate = useNavigate();
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');

  const handlePatientSelect = (patient: LocalPatient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(patient.name);
  };

  return (
    <div className="exam-app">
      {/* 헤더 */}
      <header className="exam-header">
        <div className="exam-header-left">
          <span className="exam-logo">🔬</span>
          <span className="exam-title">검사결과</span>
          <button
            className="exam-portal-btn"
            onClick={() => navigate('/')}
            title="포털로 이동"
          >
            <i className="fas fa-th-large"></i>
            포털
          </button>
        </div>

        <div className="exam-header-center">
          <HeaderPatientSearch onPatientSelect={handlePatientSelect} hideRegister />
        </div>

        <div className="exam-header-right">
          <div className="exam-user-info">
            <span className="exam-user-name">{user?.name || '관리자'}</span>
            <span className="exam-user-role">
              {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
            </span>
          </div>
          <button
            className="exam-close-btn"
            onClick={() => window.close()}
            title="닫기"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="exam-main">
        <Routes>
          <Route path="/" element={
            <ExamManagement
              selectedPatientId={selectedPatientId}
              selectedPatientName={selectedPatientName}
            />
          } />
        </Routes>
      </main>
    </div>
  );
};

export default ExamApp;
