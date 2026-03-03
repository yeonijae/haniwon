import { useState, useEffect, useCallback } from 'react';
import { query, getCurrentDate } from '@shared/lib/postgres';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

const calculateAgeFromBirthYear = (birthYear: number) => {
  const currentYear = new Date().getFullYear();
  // 기존 대기실 API 연령 표기(한국식 나이)에 맞춰 표시
  return currentYear - birthYear + 1;
};

const DEV_WAITING_PATIENT = {
  id: 6748,
  patient_id: 6748,
  chart_no: '6748',
  patient_name: '이재은',
  age: calculateAgeFromBirthYear(1987),
  sex: 'F',
  waiting_since: new Date().toISOString(),
  doctor: '',
  status: 'waiting',
  progress: '',
};

// 상담 유형 정의
export const CONSULTATION_TYPES = [
  { code: 'herb_new', label: '약초진', icon: '💊' },
  { code: 'herb_return', label: '약재진', icon: '💊' },
  { code: 'phone', label: '전화상담', icon: '📞' },
  { code: 'acup_new', label: '침초진', icon: '📍' },
  { code: 'etc', label: '기타상담', icon: '💬' },
] as const;

export type ConsultationType = typeof CONSULTATION_TYPES[number]['code'];

// MSSQL 대기 환자 타입
export interface MssqlWaitingPatient {
  id: number;
  patient_id: number;
  chart_no: string;
  patient_name: string;
  age: number;
  sex: 'M' | 'F';
  waiting_since: string | null;
  doctor: string;
  status: string;
  progress: string;
}

// 액팅 정보 타입
export interface ActingInfo {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_no: string;
  doctor_id: number;
  doctor_name: string;
  acting_type: string;
  status: 'waiting' | 'acting' | 'complete' | 'cancelled';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// 통합 환자 타입 (대기/완료 모두 사용)
export interface ConsultationPatient {
  // 기본 정보
  id: number; // MSSQL id 또는 daily_acting_records id
  patient_id: number;
  patient_name: string;
  chart_no: string;
  age?: number;
  sex?: 'M' | 'F';
  waiting_since?: string | null;

  // 액팅 정보
  acting?: ActingInfo;

