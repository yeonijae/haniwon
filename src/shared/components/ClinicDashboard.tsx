/**
 * 통합 대시보드 컴포넌트
 * 오늘의 진료 현황, 할일, 환자관리를 한눈에 보여줌
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as treatmentRecordApi from '@shared/api/treatmentRecordApi';
import * as taskApi from '@shared/api/taskApi';
import * as patientCareApi from '@shared/api/patientCareApi';
import type { TreatmentRecord } from '@shared/types/treatmentRecord';
import { RECORD_STATUS_LABELS } from '@shared/types/treatmentRecord';

interface DashboardStats {
  // 진료 현황
  totalPatients: number;
  inProgress: number;
  completed: number;
  avgWaitTime: number;

  // 할일
  pendingTasks: number;
  urgentTasks: number;
  completedTasksToday: number;

  // 환자관리
  pendingCare: number;
  overdueCare: number;
  completedCareToday: number;
}

interface ClinicDashboardProps {
  onNavigate?: (section: 'tasks' | 'care' | 'records') => void;
}

const ClinicDashboard: React.FC<ClinicDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<TreatmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // 병렬로 데이터 로드
      const [recordsData, taskStats, careStats] = await Promise.all([
        treatmentRecordApi.fetchTodayTreatmentRecords(),
        taskApi.fetchTaskStats(),
        patientCareApi.fetchPatientCareStats(),
      ]);

      // 진료 통계 계산
      const inProgress = recordsData.filter(r => r.status === 'in_progress').length;
      const completed = recordsData.filter(r => r.status === 'completed').length;

      // 평균 대기 시간 계산 (완료된 진료 중)
      const completedRecords = recordsData.filter(r => r.status === 'completed' && r.total_wait_time);
      const avgWaitTime = completedRecords.length > 0
        ? Math.round(completedRecords.reduce((sum, r) => sum + (r.total_wait_time || 0), 0) / completedRecords.length)
        : 0;

      setStats({
        totalPatients: recordsData.length,
        inProgress,
        completed,
        avgWaitTime,
        pendingTasks: taskStats.pending + taskStats.in_progress,
        urgentTasks: taskStats.overdue,
        completedTasksToday: taskStats.completed_today,
        pendingCare: careStats.pending + careStats.scheduled,
        overdueCare: careStats.overdue,
        completedCareToday: careStats.completed_today,
      });

      // 최근 진료내역 (진행 중 우선)
      const sortedRecords = [...recordsData].sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
        return new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime();
      });
      setRecentRecords(sortedRecords.slice(0, 5));

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // 1분마다 자동 새로고침
    const dataInterval = setInterval(loadDashboardData, 60000);

    // 시간 업데이트 (1초마다)
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, [loadDashboardData]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">오늘의 진료 현황</h1>
          <p className="text-gray-500">{formatDate(currentTime)}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{formatTime(currentTime)}</div>
          <button
            onClick={loadDashboardData}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 진료 현황 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">오늘 내원</div>
          <div className="text-3xl font-bold text-gray-900">{stats?.totalPatients || 0}</div>
          <div className="text-xs text-gray-400 mt-1">명</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">진료 중</div>
          <div className="text-3xl font-bold text-green-600">{stats?.inProgress || 0}</div>
          <div className="text-xs text-gray-400 mt-1">명</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">진료 완료</div>
          <div className="text-3xl font-bold text-blue-600">{stats?.completed || 0}</div>
          <div className="text-xs text-gray-400 mt-1">명</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">평균 대기시간</div>
          <div className="text-3xl font-bold text-orange-600">{stats?.avgWaitTime || 0}</div>
          <div className="text-xs text-gray-400 mt-1">분</div>
        </div>
      </div>

      {/* 할일 & 환자관리 요약 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 할일 요약 */}
        <div
          className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate?.('tasks')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">오늘의 할일</h3>
            <span className="text-sm text-blue-600">전체 보기 →</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats?.pendingTasks || 0}</div>
              <div className="text-xs text-gray-500">대기</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats?.urgentTasks || 0}</div>
              <div className="text-xs text-gray-500">기한초과</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats?.completedTasksToday || 0}</div>
              <div className="text-xs text-gray-500">완료</div>
            </div>
          </div>
        </div>

        {/* 환자관리 요약 */}
        <div
          className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate?.('care')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">환자관리</h3>
            <span className="text-sm text-blue-600">전체 보기 →</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">{stats?.pendingCare || 0}</div>
              <div className="text-xs text-gray-500">대기</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats?.overdueCare || 0}</div>
              <div className="text-xs text-gray-500">기한초과</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats?.completedCareToday || 0}</div>
              <div className="text-xs text-gray-500">완료</div>
            </div>
          </div>
        </div>
      </div>

      {/* 실시간 진료 현황 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-medium text-gray-900">실시간 환자 현황</h3>
          <button
            onClick={() => onNavigate?.('records')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            전체 보기
          </button>
        </div>
        <div className="divide-y">
          {recentRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">🏥</div>
              <div>오늘 내원한 환자가 없습니다</div>
            </div>
          ) : (
            recentRecords.map(record => (
              <div key={record.id} className="px-4 py-3 flex items-center gap-4">
                {/* 상태 배지 */}
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(record.status)}`}>
                  {RECORD_STATUS_LABELS[record.status]}
                </span>

                {/* 환자 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {record.patient_name}
                    {record.patient_chart_number && (
                      <span className="text-sm text-gray-400 ml-2">
                        ({record.patient_chart_number})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {record.services.length > 0 && (
                      <span>{record.services.join(', ')}</span>
                    )}
                  </div>
                </div>

                {/* 시간 정보 */}
                <div className="text-right text-sm">
                  <div className="text-gray-600">
                    체크인: {new Date(record.check_in_time).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {record.total_wait_time !== undefined && record.total_wait_time > 0 && (
                    <div className="text-xs text-orange-500">
                      대기: {record.total_wait_time}분
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 알림 영역 */}
      {(stats?.urgentTasks || 0) > 0 || (stats?.overdueCare || 0) > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">주의가 필요한 항목이 있습니다</span>
          </div>
          <div className="mt-2 text-sm text-red-600 space-y-1">
            {(stats?.urgentTasks || 0) > 0 && (
              <div>• 기한이 지난 할일 {stats?.urgentTasks}개</div>
            )}
            {(stats?.overdueCare || 0) > 0 && (
              <div>• 기한이 지난 환자관리 {stats?.overdueCare}개</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ClinicDashboard;
