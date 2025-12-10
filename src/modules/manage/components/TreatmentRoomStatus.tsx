
import React, { useMemo, useState, useEffect, memo } from 'react';
import Quadrant from './Quadrant';
import { TreatmentRoom, RoomStatus, SessionTreatment, Patient } from '../types';

interface PatientTreatmentInfo {
  sessionId: string;
  patientId: number;
  patientName: string;
  patientChartNumber: string;
  patientGender?: 'male' | 'female';
  patientDob?: string;
  doctorName: string;
  roomName: string;
  inTime: Date;
  sessionTreatments: SessionTreatment[];
}

// 현재 진행중인 치료 찾기
const findCurrentTreatment = (treatments: SessionTreatment[]): SessionTreatment | null => {
  // running 상태 우선
  const running = treatments.find(t => t.status === 'running');
  if (running) return running;

  // paused 상태
  const paused = treatments.find(t => t.status === 'paused');
  if (paused) return paused;

  // pending 상태
  const pending = treatments.find(t => t.status === 'pending');
  if (pending) return pending;

  return null;
};

// 시간을 mm:ss 형식으로 포맷
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 안내 시간을 HH:MM 형식으로 포맷
const formatInTime = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// 실시간 타이머 훅 - 타이머만 리렌더링
const useTimer = (treatment: SessionTreatment | null) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // treatment 속성을 개별 변수로 추출하여 dependency 명확화
  const id = treatment?.id;
  const status = treatment?.status;
  const startTime = treatment?.startTime;
  const elapsedSeconds = treatment?.elapsedSeconds || 0;
  const duration = treatment?.duration || 0;

  useEffect(() => {
    if (!treatment) {
      setRemainingSeconds(0);
      return;
    }

    const calculateRemaining = () => {
      const totalSeconds = duration * 60;

      if (status === 'completed') {
        return 0;
      } else if (status === 'running' && startTime) {
        const now = Date.now();
        const start = new Date(startTime).getTime();
        const elapsed = (now - start) / 1000 + elapsedSeconds;
        return Math.max(0, totalSeconds - elapsed);
      } else if (status === 'paused') {
        return Math.max(0, totalSeconds - elapsedSeconds);
      } else {
        // pending
        return totalSeconds;
      }
    };

    setRemainingSeconds(calculateRemaining());

    // running 상태일 때만 매초 업데이트
    if (status === 'running') {
      const interval = setInterval(() => {
        setRemainingSeconds(calculateRemaining());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [treatment, id, status, startTime, elapsedSeconds, duration]);

  return remainingSeconds;
};

// 타이머 컴포넌트 - 분리하여 타이머만 리렌더링되도록 함
interface TimerDisplayProps {
  treatment: SessionTreatment | null;
}

const TimerDisplay = memo<TimerDisplayProps>(({ treatment }) => {
  const remainingSeconds = useTimer(treatment);
  const isRunning = treatment?.status === 'running';
  const isPaused = treatment?.status === 'paused';

  if (!treatment) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  return (
    <span className={`font-mono text-xs font-bold ${
      isRunning ? 'text-red-600' : isPaused ? 'text-yellow-600' : 'text-gray-500'
    }`}>
      {formatTime(remainingSeconds)}
    </span>
  );
}, (prevProps, nextProps) => {
  // treatment 속성이 바뀌면 리렌더링
  const prev = prevProps.treatment;
  const next = nextProps.treatment;
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  return prev.id === next.id &&
         prev.status === next.status &&
         prev.startTime === next.startTime &&
         prev.elapsedSeconds === next.elapsedSeconds &&
         prev.duration === next.duration;
});

TimerDisplay.displayName = 'TimerDisplay';

// 치료 상태 컴포넌트 - 분리하여 독립적으로 리렌더링
interface TreatmentStatusProps {
  treatment: SessionTreatment | null;
}

const TreatmentStatus = memo<TreatmentStatusProps>(({ treatment }) => {
  const isRunning = treatment?.status === 'running';
  const isPaused = treatment?.status === 'paused';

  if (!treatment || !treatment.name) {
    return <span className="text-green-600 font-medium text-xs">완료</span>;
  }

  return (
    <span
      className={`font-medium text-xs ${isRunning ? 'text-clinic-secondary' : isPaused ? 'text-yellow-600' : 'text-gray-600'}`}
      title={treatment.name}
    >
      {(treatment.name || '').slice(0, 3)}
      {isPaused && <i className="fa-solid fa-pause text-[9px] text-yellow-500 ml-0.5"></i>}
    </span>
  );
});

TreatmentStatus.displayName = 'TreatmentStatus';

// 환자 정보 컴포넌트 - 분리하여 정보가 변경될 때만 리렌더링
interface PatientInfoProps {
  patient: PatientTreatmentInfo;
}

const PatientInfo = memo<PatientInfoProps>(({ patient }) => {
  // 차트번호 앞의 0 제거
  const formatChartNumber = (chartNumber?: string) => {
    if (!chartNumber) return '';
    return chartNumber.replace(/^0+/, '') || '0';
  };

  // 나이 계산
  const getAge = (dob?: string) => {
    if (!dob) return '';
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  // 성별 표시
  const getGenderDisplay = (gender?: 'male' | 'female') => {
    if (!gender) return '';
    return gender === 'male' ? '남' : '여';
  };

  // 담당의 이니셜
  const getDoctorInitial = (name: string) => {
    if (!name) return '?';
    return name.charAt(0);
  };

  const gender = getGenderDisplay(patient.patientGender);
  const age = getAge(patient.patientDob);
  const genderAge = gender || age ? `${gender}${gender && age ? '/' : ''}${age}` : '';
  const fullInfo = `${patient.patientName}(${patient.patientChartNumber || ''})${genderAge ? '/' + genderAge : ''}`;

  return (
    <>
      {/* 환자이름(차트번호)/성별/나이 */}
      <div className="truncate flex items-baseline gap-1" title={fullInfo}>
        <span className="font-bold text-clinic-text-primary text-base">{patient.patientName}</span>
        {patient.patientChartNumber && (
          <span className="text-gray-400 text-sm">{formatChartNumber(patient.patientChartNumber)}</span>
        )}
        {genderAge && (
          <span className="text-gray-500 text-sm">{genderAge}</span>
        )}
      </div>

      {/* 베드번호 */}
      <div className="text-center">
        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
          {patient.roomName}
        </span>
      </div>

      {/* 담당의 */}
      <div className="flex items-center justify-center">
        <span
          className="flex items-center justify-center w-5 h-5 bg-clinic-primary/10 text-clinic-primary text-[11px] font-bold rounded-full"
          title={patient.doctorName}
        >
          {getDoctorInitial(patient.doctorName)}
        </span>
      </div>

      {/* 입실시간 */}
      <div className="text-clinic-text-secondary text-xs text-center">
        {formatInTime(patient.inTime)}
      </div>
    </>
  );
});

PatientInfo.displayName = 'PatientInfo';

interface PatientRowProps {
  patient: PatientTreatmentInfo;
  index: number;
}

const PatientRow = memo<PatientRowProps>(({ patient, index }) => {
  const currentTreatment = useMemo(
    () => findCurrentTreatment(patient.sessionTreatments),
    [patient.sessionTreatments]
  );

  return (
    <div
      className={`grid grid-cols-[1fr_2.5rem_1.5rem_3rem_2.5rem_3rem] gap-1 items-center px-2 py-1.5 text-base ${
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      } border-b border-gray-100 hover:bg-blue-50 transition-colors`}
    >
      <PatientInfo patient={patient} />

      {/* 현재 상태 */}
      <div className="flex items-center min-w-0">
        <TreatmentStatus treatment={currentTreatment} />
      </div>

      {/* 타이머 */}
      <div className="text-right">
        <TimerDisplay treatment={currentTreatment} />
      </div>
    </div>
  );
});

PatientRow.displayName = 'PatientRow';

interface TreatmentRoomStatusProps {
  treatmentRooms: TreatmentRoom[];
  allPatients: Patient[];
}

const TreatmentRoomStatus: React.FC<TreatmentRoomStatusProps> = ({ treatmentRooms, allPatients }) => {
  // 사용 중인 방만 필터링하고 안내 시간순으로 정렬
  const patients = useMemo(() => {
    const inUseRooms = treatmentRooms.filter(
      room => room.status === RoomStatus.IN_USE && room.patientId && room.sessionId
    );

    const patientList: PatientTreatmentInfo[] = inUseRooms.map(room => {
      // 환자 정보 DB에서 성별/나이 가져오기
      const patientInfo = allPatients.find(p => p.id === room.patientId);

      return {
        sessionId: room.sessionId!,
        patientId: room.patientId!,
        patientName: room.patientName || '이름없음',
        patientChartNumber: room.patientChartNumber || '',
        // 환자 DB에서 가져온 정보 우선 사용, 없으면 room 정보 사용
        patientGender: patientInfo?.gender || room.patientGender,
        patientDob: patientInfo?.dob || room.patientDob,
        doctorName: room.doctorName || '',
        roomName: room.name,
        inTime: room.inTime ? new Date(room.inTime) : new Date(),
        sessionTreatments: room.sessionTreatments,
      };
    });

    // 안내 시간순으로 정렬 (먼저 온 환자가 위)
    patientList.sort((a, b) => a.inTime.getTime() - b.inTime.getTime());

    return patientList;
  }, [treatmentRooms, allPatients]);

  const titleWithCount = (
    <>
      치료실 현황
      <span className="ml-2 px-2 py-0.5 bg-clinic-primary text-white text-sm font-bold rounded-full">
        {patients.length}명
      </span>
    </>
  );

  return (
    <Quadrant icon="fa-solid fa-user-nurse" title={titleWithCount} className="flex-1">
      <div className="flex flex-col h-full">
        {/* 환자 목록 - 최대 17명 */}
        <div className="flex-1 overflow-y-auto">
          {patients.length > 0 ? (
            patients.slice(0, 17).map((patient, index) => (
              <PatientRow key={patient.sessionId} patient={patient} index={index} />
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              현재 치료 중인 환자가 없습니다
            </div>
          )}
        </div>
      </div>
    </Quadrant>
  );
};

export default TreatmentRoomStatus;
