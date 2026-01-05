import { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { useFontScale } from '@shared/hooks/useFontScale';
import { insert, execute, queryOne, escapeString } from '@shared/lib/postgres';
import { addActing, cancelActing, updateActing } from '@acting/api';
import CSSidebar, {
  ConsultationPatient,
  CONSULTATION_TYPES,
  ConsultationType,
} from './components/CSSidebar';
import ReservationView from './components/ReservationView';
import ReceiptView from './components/ReceiptView';
import InquiryView from './components/InquiryView';
import PatientSearchView from './components/PatientSearchView';
import NonCoveredManagementView from './components/NonCoveredManagementView';
import TreatmentProgramAdmin from './components/TreatmentProgramAdmin';
import PatientTimelineModal from './components/PatientTimelineModal';
import './styles/cs.css';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

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

export type CSMenuType = 'reservation' | 'receipt' | 'inquiry' | 'search' | 'noncovered' | 'settings';

const MENU_TITLES: Record<CSMenuType, string> = {
  reservation: '예약관리',
  receipt: '수납관리',
  inquiry: '문의접수',
  search: '환자검색',
  noncovered: '비급여관리',
  settings: '프로그램설정',
};

interface MenuItem {
  id: CSMenuType;
  icon: string;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'receipt', icon: '💰', label: '수납' },
  { id: 'reservation', icon: '📅', label: '예약' },
  { id: 'noncovered', icon: '💊', label: '비급여' },
  { id: 'inquiry', icon: '📝', label: '문의' },
  { id: 'search', icon: '🔍', label: '검색' },
  { id: 'settings', icon: '⚙️', label: '설정' },
];

