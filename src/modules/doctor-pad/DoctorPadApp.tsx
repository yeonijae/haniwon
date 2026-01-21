/**
 * 원장용 진료패드 - 리디자인 버전
 * 시방서: docs/doctor-pad-redesign-spec.md
 *
 * 3섹션 대시보드:
 * - 내 액팅 대기 (클릭 시 환자 차트 모달)
 * - 내 환자 치료 현황 (베드에서 치료 중인 담당 환자)
 * - 진행 중인 내 액팅 (시간 카운팅)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import type { ActingQueueItem, DoctorStatus } from '@modules/acting/types';
import type { TreatmentRoom } from '@modules/treatment/types';
import * as actingApi from '@modules/acting/api';
import type { PatientMemo, TreatmentHistory, DetailComment, ActingTreatmentConfigItem, TreatmentItemSelection } from '@modules/acting/api';
import { getCurrentDate } from '@shared/lib/postgres';
import { useSSE, SSEMessage } from '@shared/hooks/useSSE';
import {
  fetchPatientDetailComments,
  getMssqlPatientId,
  fetchActingTreatmentConfig,
  saveActingTreatmentDetails,
  sendJandiWebhook,
} from '@modules/acting/api';
import { fetchTreatmentRooms } from '@modules/manage/lib/api';
import {
  fetchPatientDefaultTreatments,
  fetchDailyTreatmentRecord,
} from '@modules/manage/lib/treatmentApi';
import type { PatientDefaultTreatments, DailyTreatmentRecord } from '@modules/manage/types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { processRecording } from './services/transcriptionService';
import { TodaySchedule, DoctorDashboard, CompactPatientStatus, QuickChat, ThemeToggle } from './components';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

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

// 환자 차트 모달 컴포넌트 (새 디자인)
interface PatientChartModalProps {
  acting: ActingQueueItem;
  doctorId: number;
  doctorName: string;
  memo: PatientMemo | null;
  treatments: TreatmentHistory[];
  detailComments: DetailComment[];
  receipts: any[];
  defaultTreatments: PatientDefaultTreatments | null;
  dailyRecord: DailyTreatmentRecord | null;
  loading: boolean;
  isActingInProgress: boolean;
  elapsedTime: number;
  startedAt: string | null;
  fontSize: number;
  isRecording?: boolean;
  onClose: () => void;
  onStartActing: () => void;
  onCompleteActing: (treatmentItems: TreatmentItemSelection) => void;
}

const PatientChartModal: React.FC<PatientChartModalProps> = ({
  acting,
  doctorId,
  doctorName,
  memo,
  treatments,
  detailComments,
  receipts,
  defaultTreatments,
  dailyRecord,
  loading,
  isActingInProgress,
  elapsedTime,
  startedAt,
  fontSize,
  isRecording = false,
  onClose,
  onStartActing,
  onCompleteActing,
}) => {
  // 치료 항목 설정
  const [treatmentConfig, setTreatmentConfig] = useState<ActingTreatmentConfigItem[]>([]);
  // 치료 항목 선택 상태 (itemName -> value)
  const [treatmentSelection, setTreatmentSelection] = useState<TreatmentItemSelection>({});

  // 진료내역 펼침 상태 (인덱스별)
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});

  const toggleComment2 = (idx: number) => {
    setExpandedComments(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // 액팅 타입에 맞는 치료 항목 설정 로드
  useEffect(() => {
    const loadConfig = async () => {
      // 액팅 타입 매핑: '자침' -> '침', '침치료' -> '침' 등
      let actingType = acting.actingType;
      if (actingType.includes('침')) actingType = '침';
      else if (actingType.includes('추나')) actingType = '추나';
      else if (actingType.includes('초음파')) actingType = '초음파';
      else if (actingType.includes('약')) actingType = '약상담';

      const config = await fetchActingTreatmentConfig(actingType);
      setTreatmentConfig(config);
    };
    loadConfig();
  }, [acting.actingType]);

  // 토글 항목 클릭
  const handleToggleItem = (itemName: string) => {
    setTreatmentSelection(prev => ({
      ...prev,
      [itemName]: prev[itemName] ? 0 : 1,
    }));
  };

  // 탭사이클 항목 클릭 (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0)
  const handleCycleItem = (itemName: string, maxValue: number) => {
    setTreatmentSelection(prev => {
      const current = prev[itemName] || 0;
      const next = current >= maxValue ? 0 : current + 1;
      return { ...prev, [itemName]: next };
    });
  };

  // 완료 버튼 클릭
  const handleComplete = () => {
    onCompleteActing(treatmentSelection);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50" style={{ fontSize: `${fontSize}px` }}>
      <div className="bg-white w-full h-full overflow-hidden flex flex-col">
        {/* 헤더: 이름, 나이/성별, 차트번호 */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold">{acting.patientName}</h2>
            <span className="text-xl text-blue-200">#{acting.chartNo || '-'}</span>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-blue-500 transition-colors text-3xl"
          >
            ×
          </button>
        </div>

        {/* 컨트롤 패널 */}
        <div className="bg-white border-b-2 px-4 py-3">
          {isActingInProgress ? (
            <div className="space-y-2">
              {/* 상단: 타이머 + 녹음표시 + 완료 버튼 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className={`text-2xl font-mono font-bold ${elapsedTime > 180 ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatTime(elapsedTime)}
                  </span>
                  {/* 녹음 중 표시 */}
                  {isRecording && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-sm font-medium rounded-full flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      REC
                    </span>
                  )}
                </div>
                <button
                  onClick={handleComplete}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  완료
                </button>
              </div>

              {/* 치료 항목 버튼들 */}
              {treatmentConfig.length > 0 && (
                <div className="space-y-2">
                  {/* 토글 항목 (default 그룹) */}
                  <div className="flex flex-wrap gap-1">
                    {treatmentConfig
                      .filter(item => item.itemType === 'toggle')
                      .map(item => {
                        const isSelected = treatmentSelection[item.itemName] === 1;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleToggleItem(item.itemName)}
                            className={`px-3 py-2 rounded-lg font-medium transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {item.itemName}
                          </button>
                        );
                      })}
                  </div>

                  {/* 탭사이클 항목 (약침 그룹) */}
                  {treatmentConfig.some(item => item.itemType === 'cycle') && (
                    <div className="flex flex-wrap gap-1">
                      {treatmentConfig
                        .filter(item => item.itemType === 'cycle')
                        .map(item => {
                          const value = treatmentSelection[item.itemName] || 0;
                          // 값에 따라 색상 진하기 조절
                          const intensity = value > 0 ? Math.min(value * 20 + 40, 100) : 0;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleCycleItem(item.itemName, item.maxValue)}
                              className={`px-3 py-2 rounded-lg font-medium transition-all ${
                                value > 0
                                  ? 'text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={value > 0 ? {
                                backgroundColor: `hsl(160, 70%, ${70 - intensity * 0.3}%)`,
                              } : undefined}
                            >
                              {item.itemName}{value > 0 && <sub className="ml-0.5">{value}</sub>}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
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

        {/* 메인 콘텐츠 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="text-center py-8 text-gray-500">환자 정보 로딩중...</div>
          ) : (
            <div className="p-4 space-y-4">
              {/* 섹션 1: 메모 (readonly) */}
              <section className="bg-white rounded-xl shadow p-4">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontSize: '1.1em' }}>
                  <span>📋</span> 환자 메모
                </h3>
                <div className="space-y-3">
                  {/* 주소증 */}
                  {memo?.mainDisease && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r">
                      <span className="font-bold text-orange-600" style={{ fontSize: '0.9em' }}>주소증</span>
                      <p className="text-gray-800 mt-1">{memo.mainDisease}</p>
                    </div>
                  )}

                  {/* 주치의메모 */}
                  {memo?.doctorMemo && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r">
                      <span className="font-bold text-red-600" style={{ fontSize: '0.9em' }}>주치의메모</span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap">{memo.doctorMemo}</p>
                    </div>
                  )}

                  {/* 간호사메모 */}
                  {memo?.nurseMemo && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r">
                      <span className="font-bold text-blue-600" style={{ fontSize: '0.9em' }}>간호사메모</span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap">{memo.nurseMemo}</p>
                    </div>
                  )}

                  {/* 기타메모 */}
                  {memo?.etcMemo && (
                    <div className="bg-gray-100 border-l-4 border-gray-400 p-3 rounded-r">
                      <span className="font-bold text-gray-600" style={{ fontSize: '0.9em' }}>기타메모</span>
                      <p className="text-gray-800 mt-1">{memo.etcMemo}</p>
                    </div>
                  )}

                  {!memo?.mainDisease && !memo?.doctorMemo && !memo?.nurseMemo && !memo?.etcMemo && (
                    <p className="text-gray-400 text-center py-4">저장된 메모가 없습니다</p>
                  )}
                </div>
              </section>

              {/* 섹션 2: 진료내역 (날짜별 DetailComment) */}
              <section className="bg-white rounded-xl shadow p-4">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontSize: '1.1em' }}>
                  <span>📝</span> 진료내역
                </h3>
                <div className="space-y-3">
                  {detailComments.length > 0 ? (
                    detailComments.slice(0, 10).map((dc, idx) => {
                      // 날짜에 요일 추가
                      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                      const dateObj = new Date(dc.date);
                      const dayOfWeek = dayNames[dateObj.getDay()];
                      const dateWithDay = `${dc.date}(${dayOfWeek})`;

                      // Comment1에서 날짜 패턴 제거 (예: [2025-12-16(화)] )
                      const cleanComment1 = dc.comment1
                        ? dc.comment1.replace(/^\[\d{4}-\d{2}-\d{2}\([월화수목금토일]\)\]\s*/g, '').trim()
                        : '';

                      const isExpanded = expandedComments[idx];
                      const hasComment2 = dc.comment2 && dc.comment2.trim().length > 0;

                      return (
                        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800">{dateWithDay}</span>
                              {hasComment2 && (
                                <button
                                  onClick={() => toggleComment2(idx)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    isExpanded
                                      ? 'bg-teal-500 text-white'
                                      : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                  }`}
                                >
                                  치료 {isExpanded ? '▲' : '▼'}
                                </button>
                              )}
                            </div>
                            {dc.doctor && (
                              <span className="text-blue-600 font-medium">{dc.doctor}</span>
                            )}
                          </div>
                          <div className="p-4">
                            {cleanComment1 ? (
                              <p className="text-gray-700 whitespace-pre-wrap">{cleanComment1}</p>
                            ) : (
                              <p className="text-gray-400">기록 없음</p>
                            )}
                          </div>
                          {/* 진료메모2 아코디언 */}
                          {hasComment2 && (
                            <div
                              className="overflow-hidden transition-all duration-300 ease-in-out"
                              style={{
                                maxHeight: isExpanded ? '500px' : '0',
                                opacity: isExpanded ? 1 : 0,
                              }}
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-teal-50">
                                <span className="font-bold text-teal-600" style={{ fontSize: '0.9em' }}>치료내용</span>
                                <p className="text-gray-700 whitespace-pre-wrap mt-1">{dc.comment2}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-400 text-center py-4">진료내역이 없습니다</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="border-t-2 px-6 py-4 bg-white">
          <button
            onClick={onClose}
            className="w-full py-4 bg-gray-200 text-gray-700 text-xl font-bold rounded-xl hover:bg-gray-300 transition-colors"
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

// 폰트 크기 설정
const FONT_SIZES = [
  { label: '작게', value: 14 },
  { label: '보통', value: 16 },
  { label: '크게', value: 18 },
  { label: '매우 크게', value: 20 },
];

const DoctorView: React.FC<DoctorViewProps> = ({ doctor, onBack }) => {
  const { theme, isDark } = useTheme();
  const [status, setStatus] = useState<DoctorStatus | null>(null);
  const [queue, setQueue] = useState<ActingQueueItem[]>([]);
  const [currentActing, setCurrentActing] = useState<ActingQueueItem | null>(null);
  const [myPatientRooms, setMyPatientRooms] = useState<TreatmentRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 녹음 관련
  const audioRecorder = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // 폰트 크기 상태 (localStorage에서 복원)
  const [fontSizeIndex, setFontSizeIndex] = useState(() => {
    const saved = localStorage.getItem('doctorPadFontSize');
    return saved ? parseInt(saved, 10) : 1; // 기본값: 보통(16px)
  });

  const fontSize = FONT_SIZES[fontSizeIndex].value;

  const handleFontSizeChange = (delta: number) => {
    setFontSizeIndex(prev => {
      const next = Math.max(0, Math.min(FONT_SIZES.length - 1, prev + delta));
      localStorage.setItem('doctorPadFontSize', next.toString());
      return next;
    });
  };

  // 환자 차트 모달 상태
  const [selectedActing, setSelectedActing] = useState<ActingQueueItem | null>(null);
  const [patientMemo, setPatientMemo] = useState<PatientMemo | null>(null);
  const [patientTreatments, setPatientTreatments] = useState<TreatmentHistory[]>([]);
  const [patientDetailComments, setPatientDetailComments] = useState<DetailComment[]>([]);
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

      const inProgress = doctorQueue.find(q => q.status === 'acting');
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

  // SSE 실시간 구독 (폴링 대체)
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_SUBSCRIPTION_MS = 500;
  const FALLBACK_POLLING_INTERVAL = 5000;

  const handleSSEMessage = useCallback((message: SSEMessage) => {
    // daily_acting_records, treatment_rooms, doctor_status 변경 감지
    if (message.table === 'daily_acting_records' || message.table === 'treatment_rooms' || message.table === 'doctor_status') {
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) return;
      console.log('[SSE] DoctorPad data changed:', message.table);
      loadData();
    }
  }, [loadData]);

  const { isConnected: sseConnected } = useSSE({
    enabled: true,
    onMessage: handleSSEMessage,
  });

  // SSE 실패 시 폴백 폴링
  useEffect(() => {
    if (sseConnected) return;
    console.log('[Polling] SSE not connected, fallback polling');
    const intervalId = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate >= IGNORE_SUBSCRIPTION_MS) {
        loadData();
      }
    }, FALLBACK_POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [sseConnected, loadData]);

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
    setPatientDetailComments([]);
    setPatientReceipts([]);
    setPatientDefaultTreatments(null);
    setPatientDailyRecord(null);

    const today = getCurrentDate();

    try {
      // 로컬 PostgreSQL patient_id -> MSSQL Customer_PK 변환
      const mssqlPatientId = await getMssqlPatientId(acting.patientId);
      const apiPatientId = mssqlPatientId || acting.patientId;

      const [memo, treatments, detailComments, defaultTreatments, dailyRecord] = await Promise.all([
        actingApi.fetchPatientMemo(apiPatientId),
        actingApi.fetchPatientTreatments(apiPatientId, 3),
        fetchPatientDetailComments(apiPatientId, 10),
        fetchPatientDefaultTreatments(acting.patientId),  // 로컬 ID 사용 (PostgreSQL)
        fetchDailyTreatmentRecord(acting.patientId, today),  // 로컬 ID 사용 (PostgreSQL)
      ]);

      setPatientMemo(memo);
      setPatientTreatments(treatments);
      setPatientDetailComments(detailComments);
      setPatientDefaultTreatments(defaultTreatments);
      setPatientDailyRecord(dailyRecord);

      // 수납내역 조회 (차트번호가 있는 경우)
      if (acting.chartNo) {
        try {
          const { fetchPatientReceiptHistory } = await import('@modules/manage/lib/api');
          const response = await fetchPatientReceiptHistory({ chartNo: acting.chartNo, limit: 3 });
          setPatientReceipts(response.receipts);
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
    setPatientDetailComments([]);
    setPatientReceipts([]);
    setPatientDefaultTreatments(null);
    setPatientDailyRecord(null);
  };

  const handleStartActing = async () => {
    if (!selectedActing) return;

    try {
      await actingApi.startActing(selectedActing.id, doctor.id, doctor.fullName);

      // 약상담인 경우에만 녹음 시작
      const isYakConsult = selectedActing.actingType.includes('약');
      if (isYakConsult) {
        const started = await audioRecorder.startRecording();
        if (!started) {
          console.warn('녹음 시작 실패:', audioRecorder.error);
          // 녹음 실패해도 진료는 계속 진행
        }
      }

      // 모달을 닫지 않고 데이터만 새로고침 (모달에서 타이머 + 치료항목 표시)
      await loadData();
    } catch (error) {
      console.error('진료 시작 오류:', error);
      alert('진료 시작 중 오류가 발생했습니다.');
    }
  };

  const handleCompleteActing = async (treatmentItems?: TreatmentItemSelection) => {
    const actingToComplete = selectedActing || currentActing;
    if (!actingToComplete) return;

    try {
      // 1. 녹음 중지 및 변환 (비동기로 처리)
      let audioBlob: Blob | null = null;
      if (audioRecorder.isRecording) {
        audioBlob = await audioRecorder.stopRecording();
      }

      // 2. 액팅 완료 처리
      await actingApi.completeActing(actingToComplete.id, doctor.id, doctor.fullName);

      // 3. 치료 항목 저장 (선택된 항목이 있는 경우)
      if (treatmentItems && Object.keys(treatmentItems).length > 0) {
        const selectedItems: TreatmentItemSelection = Object.entries(treatmentItems)
          .filter(([_, value]) => value > 0)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as TreatmentItemSelection);

        if (Object.keys(selectedItems).length > 0) {
          const now = new Date().toISOString();
          const today = now.split('T')[0];

          await saveActingTreatmentDetails({
            patientId: actingToComplete.patientId,
            doctorId: doctor.id,
            actingType: actingToComplete.actingType,
            treatmentItems: selectedItems,
            workDate: today,
            startedAt: actingToComplete.startedAt || now,
            completedAt: now,
            durationSec: elapsedTime,
          });

          // 4. 잔디 푸시 (선택된 항목이 있을 때만)
          const itemsList = Object.entries(selectedItems)
            .map(([name, value]) => value > 1 ? `${name}(${value})` : name)
            .join(', ');

          await sendJandiWebhook({
            title: `${actingToComplete.actingType} 완료`,
            description: `환자: ${actingToComplete.patientName}\n담당: ${doctor.fullName}\n치료: ${itemsList}\n시간: ${formatTime(elapsedTime)}`,
            color: '#07C160',
          });
        }
      }

      // 5. 녹음 파일이 있으면 백그라운드에서 녹취록 변환
      if (audioBlob && audioBlob.size > 0) {
        setIsTranscribing(true);
        // 약상담인 경우에만 오디오 파일 저장
        const isYakConsult = actingToComplete.actingType.includes('약');
        // 백그라운드에서 처리 (UI 블로킹 없이)
        processRecording(audioBlob, {
          actingId: actingToComplete.id,
          patientId: actingToComplete.patientId,
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          actingType: actingToComplete.actingType,
          saveAudio: isYakConsult, // 약상담만 오디오 파일 저장
        }).then(result => {
          setIsTranscribing(false);
          if (result.success) {
            setLastTranscript(result.transcript);
            // 5초 후 자동으로 알림 숨기기
            setTimeout(() => setLastTranscript(null), 5000);
            console.log('녹취록 저장 완료:', result.transcript.substring(0, 100) + '...');
          } else {
            console.error('녹취록 변환 실패:', result.error);
          }
        }).catch(err => {
          setIsTranscribing(false);
          console.error('녹취록 처리 오류:', err);
        });
      }

      // 6. 자침/침 완료 시 유침 자동 시작은 actingApi.completeActing 내부에서 처리됨

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

  // 테마별 스타일
  const themeStyles = {
    container: isDark ? 'bg-gray-900' : 'bg-gray-100',
    header: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
    headerText: isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900',
    button: isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    sidebar: isDark ? 'bg-gray-850 border-gray-700' : 'bg-gray-50 border-gray-200',
    card: isDark ? 'bg-gray-800' : 'bg-white shadow-sm',
    cardText: isDark ? 'text-gray-400' : 'text-gray-600',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
  };

  return (
    <div className={`min-h-screen ${themeStyles.container} flex flex-col`} style={{ fontSize: `${fontSize}px` }}>
      {/* 헤더 */}
      <header className={`${themeStyles.header} border-b px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`${themeStyles.headerText} text-2xl p-2`}>←</button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: doctor.color }}>{doctor.name}</h1>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 테마 토글 */}
          <ThemeToggle />
          {/* 폰트 크기 조정 버튼 */}
          <button
            onClick={() => handleFontSizeChange(-1)}
            disabled={fontSizeIndex === 0}
            className={`w-8 h-8 rounded-lg ${themeStyles.button} font-bold disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            A-
          </button>
          <button
            onClick={() => handleFontSizeChange(1)}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            className={`w-8 h-8 rounded-lg ${themeStyles.button} font-bold disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            A+
          </button>
          <button onClick={loadData} className={`${themeStyles.headerText} text-xl p-2 ml-1`}>↻</button>
        </div>
      </header>

      {/* 녹취 변환 중 알림 바 */}
      {isTranscribing && (
        <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-center gap-3 animate-pulse">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-bold">녹취록 변환 중...</span>
          <span className="text-purple-200 text-sm">(Whisper → 텍스트 → SOAP 분석)</span>
        </div>
      )}

      {/* 녹취 변환 완료 알림 */}
      {lastTranscript && !isTranscribing && (
        <div
          className="bg-green-600 text-white px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-green-700"
          onClick={() => setLastTranscript(null)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✓</span>
            <div>
              <span className="font-bold">녹취록 저장 완료</span>
              <p className="text-green-200 text-sm truncate max-w-md">
                {lastTranscript.length > 50 ? lastTranscript.substring(0, 50) + '...' : lastTranscript}
              </p>
            </div>
          </div>
          <span className="text-green-200 text-sm">클릭하여 닫기</span>
        </div>
      )}

      {/* 메인 콘텐츠 - 2컬럼 레이아웃 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 좌측 컬럼: 오늘 예약 현황 (전체 높이) */}
        <aside className={`w-72 flex-shrink-0 ${themeStyles.sidebar} border-r p-3 overflow-hidden`}>
          <TodaySchedule
            doctorId={doctor.id}
            doctorName={doctor.fullName}
            doctorColor={doctor.color}
            onPatientClick={(reservation) => {
              // 예약 환자 클릭 시 처리 (추후 구현)
              console.log('Reservation clicked:', reservation);
            }}
          />
        </aside>

        {/* 우측 컬럼: 대시보드 + 기존 기능 + 채팅(하단) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 상단 영역: 대시보드 + 기존 기능 (스크롤 가능) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* 대시보드 */}
            <DoctorDashboard doctorId={doctor.id} doctorName={doctor.name} />

            {/* 내 액팅 대기 */}
            <section className={`${themeStyles.card} rounded-lg p-3`}>
              <h2 className={`text-sm font-medium ${themeStyles.cardText} mb-2 flex items-center gap-2`}>
                <span>📋</span> 내 액팅 대기 ({queue.length})
              </h2>
              {queue.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {queue.map((acting) => (
                    <button
                      key={acting.id}
                      onClick={() => handleSelectPatient(acting)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg ${isDark ? 'bg-blue-900/30 border-blue-500/50 hover:bg-blue-900/50' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'} border hover:border-blue-400 flex flex-col items-center justify-center transition-colors`}
                    >
                      <span className={`font-bold ${themeStyles.text} truncate w-full px-1 text-center text-sm`}>
                        {acting.patientName}
                      </span>
                      <span className="text-[10px] text-blue-500 mt-1">{acting.actingType}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={`text-center ${themeStyles.textMuted} py-3 text-sm`}>대기중인 액팅이 없습니다</p>
              )}
            </section>

            {/* 내 환자 상태 (축소형) */}
            <CompactPatientStatus
              rooms={myPatientRooms}
              doctorName={doctor.name}
              onPatientClick={(patientId, roomId) => {
                console.log('Patient clicked:', patientId, roomId);
              }}
            />

            {/* 진행 중인 액팅 */}
            <section className={`${themeStyles.card} rounded-lg p-3`}>
              <h2 className={`text-sm font-medium ${themeStyles.cardText} mb-2 flex items-center gap-2`}>
                <span>⚡</span> 진행 중인 액팅
              </h2>
              {currentActing ? (
                <div
                  onClick={handleCurrentActingClick}
                  className={`${isDark ? 'bg-green-900/30 border-green-500/50 hover:bg-green-900/50' : 'bg-green-50 border-green-300 hover:bg-green-100'} border rounded-lg p-3 cursor-pointer transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                      {/* 녹음 중 표시 */}
                      {audioRecorder.isRecording && (
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" title="녹음 중"></div>
                      )}
                      <div>
                        <h3 className={`font-bold text-lg ${themeStyles.text}`}>{currentActing.patientName}</h3>
                        <p className={`text-xs ${themeStyles.cardText}`}>
                          {currentActing.actingType}
                          {audioRecorder.isRecording && <span className="ml-2 text-red-500">● REC</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-mono font-bold ${elapsedTime > 180 ? 'text-red-500' : themeStyles.text}`}>
                        {formatTime(elapsedTime)}
                      </span>
                      <p className={`text-[10px] ${themeStyles.textMuted}`}>경과</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCompleteActing(); }}
                    className="w-full mt-3 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    종료
                  </button>
                </div>
              ) : (
                <p className={`text-center ${themeStyles.textMuted} py-3 text-sm`}>진행중인 액팅이 없습니다</p>
              )}
            </section>
          </div>

          {/* 하단 영역: 원내 채팅 (고정) */}
          <div className={`flex-shrink-0 p-3 border-t ${themeStyles.border}`}>
            <QuickChat
              userId={doctor.id}
              userName={doctor.fullName}
              userRole="doctor"
              maxMessages={3}
            />
          </div>
        </div>
      </main>

      {/* 환자 차트 모달 */}
      {selectedActing && (
        <PatientChartModal
          acting={selectedActing}
          doctorId={doctor.id}
          doctorName={doctor.fullName}
          memo={patientMemo}
          treatments={patientTreatments}
          detailComments={patientDetailComments}
          receipts={patientReceipts}
          defaultTreatments={patientDefaultTreatments}
          dailyRecord={patientDailyRecord}
          loading={loadingPatientInfo}
          isActingInProgress={currentActing?.id === selectedActing.id}
          elapsedTime={currentActing?.id === selectedActing.id ? elapsedTime : 0}
          startedAt={currentActing?.startedAt || null}
          fontSize={fontSize}
          isRecording={audioRecorder.isRecording}
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

// 메인 앱 내용
function DoctorPadContent({ user }: DoctorPadAppProps) {
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

// ThemeProvider로 감싼 메인 앱
function DoctorPadApp({ user }: DoctorPadAppProps) {
  return (
    <ThemeProvider>
      <DoctorPadContent user={user} />
    </ThemeProvider>
  );
}

export default DoctorPadApp;
