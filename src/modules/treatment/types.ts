// 치료관리 모듈 타입 정의

export enum PatientStatus {
  RESERVED = '예약',
  WAITING_CONSULTATION = '진료대기',
  IN_CONSULTATION = '진료중',
  WAITING_TREATMENT = '치료대기',
  IN_TREATMENT = '치료중',
  WAITING_PAYMENT = '수납대기',
  COMPLETED = '완료',
}

export interface DefaultTreatment {
  name: string;
  duration: number; // in minutes
  memo?: string;
}

export interface TreatmentItem {
  id: number;
  name: string;
  defaultDuration: number; // in minutes
  displayOrder: number; // for drag and drop ordering
}

export interface Patient {
  id: number;
  name: string;
  chartNumber?: string;
  time: string; // e.g., "10:30"
  status: PatientStatus;
  details?: string; // e.g., '초진', '재진'
  dob?: string;
  gender?: 'male' | 'female';
  phone?: string;
  address?: string;
  referralPath?: string;
  registrationDate?: string; // YYYY-MM-DD
  deletionDate?: string; // ISO string for when the patient was deleted
  defaultTreatments?: DefaultTreatment[];
}

export enum RoomStatus {
  AVAILABLE = '사용가능',
  IN_USE = '사용중',
  NEED_CLEAN = '정리요청',
  CLEANING = '정리중',
}

export interface SessionTreatment {
  id: string; // Unique ID for this specific treatment instance
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed';
  duration: number; // Total duration in minutes
  startTime?: string | null; // ISO string
  elapsedSeconds: number; // Seconds elapsed, for pausing
  memo?: string;
}

export interface TreatmentRoom {
  id: number;
  name: string;
  status: RoomStatus;
  // Session-specific data
  sessionId?: string;
  patientId?: number;
  patientName?: string;
  patientChartNumber?: string;
  patientGender?: 'male' | 'female';
  patientDob?: string; // YYYY-MM-DD
  doctorName?: string;
  inTime?: string; // ISO string for when patient was assigned
  sessionTreatments: SessionTreatment[];
}

export type ActingType = '침' | '추나' | '초진' | '약상담' | '초음파' | '대기' | '기타' | '향기' | '습부';

export interface Acting {
  id: string;
  patientId: number;
  patientName: string;
  type: ActingType;
  duration: number; // in minutes
  source: 'reservation' | 'new_patient' | 'manual';
  memo?: string;
}

export interface ActingQueueState {
  [doctorName: string]: Acting[];
}