  // 상태
  hasActing: boolean;
  consultationStatus: 'waiting' | 'pending' | 'in_progress' | 'completed';
}

interface CSSidebarProps {
  onPatientRightClick?: (patient: ConsultationPatient, event: React.MouseEvent) => void;
  onPatientClick?: (patient: MssqlWaitingPatient) => void;
}

function CSSidebar({ onPatientRightClick, onPatientClick }: CSSidebarProps) {
  const [waitingPatients, setWaitingPatients] = useState<ConsultationPatient[]>([]);
  const [completedPatients, setCompletedPatients] = useState<ConsultationPatient[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 데이터 가져오기
  const fetchData = useCallback(async () => {
    try {
      // 1. MSSQL 대기실 환자
      const mssqlResponse = await fetch(`${MSSQL_API_URL}/api/queue/status`);
      let mssqlWaiting: MssqlWaitingPatient[] = [];
      if (mssqlResponse.ok) {
        const data = await mssqlResponse.json();
        mssqlWaiting = data.waiting || [];
        setIsConnected(true);
      }

      // 개발/테스트 환경에서만 상담대기 더미 1건 주입 (운영 DB 미영향)
      if (import.meta.env.DEV) {
        mssqlWaiting = [...mssqlWaiting, DEV_WAITING_PATIENT as MssqlWaitingPatient];
      }

      // 2. PostgreSQL daily_acting_records에서 오늘 액팅 조회
      const today = getCurrentDate();
      const actingList = await query<ActingInfo>(`
        SELECT * FROM daily_acting_records
        WHERE work_date = '${today}' AND source = 'cs_consultation'
        ORDER BY created_at DESC
      `);

      // 3. 상담대기 목록 구성
      const waitingList: ConsultationPatient[] = [];

      // MSSQL 대기환자를 ConsultationPatient로 변환
      for (const p of mssqlWaiting) {
        // cancelled 상태 액팅은 제외하고 찾기
        const acting = actingList.find(a =>
          (a.patient_id === p.patient_id || a.chart_no === p.chart_no?.replace(/^0+/, ''))
          && a.status !== 'cancelled'
        );

        // waiting 상태이거나 액팅 없는 환자만 상담대기에 표시
        if (!acting || acting.status === 'waiting') {
          waitingList.push({
            id: p.id,
            patient_id: p.patient_id,
            patient_name: p.patient_name,
            chart_no: p.chart_no,
            age: p.age,
            sex: p.sex,
            waiting_since: p.waiting_since,
            acting: acting || undefined,
            hasActing: !!acting,
            consultationStatus: acting ? 'pending' : 'waiting',
          });
        }
      }

      // 4. 상담완료 목록 (acting, complete)
      const completedList: ConsultationPatient[] = actingList
        .filter(a => a.status === 'acting' || a.status === 'complete')
        .map(a => ({
          id: a.id,
          patient_id: a.patient_id,
          patient_name: a.patient_name,
          chart_no: a.chart_no,
          acting: a,
          hasActing: true,
          consultationStatus: a.status === 'acting' ? 'in_progress' : 'completed',
        }));

      setWaitingPatients(waitingList);
      setCompletedPatients(completedList);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      setIsConnected(false);
    }
  }, []);

  // 3초마다 폴링
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 대기 시간 계산 (분)
  const getWaitingMinutes = (waitingSince: string | null): number => {
    if (!waitingSince) return 0;
    const start = new Date(waitingSince);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 60000);
  };

  // 상담유형 라벨 가져오기
  const getConsultationLabel = (code: string) => {
    const type = CONSULTATION_TYPES.find(t => t.code === code);
    return type ? `${type.icon} ${type.label}` : code;
  };

  // 우클릭 핸들러
  const handleContextMenu = (patient: ConsultationPatient, e: React.MouseEvent) => {
    e.preventDefault();
    onPatientRightClick?.(patient, e);
  };

  // 기존 클릭 핸들러 (하위 호환)
  const handleClick = (patient: ConsultationPatient) => {
    if (onPatientClick && !patient.hasActing) {
      // 기존 MssqlWaitingPatient 형태로 변환
      onPatientClick({
        id: patient.id,
        patient_id: patient.patient_id,
        patient_name: patient.patient_name,
        chart_no: patient.chart_no,
        age: patient.age || 0,
        sex: patient.sex || 'M',
        waiting_since: patient.waiting_since || null,
        doctor: '',
        status: '',
        progress: '',
      });
    }
  };

  return (
    <aside className="cs-waiting-panel">
      {/* 상담대기 섹션 */}
      <div className="cs-section">
        <div className="cs-section-header">
          <span className="cs-section-title">상담대기</span>
          <span className="cs-section-count">{waitingPatients.length}</span>
          <span className={`cs-connection-status ${isConnected ? 'connected' : ''}`}>
            {isConnected ? '●' : '○'}
          </span>
        </div>
        <ul className="cs-patient-list">
          {waitingPatients.length === 0 ? (
            <li className="cs-patient-empty">대기 환자 없음</li>
          ) : (
            waitingPatients.map((patient) => {
              const waitMinutes = getWaitingMinutes(patient.waiting_since || null);
              const isLongWait = waitMinutes >= 30;
              const isVeryLongWait = waitMinutes >= 60;

              return (
                <li
                  key={`waiting-${patient.id}-${patient.patient_id}`}
                  className={`cs-patient-item ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''}`}
                  onClick={() => handleClick(patient)}
                  onContextMenu={(e) => handleContextMenu(patient, e)}
                >
                  <div className="cs-patient-row">
                    <span className="cs-patient-name">{patient.patient_name}</span>
                    <span className="cs-patient-info">
                      {patient.sex === 'M' ? '남' : patient.sex === 'F' ? '여' : ''}/{patient.age || '?'}
                    </span>
                    {waitMinutes > 0 && (
                      <span className={`cs-patient-time ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''}`}>
                        {waitMinutes}분
                      </span>
                    )}
                  </div>
                  {patient.hasActing && patient.acting && (
                    <div className="cs-patient-acting">
                      <span className="cs-acting-type">
                        {getConsultationLabel(patient.acting.acting_type)}
                      </span>
                      <span className="cs-acting-doctor">{patient.acting.doctor_name}</span>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* 상담완료 섹션 */}
      <div className="cs-section cs-section-completed">
        <div className="cs-section-header">
          <span className="cs-section-title">상담완료</span>
          <span className="cs-section-count">{completedPatients.length}</span>
        </div>
        <ul className="cs-patient-list">
          {completedPatients.length === 0 ? (
            <li className="cs-patient-empty">완료된 상담 없음</li>
          ) : (
            completedPatients.map((patient) => (
              <li
                key={`completed-${patient.id}`}
                className={`cs-patient-item ${patient.consultationStatus === 'in_progress' ? 'consulting' : 'done'}`}
                onContextMenu={(e) => handleContextMenu(patient, e)}
              >
                <div className="cs-patient-row">
                  {patient.consultationStatus === 'in_progress' && (
                    <span className="cs-consulting-indicator" title="상담중"></span>
                  )}
                  {patient.consultationStatus === 'completed' && (
                    <span className="cs-completed-indicator">✓</span>
                  )}
                  <span className="cs-patient-name">{patient.patient_name}</span>
                </div>
                {patient.acting && (
                  <div className="cs-patient-acting">
                    <span className="cs-acting-type">
                      {getConsultationLabel(patient.acting.acting_type)}
                    </span>
                    <span className="cs-acting-doctor">{patient.acting.doctor_name}</span>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}

export default CSSidebar;
