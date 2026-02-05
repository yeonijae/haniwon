/**
 * TreatmentHistory
 * 진료내역 - 날짜별 진료 환자 목록
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { query } from '@shared/lib/postgres';
import type { Patient } from '../types';

// MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface DailyPatient extends Patient {
  has_chart: boolean;
  has_plan: boolean;
  plan_time?: string;
  chart_time?: string;
  disease_name?: string;
  visit_frequency?: string;
  planned_duration_weeks?: number;
  selected_programs?: { program_id: number; name: string }[];
}

// 진료계획 입력 완료 여부 판단
const isPlanComplete = (patient: DailyPatient): boolean => {
  return !!(
    patient.disease_name &&
    patient.planned_duration_weeks &&
    patient.selected_programs &&
    patient.selected_programs.length > 0
  );
};

const TreatmentHistory: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [patients, setPatients] = useState<DailyPatient[]>([]);
  const [loading, setLoading] = useState(true);

  // 통계
  const [stats, setStats] = useState({
    total: 0,
    planIncomplete: 0,  // 계획 미완료
    planComplete: 0,    // 계획 완료
    chartComplete: 0,   // 차트 완료
  });

  // MSSQL 환자 데이터 변환
  const convertMssqlPatient = (mssqlData: any): Patient => ({
    id: mssqlData.id,
    name: mssqlData.name,
    chart_number: mssqlData.chart_no || '',
    dob: mssqlData.birth || undefined,
    gender: mssqlData.sex === 'M' ? 'male' : mssqlData.sex === 'F' ? 'female' : undefined,
    phone: mssqlData.phone || undefined,
  });

  // 날짜별 진료 환자 로드
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);

      const startOfDay = `${selectedDate} 00:00:00`;
      const endOfDay = `${selectedDate} 23:59:59`;

      // 1. 해당 날짜의 진료계획 조회
      const plansData = await query<{
        patient_id: number;
        disease_name: string | null;
        visit_frequency: string;
        planned_duration_weeks: number | null;
        selected_programs: { program_id: number; name: string }[] | null;
        created_at: string;
      }>(`
        SELECT patient_id, disease_name, visit_frequency, planned_duration_weeks, selected_programs, created_at
        FROM treatment_plans
        WHERE created_at >= '${startOfDay}' AND created_at <= '${endOfDay}'
        ORDER BY created_at DESC
      `);

      // 2. 해당 날짜의 초진차트 조회
      const chartsData = await query<{
        patient_id: number;
        chart_date: string;
        created_at: string;
      }>(`
        SELECT patient_id, chart_date, created_at
        FROM initial_charts
        WHERE chart_date = '${selectedDate}' OR (created_at >= '${startOfDay}' AND created_at <= '${endOfDay}')
        ORDER BY created_at DESC
      `);

      // 3. 환자 ID별로 정보 수집
      const patientMap = new Map<number, {
        has_chart: boolean;
        has_plan: boolean;
        plan_time?: string;
        chart_time?: string;
        disease_name?: string;
        visit_frequency?: string;
        planned_duration_weeks?: number;
        selected_programs?: { program_id: number; name: string }[];
      }>();

      // 진료계획 데이터 처리
      (plansData || []).forEach(plan => {
        const existing = patientMap.get(plan.patient_id) || { has_chart: false, has_plan: false };
        existing.has_plan = true;
        existing.plan_time = plan.created_at;
        existing.disease_name = plan.disease_name || undefined;
        existing.visit_frequency = plan.visit_frequency;
        existing.planned_duration_weeks = plan.planned_duration_weeks || undefined;
        existing.selected_programs = plan.selected_programs || undefined;
        patientMap.set(plan.patient_id, existing);
      });

      // 초진차트 데이터 처리
      (chartsData || []).forEach(chart => {
        const existing = patientMap.get(chart.patient_id) || { has_chart: false, has_plan: false };
        existing.has_chart = true;
        existing.chart_time = chart.created_at;
        patientMap.set(chart.patient_id, existing);
      });

      if (patientMap.size === 0) {
        setPatients([]);
        setStats({ total: 0, planIncomplete: 0, planComplete: 0, chartComplete: 0 });
        return;
      }

      // 4. MSSQL에서 환자 정보 가져오기
      const patientsList: DailyPatient[] = [];
      for (const [patientId, info] of patientMap) {
        try {
          const response = await fetch(`${MSSQL_API_URL}/api/patients/${patientId}`);
          if (response.ok) {
            const mssqlData = await response.json();
            const patient = convertMssqlPatient(mssqlData);
            patientsList.push({
              ...patient,
              ...info,
            });
          }
        } catch (err) {
          console.error(`환자 ${patientId} 정보 조회 실패:`, err);
        }
      }

      // 시간순 정렬 (최신순)
      patientsList.sort((a, b) => {
        const timeA = a.plan_time || a.chart_time || '';
        const timeB = b.plan_time || b.chart_time || '';
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setPatients(patientsList);

      // 통계 계산
      const chartComplete = patientsList.filter(p => p.has_chart).length;
      const planComplete = patientsList.filter(p => p.has_plan && !p.has_chart && isPlanComplete(p)).length;
      const planIncomplete = patientsList.filter(p => p.has_plan && !p.has_chart && !isPlanComplete(p)).length;
      setStats({
        total: patientsList.length,
        planIncomplete,
        planComplete,
        chartComplete,
      });
    } catch (error) {
      console.error('진료내역 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // 날짜 이동 함수
  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // 오늘로 이동
  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // 요일 표시
  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  // 시간 포맷
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 오늘인지 확인
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">진료내역</h1>
          <button
            onClick={() => navigate('/doctor/patients')}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>환자 목록
          </button>
        </div>
      </div>

      {/* 날짜 선택 영역 - 한 줄 */}
      <div className="flex-shrink-0 bg-white border-b px-4 py-2">
        <div className="flex items-center justify-center gap-1">
          {/* 1주일 전 */}
          <button
            onClick={() => changeDate(-7)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="1주일 전"
          >
            <i className="fas fa-angle-double-left text-sm"></i>
          </button>

          {/* 1일 전 */}
          <button
            onClick={() => changeDate(-1)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="전날"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>

          {/* 날짜 선택 + 요일 */}
          <div className="flex items-center gap-1 mx-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 border rounded text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-clinic-primary"
            />
            <span className="text-sm font-medium text-gray-500">
              ({getDayOfWeek(selectedDate)})
            </span>
          </div>

          {/* 1일 후 */}
          <button
            onClick={() => changeDate(1)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="다음날"
          >
            <i className="fas fa-chevron-right text-sm"></i>
          </button>

          {/* 1주일 후 */}
          <button
            onClick={() => changeDate(7)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="1주일 후"
          >
            <i className="fas fa-angle-double-right text-sm"></i>
          </button>

          {/* 구분선 */}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>

          {/* 빠른 날짜 선택 */}
          {[-3, -2, -1, 0, 1, 2, 3].map(offset => {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            const dateStr = date.toISOString().split('T')[0];
            const isSelected = dateStr === selectedDate;
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

            return (
              <button
                key={offset}
                onClick={() => setSelectedDate(dateStr)}
                className={`px-2 py-1 rounded text-xs transition-colors min-w-[42px] ${
                  isSelected
                    ? 'bg-clinic-primary text-white'
                    : offset === 0
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div className="font-medium">{date.getDate()}</div>
                <div className="text-[10px] opacity-75">{dayOfWeek}</div>
              </button>
            );
          })}

          {/* 오늘 버튼 */}
          {!isToday && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <button
                onClick={goToToday}
                className="px-2 py-1 bg-clinic-primary text-white text-xs rounded hover:bg-clinic-primary/90 transition-colors"
              >
                오늘
              </button>
            </>
          )}
        </div>
      </div>

      {/* 통계 */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-100 border-b">
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">전체</span>
            <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full font-bold">
              {stats.total}명
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600">미완료</span>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold">
              {stats.planIncomplete}명
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-600">입력완료</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
              {stats.planComplete}명
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600">차트완료</span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold">
              {stats.chartComplete}명
            </span>
          </div>
        </div>
      </div>

      {/* 환자 목록 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="border-4 border-gray-200 border-t-clinic-primary rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">진료내역을 불러오는 중...</p>
            </div>
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fas fa-calendar-times text-6xl mb-4"></i>
            <p className="text-lg">해당 날짜에 진료 기록이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {patients.map((patient) => {
              const planComplete = isPlanComplete(patient);
              // 카드 스타일: 차트완료(녹색) > 입력완료(파랑) > 미완료(빨강)
              const cardStyle = patient.has_chart
                ? 'bg-green-50 border-green-300 hover:border-green-500'
                : planComplete
                ? 'bg-blue-50 border-blue-300 hover:border-blue-500'
                : 'bg-red-50 border-red-300 hover:border-red-500';

              const badgeStyle = patient.has_chart
                ? 'bg-green-200 text-green-800'
                : planComplete
                ? 'bg-blue-200 text-blue-800'
                : 'bg-red-200 text-red-800';

              const statusText = patient.has_chart
                ? '차트완료'
                : planComplete
                ? '입력완료'
                : '미완료';

              return (
              <div
                key={patient.id}
                onClick={() => navigate(`/doctor/patients/${patient.id}?chartNo=${patient.chart_number}`)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${cardStyle}`}
              >
                {/* 상단: 이름 & 상태 */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{patient.name}</h3>
                    <p className="text-sm text-gray-500">#{patient.chart_number}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeStyle}`}>
                    {statusText}
                  </span>
                </div>

                {/* 질환명 */}
                {patient.disease_name && (
                  <p className="text-sm text-gray-700 mb-2 truncate">
                    <i className="fas fa-stethoscope mr-1 text-gray-400"></i>
                    {patient.disease_name}
                  </p>
                )}

                {/* 내원빈도 */}
                {patient.visit_frequency && (
                  <p className="text-sm text-gray-500 mb-2">
                    <i className="fas fa-calendar-alt mr-1 text-gray-400"></i>
                    {patient.visit_frequency}
                  </p>
                )}

                {/* 하단: 시간 */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-200">
                  <span>
                    <i className="fas fa-clock mr-1"></i>
                    {formatTime(patient.plan_time || patient.chart_time)}
                  </span>
                  {patient.phone && (
                    <span>
                      <i className="fas fa-phone mr-1"></i>
                      {patient.phone}
                    </span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentHistory;
