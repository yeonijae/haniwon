/**
 * 원장용 진료패드 - 리디자인 버전
 * 시방서: docs/doctor-pad-redesign-spec.md
 *
 * 3섹션 대시보드:
 * - 내 액팅 대기 (클릭 시 환자 차트 모달)
 * - 내 환자 치료 현황 (베드에서 치료 중인 담당 환자)
 * - 진행 중인 내 액팅 (시간 카운팅)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import type { ActingQueueItem, DoctorStatus } from '@modules/acting/types';
import type { TreatmentRoom } from '@modules/treatment/types';
import * as actingApi from '@modules/acting/api';
import type { PatientMemo, TreatmentHistory } from '@modules/acting/api';
import { fetchTreatmentRooms } from '@modules/manage/lib/api';
import {
  fetchPatientDefaultTreatments,
  fetchDailyTreatmentRecord,
} from '@modules/manage/lib/treatmentApi';
import type { PatientDefaultTreatments, DailyTreatmentRecord } from '@modules/manage/types';
import { TREATMENT_CHECKBOX_ITEMS, YAKCHIM_SELECT_ITEMS } from '@modules/manage/hooks/useTreatmentInfo';

interface DoctorPadAppProps {
  user: PortalUser;
}

// 원장 목록 (MSSQL doctor_id와 매칭)
const DOCTORS = [
  { id: 3, name: '김원장', fullName: '김대현', color: '#10B981', alias: '김' },
  { id: 1, name: '강원장', fullName: '강희종', color: '#3B82F6', alias: '강' },
  { id: 13, name: '임원장', fullName: '임세열', color: '#8B5CF6', alias: '임' },
  { id: 15, name: '전원장', fullName: '전인태', color: '#F59E0B', alias: '전' },
];

// 상태 색상
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  in_progress: { bg: 'bg-green-500', text: 'text-white', label: '진료중' },
  waiting: { bg: 'bg-yellow-500', text: 'text-white', label: '대기중' },
  office: { bg: 'bg-gray-400', text: 'text-white', label: '원장실' },
  away: { bg: 'bg-red-500', text: 'text-white', label: '부재' },
};

// 탭 타입
type ChartTab = 'memo' | 'history' | 'receipt' | 'today';

// 환자 차트 모달 컴포넌트 (4탭)
interface PatientChartModalProps {
  acting: ActingQueueItem;
  memo: PatientMemo | null;
  treatments: TreatmentHistory[];
  receipts: any[];
  defaultTreatments: PatientDefaultTreatments | null;
  dailyRecord: DailyTreatmentRecord | null;
  loading: boolean;
  isActingInProgress: boolean;
  elapsedTime: number;
  onClose: () => void;
  onStartActing: () => void;
  onCompleteActing: () => void;
}

const PatientChartModal: React.FC<PatientChartModalProps> = ({
  acting,
  memo,
  treatments,
  receipts,
  defaultTreatments,
  dailyRecord,
  loading,
  isActingInProgress,
  elapsedTime,
  onClose,
  onStartActing,
  onCompleteActing,
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('memo');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 기본 치료 항목 목록
  const treatmentItems = defaultTreatments
    ? TREATMENT_CHECKBOX_ITEMS.filter(item => defaultTreatments[item.key])
    : [];

  // 약침 정보
  const yakchimInfo = defaultTreatments?.yakchim_type
    ? `${YAKCHIM_SELECT_ITEMS.find(y => y.value === defaultTreatments.yakchim_type)?.label || defaultTreatments.yakchim_type} ${defaultTreatments.yakchim_quantity}cc`
    : null;

  const tabs = [
    { id: 'memo' as ChartTab, label: '메모' },
    { id: 'history' as ChartTab, label: '진료내역' },
    { id: 'receipt' as ChartTab, label: '수납내역' },
    { id: 'today' as ChartTab, label: '오늘치료' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{acting.patientName}</h2>
            <p className="text-blue-200">{acting.chartNo || '차트번호 없음'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-500 transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* 액팅 시작/종료 버튼 영역 */}
        <div className="bg-gray-50 border-b px-6 py-4">
          {isActingInProgress ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-lg font-bold text-gray-800">{acting.actingType} 진행중</span>
                <span className={`text-3xl font-mono font-bold ${elapsedTime > 180 ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatTime(elapsedTime)}
                </span>
              </div>
              <button
                onClick={onCompleteActing}
                className="px-8 py-3 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                {acting.actingType} 종료
              </button>
            </div>
          ) : (
            <button
              onClick={onStartActing}
              className="w-full py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 transition-colors"
            >
              {acting.actingType} 시작
            </button>
          )}
        </div>

        {/* 탭 메뉴 */}
        <div className="flex border-b bg-gray-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">환자 정보 로딩중...</div>
          ) : (
            <>
              {/* 메모 탭 */}
              {activeTab === 'memo' && (
                <div className="space-y-4">
                  {/* 주치의메모 */}
                  {memo?.doctorMemo && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-500 mb-2">주치의메모</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-gray-800 whitespace-pre-wrap">
                        {memo.doctorMemo}
                      </div>
                    </section>
                  )}

                  {/* 간호사메모 */}
                  {memo?.nurseMemo && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-500 mb-2">간호사메모</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-gray-800 whitespace-pre-wrap">
                        {memo.nurseMemo}
                      </div>
                    </section>
                  )}

                  {/* 주소증 */}
                  {memo?.mainDisease && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-500 mb-2">주소증</h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-gray-800">
                        {memo.mainDisease}
                      </div>
                    </section>
                  )}

                  {/* 진료메모2 (treat_type) */}
                  {memo?.treatType && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-500 mb-2">진료메모</h3>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-gray-800">
                        {memo.treatType}
                      </div>
                    </section>
                  )}

                  {/* 기타메모 */}
                  {memo?.etcMemo && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-500 mb-2">기타메모</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-800">
                        {memo.etcMemo}
                      </div>
                    </section>
                  )}

                  {!memo?.doctorMemo && !memo?.nurseMemo && !memo?.mainDisease && !memo?.treatType && !memo?.etcMemo && (
                    <div className="text-center py-8 text-gray-400">저장된 메모가 없습니다</div>
                  )}
                </div>
              )}

              {/* 진료내역 탭 */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {treatments.length > 0 ? (
                    treatments.map(t => (
                      <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
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
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">진료내역이 없습니다</div>
                  )}
                </div>
              )}

              {/* 수납내역 탭 */}
              {activeTab === 'receipt' && (
                <div className="space-y-3">
                  {receipts.length > 0 ? (
                    receipts.map((r, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-800">{r.receipt_date}</span>
                          <span className="text-lg font-bold text-blue-600">
                            {(r.amount || 0).toLocaleString()}원
                          </span>
                        </div>
                        {r.payment_type && (
                          <p className="text-sm text-gray-500 mt-1">{r.payment_type}</p>
                        )}
                        {r.memo && (
                          <p className="text-sm text-gray-500">{r.memo}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">수납내역이 없습니다</div>
                  )}
                </div>
              )}

              {/* 오늘치료 탭 */}
              {activeTab === 'today' && (
                <div className="space-y-4">
                  {(treatmentItems.length > 0 || yakchimInfo) ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {treatmentItems.map(item => (
                          <span
                            key={item.key}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              item.isActing
                                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {item.label}
                            {item.isActing && <span className="ml-1 text-orange-500">★</span>}
                          </span>
                        ))}
                        {yakchimInfo && (
                          <span className="px-3 py-1.5 bg-lime-100 text-lime-700 rounded-full text-sm font-medium border border-lime-300">
                            약침: {yakchimInfo}
                          </span>
                        )}
                      </div>
                      {defaultTreatments?.memo && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <span className="font-medium text-gray-700">메모:</span> {defaultTreatments.memo}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">오늘 치료 정보가 없습니다</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-200 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 내 환자 치료 현황 아이템
interface PatientBedItemProps {
  room: TreatmentRoom;
  onClick?: () => void;
}

const PatientBedItem: React.FC<PatientBedItemProps> = ({ room, onClick }) => {
  const currentTreatment = room.sessionTreatments?.find(t => t.status === 'running');
  const pendingTreatments = room.sessionTreatments?.filter(t => t.status === 'pending') || [];

  // 현재 치료의 남은 시간 계산
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    if (!currentTreatment?.startTime || !currentTreatment?.duration) {
      setRemainingTime('');
      return;
    }

    const calculateRemaining = () => {
      const start = new Date(currentTreatment.startTime!);
      const now = new Date();
      const elapsedSec = Math.floor((now.getTime() - start.getTime()) / 1000);
      const durationSec = currentTreatment.duration * 60;
      const remainingSec = Math.max(0, durationSec - elapsedSec);

      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      setRemainingTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [currentTreatment?.startTime, currentTreatment?.duration]);

  const nextTreatments = pendingTreatments.slice(0, 2).map(t => t.name).join(' → ');

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-400 cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="text-sm text-gray-500">{room.name}</span>
          <h4 className="font-bold text-gray-800">{room.patientName}</h4>
        </div>
        <div className="text-right">
          <span className="inline-block px-2 py-1 bg-teal-100 text-teal-700 rounded text-sm font-medium">
            {currentTreatment?.name || '대기'}
          </span>
          {remainingTime && (
            <p className={`text-lg font-mono font-bold ${parseInt(remainingTime) < 2 ? 'text-red-600' : 'text-gray-600'}`}>
              {remainingTime}
            </p>
          )}
        </div>
      </div>
      {nextTreatments && (
        <p className="text-xs text-gray-500 mt-1">다음: {nextTreatments}</p>
      )}
    </div>
  );
};

// 원장 뷰 (3섹션 대시보드)
interface DoctorViewProps {
  doctor: typeof DOCTORS[0];
  onBack: () => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ doctor, onBack }) => {
  const [status, setStatus] = useState<DoctorStatus | null>(null);
  const [queue, setQueue] = useState<ActingQueueItem[]>([]);
  const [currentActing, setCurrentActing] = useState<ActingQueueItem | null>(null);
  const [myPatientRooms, setMyPatientRooms] = useState<TreatmentRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 환자 차트 모달 상태
  const [selectedActing, setSelectedActing] = useState<ActingQueueItem | null>(null);
  const [patientMemo, setPatientMemo] = useState<PatientMemo | null>(null);
  const [patientTreatments, setPatientTreatments] = useState<TreatmentHistory[]>([]);
  const [patientReceipts, setPatientReceipts] = useState<any[]>([]);
  const [patientDefaultTreatments, setPatientDefaultTreatments] = useState<PatientDefaultTreatments | null>(null);
  const [patientDailyRecord, setPatientDailyRecord] = useState<DailyTreatmentRecord | null>(null);
  const [loadingPatientInfo, setLoadingPatientInfo] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [doctorStatus, doctorQueue, treatmentRooms] = await Promise.all([
        actingApi.fetchDoctorStatus(doctor.id),
        actingApi.fetchDoctorQueue(doctor.id),
        fetchTreatmentRooms(),
      ]);

      setStatus(doctorStatus);

      const inProgress = doctorQueue.find(q => q.status === 'in_progress');
      const waiting = doctorQueue.filter(q => q.status === 'waiting');

      setCurrentActing(inProgress || null);
      setQueue(waiting);

      // 내 담당 환자가 있는 베드 필터링
      const myRooms = treatmentRooms.filter(room => {
        if (!room.patientId || !room.doctorName) return false;
        // 원장 이름 또는 alias로 매칭
        return room.doctorName.includes(doctor.name) ||
               room.doctorName.includes(doctor.fullName) ||
               room.doctorName.includes(doctor.alias);
      });
      setMyPatientRooms(myRooms);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctor.id, doctor.name, doctor.fullName, doctor.alias]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 폴링 (3초마다)
  useEffect(() => {
    const POLLING_INTERVAL = 3000;
    const intervalId = setInterval(loadData, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
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

  // 환자 선택 시 정보 로드
  const handleSelectPatient = async (acting: ActingQueueItem) => {
    setSelectedActing(acting);
    setLoadingPatientInfo(true);
    setPatientMemo(null);
    setPatientTreatments([]);
    setPatientReceipts([]);
    setPatientDefaultTreatments(null);
    setPatientDailyRecord(null);

    const today = new Date().toISOString().split('T')[0];

    try {
      const [memo, treatments, defaultTreatments, dailyRecord] = await Promise.all([
        actingApi.fetchPatientMemo(acting.patientId),
        actingApi.fetchPatientTreatments(acting.patientId, 3),
        fetchPatientDefaultTreatments(acting.patientId),
        fetchDailyTreatmentRecord(acting.patientId, today),
      ]);

      setPatientMemo(memo);
      setPatientTreatments(treatments);
      setPatientDefaultTreatments(defaultTreatments);
      setPatientDailyRecord(dailyRecord);

      // 수납내역 조회 (차트번호가 있는 경우)
      if (acting.chartNo) {
        try {
          const { fetchPatientReceiptHistory } = await import('@modules/manage/lib/api');
          const receipts = await fetchPatientReceiptHistory(acting.chartNo, 3);
          setPatientReceipts(receipts);
        } catch (e) {
          console.error('수납내역 조회 오류:', e);
        }
      }
    } catch (error) {
      console.error('환자 정보 로드 오류:', error);
    } finally {
      setLoadingPatientInfo(false);
    }
  };

  // 현재 진행중인 액팅 클릭 시 모달 열기
  const handleCurrentActingClick = () => {
    if (currentActing) {
      handleSelectPatient(currentActing);
    }
  };

  const handleCloseModal = () => {
    setSelectedActing(null);
    setPatientMemo(null);
    setPatientTreatments([]);
    setPatientReceipts([]);
    setPatientDefaultTreatments(null);
    setPatientDailyRecord(null);
  };

  const handleStartActing = async () => {
    if (!selectedActing) return;

    try {
      await actingApi.startActing(selectedActing.id, doctor.id, doctor.fullName);
      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('진료 시작 오류:', error);
      alert('진료 시작 중 오류가 발생했습니다.');
    }
  };

  const handleCompleteActing = async () => {
    const actingToComplete = selectedActing || currentActing;
    if (!actingToComplete) return;

    try {
      await actingApi.completeActing(actingToComplete.id, doctor.id, doctor.fullName);
      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('진료 완료 오류:', error);
      alert('진료 완료 중 오류가 발생했습니다.');
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
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="text-gray-600 text-2xl p-2">←</button>
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: doctor.color }}>{doctor.name}</h1>
          <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs ${statusStyle.bg} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
        <button onClick={loadData} className="text-gray-600 text-xl p-2">↻</button>
      </header>

      {/* 메인 콘텐츠 - 3섹션 */}
      <main className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* 섹션 1: 내 액팅 대기 */}
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
            <span>📋</span> 내 액팅 대기 ({queue.length})
          </h2>
          {queue.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {queue.map((acting) => (
                <button
                  key={acting.id}
                  onClick={() => handleSelectPatient(acting)}
                  className="flex-shrink-0 w-24 h-24 rounded-xl bg-blue-50 border-2 border-blue-200 hover:border-blue-400 flex flex-col items-center justify-center transition-colors"
                >
                  <span className="font-bold text-gray-800 truncate w-full px-2 text-center">
                    {acting.patientName}
                  </span>
                  <span className="text-xs text-blue-600 mt-1">{acting.actingType}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">대기중인 액팅이 없습니다</p>
          )}
        </section>

        {/* 섹션 2: 내 환자 치료 현황 */}
        <section className="bg-white rounded-xl shadow p-4 flex-1">
          <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
            <span>🛏️</span> 내 환자 치료 현황 ({myPatientRooms.length})
          </h2>
          {myPatientRooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {myPatientRooms.map(room => (
                <PatientBedItem key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">치료실에 담당 환자가 없습니다</p>
          )}
        </section>

        {/* 섹션 3: 진행 중인 내 액팅 */}
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
            <span>⏱️</span> 진행 중인 액팅
          </h2>
          {currentActing ? (
            <div
              onClick={handleCurrentActingClick}
              className="bg-green-50 border-2 border-green-300 rounded-xl p-4 cursor-pointer hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-800">{currentActing.patientName}</h3>
                    <p className="text-sm text-gray-500">{currentActing.actingType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-mono font-bold ${elapsedTime > 180 ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatTime(elapsedTime)}
                  </span>
                  <p className="text-xs text-gray-500">경과</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleCompleteActing(); }}
                className="w-full mt-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                종료
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">진행중인 액팅이 없습니다</p>
          )}
        </section>
      </main>

      {/* 환자 차트 모달 */}
      {selectedActing && (
        <PatientChartModal
          acting={selectedActing}
          memo={patientMemo}
          treatments={patientTreatments}
          receipts={patientReceipts}
          defaultTreatments={patientDefaultTreatments}
          dailyRecord={patientDailyRecord}
          loading={loadingPatientInfo}
          isActingInProgress={currentActing?.id === selectedActing.id}
          elapsedTime={currentActing?.id === selectedActing.id ? elapsedTime : 0}
          onClose={handleCloseModal}
          onStartActing={handleStartActing}
          onCompleteActing={handleCompleteActing}
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
