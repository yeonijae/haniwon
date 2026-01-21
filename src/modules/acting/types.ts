/**
 * 액팅 관리 시스템 타입 정의
 */

// 액팅 종류
export interface ActingType {
  id: number;
  name: string;
  category: 'basic' | 'consult' | 'etc';
  standardMin: number;
  slotUsage: number;
  displayOrder: number;
  isActive: boolean;
}

// 액팅 상태
// DB에서는 'acting', 'complete'를 사용함 (in_progress, completed 아님)
export type ActingStatus = 'waiting' | 'acting' | 'complete' | 'cancelled';

// 액팅 대기열 아이템
export interface ActingQueueItem {
  id: number;
  patientId: number;
  patientName: string;
  chartNo: string;
  doctorId: number;
  doctorName: string;
  actingType: string;
  orderNum: number;
  status: ActingStatus;
  source: 'reservation' | 'manual';
  sourceId?: number;
  memo?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSec?: number;
  workDate: string;
}

// 원장 상태
// DB에서는 'acting'을 사용함 (in_progress 아님)
export type DoctorStatusType = 'acting' | 'waiting' | 'office' | 'away';

export interface DoctorStatus {
  doctorId: number;
  doctorName: string;
  status: DoctorStatusType;
  currentActingId?: number;
  currentActing?: ActingQueueItem;
  statusUpdatedAt: string;
}

// 액팅 기록 (통계용)
export interface ActingRecord {
  id: number;
  patientId: number;
  patientName: string;
  chartNo: string;
  doctorId: number;
  doctorName: string;
  actingType: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;
  workDate: string;
}

// 원장별 액팅 통계
export interface DoctorActingStats {
  doctorId: number;
  doctorName: string;
  actingType: string;
  totalCount: number;
  avgDurationSec: number;
  avgDurationMin: number;
  minDurationSec: number;
  maxDurationSec: number;
}

// 일별 통계
export interface DailyActingStats {
  workDate: string;
  doctorId: number;
  doctorName: string;
  totalCount: number;
  totalDurationSec: number;
  totalDurationMin: number;
  avgDurationSec: number;
}

// 액팅 추가 요청
export interface AddActingRequest {
  patientId: number;
  patientName: string;
  chartNo?: string;
  doctorId: number;
  doctorName: string;
  actingType: string;
  orderNum?: number; // 미지정시 맨 뒤
  memo?: string;
  source?: 'reservation' | 'manual' | 'treatment_queue' | 'cs_consultation';
  sourceId?: number;
}

// 액팅 순서 변경 요청
export interface ReorderActingRequest {
  actingId: number;
  newOrderNum: number;
}

// 원장별 대기열 그룹
export interface DoctorQueueGroup {
  doctor: {
    id: number;
    name: string;
    color?: string;
  };
  status: DoctorStatus;
  currentActing?: ActingQueueItem;
  queue: ActingQueueItem[];
  totalWaiting: number;
}
