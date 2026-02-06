/**
 * 지표관리 API
 * 초진수, 재진율, 삼진율, 이탈율, 객단가 등 지표 조회
 */

// 타입 정의
export interface ChoojinPatient {
  customer_pk: number;
  chart_no: string;
  patient_name: string;
  choojin_date: string;
  choojin_type: 'chim' | 'jabo' | 'yak';
  choojin_sub_type: 'new' | 're';
  insurance_type: string;
  doctor_id: string;
  doctor_name: string;
}

export interface ChoojinListResponse {
  success: boolean;
  data: {
    choojin_list: ChoojinPatient[];
    summary: {
      total: number;
      by_type: {
        chim_new: number;
        chim_re: number;
        jabo_new: number;
        jabo_re: number;
        yak_new: number;
        yak_re: number;
      };
      by_doctor: Record<string, {
        doctor_name: string;
        total: number;
        chim_new: number;
        chim_re: number;
        jabo_new: number;
        jabo_re: number;
        yak_new: number;
        yak_re: number;
      }>;
    };
    period: {
      start_date: string;
      end_date: string;
    };
  };
}

export interface VisitRecord {
  tx_date: string;
  tx_items: string[];
  doctor_name: string;
}

export interface PatientVisitsResponse {
  success: boolean;
  data: {
    customer_pk: number;
    chart_no: string;
    patient_name: string;
    choojin_date: string;
    tracking_end_date: string;
    visit_count: number;
    visits: VisitRecord[];
    is_rejin: boolean;
    is_samjin: boolean;
    is_ital: boolean;
  };
}

export interface RevisitRateData {
  total_choojin: number;
  rejin_count: number;
  samjin_count: number;
  ital_count: number;
  rejin_rate: number;
  samjin_rate: number;
  ital_rate: number;
  tracking_completed_count: number;
  pending_count: number;
}

export interface RevisitRateResponse {
  success: boolean;
  data: {
    overall: RevisitRateData;
    by_type: Record<string, RevisitRateData>;
    by_doctor: Record<string, {
      doctor_name: string;
    } & RevisitRateData>;
    period: {
      start_date: string;
      end_date: string;
      tracking_end_date: string;
    };
  };
}

export interface RevenuePerPatientData {
  insurance: {
    total_revenue: number;
    patient_count: number;
    avg_per_patient: number;
  };
  jabo: {
    total_revenue: number;
    patient_count: number;
    avg_per_patient: number;
  };
  uncovered: {
    total_revenue: number;
    patient_count: number;
    avg_per_patient: number;
  };
  total: {
    total_revenue: number;
    patient_count: number;
    avg_per_patient: number;
  };
}

export interface RevenuePerPatientResponse {
  success: boolean;
  data: {
    overall: RevenuePerPatientData;
    by_doctor: Record<string, {
      doctor_name: string;
    } & RevenuePerPatientData>;
    period: {
      start_date: string;
      end_date: string;
    };
  };
}

export interface CumulativeStatsData {
  choojin: {
    chim_new: number;
    chim_re: number;
    jabo_new: number;
    jabo_re: number;
    yak_new: number;
    yak_re: number;
    total: number;
  };
  revisit: {
    total_tracked: number;
    rejin_count: number;
    samjin_count: number;
    ital_count: number;
    rejin_rate: number;
    samjin_rate: number;
    ital_rate: number;
  };
  revenue: {
    insurance: number;
    jabo: number;
    uncovered: number;
    total: number;
  };
  avg_per_patient: {
    insurance: number;
    jabo: number;
    uncovered: number;
    total: number;
  };
}

export interface CumulativeResponse {
  success: boolean;
  data: {
    doctor_id: string;
    doctor_name: string;
    hire_date: string | null;
    period: {
      start_date: string;
      end_date: string;
      type: string;
    };
    stats: CumulativeStatsData;
  };
}

// API 함수들
const POSTGRES_API = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

