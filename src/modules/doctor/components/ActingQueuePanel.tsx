/**
 * 액팅 대기열 패널
 * 선택된 원장의 오늘 액팅 대기 목록
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchDoctorQueue } from '@modules/acting/api';
import { useSSE } from '@shared/hooks/useSSE';
import type { ActingQueueItem } from '@modules/acting/types';

interface Props {
  doctorId: number;
  doctorName: string;
  onActingClick?: (acting: ActingQueueItem) => void;
  onStartActing?: (acting: ActingQueueItem) => void;
}

export function ActingQueuePanel({
  doctorId,
  doctorName,
  onActingClick,
  onStartActing,
}: Props) {
  const [queue, setQueue] = useState<ActingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadQueue = useCallback(async () => {
    try {
      const data = await fetchDoctorQueue(doctorId);
      setQueue(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('액팅 대기열 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // 초기 로드 및 폴링
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30 * 1000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [loadQueue]);

  // SSE 실시간 업데이트
  useSSE({
    enabled: true,
    onMessage: (message) => {
      // 액팅 관련 테이블 변경 시 갱신
      if (
        message.table === 'daily_acting_records' ||
        message.table === 'doctor_status'
      ) {
        loadQueue();
      }
    },
  });

  // 대기 중인 항목만 필터링
  const waitingItems = queue.filter(item => item.status === 'waiting');
  const actingItem = queue.find(item => item.status === 'acting');

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
        return '📋';
    }
  };

  // 상태 배지
  const getStatusBadge = (status: string) => {
    if (status === 'acting') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500 text-white animate-pulse">
          진행중
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
        대기
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-semibold text-gray-800">내 액팅 대기열</span>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
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
          <span className="text-lg">📋</span>
          <span className="font-semibold text-gray-800">내 액팅 대기열</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-clinic-primary text-white">
            {waitingItems.length}명
          </span>
        </div>
        <button
          onClick={loadQueue}
          className="text-gray-400 hover:text-gray-600 text-sm"
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {/* 현재 진행중인 액팅 표시 */}
      {actingItem && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-green-500 animate-pulse">●</span>
            <span className="text-sm font-medium text-green-700">
              진행중: {actingItem.patientName} ({actingItem.actingType})
            </span>
          </div>
        </div>
      )}

      {/* 대기 목록 */}
      <div className="flex-1 overflow-y-auto">
        {waitingItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            대기 중인 환자가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {waitingItems.map((item, index) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onActingClick?.(item)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 순번 */}
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      {index + 1}
                    </span>

                    {/* 액팅 타입 아이콘 */}
                    <span className="text-lg">{getActingIcon(item.actingType)}</span>

                    {/* 환자 정보 */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {item.patientName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.chartNo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{item.actingType}</span>
                        {item.memo && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[120px]">{item.memo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 시작 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartActing?.(item);
                    }}
                    className="px-3 py-1.5 text-xs bg-clinic-primary text-white rounded hover:bg-clinic-primary-dark transition-colors"
                  >
                    시작
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 푸터: 마지막 업데이트 시간 */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
        마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
}

export default ActingQueuePanel;
