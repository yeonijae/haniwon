/**
 * 상담 패널
 * 현재 진행 중인 액팅 표시 (타이머 + 환자 정보)
 * Phase 1: 기본 구조만 구현 (녹음 기능은 Phase 2에서)
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentActing } from '../lib/dashboardApi';
import { completeActing } from '@modules/acting/api';
import { useSSE } from '@shared/hooks/useSSE';
import type { ActingQueueItem } from '@modules/acting/types';

interface Props {
  doctorId: number;
  doctorName: string;
  onPatientClick?: (patientId: number, chartNumber: string) => void;
  onComplete?: () => void;
}

export function ConsultationPanel({
  doctorId,
  doctorName,
  onPatientClick,
  onComplete,
}: Props) {
  const [currentActing, setCurrentActing] = useState<ActingQueueItem | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const loadCurrentActing = useCallback(async () => {
    try {
      const acting = await getCurrentActing(doctorId);
      setCurrentActing(acting);
      
      // 시작 시간이 있으면 경과 시간 계산
      if (acting?.startedAt) {
        const startTime = new Date(acting.startedAt).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));
      } else {
        setElapsedSeconds(0);
      }
    } catch (error) {
      console.error('현재 액팅 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // 초기 로드
  useEffect(() => {
    loadCurrentActing();
  }, [loadCurrentActing]);

  // 타이머 - 1초마다 업데이트
  useEffect(() => {
    if (!currentActing?.startedAt) return;

    const interval = setInterval(() => {
      const startTime = new Date(currentActing.startedAt!).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentActing?.startedAt]);

  // SSE 실시간 업데이트
  useSSE({
    enabled: true,
    onMessage: (message) => {
      // 액팅 관련 테이블 변경 시 갱신
      if (
        message.table === 'daily_acting_records' ||
        message.table === 'doctor_status'
      ) {
        loadCurrentActing();
      }
    },
  });

  // 시간 포맷팅 (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 완료 처리
  const handleComplete = async () => {
    if (!currentActing) return;

    try {
      setCompleting(true);
      await completeActing(currentActing.id, doctorId, doctorName);
      setCurrentActing(null);
      setElapsedSeconds(0);
      onComplete?.();
    } catch (error) {
      console.error('액팅 완료 처리 오류:', error);
    } finally {
      setCompleting(false);
    }
  };

  // 액팅 타입별 아이콘
  const getActingIcon = (type: string) => {
    switch (type) {
      case '약상담':
      case '초진상담':
        return '💊';
      case '자침':
      case '침':
        return '📍';
      case '부항':
        return '🔴';
      case '물치':
        return '💧';
      default:
        return '🩺';
    }
  };

  // 타이머 색상 (시간에 따라 변화)
  const getTimerColor = (seconds: number) => {
    if (seconds < 300) return 'text-green-600'; // 5분 미만
    if (seconds < 600) return 'text-blue-600';  // 10분 미만
    if (seconds < 900) return 'text-orange-500'; // 15분 미만
    return 'text-red-500'; // 15분 이상
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <span className="text-lg">🩺</span>
          <span className="font-semibold text-gray-800">진행중 상담</span>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-200 rounded" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🩺</span>
          <span className="font-semibold text-gray-800">진행중 상담</span>
          {currentActing && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 p-4">
        {!currentActing ? (
          // 진행 중인 상담 없음
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <span className="text-3xl opacity-50">🩺</span>
            </div>
            <p className="text-sm">진행 중인 상담이 없습니다</p>
            <p className="text-xs mt-1">대기열에서 환자를 선택하세요</p>
          </div>
        ) : (
          // 진행 중인 상담 표시
          <div className="flex flex-col h-full">
            {/* 타이머 */}
            <div className="text-center mb-4">
              <div className={`text-4xl font-mono font-bold ${getTimerColor(elapsedSeconds)}`}>
                {formatTime(elapsedSeconds)}
              </div>
              <p className="text-xs text-gray-400 mt-1">경과 시간</p>
            </div>

            {/* 환자 정보 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4">
                {/* 액팅 타입 아이콘 */}
                <div className="w-12 h-12 rounded-full bg-clinic-primary/10 flex items-center justify-center">
                  <span className="text-2xl">{getActingIcon(currentActing.actingType)}</span>
                </div>

                {/* 정보 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-clinic-primary"
                      onClick={() => onPatientClick?.(currentActing.patientId, currentActing.chartNo)}
                    >
                      {currentActing.patientName}
                    </span>
                    <span className="text-sm text-gray-400">
                      {currentActing.chartNo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm px-2 py-0.5 bg-clinic-primary text-white rounded">
                      {currentActing.actingType}
                    </span>
                    {currentActing.memo && (
                      <span className="text-xs text-gray-500 truncate">
                        {currentActing.memo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Phase 2 예정: 녹음 컨트롤 영역 */}
            <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-4 border-2 border-dashed border-gray-200">
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-2xl mb-2">🎙️</span>
                <p className="text-xs text-center">
                  녹음 기능은 Phase 2에서<br />구현 예정입니다
                </p>
              </div>
            </div>

            {/* 완료 버튼 */}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {completing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <span>✓</span>
                  상담 완료
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsultationPanel;
