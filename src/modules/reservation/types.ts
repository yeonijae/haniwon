// 예약 상태
export type ReservationStatus = 'pending' | 'confirmed' | 'visited' | 'canceled' | 'no_show';

// 예약 타입 (진료 종류)
export type ReservationType = '초진' | '재진' | '상담예약' | '초진예약' | '기타';

// 예약 정보
export interface Reservation {
  id: number;
  patientId: number;
  chartNo: string;
  patientName: string;
  phone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  doctor: string;
  item: string; // 진료항목 (침, 약침, 한약 등)
  type: ReservationType;
  memo: string;
  visited: boolean;
  canceled: boolean;
  status: ReservationStatus;
  // 외부 예약 관련
  source?: 'internal' | 'naver' | 'kakao' | 'web' | 'phone';
  externalId?: string;
  needsApproval?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 예약 생성 요청
export interface CreateReservationRequest {
  patientId: number;
  patientName?: string;
  chartNo?: string;
  date: string;
  time: string;
  doctor: string;
  item: string;
  type: ReservationType;
  memo?: string;
}

// 예약 수정 요청
export interface UpdateReservationRequest {
  date?: string;
  time?: string;
  doctor?: string;
  item?: string;
  type?: ReservationType;
  memo?: string;
  status?: ReservationStatus;
}

// 의사 정보
export interface Doctor {
  id: number | string;
  name: string;
  color: string; // 캘린더 표시용 색상
  isWorking?: boolean; // 해당 날짜에 근무 여부
  resigned?: boolean; // 퇴사 여부
  isOther?: boolean; // 기타 여부
  workStartDate?: string | null; // 근무 시작일
  workEndDate?: string | null; // 근무 종료일
  workDays?: number[]; // 0=일, 1=월, ... 6=토
  workHours?: {
    start: string; // HH:mm
    end: string;
  };
  lunchTime?: {
    start: string;
    end: string;
  };
}

// 휴무일 정보
export interface DayOff {
  id: number;
  doctor?: string; // null이면 전체 휴무
  date: string;
  reason: string;
  type: 'holiday' | 'personal' | 'other';
}

// 캘린더 뷰 타입
export type CalendarViewType = 'day' | 'week' | 'month';

// 캘린더 타임슬롯
export interface TimeSlot {
  time: string;
  reservations: Reservation[];
}

// 일별 예약 현황
export interface DaySchedule {
  date: string;
  slots: TimeSlot[];
  dayOff?: DayOff;
}

// 예약 필터
export interface ReservationFilter {
  startDate?: string;
  endDate?: string;
  doctor?: string;
  status?: ReservationStatus;
  type?: ReservationType;
  patientId?: number;
  searchTerm?: string;
}

// 외부 예약 (승인 대기)
export interface PendingReservation extends Reservation {
  source: 'naver' | 'kakao' | 'web' | 'phone';
  externalId: string;
  needsApproval: true;
  requestedAt: string;
  originalTime?: string; // 변경 전 시간
}

// 예약 통계
export interface ReservationStats {
  date: string;
  total: number;
  visited: number;
  canceled: number;
  noShow: number;
  byDoctor: {
    [doctorName: string]: number;
  };
  byType: {
    [type: string]: number;
  };
}

// 치료 항목 설정
export interface TreatmentItem {
  id: string;
  name: string;
  slots: number; // 단독일 때 슬롯 수
  slotsInCompound?: number; // 복합 진료일 때 슬롯 수 (없으면 slots와 동일)
  category: string; // 카테고리 (기본진료, 재초진, 약상담 등)
  color?: string; // 표시 색상
  isActive: boolean; // 활성화 여부
  sortOrder: number; // 정렬 순서
}

// 예약 설정
export interface ReservationSettings {
  treatmentItems: TreatmentItem[];
  categories: string[]; // 카테고리 목록
  maxSlotsPerReservation: number; // 최대 슬롯 수 (기본 6)
  slotDurationMinutes: number; // 슬롯 당 시간 (기본 10분)
}