function CSApp({ user }: CSAppProps) {
  const [activeMenu, setActiveMenu] = useState<CSMenuType>('receipt');
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('cs');

  // 의사 목록 및 모달 상태
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 우클릭 컨텍스트 메뉴 상태
  const [contextPatient, setContextPatient] = useState<ConsultationPatient | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // 액팅 배정 모달 상태 (우클릭 시 사용)
  const [showActingModal, setShowActingModal] = useState(false);
  const [actingModalPatient, setActingModalPatient] = useState<ConsultationPatient | null>(null);
  const [selectedConsultationType, setSelectedConsultationType] = useState<ConsultationType>('herb_new');

  // 프로그램 등록 모달 상태
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programModalPatient, setProgramModalPatient] = useState<ConsultationPatient | null>(null);

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

  // 우클릭 핸들러 - 컨텍스트 메뉴 표시
  const handlePatientRightClick = useCallback((patient: ConsultationPatient, event: React.MouseEvent) => {
    event.preventDefault();
    setContextPatient(patient);
    setContextMenuPos({ x: event.clientX, y: event.clientY });
  }, []);

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextPatient(null);
    setContextMenuPos(null);
  }, []);

  // 컨텍스트 메뉴: 액팅 배정 선택
  const handleContextAssignActing = useCallback(() => {
    if (contextPatient) {
      setActingModalPatient(contextPatient);
      setShowActingModal(true);
      setSelectedConsultationType('herb_new');
      setSelectedDoctor(null);
    }
    closeContextMenu();
  }, [contextPatient, closeContextMenu]);

  // 컨텍스트 메뉴: 프로그램 등록 선택
  const handleContextRegisterProgram = useCallback(() => {
    if (contextPatient) {
      setProgramModalPatient(contextPatient);
      setShowProgramModal(true);
    }
    closeContextMenu();
  }, [contextPatient, closeContextMenu]);

  // 컨텍스트 메뉴: 액팅 취소
  const handleContextCancelActing = useCallback(async () => {
    if (contextPatient?.acting?.id) {
      if (confirm(`${contextPatient.patient_name} 환자의 액팅을 취소하시겠습니까?`)) {
        try {
          await cancelActing(contextPatient.acting.id);
          console.log(`✅ ${contextPatient.patient_name} 환자 액팅 취소 완료`);
        } catch (error) {
          console.error('액팅 취소 오류:', error);
          alert('액팅 취소 중 오류가 발생했습니다.');
        }
      }
    }
    closeContextMenu();
  }, [contextPatient, closeContextMenu]);

  // 컨텍스트 메뉴: 액팅 수정 (모달 열기)
  const handleContextEditActing = useCallback(() => {
    if (contextPatient?.acting) {
      setActingModalPatient(contextPatient);
      // 기존 액팅 정보로 초기화
      const existingType = CONSULTATION_TYPES.find(t => t.label === contextPatient.acting?.acting_type);
      setSelectedConsultationType(existingType?.code || 'herb_new');
      // 기존 담당의 선택
      const existingDoctor = doctors.find(d => d.name === contextPatient.acting?.doctor_name);
      setSelectedDoctor(existingDoctor || null);
      setShowActingModal(true);
    }
    closeContextMenu();
  }, [contextPatient, doctors, closeContextMenu]);

  // 프로그램 등록 모달 닫기
  const closeProgramModal = useCallback(() => {
    setShowProgramModal(false);
    setProgramModalPatient(null);
  }, []);

  // 액팅 배정/수정 모달에서 등록
  const handleSubmitActingAssignment = useCallback(async () => {
    if (!actingModalPatient || !selectedDoctor) return;

    setIsSubmitting(true);
    try {
      const chartNo = actingModalPatient.chart_no?.replace(/^0+/, '') || '';
      const consultType = CONSULTATION_TYPES.find(t => t.code === selectedConsultationType);
      const actingTypeLabel = consultType?.label || selectedConsultationType;
      const doctorIdNum = parseInt(selectedDoctor.id.replace('doctor_', ''), 10);

      // 기존 액팅이 있으면 수정 모드
      if (actingModalPatient.acting?.id) {
        await updateActing(actingModalPatient.acting.id, {
          actingType: actingTypeLabel,
        });
        // 담당의가 변경되었으면 별도 처리 (moveActingToDoctor 사용)
        if (actingModalPatient.acting.doctor_id !== doctorIdNum) {
          const { moveActingToDoctor } = await import('@acting/api');
          await moveActingToDoctor(actingModalPatient.acting.id, doctorIdNum, selectedDoctor.name);
        }
        console.log(`✅ ${actingModalPatient.patient_name} 환자 액팅 수정 완료 (${actingTypeLabel}, 담당: ${selectedDoctor.name})`);
      } else {
        // 신규 액팅 등록
        // 1. SQLite에 환자가 있는지 확인, 없으면 생성
        let patientRecord = await queryOne<{ id: number }>(`
          SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)} OR mssql_id = ${actingModalPatient.patient_id}
        `);

        let patientId: number;
        if (!patientRecord) {
          const gender = actingModalPatient.sex === 'M' ? 'male' : actingModalPatient.sex === 'F' ? 'female' : null;
          patientId = await insert(`
            INSERT INTO patients (name, chart_number, mssql_id, gender)
            VALUES (${escapeString(actingModalPatient.patient_name)}, ${escapeString(chartNo)}, ${actingModalPatient.patient_id}, ${gender ? escapeString(gender) : 'NULL'})
          `);
        } else {
          patientId = patientRecord.id;
        }

        // 2. 액팅 등록
        await addActing({
          patientId,
          patientName: actingModalPatient.patient_name,
          chartNo,
          doctorId: doctorIdNum,
          doctorName: selectedDoctor.name,
          actingType: actingTypeLabel,
          source: 'cs_consultation',
          memo: '',
        });

        // 3. 상담 기록 저장
        await execute(`
          INSERT INTO consultation_records (patient_id, patient_name, chart_number, consultation_type, doctor_id, doctor_name, status)
          VALUES (${patientId}, ${escapeString(actingModalPatient.patient_name)}, ${escapeString(chartNo)},
                  ${escapeString(selectedConsultationType)}, ${doctorIdNum}, ${escapeString(selectedDoctor.name)}, 'completed')
        `);

        console.log(`✅ ${actingModalPatient.patient_name} 환자 ${actingTypeLabel} 액팅 배정 완료 (담당: ${selectedDoctor.name})`);
      }

      setShowActingModal(false);
      setActingModalPatient(null);
      setSelectedDoctor(null);
    } catch (error) {
      console.error('액팅 배정/수정 오류:', error);
      alert('액팅 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [actingModalPatient, selectedDoctor, selectedConsultationType]);

  // 액팅 배정 모달 닫기
  const closeActingModal = useCallback(() => {
    setShowActingModal(false);
    setActingModalPatient(null);
    setSelectedDoctor(null);
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
      case 'noncovered':
        return <NonCoveredManagementView user={user} />;
      case 'settings':
        return <TreatmentProgramAdmin />;
      default:
        return null;
    }
  }

  return (
    <div className="cs-app-new">
      {/* 상단 헤더 (메뉴 포함) */}
      <header className="cs-top-header">
        <div className="cs-top-header-left">
          <span className="cs-logo">🖥️</span>
          <span className="cs-title">데스크</span>
        </div>
        <nav className="cs-top-nav">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`cs-top-nav-item ${activeMenu === item.id ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.id)}
            >
              <span className="cs-top-nav-icon">{item.icon}</span>
              <span className="cs-top-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="cs-top-header-right">
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
          <span className="cs-user-info">👤 {user.name}</span>
          <button className="cs-close-btn" onClick={handleClose}>✕</button>
        </div>
      </header>

      {/* 메인 영역 (대기환자 패널 + 콘텐츠) */}
      <div className="cs-body">
        {/* 왼쪽: 대기환자 패널 */}
        <CSSidebar
          onPatientRightClick={handlePatientRightClick}
        />

        {/* 오른쪽: 콘텐츠 */}
        <div className="cs-main-new">
          <div className="cs-content" style={{ zoom: scale }}>
            {renderContent()}
          </div>
        </div>
      </div>


      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenuPos && contextPatient && (
        <div
          className="cs-context-menu"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 상담대기 (waiting/pending): 액팅 관련 메뉴 */}
          {(contextPatient.consultationStatus === 'waiting' || contextPatient.consultationStatus === 'pending') && (
            <>
              {!contextPatient.hasActing && (
                <button className="cs-context-menu-item" onClick={handleContextAssignActing}>
                  <span className="cs-context-icon">👨‍⚕️</span>
                  <span>액팅 배정</span>
                </button>
              )}
              {contextPatient.hasActing && (
                <>
                  <button className="cs-context-menu-item" onClick={handleContextEditActing}>
                    <span className="cs-context-icon">✏️</span>
                    <span>액팅 수정</span>
                  </button>
                  <button className="cs-context-menu-item cs-context-danger" onClick={handleContextCancelActing}>
                    <span className="cs-context-icon">🗑️</span>
                    <span>액팅 취소</span>
                  </button>
                </>
              )}
            </>
          )}
          {/* 상담완료 (in_progress/completed): 비급여관리만 */}
          {(contextPatient.consultationStatus === 'in_progress' || contextPatient.consultationStatus === 'completed') && (
            <button className="cs-context-menu-item" onClick={handleContextRegisterProgram}>
              <span className="cs-context-icon">💊</span>
              <span>비급여관리</span>
            </button>
          )}
          <button className="cs-context-menu-item" onClick={closeContextMenu}>
            <span className="cs-context-icon">✕</span>
            <span>닫기</span>
          </button>
        </div>
      )}

      {/* 컨텍스트 메뉴 배경 클릭 시 닫기 */}
      {contextMenuPos && (
        <div className="cs-context-overlay" onClick={closeContextMenu} />
      )}

      {/* 액팅 배정/수정 모달 (우클릭 시) */}
      {showActingModal && actingModalPatient && (
        <div className="modal-overlay" onClick={closeActingModal}>
          <div className="modal-content acting-assign-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{actingModalPatient.acting ? '액팅 수정' : '액팅 배정'}</h3>
              <button className="modal-close-btn" onClick={closeActingModal}>×</button>
            </div>
            <div className="modal-body">
              {/* 환자 정보 */}
              <div className="patient-info-bar">
                <span className="patient-name">{actingModalPatient.patient_name}</span>
                <span className="patient-chart">({actingModalPatient.chart_no?.replace(/^0+/, '') || ''})</span>
                {actingModalPatient.sex && actingModalPatient.age && (
                  <span className="patient-gender">
                    {actingModalPatient.sex === 'M' ? '남' : '여'}/{actingModalPatient.age}세
                  </span>
                )}
              </div>

              {/* 상담 유형 (5가지) */}
              <div className="form-group">
                <label>상담 유형</label>
                <div className="consultation-type-btns consultation-type-grid">
                  {CONSULTATION_TYPES.map(type => (
                    <button
                      key={type.code}
                      className={`consultation-type-btn ${selectedConsultationType === type.code ? 'active' : ''}`}
                      onClick={() => setSelectedConsultationType(type.code)}
                    >
                      <span className="type-icon">{type.icon}</span>
                      <span className="type-label">{type.label}</span>
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
              <button className="btn-cancel" onClick={closeActingModal}>취소</button>
              <button
                className="btn-submit"
                onClick={handleSubmitActingAssignment}
                disabled={!selectedDoctor || isSubmitting}
              >
                {isSubmitting ? '처리 중...' : (actingModalPatient.acting ? '수정' : '배정')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비급여관리 타임라인 모달 */}
      {showProgramModal && programModalPatient && (
        <PatientTimelineModal
          patient={programModalPatient}
          onClose={closeProgramModal}
        />
      )}
    </div>
  );
}

export default CSApp;