/**
 * 초진 환자 목록 조회
 */
export async function getChoojinList(params: {
  start_date: string;
  end_date: string;
  doctor_id?: string;
  type?: 'chim' | 'jabo' | 'yak';
}): Promise<ChoojinListResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('start_date', params.start_date);
  queryParams.set('end_date', params.end_date);
  if (params.doctor_id) queryParams.set('doctor_id', params.doctor_id);
  if (params.type) queryParams.set('type', params.type);

  const response = await fetch(`${POSTGRES_API}/api/metrics/choojin-list?${queryParams}`);
  return response.json();
}

/**
 * 환자 방문 기록 조회 (재진/삼진/이탈 판정용)
 */
export async function getPatientVisits(params: {
  customer_pk: number;
  choojin_date: string;
}): Promise<PatientVisitsResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('customer_pk', String(params.customer_pk));
  queryParams.set('choojin_date', params.choojin_date);

  const response = await fetch(`${POSTGRES_API}/api/metrics/patient-visits?${queryParams}`);
  return response.json();
}

/**
 * 재진율/삼진율/이탈율 조회
 */
export async function getRevisitRate(params: {
  start_date: string;
  end_date: string;
  doctor_id?: string;
  type?: 'chim' | 'jabo' | 'yak';
}): Promise<RevisitRateResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('start_date', params.start_date);
  queryParams.set('end_date', params.end_date);
  if (params.doctor_id) queryParams.set('doctor_id', params.doctor_id);
  if (params.type) queryParams.set('type', params.type);

  const response = await fetch(`${POSTGRES_API}/api/metrics/revisit-rate?${queryParams}`);
  return response.json();
}

/**
 * 객단가 조회
 */
export async function getRevenuePerPatient(params: {
  start_date: string;
  end_date: string;
  doctor_id?: string;
}): Promise<RevenuePerPatientResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('start_date', params.start_date);
  queryParams.set('end_date', params.end_date);
  if (params.doctor_id) queryParams.set('doctor_id', params.doctor_id);

  const response = await fetch(`${POSTGRES_API}/api/metrics/revenue-per-patient?${queryParams}`);
  return response.json();
}

/**
 * 누적 통계 조회 (원장별)
 */
export async function getCumulativeStats(params: {
  doctor_id: string;
  period_type?: 'from_hire' | '3months' | '6months';
}): Promise<CumulativeResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('doctor_id', params.doctor_id);
  if (params.period_type) queryParams.set('period_type', params.period_type);

  const response = await fetch(`${POSTGRES_API}/api/metrics/cumulative?${queryParams}`);
  return response.json();
}

export interface CumulativeStatsAllResponse {
  success: boolean;
  data: {
    by_doctor: Record<string, {
      doctor_name: string;
      start_date: string;
      total_work_days: number;
      choojin: {
        total: number;
        chim: number;
        jabo: number;
      };
      revisit: {
        total_choojin: number;
        rejin_count: number;
        samjin_count: number;
        ital_count: number;
        rejin_rate: number;
        samjin_rate: number;
        ital_rate: number;
      };
      revenue: {
        total: number;
        insurance: number;
        jabo: number;
        uncovered: number;
        pain_uncovered: number;
        insurance_patients: number;
        jabo_patients: number;
        insurance_avg: number;
        jabo_avg: number;
      };
    }>;
  };
}

/**
 * 전체 원장 누적 통계 조회 (입사일부터 현재까지)
 */
export async function getCumulativeStatsAll(): Promise<CumulativeStatsAllResponse> {
  const response = await fetch(`${POSTGRES_API}/api/metrics/cumulative-stats`);
  return response.json();
}

// 유틸리티 함수
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// 주차 계산 유틸리티
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

export function getWeekDates(year: number, week: number): { start: Date; end: Date } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const start = new Date(simple);
  if (dow <= 4) {
    start.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    start.setDate(simple.getDate() + 8 - simple.getDay());
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`;
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}
