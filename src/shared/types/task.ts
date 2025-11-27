/**
 * 의료진 할일 관련 타입 정의
 */

// 할일 유형
export type TaskType =
  | 'write_initial_chart'      // 초진차트 작성
  | 'write_progress_note'      // 경과기록 작성
  | 'write_prescription'       // 처방전 작성
  | 'write_dosage_instruction' // 복용법 작성
  | 'order_herbal_medicine'    // 한약 주문
  | 'patient_callback'         // 환자 콜백
  | 'review_test_result'       // 검사결과 확인
  | 'other';                   // 기타

// 할일 상태
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'canceled';

// 우선순위
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// 담당 역할
export type TaskAssignedRole = 'doctor' | 'desk' | 'treatment';

// 할일
export interface Task {
  id: number;
  treatment_record_id?: number;
  patient_id: number;

  // 할일 정보
  task_type: TaskType;
  title: string;
  description?: string;

  // 담당
  assigned_to?: string;
  assigned_role?: TaskAssignedRole;

  // 상태
  status: TaskStatus;
  priority: TaskPriority;

  // 일정
  due_date?: string;
  completed_at?: string;
  completed_by?: string;

  // 트리거 정보
  trigger_service?: string;

  // 타임스탬프
  created_at: string;
  updated_at: string;

  // 조인된 데이터
  patient_name?: string;
  patient_chart_number?: string;
  treatment_date?: string;
  treatment_doctor?: string;
}

// 할일 템플릿
export interface TaskTemplate {
  id: number;
  trigger_service: string;
  task_type: TaskType;
  title_template: string;
  description_template?: string;
  default_assigned_role?: TaskAssignedRole;
  default_priority: TaskPriority;
  due_days_offset: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// 할일 생성 입력
export interface CreateTaskInput {
  treatment_record_id?: number;
  patient_id: number;
  task_type: TaskType;
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_role?: TaskAssignedRole;
  priority?: TaskPriority;
  due_date?: string;
  trigger_service?: string;
}

// 할일 유형 한글명
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  write_initial_chart: '초진차트 작성',
  write_progress_note: '경과기록 작성',
  write_prescription: '처방전 작성',
  write_dosage_instruction: '복용법 작성',
  order_herbal_medicine: '한약 주문',
  patient_callback: '환자 콜백',
  review_test_result: '검사결과 확인',
  other: '기타',
};

// 우선순위 한글명
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급',
};

// 상태 한글명
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  canceled: '취소',
};
