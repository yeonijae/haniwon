/**
 * Doctor Dashboard
 * 원장실 대시보드 - 원장 선택 및 대시보드 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDoctorsWithSqliteStatus } from '@modules/staff/api/staffApi';
import { startActing } from '@modules/acting/api';
import type { StaffMember } from '@modules/staff/types';
import type { ActingQueueItem } from '@modules/acting/types';
import type { HerbalPackage } from '@modules/cs/types';

import {
  DoctorSelectPanel,
  ActingQueuePanel,
  PrescriptionPendingPanel,
  DosagePendingPanel,
  ConsultationPanel,
  TodayTreatmentPlansPanel,
} from '../components';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDoctor, setSelectedDoctor] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  // URL에서 doctor 파라미터 읽기
  const doctorIdParam = searchParams.get('doctor');

  // 원장 정보 로드
  const loadDoctor = useCallback(async (doctorId: number) => {
    try {
      const doctors = await fetchDoctorsWithSqliteStatus();
      const doctor = doctors.find(d => d.id === doctorId);
      if (doctor) {
        setSelectedDoctor(doctor);
      } else {
        // 존재하지 않는 doctor ID면 파라미터 제거
        setSearchParams({});
      }
    } catch (error) {
      console.error('원장 정보 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    if (doctorIdParam) {
      const doctorId = parseInt(doctorIdParam, 10);
      if (!isNaN(doctorId)) {
        loadDoctor(doctorId);
      } else {
        setSearchParams({});
        setLoading(false);
      }
    } else {
      setSelectedDoctor(null);
      setLoading(false);
    }
  }, [doctorIdParam, loadDoctor, setSearchParams]);

  // MSSQL doctor_id 추출 헬퍼 (예: "doctor_3" -> 3)
  const getMssqlDoctorId = (doctor: StaffMember): number => {
    if (doctor.mssql_doctor_id) {
      const id = parseInt(doctor.mssql_doctor_id.replace('doctor_', ''), 10);
      if (!isNaN(id)) return id;
    }
    return doctor.id;
  };

  // 액팅 시작 핸들러
  const handleStartActing = async (acting: ActingQueueItem) => {
    console.log('[Dashboard] handleStartActing 호출됨:', acting);
    if (!selectedDoctor) {
      console.log('[Dashboard] selectedDoctor 없음, 리턴');
      return;
    }

    try {
      console.log('[Dashboard] startActing API 호출...');
      await startActing(acting.id, getMssqlDoctorId(selectedDoctor), selectedDoctor.name);
      console.log('[Dashboard] startActing 완료, 차트 페이지로 이동');

      // 차트 페이지로 이동 (autoCreate=true로 차트 없으면 자동 생성, 녹음 자동 시작)
      const params = new URLSearchParams({
        chartNo: acting.chartNo,
        autoCreate: 'true',
        autoRecord: 'true',
        actingId: String(acting.id),
        actingType: acting.actingType || '약상담',
        doctorId: String(getMssqlDoctorId(selectedDoctor)),
        doctorName: selectedDoctor.name,
      });
      const url = `/doctor/patients/${acting.patientId}?${params.toString()}`;
      console.log('[Dashboard] navigate to:', url);
      navigate(url);
    } catch (error) {
      console.error('[Dashboard] 액팅 시작 실패:', error);
    }
  };

  // 환자 클릭 핸들러
  const handlePatientClick = (patientId: number, chartNumber: string) => {
    navigate(`/doctor/patients/${patientId}?chartNo=${chartNumber}`);
  };

  // 처방 클릭 핸들러
  const handlePrescriptionClick = (pkg: HerbalPackage) => {
    navigate(`/doctor/prescription/edit?packageId=${pkg.id}`);
  };

  // 복용법 클릭 핸들러
  const handleDosageClick = (pkg: HerbalPackage) => {
    navigate(`/doctor/dosage-instruction/create?packageId=${pkg.id}`);
  };

  // 상담 완료 핸들러
  const handleConsultationComplete = () => {
    // 새로고침 트리거 (SSE로 자동 갱신되지만 명시적 호출도 가능)
  };

  // 원장 변경 핸들러
  const handleChangeDoctor = () => {
    setSearchParams({});
    setSelectedDoctor(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="border-4 border-gray-200 border-t-clinic-primary rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 원장 미선택 시 선택 화면
  if (!selectedDoctor) {
    return <DoctorSelectPanel />;
  }

  // 원장 선택 시 대시보드 화면
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-100">
      {/* 상단 헤더 */}
      <div className="flex-shrink-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 원장 프로필 */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: selectedDoctor.profile_color || '#3B82F6' }}
          >
            {selectedDoctor.alias?.[0] || selectedDoctor.name[0]}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {selectedDoctor.alias || selectedDoctor.name} 대시보드
            </h1>
            <p className="text-xs text-gray-500">
              {selectedDoctor.consultation_room || '원장실'}
            </p>
          </div>
        </div>

        <button
          onClick={handleChangeDoctor}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          원장 변경
        </button>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full flex flex-col gap-4">
          {/* 상단 3열 레이아웃 (55%) */}
          <div className="min-h-0 grid grid-cols-3 gap-4" style={{ flex: '55 1 0%' }}>
            {/* 좌측: 진행중 상담 */}
            <div className="h-full overflow-hidden">
              <ConsultationPanel
                doctorId={getMssqlDoctorId(selectedDoctor)}
                doctorName={selectedDoctor.name}
                onPatientClick={handlePatientClick}
                onComplete={handleConsultationComplete}
              />
            </div>

            {/* 중앙: 액팅 대기열 */}
            <div className="h-full overflow-hidden">
              <ActingQueuePanel
                doctorId={getMssqlDoctorId(selectedDoctor)}
                doctorName={selectedDoctor.name}
                onActingClick={(acting) => handlePatientClick(acting.patientId, acting.chartNo)}
                onStartActing={handleStartActing}
              />
            </div>

            {/* 우측: 처방 대기 */}
            <div className="h-full overflow-hidden">
              <PrescriptionPendingPanel
                doctorId={getMssqlDoctorId(selectedDoctor)}
                doctorName={selectedDoctor.name}
                onPatientClick={handlePatientClick}
                onPrescriptionClick={handlePrescriptionClick}
              />
            </div>
          </div>

          {/* 하단: 2열 레이아웃 (45%) */}
          <div className="min-h-0 grid grid-cols-2 gap-4" style={{ flex: '45 1 0%' }}>
            {/* 좌측: 오늘의 진료계획 */}
            <div className="h-full overflow-hidden">
              <TodayTreatmentPlansPanel
                onPatientClick={handlePatientClick}
              />
            </div>

            {/* 우측: 복용법 대기 */}
            <div className="h-full overflow-hidden">
              <DosagePendingPanel
                doctorId={getMssqlDoctorId(selectedDoctor)}
                doctorName={selectedDoctor.name}
                onPatientClick={handlePatientClick}
                onDosageClick={handleDosageClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
