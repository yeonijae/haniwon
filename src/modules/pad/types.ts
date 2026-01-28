/**
 * DoctorPad 타입 정의
 */

// 대시보드 통계
export interface DashboardStats {
  // 환자 통계
  totalPatients: number;        // 오늘의 환자수
  reservedPatients: number;     // 예약환자
  walkInPatients: number;       // 현장예약 (예약하고간환자)
  canceledPatients: number;     // 예약취소자

  // 매출/생산성
  totalRevenue: number;         // 오늘 매출
  avgRevenuePerPatient: number; // 객단가 (매출/환자수)
  totalActingMinutes: number;   // 총 액팅시간 (분)
  productivity: number;         // 생산성 (매출/액팅시간, 원/분)
}

// 오늘 예약 항목
export interface TodayReservation {
  id: number;
  patientId: number;
  patientName: string;
  chartNumber: string;
  time: string;              // "09:30"
  treatmentType: string;     // "침", "추나" 등
  reservationType: 'initial' | 'return' | 're_initial';  // 초진/재진/재초진
  status: 'pending' | 'visited' | 'canceled' | 'no_show';
  memo?: string;
}

// 시간 슬롯
export interface TimeSlot {
  time: string;              // "09:30"
  reservations: TodayReservation[];
  isLunchTime: boolean;
  isPast: boolean;
  isCurrent: boolean;
}

// 채팅 메시지
export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderRole: 'doctor' | 'nurse' | 'reception' | 'admin';
  message: string;
  timestamp: string;
  isMe: boolean;
  targetType?: 'all' | 'doctor' | 'nurse' | 'reception';
  patientId?: number;        // 특정 환자 관련 메시지일 경우
}

// 빠른 메시지 템플릿
export interface QuickMessage {
  id: string;
  label: string;
  message: string;
  targetType: 'all' | 'nurse' | 'doctor' | 'reception';
  icon?: string;
}

// 축소된 환자 상태
export interface CompactPatientInfo {
  roomId: number;
  roomName: string;
  patientId: number;
  patientName: string;
  currentTreatment: string;
  remainingSeconds: number;
  status: 'running' | 'pending' | 'completed';
}

// 의사 정보
export interface Doctor {
  id: number;
  name: string;
  fullName: string;
  color: string;
}

// 의사 상태
export type DoctorStatusType = 'in_progress' | 'waiting' | 'office' | 'away';

export interface DoctorStatus {
  doctorId: number;
  status: DoctorStatusType;
  currentPatientId?: number;
  currentPatientName?: string;
  updatedAt: string;
}
