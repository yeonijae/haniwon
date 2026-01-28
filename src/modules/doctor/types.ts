// 환자 관리 타입 (hani-man과 공유)
export interface Patient {
  id: number;
  name: string;
  chart_number?: string;
  dob?: string;
  gender?: 'male' | 'female';
  phone?: string;
  address?: string;
  referral_path?: string;
  registration_date?: string;
  deletion_date?: string;
  created_at?: string;
}

// 바이탈 사인
export interface VitalSigns {
  blood_pressure?: string;
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
}

// 시스템별 검토
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

// 신체 검사
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

// 초진차트
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
  prescription_issued?: boolean;
  prescription_issued_at?: string;
  created_at: string;
  updated_at: string;
}

// 진단 타입
export type DiagnosisType = 'primary' | 'secondary' | 'differential';
export type DiagnosisStatus = 'active' | 'resolved' | 'chronic' | 'ruled-out';
export type Severity = 'mild' | 'moderate' | 'severe';

// 진단기록
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

// 경과기록 (SOAP)
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
  prescription_issued?: boolean;
  prescription_issued_at?: string;
  created_at: string;
  updated_at: string;
}

// ===== 처방전 관리 타입 =====

// 약재 (개별 재료)
export interface Herb {
  id: number;
  name: string;           // 약재명 (예: 인삼, 감초)
  default_dosage?: number; // 기본 용량 (g)
  unit?: string;          // 단위 (g, 정, ml 등)
  description?: string;   // 설명
  created_at?: string;
}

// 처방 템플릿의 약재 구성
export interface PrescriptionHerb {
  herb_id: number;
  herb_name: string;
  dosage: number;        // 용량
  unit: string;          // 단위
}

// 처방 템플릿 (기본 처방 - 예: 소시호탕, 반하사심탕)
export interface PrescriptionTemplate {
  id: number;
  name: string;           // 처방명 (예: 소시호탕)
  alias?: string;         // 별칭 (예: 소시호)
  herbs: PrescriptionHerb[]; // 구성 약재들
  description?: string;   // 설명
  created_at?: string;
  updated_at?: string;
}

// 최종 약재 (조정 후)
export interface FinalHerb {
  herb_id: number;
  name: string;
  amount: number;
}

// 처방전 (실제 환자에게 발급하는 처방)
export interface Prescription {
  id: number;
  patient_id?: number;
  patient_name?: string;
  chart_number?: string;  // 차트번호
  patient_age?: number;   // 나이
  patient_gender?: string; // 성별
  source_type?: 'initial_chart' | 'progress_note'; // 발급 출처 타입
  source_id?: number;     // 발급 출처 ID (initial_chart.id 또는 progress_note.id)
  formula: string;        // 공식 (예: 백인 소시호 반하사심)
  merged_herbs: PrescriptionHerb[]; // merge된 1첩 약재 목록
  final_herbs: FinalHerb[]; // 조정 후 최종 약재 목록
  total_doses: number;    // 총 첩수
  days: number;           // 복용 일수
  doses_per_day: number;  // 하루 팩수
  total_packs: number;    // 총 팩수
  pack_volume?: number;   // 한팩당 용량 (ml)
  water_amount?: number;  // 탕전 물양 (ml)
  herb_adjustment?: string; // 약재 조정 공식
  total_dosage: number;   // 1첩 용량 (g)
  final_total_amount: number; // 최종 총량 (g)
  notes?: string;         // 특이사항
  status: 'draft' | 'issued' | 'completed'; // 상태
  issued_at?: string;     // 발급 시각
  dosage_instruction_created?: boolean;  // 복용법 작성 여부
  dosage_instruction_created_at?: string; // 복용법 작성 시각
  dosage_instruction_data?: {             // 복용법 데이터
    description?: string;
    dosageMethod?: {
      dosageAmount: string;
      selectedTimes: string[];
      timing: string;
    };
    dosageNotice?: string;
    storageMethod?: {
      method: string;
      duration: number;
      unit: string;
    };
    storageNotice?: string;
    selectedFoods?: string[];
    selectedMedicines?: string[];
    customMedicine?: string;
    customPrecautions?: string;
  };
  chief_complaint?: string; // 주소증 (조인으로 가져옴)
  created_by?: string;    // 작성자
  created_at: string;
  updated_at: string;
}

// ===== 복용법 관리 타입 =====

// 복용법 템플릿
export interface DosageInstruction {
  id: number;
  category: string;           // 대분류 (소아&청소년, 부인과&산과, 소화기 등)
  subcategory?: string;       // 소분류 (소아, 성인 등)
  disease_name: string;       // 질환명 (ADHD, 담적증, 비염 등)
  condition_detail?: string;  // 세부 상태 (리열+심기부족, 코막힘 등)
  description?: string;       // 一. 설명 (질환 설명)
  dosage_method?: string;     // 二. 복용법
  precautions?: string;       // 三. 주의사항
  full_text?: string;         // 전체 원본 텍스트
  source_filename?: string;   // 원본 파일명
  keywords?: string[];        // 검색용 키워드
  created_at?: string;
  updated_at?: string;
}
