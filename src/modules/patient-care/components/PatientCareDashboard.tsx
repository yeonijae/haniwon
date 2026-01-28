/**
 * 환자관리 대시보드
 * 오늘 할일을 강조하여 보여주는 대시보드
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../doctor/lib/supabaseClient';

interface DashboardStats {
  // 배송콜
  deliveryCallPending: number;
  deliveryCallCompleted: number;

  // 내원콜
  visitCallPending: number;
  visitCallCompleted: number;

  // 애프터콜
  afterCallPending: number;
  afterCallCompleted: number;

  // 복약관리
  activePrescriptions: number;
}

interface TodayTask {
  id: number;
  type: 'delivery' | 'visit' | 'after';
  patient_name: string;
  chart_number?: string;
  phone?: string;
  formula?: string;
  scheduled_date: string;
  is_overdue: boolean;
}

interface PatientCareDashboardProps {
  onNavigate: (view: 'dashboard' | 'medication' | 'delivery' | 'visit' | 'aftercall') => void;
}

const PatientCareDashboard: React.FC<PatientCareDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 발급 완료되었고 복약 완료되지 않은 처방 조회
      const { data: prescriptions, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('status', 'issued')
        .eq('medication_completed', false)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      let deliveryPending = 0;
      let deliveryCompleted = 0;
      let visitPending = 0;
      let visitCompleted = 0;
      const tasks: TodayTask[] = [];

      for (const p of prescriptions || []) {
        const deliveryMethod = p.delivery_method || '직접수령';
        const issuedDate = new Date(p.issued_at);

        // 복약 시작일 계산
        let startDate = new Date(issuedDate);
        if (deliveryMethod === '퀵') startDate.setDate(startDate.getDate() + 1);
        else if (deliveryMethod === '택배') startDate.setDate(startDate.getDate() + 3);

        // 배송콜 예정일 (복약 시작일 +2일)
        const deliveryCallDate = new Date(startDate);
        deliveryCallDate.setDate(deliveryCallDate.getDate() + 2);
        deliveryCallDate.setHours(0, 0, 0, 0);

        // 내원콜 예정일 (복약 종료 -3일)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (p.days || 15));
        const visitCallDate = p.visit_call_scheduled_date
          ? new Date(p.visit_call_scheduled_date)
          : new Date(endDate);
        if (!p.visit_call_scheduled_date) {
          visitCallDate.setDate(visitCallDate.getDate() - 3);
        }
        visitCallDate.setHours(0, 0, 0, 0);

        // 환자 정보
        let phone = '';
        if (p.patient_id) {
          const { data: patientData } = await supabase
            .from('patients')
            .select('phone')
            .eq('id', p.patient_id)
            .single();
          phone = patientData?.phone || '';
        }

        // 배송콜 통계 및 할일
        if (deliveryCallDate <= today) {
          if (p.delivery_call_date) {
            deliveryCompleted++;
          } else {
            deliveryPending++;
            tasks.push({
              id: p.id,
              type: 'delivery',
              patient_name: p.patient_name || '이름없음',
              chart_number: p.chart_number,
              phone,
              formula: p.formula,
              scheduled_date: deliveryCallDate.toISOString(),
              is_overdue: deliveryCallDate < today,
            });
          }
        }

        // 내원콜 통계 및 할일
        if (visitCallDate <= today) {
          if (p.visit_call_date) {
            visitCompleted++;
          } else {
            visitPending++;
            tasks.push({
              id: p.id,
              type: 'visit',
              patient_name: p.patient_name || '이름없음',
              chart_number: p.chart_number,
              phone,
              formula: p.formula,
              scheduled_date: visitCallDate.toISOString(),
              is_overdue: visitCallDate < today,
            });
          }
        }
      }

      // 애프터콜 (복용 완료 환자) 통계
      const { count: afterPending } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'issued')
        .eq('medication_completed', true);

      setStats({
        deliveryCallPending: deliveryPending,
        deliveryCallCompleted: deliveryCompleted,
        visitCallPending: visitPending,
        visitCallCompleted: visitCompleted,
        afterCallPending: afterPending || 0,
        afterCallCompleted: 0,
        activePrescriptions: prescriptions?.length || 0,
      });

      // 할일 정렬 (기한초과 우선, 그 다음 날짜순)
      tasks.sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });

      setTodayTasks(tasks.slice(0, 10));

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000);
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [loadDashboardData]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery': return '배송콜';
      case 'visit': return '내원콜';
      case 'after': return '애프터콜';
      default: return type;
    }
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'delivery': return 'bg-blue-100 text-blue-700';
      case 'visit': return 'bg-purple-100 text-purple-700';
      case 'after': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalPending = (stats?.deliveryCallPending || 0) + (stats?.visitCallPending || 0);
  const overdueCount = todayTasks.filter(t => t.is_overdue).length;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full overflow-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">환자관리 대시보드</h1>
          <p className="text-gray-500">{formatDate(currentTime)}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{formatTime(currentTime)}</div>
          <button
            onClick={loadDashboardData}
            className="text-sm text-orange-600 hover:text-orange-800"
          >
            <i className="fas fa-sync-alt mr-1"></i>새로고침
          </button>
        </div>
      </div>

      {/* 오늘의 할일 알림 (강조) */}
      {totalPending > 0 && (
        <div className={`rounded-xl p-6 ${overdueCount > 0 ? 'bg-red-50 border-2 border-red-300' : 'bg-orange-50 border-2 border-orange-300'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${overdueCount > 0 ? 'bg-red-500' : 'bg-orange-500'}`}>
                <i className="fas fa-bell text-white text-xl"></i>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-orange-700'}`}>
                  오늘 처리할 콜이 {totalPending}건 있습니다
                </h2>
                {overdueCount > 0 && (
                  <p className="text-red-600 text-sm">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    {overdueCount}건이 기한을 초과했습니다
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 오늘의 할일 목록 */}
          <div className="space-y-2">
            {todayTasks.map(task => (
              <div
                key={`${task.type}-${task.id}`}
                onClick={() => onNavigate(task.type === 'delivery' ? 'delivery' : task.type === 'visit' ? 'visit' : 'aftercall')}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  task.is_overdue
                    ? 'bg-red-100 hover:bg-red-200'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getTaskTypeColor(task.type)}`}>
                    {getTaskTypeLabel(task.type)}
                  </span>
                  <div>
                    <span className="font-medium">{task.patient_name}</span>
                    {task.chart_number && (
                      <span className="text-sm text-gray-400 ml-2">({task.chart_number})</span>
                    )}
                  </div>
                  {task.formula && (
                    <span className="text-sm text-gray-500 truncate max-w-[200px]">{task.formula}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {task.is_overdue && (
                    <span className="text-xs text-red-600 font-medium">기한초과</span>
                  )}
                  <i className="fas fa-chevron-right text-gray-400"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 배송콜 */}
        <div
          onClick={() => onNavigate('delivery')}
          className="bg-white rounded-lg shadow p-5 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">배송콜</div>
            <i className="fas fa-truck text-blue-500"></i>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-blue-600">{stats?.deliveryCallPending || 0}</div>
              <div className="text-xs text-gray-400">대기 중</div>
            </div>
            <div className="text-right">
              <div className="text-lg text-green-600">{stats?.deliveryCallCompleted || 0}</div>
              <div className="text-xs text-gray-400">완료</div>
            </div>
          </div>
        </div>

        {/* 내원콜 */}
        <div
          onClick={() => onNavigate('visit')}
          className="bg-white rounded-lg shadow p-5 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-purple-500"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">내원콜</div>
            <i className="fas fa-hospital text-purple-500"></i>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-600">{stats?.visitCallPending || 0}</div>
              <div className="text-xs text-gray-400">대기 중</div>
            </div>
            <div className="text-right">
              <div className="text-lg text-green-600">{stats?.visitCallCompleted || 0}</div>
              <div className="text-xs text-gray-400">완료</div>
            </div>
          </div>
        </div>

        {/* 애프터콜 */}
        <div
          onClick={() => onNavigate('aftercall')}
          className="bg-white rounded-lg shadow p-5 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">애프터콜</div>
            <i className="fas fa-user-check text-green-500"></i>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-green-600">{stats?.afterCallPending || 0}</div>
              <div className="text-xs text-gray-400">복용 완료 환자</div>
            </div>
          </div>
        </div>

        {/* 복약관리 */}
        <div
          onClick={() => onNavigate('medication')}
          className="bg-white rounded-lg shadow p-5 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-orange-500"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">복약관리</div>
            <i className="fas fa-pills text-orange-500"></i>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-orange-600">{stats?.activePrescriptions || 0}</div>
              <div className="text-xs text-gray-400">복약 진행 중</div>
            </div>
          </div>
        </div>
      </div>

      {/* 할일 없음 메시지 */}
      {totalPending === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-2xl"></i>
          </div>
          <h3 className="text-xl font-bold text-green-700 mb-2">오늘 처리할 콜이 없습니다</h3>
          <p className="text-green-600">모든 할일을 완료했습니다!</p>
        </div>
      )}

      {/* 빠른 안내 */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-medium text-gray-900 mb-4">콜 타입 안내</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-truck text-blue-600 text-sm"></i>
            </div>
            <div>
              <div className="font-medium text-gray-800">배송콜</div>
              <div className="text-gray-500">한약 복약 시작 2일 후<br />배송 및 복용 상태 확인</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-hospital text-purple-600 text-sm"></i>
            </div>
            <div>
              <div className="font-medium text-gray-800">내원콜</div>
              <div className="text-gray-500">복약 종료 3일 전<br />재진 예약 안내</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-user-check text-green-600 text-sm"></i>
            </div>
            <div>
              <div className="font-medium text-gray-800">애프터콜</div>
              <div className="text-gray-500">복용 완료 후<br />치료 효과 및 만족도 확인</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientCareDashboard;
