import { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { useFontScale } from '@shared/hooks/useFontScale';
import { insert, execute, queryOne, escapeString } from '@shared/lib/sqlite';
import { addActing } from '@acting/api';
import CSSidebar, { MssqlWaitingPatient } from './components/CSSidebar';
import ReservationView from './components/ReservationView';
import ReceiptView from './components/ReceiptView';
import InquiryView from './components/InquiryView';
import PatientSearchView from './components/PatientSearchView';
import PrepaidManagementView from './components/PrepaidManagementView';
import './styles/cs.css';

const MSSQL_API_URL = 'http://192.168.0.173:3100';

interface Doctor {
  id: string;
  name: string;
  isOther?: boolean;
  resigned?: boolean;
  workStartDate?: string;
  workEndDate?: string;
}

// 입사일/퇴사일 기반 활성 의사 필터
const isActiveDoctor = (doc: Doctor): boolean => {
  // 'DOCTOR' 또는 isOther 제외
  if (doc.isOther || doc.name === 'DOCTOR') return false;

  // 퇴직자 제외
  if (doc.resigned) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 입사일이 미래면 제외 (아직 입사 전)
  if (doc.workStartDate) {
    const startDate = new Date(doc.workStartDate);
    if (startDate > today) return false;
  }

  // 퇴사일이 과거면 제외 (이미 퇴사)
  if (doc.workEndDate) {
    const endDate = new Date(doc.workEndDate);
    if (endDate < today) return false;
  }

  return true;
};

interface CSAppProps {
  user: PortalUser;
}

export type CSMenuType = 'reservation' | 'receipt' | 'inquiry' | 'search' | 'prepaid';

const MENU_TITLES: Record<CSMenuType, string> = {
  reservation: '예약관리',
  receipt: '수납관리',
  inquiry: '문의접수',
  search: '환자검색',
  prepaid: '선결관리',
};

function CSApp({ user }: CSAppProps) {
  const [activeMenu, setActiveMenu] = useState<CSMenuType>('reservation');
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('cs');

  // 담당의 선택 모달 상태
  const [selectedPatient, setSelectedPatient] = useState<MssqlWaitingPatient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [actingType, setActingType] = useState('한약상담');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 의사 목록 가져오기 (입사일/퇴사일 필터 적용)
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await fetch(`${MSSQL_API_URL}/api/doctors`);
        if (response.ok) {
          const data: Doctor[] = await response.json();
          // 활성 의사만 필터링
          const activeDoctors = data.filter(isActiveDoctor);
          setDoctors(activeDoctors);
        }
      } catch (error) {
        console.error('의사 목록 조회 오류:', error);
      }
    };
    fetchDoctors();
  }, []);

  function handleClose() {
    window.close();
  }

  // 대기환자 클릭 핸들러
  const handlePatientClick = useCallback((patient: MssqlWaitingPatient) => {
    setSelectedPatient(patient);
    // 기존 담당의가 있으면 선택
    if (patient.doctor) {
      const existingDoctor = doctors.find(d => d.name === patient.doctor);
      if (existingDoctor) {
        setSelectedDoctor(existingDoctor);
      }
    }
  }, [doctors]);

  // 담당의 선택 후 등록
  const handleSubmitConsultation = useCallback(async () => {
    if (!selectedPatient || !selectedDoctor) return;

    setIsSubmitting(true);
    try {
      const chartNo = selectedPatient.chart_no?.replace(/^0+/, '') || '';
      const gender = selectedPatient.sex === 'M' ? 'male' : selectedPatient.sex === 'F' ? 'female' : null;

      // 1. SQLite에 환자가 있는지 확인, 없으면 생성
      let patientRecord = await queryOne<{ id: number }>(`
        SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)} OR mssql_id = ${selectedPatient.patient_id}
      `);

      let patientId: number;
      if (!patientRecord) {
        patientId = await insert(`
          INSERT INTO patients (name, chart_number, mssql_id, gender)
          VALUES (${escapeString(selectedPatient.patient_name)}, ${escapeString(chartNo)}, ${selectedPatient.patient_id}, ${gender ? escapeString(gender) : 'NULL'})
        `);
      } else {
        patientId = patientRecord.id;
      }

      // 2. waiting_queue에 consultation으로 등록
      const details = `${actingType} - ${selectedDoctor.name}`;
      await execute(`
        INSERT OR IGNORE INTO waiting_queue (patient_id, queue_type, details, doctor, position)
        VALUES (${patientId}, 'consultation', ${escapeString(details)}, ${escapeString(selectedDoctor.name)},
          (SELECT COALESCE(MAX(position), -1) + 1 FROM waiting_queue WHERE queue_type = 'consultation'))
      `);

      // 3. 액팅 등록
      await addActing({
        patientId,
        patientName: selectedPatient.patient_name,
        chartNo,
        doctorId: parseInt(selectedDoctor.id, 10),
        doctorName: selectedDoctor.name,
        actingType,
        source: 'cs_consultation',
        memo: '',
      });

      console.log(`✅ ${selectedPatient.patient_name} 환자 ${actingType} 등록 완료 (담당: ${selectedDoctor.name})`);
      setSelectedPatient(null);
      setSelectedDoctor(null);
      setActingType('한약상담');
    } catch (error) {
      console.error('상담 등록 오류:', error);
      alert('상담 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedPatient, selectedDoctor, actingType]);

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setSelectedPatient(null);
    setSelectedDoctor(null);
    setActingType('한약상담');
  }, []);

  function renderContent() {
    switch (activeMenu) {
      case 'reservation':
        return <ReservationView user={user} />;
      case 'receipt':
        return <ReceiptView user={user} />;
      case 'inquiry':
        return <InquiryView user={user} />;
      case 'search':
        return <PatientSearchView user={user} />;
      case 'prepaid':
        return <PrepaidManagementView user={user} />;
      default:
        return null;
    }
  }

  return (
    <div className="cs-app">
      <CSSidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        userName={user.name}
        onClose={handleClose}
        onPatientClick={handlePatientClick}
      />
      <div className="cs-main">
        <header className="cs-header">
          <h1 className="cs-header-title">{MENU_TITLES[activeMenu]}</h1>
          <div className="font-scale-controls">
            <button
              className="font-scale-btn"
              onClick={decreaseScale}
              disabled={!canDecrease}
              title="글씨 축소"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
            <span className="font-scale-value" onClick={resetScale} title="기본 크기로 복원">
              {scalePercent}%
            </span>
            <button
              className="font-scale-btn"
              onClick={increaseScale}
              disabled={!canIncrease}
              title="글씨 확대"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>
        </header>
        <div className="cs-content" style={{ zoom: scale }}>
          {renderContent()}
        </div>
      </div>

      {/* 담당의 선택 모달 */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content consultation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>상담 등록</h3>
              <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              {/* 환자 정보 */}
              <div className="patient-info-bar">
                <span className="patient-name">{selectedPatient.patient_name}</span>
                <span className="patient-chart">({selectedPatient.chart_no?.replace(/^0+/, '') || ''})</span>
                <span className="patient-gender">
                  {selectedPatient.sex === 'M' ? '남' : '여'}/{selectedPatient.age || '?'}세
                </span>
              </div>

              {/* 상담 유형 */}
              <div className="form-group">
                <label>상담 유형</label>
                <div className="consultation-type-btns">
                  {['한약상담', '침/추나 상담', '기타 상담'].map(type => (
                    <button
                      key={type}
                      className={`consultation-type-btn ${actingType === type ? 'active' : ''}`}
                      onClick={() => setActingType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 담당의 선택 */}
              <div className="form-group">
                <label>담당의 선택</label>
                <div className="doctor-select-grid">
                  {doctors.map(doctor => (
                    <button
                      key={doctor.id}
                      className={`doctor-select-btn ${selectedDoctor?.id === doctor.id ? 'active' : ''}`}
                      onClick={() => setSelectedDoctor(doctor)}
                    >
                      {doctor.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>취소</button>
              <button
                className="btn-submit"
                onClick={handleSubmitConsultation}
                disabled={!selectedDoctor || isSubmitting}
              >
                {isSubmitting ? '등록 중...' : '액팅 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CSApp;
