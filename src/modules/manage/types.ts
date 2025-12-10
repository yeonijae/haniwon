

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
  memo?: string; // 접수메모
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
  startTime?: string; // ISO string
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

export interface ConsultationRoom {
  id: number;
  roomName: string;
  doctorName: string;
  status: 'available' | 'in_consultation' | 'waiting';
  patientId?: number;
  patientName?: string;
  patientDetails?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'completed';  // pending: 수납대기, paid: 수납완료(예약미완), completed: 모두완료

export interface Payment {
    id: number;
    patientId: number;
    patientName: string;
    patientChartNumber?: string;
    amount?: number;
    details: string; // e.g., '침치료, 약침'
    isPaid: boolean;
    status: PaymentStatus;      // 수납 상태
    reservationId?: string;
    reservationDate?: string; // YYYY-MM-DD
    reservationTime?: string; // HH:mm
    // MSSQL 수납 정보
    mssqlReceiptId?: number;
    insuranceSelf?: number;     // 본인부담금
    insuranceClaim?: number;    // 청구금액
    generalAmount?: number;     // 비급여
    unpaidAmount?: number;      // 미수금
    insuranceType?: string;     // 종별 (건보, 차상위, 의료급여1종/2종, 자보, 일반, 임산부, 산정특례)
    // 수납 메모
    packageInfo?: string;       // 패키지 정보
    paymentMemo?: string;       // 수납 메모 (그날 있었던 문제들)
    paidAt?: string;            // 수납 완료 시간
}

export interface Treatment {
  name: string;
  acting: number;
}

export interface Reservation {
  id: string; // A unique ID for the whole reservation event
  partId: string; // A unique ID for the part of the reservation in a slot
  patientId: number;
  patientName: string;
  patientChartNumber: string;
  doctor: string;
  date: string; // YYYY-MM-DD - The date of this specific slot
  time: string; // HH:mm - The time of this specific slot
  treatments: Treatment[]; // The full list of treatments for the entire reservation
  slotActing: number; // The acting consumed in this specific slot
  isContinuation: boolean; // True if this is not the first part of a multi-slot reservation
  memo?: string;
  status: 'confirmed' | 'canceled' | 'arrived';
}


export interface ReservationsState {
  [date: string]: { // YYYY-MM-DD
    [doctor: string]: {
      [time: string]: Reservation[]; // HH:mm
    }
  }
}

export type PaymentMethod = 'card' | 'cash' | 'transfer';

export type TreatmentItemCategory = 'covered' | 'uncovered';

export interface TreatmentDetailItem {
  id: string;
  name: string;
  amount: number;
  category: TreatmentItemCategory;
  memo?: string;
}

export interface CompletedPayment {
  id: number;
  paymentId: number; // Original ID from the waiting list
  patientId: number;
  patientName: string;
  patientChartNumber?: string;
  treatmentItems: TreatmentDetailItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethods: {
    method: PaymentMethod;
    amount: number;
  }[];
  timestamp: string; // ISO string for the time of completion
}

export interface MedicalStaffPermissions {
  prescription: boolean;
  chart: boolean;
  payment: boolean;
  statistics: boolean;
}

export interface DayWorkHours {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface WorkPattern {
  id: string;
  days: boolean[]; // index 0 = Monday, ..., 6 = Sunday
  dayWorkHours: (DayWorkHours | null)[]; // 각 요일별 근무시간, null이면 해당 요일 근무 안함
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface MedicalStaff {
  id: number;
  name: string;
  dob: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  hireDate: string; // YYYY-MM-DD
  fireDate?: string | null; // YYYY-MM-DD or null
  status: 'working' | 'retired';
  permissions: MedicalStaffPermissions;
  workPatterns: WorkPattern[];
  consultationRoom?: string | null; // 진료실 (1진료실, 2진료실, 3진료실, 4진료실)
}

export interface StaffPermissions {
  decoction: boolean;     // 탕전관리
  patient: boolean;       // 환자관리
  herbalMedicine: boolean; // 상비약관리
  payment: boolean;       // 수납현황
  inventory: boolean;     // 물품관리
  board: boolean;         // 게시판
  treatmentRoom: boolean; // 치료실관리
}

export type StaffRank = '실장' | '팀장' | '주임' | '사원';
export type StaffDepartment = '총괄' | '데스크' | '치료팀' | '탕전팀';

export interface Staff {
  id: number;
  name: string;
  dob: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  hireDate: string; // YYYY-MM-DD
  fireDate?: string | null; // YYYY-MM-DD or null
  status: 'working' | 'retired';
  rank: StaffRank;
  department: StaffDepartment;
  permissions: StaffPermissions;
}

export type UncoveredCategories = {
  [key: string]: string[];
};

export type ActingType = '침' | '추나' | '초진' | '약상담' | '초음파' | '대기' | '기타' | '향기' | '습부';

// 진료항목 (접수 시 선택하는 항목)
export interface ConsultationSubItem {
  id: number;
  name: string;
  displayOrder: number;
}

export interface ConsultationItem {
  id: number;
  name: string;
  displayOrder: number;
  subItems: ConsultationSubItem[];
}

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

export type Affiliation = '의료진' | '데스크' | '치료실' | '탕전실';

export interface User {
  id: string;
  password?: string;
  name: string;
  affiliation: Affiliation;
}

// =====================================================
// 차트 관리 타입 (초진차트, 진단기록, 경과기록)
// =====================================================

export interface VitalSigns {
  blood_pressure?: string;
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
}

export interface ReviewOfSystems {
  constitutional?: string;
  eyes?: string;
  ears_nose_throat?: string;
  cardiovascular?: string;
  respiratory?: string;
  gastrointestinal?: string;
  genitourinary?: string;
  musculoskeletal?: string;
  skin?: string;
  neurological?: string;
  psychiatric?: string;
  endocrine?: string;
  hematologic?: string;
  allergic_immunologic?: string;
}

export interface PhysicalExamination {
  general?: string;
  vital_signs?: VitalSigns;
  head_neck?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdomen?: string;
  extremities?: string;
  neurological?: string;
  skin?: string;
  other?: string;
}

export interface InitialChart {
  id: number;
  patient_id: number;
  doctor_name?: string;
  chart_date: string;
  chief_complaint?: string;
  present_illness?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  family_history?: string;
  social_history?: string;
  medications?: string;
  allergies?: string;
  review_of_systems?: ReviewOfSystems;
  physical_examination?: PhysicalExamination;
  initial_diagnosis?: string;
  initial_plan?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type DiagnosisType = 'primary' | 'secondary' | 'differential';
export type DiagnosisStatus = 'active' | 'resolved' | 'chronic' | 'ruled-out';
export type Severity = 'mild' | 'moderate' | 'severe';

export interface Diagnosis {
  id: number;
  patient_id: number;
  doctor_name?: string;
  diagnosis_date: string;
  icd_code?: string;
  diagnosis_name: string;
  diagnosis_type?: DiagnosisType;
  status: DiagnosisStatus;
  onset_date?: string;
  resolved_date?: string;
  severity?: Severity;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgressNote {
  id: number;
  patient_id: number;
  doctor_name?: string;
  note_date: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vital_signs?: VitalSigns;
  follow_up_plan?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
