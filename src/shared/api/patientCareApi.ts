/**
 * 환자관리 API
 * 해피콜, 치료 종결, 정기 관리 메시지 등
 */

import { supabase } from '@shared/lib/supabase';
import type {
  PatientCareItem,
  PatientCareType,
  PatientCareStatus,
  PatientTreatmentStatus,
  TreatmentStatusType,
  PatientCareRule,
  CreatePatientCareItemInput,
  ClosureType,
} from '@shared/types/patientCare';

// ============================================
// 환자 관리 항목 CRUD
// ============================================

/**
 * 오늘의 환자관리 목록 조회 (뷰 사용)
 */
export async function fetchTodayPatientCare(): Promise<PatientCareItem[]> {
  const { data, error } = await supabase
    .from('today_patient_care')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('오늘의 환자관리 조회 오류:', error);
    throw error;
  }

  return data || [];
}

/**
 * 관리 필요 환자 목록 조회 (30일 이상 미방문)
 */
export async function fetchPatientsNeedFollowup(): Promise<any[]> {
  const { data, error } = await supabase
    .from('patients_need_followup')
    .select('*')
    .order('days_since_last_visit', { ascending: false, nullsFirst: true });

  if (error) {
    console.error('관리 필요 환자 조회 오류:', error);
    throw error;
  }

  return data || [];
}

/**
 * 환자별 관리 항목 조회
 */
export async function fetchPatientCareItems(
  patientId: number,
  options?: {
    status?: PatientCareStatus;
    careType?: PatientCareType;
    limit?: number;
  }
): Promise<PatientCareItem[]> {
  let query = supabase
    .from('patient_care_items')
    .select(`
      *,
      patients!inner(name, chart_number, phone)
    `)
    .eq('patient_id', patientId)
    .order('scheduled_date', { ascending: true, nullsFirst: true });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.careType) {
    query = query.eq('care_type', options.careType);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('환자 관리 항목 조회 오류:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    patient_name: item.patients?.name,
    patient_chart_number: item.patients?.chart_number,
    patient_phone: item.patients?.phone,
  }));
}

/**
 * 관리 항목 생성
 */
export async function createPatientCareItem(
  input: CreatePatientCareItemInput
): Promise<PatientCareItem> {
  const { data, error } = await supabase
    .from('patient_care_items')
    .insert({
      patient_id: input.patient_id,
      treatment_record_id: input.treatment_record_id,
      care_type: input.care_type,
      title: input.title,
      description: input.description,
      scheduled_date: input.scheduled_date,
      trigger_type: input.trigger_type || 'manual',
      trigger_source: input.trigger_source,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('관리 항목 생성 오류:', error);
    throw error;
  }

  return data;
}

/**
 * 관리 항목 완료
 */
export async function completePatientCareItem(
  itemId: number,
  completedBy?: string,
  result?: string
): Promise<void> {
  const { error } = await supabase
    .from('patient_care_items')
    .update({
      status: 'completed',
      completed_date: new Date().toISOString(),
      completed_by: completedBy,
      result: result,
    })
    .eq('id', itemId);

  if (error) {
    console.error('관리 항목 완료 오류:', error);
    throw error;
  }
}

/**
 * 관리 항목 건너뛰기
 */
export async function skipPatientCareItem(
  itemId: number,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('patient_care_items')
    .update({
      status: 'skipped',
      result: reason,
    })
    .eq('id', itemId);

  if (error) {
    console.error('관리 항목 건너뛰기 오류:', error);
    throw error;
  }
}

/**
 * 관리 항목 일정 변경
 */
export async function reschedulePatientCareItem(
  itemId: number,
  newDate: string
): Promise<void> {
  const { error } = await supabase
    .from('patient_care_items')
    .update({
      scheduled_date: newDate,
      status: 'scheduled',
    })
    .eq('id', itemId);

  if (error) {
    console.error('관리 항목 일정 변경 오류:', error);
    throw error;
  }
}

// ============================================
// 환자 치료 상태 관리
// ============================================

/**
 * 환자 치료 상태 조회
 */
export async function fetchPatientTreatmentStatus(
  patientId: number
): Promise<PatientTreatmentStatus | null> {
  const { data, error } = await supabase
    .from('patient_treatment_status')
    .select('*')
    .eq('patient_id', patientId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('환자 치료 상태 조회 오류:', error);
    throw error;
  }

  return data;
}

/**
 * 환자 치료 상태 생성/업데이트 (upsert)
 */
export async function upsertPatientTreatmentStatus(
  patientId: number,
  updates: Partial<Omit<PatientTreatmentStatus, 'id' | 'patient_id' | 'created_at' | 'updated_at'>>
): Promise<PatientTreatmentStatus> {
  const { data, error } = await supabase
    .from('patient_treatment_status')
    .upsert({
      patient_id: patientId,
      ...updates,
    }, {
      onConflict: 'patient_id',
    })
    .select()
    .single();

  if (error) {
    console.error('환자 치료 상태 업데이트 오류:', error);
    throw error;
  }

  return data;
}

/**
 * 환자 방문 기록 업데이트 (내원 시 호출)
 */
export async function recordPatientVisit(patientId: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // 기존 상태 조회
  const existing = await fetchPatientTreatmentStatus(patientId);

  if (existing) {
    await supabase
      .from('patient_treatment_status')
      .update({
        total_visits: existing.total_visits + 1,
        last_visit_date: today,
        status: 'active', // 방문하면 active로 변경
      })
      .eq('patient_id', patientId);
  } else {
    await supabase
      .from('patient_treatment_status')
      .insert({
        patient_id: patientId,
        status: 'active',
        start_date: today,
        total_visits: 1,
        last_visit_date: today,
      });
  }
}

/**
 * 환자 치료 종결 처리
 */
export async function closeTreatment(
  patientId: number,
  closureType: ClosureType,
  reason?: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('patient_treatment_status')
    .update({
      status: 'completed',
      end_date: today,
      closure_type: closureType,
      closure_reason: reason,
    })
    .eq('patient_id', patientId);

  if (error) {
    console.error('치료 종결 처리 오류:', error);
    throw error;
  }
}

/**
 * 환자 치료 재개
 */
export async function resumeTreatment(patientId: number): Promise<void> {
  const { error } = await supabase
    .from('patient_treatment_status')
    .update({
      status: 'active',
      end_date: null,
      closure_type: null,
      closure_reason: null,
    })
    .eq('patient_id', patientId);

  if (error) {
    console.error('치료 재개 오류:', error);
    throw error;
  }
}

// ============================================
// 자동 관리 항목 생성
// ============================================

/**
 * 관리 규칙 목록 조회
 */
export async function fetchPatientCareRules(
  activeOnly: boolean = true
): Promise<PatientCareRule[]> {
  let query = supabase
    .from('patient_care_rules')
    .select('*')
    .order('name');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('관리 규칙 조회 오류:', error);
    throw error;
  }

  return data || [];
}

