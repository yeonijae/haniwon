import type {
  Reservation,
  CreateReservationRequest,
  UpdateReservationRequest,
  ReservationFilter,
  Doctor,
  DayOff
} from '../types';

const API_BASE = 'http://localhost:3100/api';

// API 응답 타입
interface MssqlReservationResponse {
  id: number;
  patient_id: number;
  chart_no: string;
  patient_name: string;
  phone: string;
  date: string;
  time: string;
  doctor: string;
  item: string;
  type: string;
  memo: string;
  visited: boolean;
  canceled: boolean;
}

// MSSQL 응답을 Reservation 타입으로 변환
const mapMssqlToReservation = (r: MssqlReservationResponse): Reservation => ({
  id: r.id,
  patientId: r.patient_id,
  chartNo: r.chart_no || '',
  patientName: r.patient_name || '',
  phone: r.phone || '',
  date: r.date,
  time: r.time,
  doctor: r.doctor || '',
  item: r.item || '',
  type: (r.type as Reservation['type']) || '재진',
  memo: r.memo || '',
  visited: r.visited,
  canceled: r.canceled,
  status: r.canceled ? 'canceled' : r.visited ? 'visited' : 'confirmed',
  source: 'internal',
});

// 날짜별 예약 조회
export async function fetchReservationsByDate(date: string): Promise<Reservation[]> {
  const response = await fetch(`${API_BASE}/reservations?date=${date}`);
  if (!response.ok) throw new Error('예약 조회 실패');
  const data: MssqlReservationResponse[] = await response.json();
  return data.map(mapMssqlToReservation);
}

// 기간별 예약 조회
export async function fetchReservationsByDateRange(
  startDate: string,
  endDate: string
): Promise<Reservation[]> {
  const response = await fetch(
    `${API_BASE}/reservations?startDate=${startDate}&endDate=${endDate}`
  );
  if (!response.ok) throw new Error('예약 조회 실패');
  const data: MssqlReservationResponse[] = await response.json();
  return data.map(mapMssqlToReservation);
}

// 의사별 예약 조회
export async function fetchReservationsByDoctor(
  date: string,
  doctor: string
): Promise<Reservation[]> {
  const response = await fetch(
    `${API_BASE}/reservations?date=${date}&doctor=${encodeURIComponent(doctor)}`
  );
  if (!response.ok) throw new Error('예약 조회 실패');
  const data: MssqlReservationResponse[] = await response.json();
  return data.map(mapMssqlToReservation);
}

// 환자별 예약 이력 조회
export async function fetchPatientReservations(patientId: number): Promise<Reservation[]> {
  const response = await fetch(`${API_BASE}/patients/${patientId}/reservations`);
  if (!response.ok) throw new Error('환자 예약 이력 조회 실패');
  const data: MssqlReservationResponse[] = await response.json();
  return data.map(mapMssqlToReservation);
}

// 예약 생성
export async function createReservation(req: CreateReservationRequest): Promise<Reservation> {
  const response = await fetch(`${API_BASE}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) throw new Error('예약 생성 실패');
  const data: MssqlReservationResponse = await response.json();
  return mapMssqlToReservation(data);
}

// 예약 수정
export async function updateReservation(
  id: number,
  req: UpdateReservationRequest
): Promise<Reservation> {
  const response = await fetch(`${API_BASE}/reservations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) throw new Error('예약 수정 실패');
  const data: MssqlReservationResponse = await response.json();
  return mapMssqlToReservation(data);
}

// 예약 취소
export async function cancelReservation(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/reservations/${id}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('예약 취소 실패');
}

// 내원 확인
export async function markAsVisited(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/reservations/${id}/visit`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('내원 확인 실패');
}

// 의료진 목록 조회
export async function fetchDoctors(date?: string): Promise<Doctor[]> {
  try {
    const url = date
      ? `${API_BASE}/doctors?date=${date}`
      : `${API_BASE}/doctors`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('의사 목록 조회 실패');
    const data = await response.json();

    return data.map((d: any, index: number) => ({
      id: d.id || index + 1,
      name: d.name,
      color: d.color || '#3B82F6',
      resigned: d.resigned,
      isOther: d.isOther,
      workStartDate: d.workStartDate,
      workEndDate: d.workEndDate,
      workDays: [1, 2, 3, 4, 5, 6],
      workHours: { start: '09:00', end: '18:00' },
      lunchTime: { start: '13:00', end: '14:00' }
    }));
  } catch (err) {
    console.error('의사 목록 조회 오류:', err);
    return [];
  }
}

// 휴무일 조회
export async function fetchDayOffs(month: string): Promise<DayOff[]> {
  // TODO: API 연동
  return [];
}

// 초진 예약 조회 (first-visit)
export async function fetchFirstVisitReservations(date: string): Promise<Reservation[]> {
  const response = await fetch(`${API_BASE}/reservations/first-visit?date=${date}`);
  if (!response.ok) throw new Error('초진 예약 조회 실패');
  const data: MssqlReservationResponse[] = await response.json();
  return data.map(mapMssqlToReservation);
}

// 승인 대기 예약 조회 (외부 유입)
export async function fetchPendingApprovals(): Promise<Reservation[]> {
  // TODO: Supabase에서 외부 예약 조회
  return [];
}

// 외부 예약 승인
export async function approveExternalReservation(
  externalId: string,
  updates?: Partial<CreateReservationRequest>
): Promise<Reservation> {
  // TODO: 외부 예약을 MSSQL에 등록하고 Supabase 상태 업데이트
  throw new Error('Not implemented');
}

// 외부 예약 거절
export async function rejectExternalReservation(
  externalId: string,
  reason: string
): Promise<void> {
  // TODO: Supabase 상태 업데이트
  throw new Error('Not implemented');
}

// 환자 검색 결과 타입
export interface PatientSearchResult {
  id: number;
  chartNo: string;
  name: string;
  phone?: string;
}

// 환자 검색 (MSSQL API)
export async function searchPatients(searchTerm: string): Promise<PatientSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE}/patients/search?q=${encodeURIComponent(searchTerm)}`
    );

    if (!response.ok) {
      throw new Error(`환자 검색 오류: ${response.status}`);
    }

    const data = await response.json();
    return (data || []).map((p: any) => ({
      id: p.id || p.patient_id,
      chartNo: p.chart_no || p.chartNo || '',
      name: p.name || p.patient_name || '',
      phone: p.phone || '',
    }));
  } catch (error) {
    console.error('환자 검색 실패:', error);
    return [];
  }
}
