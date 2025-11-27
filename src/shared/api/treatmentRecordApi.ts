/**
 * 진료내역 API
 */

import { supabase } from '@shared/lib/supabase';
import type {
  TreatmentRecord,
  TimelineEvent,
  CreateTreatmentRecordInput,
  CreateTimelineEventInput,
  TimelineEventType,
  WaitingTimeAnalysis,
} from '@shared/types/treatmentRecord';

/**
 * 진료내역 생성
 */
export async function createTreatmentRecord(
  input: CreateTreatmentRecordInput
): Promise<TreatmentRecord> {
  const { data, error } = await supabase
    .from('treatment_records')
    .insert({
      patient_id: input.patient_id,
      treatment_date: input.treatment_date || new Date().toISOString().split('T')[0],
      doctor_name: input.doctor_name || null,
      visit_type: input.visit_type || 'follow_up',
      services: input.services || [],
      reservation_id: input.reservation_id || null,
      memo: input.memo || null,
      status: 'in_progress',
      treatment_items: [],
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 진료내역 생성 오류:', error);
    throw error;
  }

  console.log('✅ 진료내역 생성 완료, ID:', data.id);
  return mapTreatmentRecord(data);
}

/**
 * 진료내역 조회 (ID)
 */
export async function fetchTreatmentRecordById(id: number): Promise<TreatmentRecord | null> {
  const { data, error } = await supabase
    .from('treatment_records')
    .select(`
      *,
      patients (name, chart_number),
      treatment_timeline_events (*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('❌ 진료내역 조회 오류:', error);
    throw error;
  }

  return mapTreatmentRecordWithRelations(data);
}

/**
 * 오늘 진료내역 조회
 */
export async function fetchTodayTreatmentRecords(): Promise<TreatmentRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  return fetchTreatmentRecordsByDate(today);
}

/**
 * 날짜별 진료내역 조회
 */
export async function fetchTreatmentRecordsByDate(date: string): Promise<TreatmentRecord[]> {
  const { data, error } = await supabase
    .from('treatment_records')
    .select(`
      *,
      patients (name, chart_number),
      treatment_timeline_events (*)
    `)
    .eq('treatment_date', date)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ 진료내역 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTreatmentRecordWithRelations);
}

/**
 * 환자별 진료내역 조회
 */
export async function fetchTreatmentRecordsByPatient(patientId: number): Promise<TreatmentRecord[]> {
  const { data, error } = await supabase
    .from('treatment_records')
    .select(`
      *,
      patients (name, chart_number),
      treatment_timeline_events (*)
    `)
    .eq('patient_id', patientId)
    .order('treatment_date', { ascending: false });

  if (error) {
    console.error('❌ 환자 진료내역 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTreatmentRecordWithRelations);
}

/**
 * 환자의 오늘 진행 중인 진료내역 조회 (있으면 반환, 없으면 null)
 */
export async function fetchActiveRecordForPatient(patientId: number): Promise<TreatmentRecord | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('treatment_records')
    .select(`
      *,
      patients (name, chart_number),
      treatment_timeline_events (*)
    `)
    .eq('patient_id', patientId)
    .eq('treatment_date', today)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('❌ 진행 중 진료내역 조회 오류:', error);
    throw error;
  }

  return mapTreatmentRecordWithRelations(data);
}

/**
 * 진료내역 업데이트
 */
export async function updateTreatmentRecord(
  id: number,
  updates: Partial<TreatmentRecord>
): Promise<void> {
  const updateData: any = {};

  if (updates.doctor_name !== undefined) updateData.doctor_name = updates.doctor_name;
  if (updates.treatment_room !== undefined) updateData.treatment_room = updates.treatment_room;
  if (updates.visit_type !== undefined) updateData.visit_type = updates.visit_type;
  if (updates.services !== undefined) updateData.services = updates.services;
  if (updates.treatment_items !== undefined) updateData.treatment_items = updates.treatment_items;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.memo !== undefined) updateData.memo = updates.memo;
  if (updates.payment_id !== undefined) updateData.payment_id = updates.payment_id;

  const { error } = await supabase
    .from('treatment_records')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('❌ 진료내역 업데이트 오류:', error);
    throw error;
  }
}

/**
 * 진료내역 완료 처리
 */
export async function completeTreatmentRecord(id: number): Promise<void> {
  await updateTreatmentRecord(id, { status: 'completed' });
}

/**
 * 타임라인 이벤트 추가
 */
export async function addTimelineEvent(
  input: CreateTimelineEventInput
): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from('treatment_timeline_events')
    .insert({
      treatment_record_id: input.treatment_record_id,
      event_type: input.event_type,
      timestamp: input.timestamp || new Date().toISOString(),
      location: input.location || null,
      staff_name: input.staff_name || null,
      memo: input.memo || null,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 타임라인 이벤트 추가 오류:', error);
    throw error;
  }

  console.log(`✅ 타임라인 이벤트 추가: ${input.event_type}`);
  return mapTimelineEvent(data);
}

/**
 * 진료내역의 타임라인 이벤트 조회
 */
export async function fetchTimelineEvents(treatmentRecordId: number): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('treatment_timeline_events')
    .select('*')
    .eq('treatment_record_id', treatmentRecordId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('❌ 타임라인 이벤트 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTimelineEvent);
}

/**
 * 대기시간 분석
 */
export async function analyzeWaitingTime(treatmentRecordId: number): Promise<WaitingTimeAnalysis | null> {
  const events = await fetchTimelineEvents(treatmentRecordId);

  if (events.length === 0) return null;

  const getEventTime = (type: TimelineEventType): Date | null => {
    const event = events.find(e => e.event_type === type);
    return event ? new Date(event.timestamp) : null;
  };

  const calcMinutes = (start: Date | null, end: Date | null): number => {
    if (!start || !end) return 0;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  const checkIn = getEventTime('check_in');
  const waitingConsultation = getEventTime('waiting_consultation');
  const consultationStart = getEventTime('consultation_start');
  const consultationEnd = getEventTime('consultation_end');
  const waitingTreatment = getEventTime('waiting_treatment');
  const treatmentStart = getEventTime('treatment_start');
  const treatmentEnd = getEventTime('treatment_end');
  const waitingPayment = getEventTime('waiting_payment');
  const paymentComplete = getEventTime('payment_complete');
  const checkOut = getEventTime('check_out');

  const consultationWait = calcMinutes(waitingConsultation, consultationStart);
  const treatmentWait = calcMinutes(waitingTreatment, treatmentStart);
  const paymentWait = calcMinutes(waitingPayment, paymentComplete);

  const consultationDuration = calcMinutes(consultationStart, consultationEnd);
  const treatmentDuration = calcMinutes(treatmentStart, treatmentEnd);

  const totalWait = consultationWait + treatmentWait + paymentWait;
  const totalService = consultationDuration + treatmentDuration;
  const totalDuration = calcMinutes(checkIn, checkOut);

  return {
    treatment_record_id: treatmentRecordId,
    consultation_wait_minutes: consultationWait,
    treatment_wait_minutes: treatmentWait,
    payment_wait_minutes: paymentWait,
    total_wait_minutes: totalWait,
    total_service_minutes: totalService,
    total_duration_minutes: totalDuration,
  };
}

/**
 * 환자 체크인 (진료내역 생성 + check_in 이벤트)
 */
export async function checkInPatient(
  patientId: number,
  options?: {
    doctorName?: string;
    visitType?: 'initial' | 'follow_up' | 'medication' | 'treatment_only';
    reservationId?: string;
  }
): Promise<TreatmentRecord> {
  // 1. 진료내역 생성
  const record = await createTreatmentRecord({
    patient_id: patientId,
    doctor_name: options?.doctorName,
    visit_type: options?.visitType,
    reservation_id: options?.reservationId,
  });

  // 2. check_in 이벤트 추가
  await addTimelineEvent({
    treatment_record_id: record.id,
    event_type: 'check_in',
  });

  return record;
}

// =====================================================
// 매핑 헬퍼 함수
// =====================================================

function mapTreatmentRecord(data: any): TreatmentRecord {
  return {
    id: data.id,
    patient_id: data.patient_id,
    treatment_date: data.treatment_date,
    doctor_name: data.doctor_name,
    treatment_room: data.treatment_room,
    visit_type: data.visit_type,
    services: data.services || [],
    treatment_items: data.treatment_items || [],
    reservation_id: data.reservation_id,
    payment_id: data.payment_id,
    status: data.status,
    memo: data.memo,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function mapTreatmentRecordWithRelations(data: any): TreatmentRecord {
  const record = mapTreatmentRecord(data);

  if (data.patients) {
    record.patient_name = data.patients.name;
    record.chart_number = data.patients.chart_number;
  }

  if (data.treatment_timeline_events) {
    record.timeline_events = data.treatment_timeline_events
      .map(mapTimelineEvent)
      .sort((a: TimelineEvent, b: TimelineEvent) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  return record;
}

function mapTimelineEvent(data: any): TimelineEvent {
  return {
    id: data.id,
    treatment_record_id: data.treatment_record_id,
    event_type: data.event_type,
    timestamp: data.timestamp,
    location: data.location,
    staff_name: data.staff_name,
    memo: data.memo,
    created_at: data.created_at,
  };
}
