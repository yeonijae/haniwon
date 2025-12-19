/**
 * 직원관리 시스템 타입 정의
 */

// 직원 유형
export type EmployeeType = 'doctor' | 'staff';

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  doctor: '원장',
  staff: '직원'
};

// 직원 상태
export type EmployeeStatus = 'active' | 'resigned' | 'leave';

// 근무 파트 (직원용)
export type WorkPart = 'desk' | 'treatment' | 'decoction';

export const WORK_PART_LABELS: Record<WorkPart, string> = {
  desk: '데스크',
  treatment: '치료실',
  decoction: '탕전실'
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: '재직중',
  resigned: '퇴사',
  leave: '휴직'
};

// 근무 타입 (시프트)
export type ShiftType = 'full' | 'am' | 'pm' | 'off' | 'half_am' | 'half_pm';

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  full: '풀타임',
  am: '오전',
  pm: '오후',
  off: '휴무',
  half_am: '오전반차',
  half_pm: '오후반차'
};

export const SHIFT_COLORS: Record<ShiftType, string> = {
  full: 'bg-blue-100 text-blue-700 border-blue-300',
  am: 'bg-green-100 text-green-700 border-green-300',
  pm: 'bg-orange-100 text-orange-700 border-orange-300',
  off: 'bg-gray-100 text-gray-500 border-gray-300',
  half_am: 'bg-teal-100 text-teal-700 border-teal-300',
  half_pm: 'bg-amber-100 text-amber-700 border-amber-300'
};

// 급여/면담 이벤트 타입
export type SalaryEventType = 'salary_change' | 'interview' | 'contract' | 'bonus' | 'other';

export const SALARY_EVENT_LABELS: Record<SalaryEventType, string> = {
  salary_change: '급여 변경',
  interview: '면담',
  contract: '계약',
  bonus: '상여금',
  other: '기타'
};

// 면담 타입
export type InterviewType = 'regular' | 'salary' | 'evaluation' | 'counseling';

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  regular: '정기 면담',
  salary: '급여 면담',
  evaluation: '평가 면담',
  counseling: '상담'
};

// 휴가 타입
export type LeaveType = 'annual' | 'sick' | 'personal' | 'maternity' | 'unpaid' | 'other';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: '연차',
  sick: '병가',
  personal: '경조사',
  maternity: '출산휴가',
  unpaid: '무급휴가',
  other: '기타'
};

// 휴가 상태
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: '승인대기',
  approved: '승인됨',
  rejected: '거절됨',
  cancelled: '취소됨'
};

// 성별
export type Gender = 'male' | 'female';

export const GENDER_LABELS: Record<Gender, string> = {
  male: '남성',
  female: '여성'
};

// 진료실
export const CONSULTATION_ROOMS = ['1진료실', '2진료실', '3진료실', '4진료실'] as const;
export type ConsultationRoom = typeof CONSULTATION_ROOMS[number];

// 의료진 권한
export interface DoctorPermissions {
  prescription: boolean;  // 처방관리
  chart: boolean;         // 환자차트
  payment: boolean;       // 수납현황
  statistics: boolean;    // 지표관리
}

export const DEFAULT_DOCTOR_PERMISSIONS: DoctorPermissions = {
  prescription: true,
  chart: true,
  payment: false,
  statistics: false
};

export const PERMISSION_LABELS: Record<keyof DoctorPermissions, string> = {
  prescription: '처방관리',
  chart: '환자차트',
  payment: '수납현황',
  statistics: '지표관리'
};

// =====================================================
// 데이터 모델
// =====================================================

// 직원 기본 정보
export interface StaffMember {
  id: number;
  employee_type: EmployeeType;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  hire_date?: string;
  resign_date?: string;
  status: EmployeeStatus;
  profile_color: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;

  // 직원 전용 필드 (employee_type === 'staff')
  work_part?: WorkPart;           // 근무 파트

  // 의료진 전용 필드 (employee_type === 'doctor')
  mssql_doctor_id?: string;       // MSSQL 연결용 ID
  dob?: string;                   // 생년월일 (YYYY-MM-DD)
  gender?: Gender;                // 성별
  consultation_room?: ConsultationRoom;  // 진료실
  permissions?: DoctorPermissions;       // 권한 (JSON 파싱됨)
  alias?: string;                 // 호칭 (예: 김원장, 강원장)

  // SQLite 등록 여부 (UI용, DB에는 없음)
  isRegisteredInSqlite?: boolean;
}

// 근무 패턴 (원장용)
export interface WorkPattern {
  id: number;
  staff_id: number;
  pattern_name?: string;
  start_date: string;
  end_date?: string;

  mon_start?: string;
  mon_end?: string;
  tue_start?: string;
  tue_end?: string;
  wed_start?: string;
  wed_end?: string;
  thu_start?: string;
  thu_end?: string;
  fri_start?: string;
  fri_end?: string;
  sat_start?: string;
  sat_end?: string;
  sun_start?: string;
  sun_end?: string;

  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// 근무 일정 (직원용)
export interface WorkSchedule {
  id: number;
  staff_id: number;
  work_date: string;
  shift_type: ShiftType;
  start_time?: string;
  end_time?: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// 급여/면담 이벤트
export interface SalaryInterview {
  id: number;
  staff_id: number;
  event_type: SalaryEventType;
  event_date: string;

  salary_amount?: number;
  salary_type?: 'monthly' | 'yearly';
  previous_amount?: number;

  interview_type?: InterviewType;
  interview_summary?: string;

  title?: string;
  description?: string;
  attachments?: string;

  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// 휴가 기록
export interface LeaveRecord {
  id: number;
  staff_id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count?: number;
  reason?: string;
  status: LeaveStatus;
  approved_by?: string;
  approved_at?: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// 스케줄 템플릿
export interface ScheduleTemplate {
  id: number;
  template_name: string;
  description?: string;

  mon_shift: ShiftType;
  tue_shift: ShiftType;
  wed_shift: ShiftType;
  thu_shift: ShiftType;
  fri_shift: ShiftType;
  sat_shift: ShiftType;
  sun_shift: ShiftType;

  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// 뷰/폼 데이터
// =====================================================

// 스케줄 그리드 셀
export interface ScheduleCell {
  staffId: number;
  staffName: string;
  date: string;
  shiftType: ShiftType;
  isModified?: boolean;
}

// 월간 스케줄 데이터
export interface MonthlyScheduleData {
  year: number;
  month: number;
  staffList: StaffMember[];
  schedules: Map<string, WorkSchedule>; // key: `${staff_id}_${date}`
}

// 일괄 입력 변경사항
export interface BatchScheduleChange {
  staff_id: number;
  work_date: string;
  shift_type: ShiftType;
  action: 'create' | 'update' | 'delete';
}

// 요일 인덱스 (월=0, 일=6)
export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