/**
 * 트리거 이벤트에 따른 자동 관리 항목 생성
 */
export async function createCareItemsFromTrigger(
  patientId: number,
  patientName: string,
  triggerEvent: string,
  options?: {
    treatmentRecordId?: number;
  }
): Promise<PatientCareItem[]> {
  // 해당 트리거에 맞는 규칙 조회
  const { data: rules, error: rulesError } = await supabase
    .from('patient_care_rules')
    .select('*')
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true);

  if (rulesError) {
    console.error('규칙 조회 오류:', rulesError);
    throw rulesError;
  }

  if (!rules || rules.length === 0) {
    return [];
  }

  const createdItems: PatientCareItem[] = [];

  for (const rule of rules) {
    // 예정일 계산
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + rule.days_offset);

    // 제목 템플릿 치환
    const title = rule.title_template.replace('{patient_name}', patientName);
    const description = rule.description_template?.replace('{patient_name}', patientName);

    const item = await createPatientCareItem({
      patient_id: patientId,
      treatment_record_id: options?.treatmentRecordId,
      care_type: rule.care_type,
      title,
      description,
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      trigger_type: 'auto',
      trigger_source: triggerEvent,
    });

    createdItems.push(item);
  }

  console.log(`✅ [환자관리] ${triggerEvent} 트리거로 ${createdItems.length}개 관리 항목 생성`);
  return createdItems;
}

/**
 * 한약 배송 시 해피콜 항목 생성
 */
export async function createDeliveryHappyCall(
  patientId: number,
  patientName: string,
  deliveryDate: string,
  treatmentRecordId?: number
): Promise<PatientCareItem> {
  // 배송 다음날 해피콜
  const scheduledDate = new Date(deliveryDate);
  scheduledDate.setDate(scheduledDate.getDate() + 1);

  return createPatientCareItem({
    patient_id: patientId,
    treatment_record_id: treatmentRecordId,
    care_type: 'happy_call_delivery',
    title: `${patientName} 한약 배송 해피콜`,
    description: '한약이 잘 도착했는지, 복용법을 이해하셨는지 확인해주세요.',
    scheduled_date: scheduledDate.toISOString().split('T')[0],
    trigger_type: 'auto',
    trigger_source: 'herbal_delivery',
  });
}

/**
 * 복약 중 해피콜 항목 생성 (복약 7일차)
 */
export async function createMedicationHappyCall(
  patientId: number,
  patientName: string,
  startDate: string,
  treatmentRecordId?: number
): Promise<PatientCareItem> {
  // 복약 시작 7일 후 해피콜
  const scheduledDate = new Date(startDate);
  scheduledDate.setDate(scheduledDate.getDate() + 7);

  return createPatientCareItem({
    patient_id: patientId,
    treatment_record_id: treatmentRecordId,
    care_type: 'happy_call_medication',
    title: `${patientName} 복약 7일차 해피콜`,
    description: '복약 중 불편한 점이 없는지 확인해주세요.',
    scheduled_date: scheduledDate.toISOString().split('T')[0],
    trigger_type: 'auto',
    trigger_source: 'herbal_start',
  });
}

// ============================================
// 통계 및 리포트
// ============================================

/**
 * 환자관리 통계 조회
 */
export async function fetchPatientCareStats(): Promise<{
  pending: number;
  scheduled: number;
  completed_today: number;
  overdue: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  // 대기 중
  const { count: pending } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // 예정됨
  const { count: scheduled } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'scheduled');

  // 오늘 완료
  const { count: completedToday } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_date', `${today}T00:00:00`)
    .lt('completed_date', `${today}T23:59:59`);

  // 기한 초과 (pending이면서 scheduled_date가 오늘 이전)
  const { count: overdue } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'scheduled'])
    .lt('scheduled_date', today);

  return {
    pending: pending || 0,
    scheduled: scheduled || 0,
    completed_today: completedToday || 0,
    overdue: overdue || 0,
  };
}

/**
 * 환자별 치료 요약 통계
 */
export async function fetchTreatmentSummary(patientId: number): Promise<{
  status: PatientTreatmentStatus | null;
  pendingCareItems: number;
  completedCareItems: number;
}> {
  const status = await fetchPatientTreatmentStatus(patientId);

  const { count: pendingCareItems } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .in('status', ['pending', 'scheduled']);

  const { count: completedCareItems } = await supabase
    .from('patient_care_items')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('status', 'completed');

  return {
    status,
    pendingCareItems: pendingCareItems || 0,
    completedCareItems: completedCareItems || 0,
  };
}
