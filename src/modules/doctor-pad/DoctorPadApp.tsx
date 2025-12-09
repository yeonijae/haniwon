/**
 * 원장용 진료패드 - 액팅 시작/완료 인터페이스
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import type { ActingQueueItem, DoctorStatus } from '@modules/acting/types';
import * as actingApi from '@modules/acting/api';
import type { PatientMemo, TreatmentHistory } from '@modules/acting/api';

interface DoctorPadAppProps {
  user: PortalUser;
}

// 원장 목록 (실제 DB의 doctor_id와 매칭)
const DOCTORS = [
  { id: 1, name: '김원장', color: '#10B981' },
  { id: 2, name: '강원장', color: '#3B82F6' },
  { id: 3, name: '임원장', color: '#8B5CF6' },
  { id: 4, name: '전원장', color: '#F59E0B' },
];

// 상태 색상
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  in_progress: { bg: 'bg-green-500', text: 'text-white', label: '진료중' },
  waiting: { bg: 'bg-yellow-500', text: 'text-white', label: '대기중' },
  office: { bg: 'bg-gray-400', text: 'text-white', label: '원장실' },
  away: { bg: 'bg-red-500', text: 'text-white', label: '부재' },
};

// 환자 정보 모달 컴포넌트
interface PatientInfoModalProps {
  acting: ActingQueueItem;
  memo: PatientMemo | null;
  treatments: TreatmentHistory[];
  loading: boolean;
  onClose: () => void;
  onStartActing: () => void;
}

const PatientInfoModal: React.FC<PatientInfoModalProps> = ({
  acting,
  memo,
  treatments,
  loading,
  onClose,
  onStartActing,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{acting.patientName}</h2>
            <p className="text-blue-200">{acting.chartNo || '차트번호 없음'} · {acting.actingType}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-500 transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">환자 정보 로딩중...</div>
          ) : (
            <>
              {/* 원장 메모 */}
              {memo?.doctorMemo && (
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    원장 메모
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-gray-800 whitespace-pre-wrap">
                    {memo.doctorMemo}
                  </div>
                </section>
              )}

              {/* 간호 메모 */}
              {memo?.nurseMemo && (
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    간호 메모
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-gray-800 whitespace-pre-wrap">
                    {memo.nurseMemo}
                  </div>
                </section>
              )}

              {/* 주요 질환 */}
              {memo?.mainDisease && (
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    주요 질환
                  </h3>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-gray-800">
                    {memo.mainDisease}
                  </div>
                </section>
              )}

              {/* 최근 진료 내역 */}
              {treatments.length > 0 && (
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    최근 진료 ({treatments.length}건)
                  </h3>
                  <div className="space-y-2">
                    {treatments.map(t => (
                      <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-gray-800">{t.date}</span>
                            {t.doctor && <span className="text-gray-500 ml-2">{t.doctor}</span>}
                          </div>
                          {t.item && (
                            <span className="text-sm bg-gray-200 px-2 py-1 rounded">{t.item}</span>
                          )}
                        </div>
                        {t.diagnosis && (
                          <p className="text-sm text-gray-600 mt-1">진단: {t.diagnosis}</p>
                        )}
                        {t.treatment && (
                          <p className="text-sm text-gray-600">처치: {t.treatment}</p>
                        )}
                        {t.note && (
                          <p className="text-sm text-gray-500 mt-1">{t.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 메모가 전혀 없는 경우 */}
              {!memo?.doctorMemo && !memo?.nurseMemo && !memo?.mainDisease && treatments.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  저장된 메모 및 진료 내역이 없습니다
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t px-6 py-4 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-200 text-gray-700 text-xl font-bold rounded-xl hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onStartActing}
            className="flex-1 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            진료 시작
          </button>
        </div>
      </div>
    </div>
  );
};

interface DoctorViewProps {
  doctor: { id: number; name: string; color: string };
  onBack: () => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ doctor, onBack }) => {
  const [status, setStatus] = useState<DoctorStatus | null>(null);
  const [queue, setQueue] = useState<ActingQueueItem[]>([]);
  const [currentActing, setCurrentActing] = useState<ActingQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 환자 정보 모달 상태
  const [selectedActing, setSelectedActing] = useState<ActingQueueItem | null>(null);
  const [patientMemo, setPatientMemo] = useState<PatientMemo | null>(null);
  const [patientTreatments, setPatientTreatments] = useState<TreatmentHistory[]>([]);
  const [loadingPatientInfo, setLoadingPatientInfo] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [doctorStatus, doctorQueue] = await Promise.all([
        actingApi.fetchDoctorStatus(doctor.id),
        actingApi.fetchDoctorQueue(doctor.id),
      ]);

      setStatus(doctorStatus);

      const inProgress = doctorQueue.find(q => q.status === 'in_progress');
      const waiting = doctorQueue.filter(q => q.status === 'waiting');

      setCurrentActing(inProgress || null);
      setQueue(waiting);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctor.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 폴링 (2초마다 - 진료패드는 빠른 응답 필요)
  useEffect(() => {
    const POLLING_INTERVAL = 2000;
    const intervalId = setInterval(loadData, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadData]);

  // 진료중일 때 경과 시간 계산
  useEffect(() => {
    if (!currentActing?.startedAt) {
      setElapsedTime(0);
      return;
    }

    const calculateElapsed = () => {
      const start = new Date(currentActing.startedAt!);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsedTime(seconds);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [currentActing?.startedAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 환자 선택 시 정보 로드 및 모달 표시
  const handleSelectPatient = async (acting: ActingQueueItem) => {
    setSelectedActing(acting);
    setLoadingPatientInfo(true);
    setPatientMemo(null);
    setPatientTreatments([]);

    try {
      const [memo, treatments] = await Promise.all([
        actingApi.fetchPatientMemo(acting.patientId),
        actingApi.fetchPatientTreatments(acting.patientId, 5),
      ]);

      setPatientMemo(memo);
      setPatientTreatments(treatments);
    } catch (error) {
      console.error('환자 정보 로드 오류:', error);
    } finally {
      setLoadingPatientInfo(false);
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setSelectedActing(null);
    setPatientMemo(null);
    setPatientTreatments([]);
  };

  // 진료 시작 (모달에서 호출)
  const handleStartActing = async () => {
    if (!selectedActing) return;

    try {
      await actingApi.startActing(selectedActing.id, doctor.id, doctor.name);
      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('진료 시작 오류:', error);
      alert('진료 시작 중 오류가 발생했습니다.');
    }
  };

  const handleCompleteActing = async () => {
    if (!currentActing) return;
    if (!window.confirm(`${currentActing.patientName}님 진료를 완료하시겠습니까?`)) return;

    try {
      await actingApi.completeActing(currentActing.id, doctor.id, doctor.name);
      await loadData();
    } catch (error) {
      console.error('진료 완료 오류:', error);
      alert('진료 완료 중 오류가 발생했습니다.');
    }
  };

  const handleSetOffice = async () => {
    try {
      await actingApi.setDoctorOffice(doctor.id, doctor.name);
      await loadData();
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-500">로딩중...</div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[status?.status || 'office'];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-gray-600 text-2xl"
        >
          ←
        </button>
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: doctor.color }}>
            {doctor.name}
          </h1>
          <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm ${statusStyle.bg} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
        <div className="w-10"></div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* 현재 진료중 */}
        {currentActing ? (
          <section className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-medium text-gray-600 mb-4">현재 진료중</h2>
            <div className="text-center">
              <div className="mb-4">
                <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-lg font-medium">
                  {currentActing.actingType}
                </span>
              </div>
              <h3 className="text-5xl font-bold text-gray-800 mb-2">
                {currentActing.patientName}
              </h3>
              {currentActing.chartNo && (
                <p className="text-xl text-gray-500 mb-4">{currentActing.chartNo}</p>
              )}
              <div className={`text-6xl font-mono font-bold mb-8 ${elapsedTime > 1200 ? 'text-red-600' : 'text-gray-800'}`}>
                {formatTime(elapsedTime)}
              </div>
              <button
                onClick={handleCompleteActing}
                className="w-full py-6 bg-blue-600 text-white text-3xl font-bold rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                진료 완료
              </button>
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-medium text-gray-600 mb-4">현재 진료중</h2>
            <p className="text-2xl text-gray-400 py-8">진료중인 환자가 없습니다</p>
            {status?.status !== 'office' && (
              <button
                onClick={handleSetOffice}
                className="mt-4 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
              >
                원장실로 이동
              </button>
            )}
          </section>
        )}

        {/* 대기열 */}
        <section className="bg-white rounded-2xl shadow-lg p-6 flex-1">
          <h2 className="text-xl font-medium text-gray-600 mb-4">
            대기열 <span className="text-blue-600">({queue.length})</span>
          </h2>
          {queue.length > 0 ? (
            <div className="space-y-3">
              {queue.map((acting, index) => (
                <div
                  key={acting.id}
                  onClick={() => !currentActing && handleSelectPatient(acting)}
                  className={`flex items-center justify-between p-5 rounded-xl border-2 transition-colors ${
                    currentActing
                      ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-400 cursor-pointer active:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full font-bold text-lg">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">{acting.patientName}</h3>
                      {acting.chartNo && (
                        <p className="text-sm text-gray-500">{acting.chartNo}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-lg font-medium">
                      {acting.actingType}
                    </span>
                    {acting.memo && (
                      <p className="text-sm text-gray-500 mt-1">{acting.memo}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-xl text-gray-400">
              대기중인 환자가 없습니다
            </div>
          )}
        </section>
      </main>

      {/* 새로고침 버튼 */}
      <button
        onClick={loadData}
        className="fixed bottom-6 right-6 w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-2xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
      >
        ↻
      </button>

      {/* 환자 정보 모달 */}
      {selectedActing && (
        <PatientInfoModal
          acting={selectedActing}
          memo={patientMemo}
          treatments={patientTreatments}
          loading={loadingPatientInfo}
          onClose={handleCloseModal}
          onStartActing={handleStartActing}
        />
      )}
    </div>
  );
};

// 원장 선택 화면
const DoctorSelectView: React.FC<{
  user: PortalUser;
  onSelect: (doctor: typeof DOCTORS[0]) => void;
  onClose: () => void;
}> = ({ user, onSelect, onClose }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">진료패드</h1>
          <p className="text-sm text-gray-500">{user.name}님</p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          닫기
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">원장 선택</h2>
        <p className="text-lg text-gray-500 mb-8">진료 관리를 위해 원장을 선택하세요</p>
        <div className="grid grid-cols-2 gap-6 max-w-2xl w-full">
          {DOCTORS.map(doctor => (
            <button
              key={doctor.id}
              onClick={() => onSelect(doctor)}
              className="aspect-square rounded-3xl shadow-lg flex flex-col items-center justify-center text-white text-4xl font-bold hover:scale-105 active:scale-95 transition-transform"
              style={{ backgroundColor: doctor.color }}
            >
              {doctor.name}
            </button>
          ))}
        </div>
      </main>

      <footer className="p-6 text-center text-gray-500">
        연이재한의원 진료 관리 시스템
      </footer>
    </div>
  );
};

// 메인 앱
function DoctorPadApp({ user }: DoctorPadAppProps) {
  const [searchParams] = useSearchParams();
  const doctorIdFromUrl = searchParams.get('doctor');

  const [selectedDoctor, setSelectedDoctor] = useState<typeof DOCTORS[0] | null>(() => {
    if (doctorIdFromUrl) {
      return DOCTORS.find(d => d.id === parseInt(doctorIdFromUrl)) || null;
    }
    return null;
  });

  const handleClose = () => {
    window.close();
  };

  if (!selectedDoctor) {
    return (
      <DoctorSelectView
        user={user}
        onSelect={setSelectedDoctor}
        onClose={handleClose}
      />
    );
  }

  return <DoctorView doctor={selectedDoctor} onBack={() => setSelectedDoctor(null)} />;
}

export default DoctorPadApp;
