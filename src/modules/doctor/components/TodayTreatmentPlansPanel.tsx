/**
 * TodayTreatmentPlansPanel
 * 오늘 생성된 진료계획 목록 패널
 */

import { useState, useEffect, useCallback } from 'react';
import { query } from '@shared/lib/postgres';

// MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface TreatmentPlanWithPatient {
  id: number;
  patient_id: number;
  patient_name?: string;
  chart_number?: string;
  disease_name: string | null;
  visit_frequency: string;
  planned_duration_weeks: number | null;
  status: string;
  created_at: string;
  has_initial_chart: boolean;
}

interface Props {
  onPatientClick?: (patientId: number, chartNumber: string) => void;
}

const TodayTreatmentPlansPanel: React.FC<Props> = ({ onPatientClick }) => {
  const [plans, setPlans] = useState<TreatmentPlanWithPatient[]>([]);
  const [loading, setLoading] = useState(true);

  // 환자 정보 조회 (MSSQL)
  const fetchPatientInfo = async (patientId: number): Promise<{ name: string; chart_no: string } | null> => {
    try {
      const response = await fetch(`${MSSQL_API_URL}/api/patients/${patientId}`);
      if (response.ok) {
        const data = await response.json();
        return { name: data.name, chart_no: data.chart_no };
      }
    } catch (error) {
      console.error('환자 정보 조회 실패:', error);
    }
    return null;
  };

  // 오늘 진료계획 로드
  const loadTodayPlans = useCallback(async () => {
    try {
      setLoading(true);

      // 오늘 날짜의 시작과 끝
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const plansData = await query<{
        id: number;
        patient_id: number;
        disease_name: string | null;
        visit_frequency: string;
        planned_duration_weeks: number | null;
        initial_chart_id: number | null;
        status: string;
        created_at: string;
      }>(`
        SELECT id, patient_id, disease_name, visit_frequency, planned_duration_weeks,
               initial_chart_id, status, created_at
        FROM treatment_plans
        WHERE created_at >= '${startOfDay}' AND created_at < '${endOfDay}'
        ORDER BY created_at DESC
      `);

      // 환자 정보 조회하여 병합
      const plansWithPatients: TreatmentPlanWithPatient[] = await Promise.all(
        (plansData || []).map(async (plan) => {
          const patientInfo = await fetchPatientInfo(plan.patient_id);
          return {
            ...plan,
            patient_name: patientInfo?.name || `환자 ${plan.patient_id}`,
            chart_number: patientInfo?.chart_no || '',
            has_initial_chart: !!plan.initial_chart_id,
          };
        })
      );

      setPlans(plansWithPatients);
    } catch (error) {
      console.error('오늘 진료계획 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayPlans();
    // 1분마다 자동 새로고침
    const interval = setInterval(loadTodayPlans, 60000);
    return () => clearInterval(interval);
  }, [loadTodayPlans]);

  const handleClick = (plan: TreatmentPlanWithPatient) => {
    if (onPatientClick && plan.chart_number) {
      onPatientClick(plan.patient_id, plan.chart_number);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border flex flex-col">
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-clipboard-list text-amber-500"></i>
          <h2 className="font-semibold text-gray-800">오늘의 진료계획</h2>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
            {plans.length}건
          </span>
        </div>
        <button
          onClick={loadTodayPlans}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="새로고침"
        >
          <i className="fas fa-sync-alt text-sm"></i>
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="border-4 border-gray-200 border-t-amber-500 rounded-full w-8 h-8 animate-spin"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <i className="fas fa-clipboard text-4xl mb-2"></i>
            <p className="text-sm">오늘 생성된 진료계획이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => handleClick(plan)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  plan.has_initial_chart
                    ? 'bg-green-50 border-green-200 hover:border-green-400'
                    : 'bg-amber-50 border-amber-200 hover:border-amber-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 truncate">
                        {plan.patient_name}
                      </span>
                      {plan.chart_number && (
                        <span className="text-xs text-gray-500">
                          #{plan.chart_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.disease_name ? (
                        <span className="text-gray-700">{plan.disease_name}</span>
                      ) : (
                        <span className="text-gray-400">(질환명 미입력)</span>
                      )}
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{plan.visit_frequency}</span>
                      {plan.planned_duration_weeks && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{plan.planned_duration_weeks}주</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span className="text-xs text-gray-400">{formatTime(plan.created_at)}</span>
                    {plan.has_initial_chart ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        차트작성
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        대기중
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayTreatmentPlansPanel;
