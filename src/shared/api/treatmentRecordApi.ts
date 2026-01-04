/**
 * 진료내역 API
 */

import { query, queryOne, execute, insert, escapeString, getCurrentDate, getCurrentTimestamp } from '@shared/lib/postgres';
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
  const now = getCurrentTimestamp();
  const today = getCurrentDate();

  const id = await insert(`
    INSERT INTO treatment_records (patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at)
    VALUES (${input.patient_id}, ${escapeString(input.treatment_date || today)}, ${escapeString(input.visit_type || 'follow_up')},
            ${escapeString(input.memo || '')}, NULL, ${escapeString(input.doctor_name || '')},
            ${escapeString(now)}, ${escapeString(now)})
  `);

  // id가 0이면 방금 삽입한 레코드를 patient_id + created_at으로 조회
  let data: any = null;
  if (id > 0) {
    data = await queryOne<any>(`SELECT * FROM treatment_records WHERE id = ${id}`);
  }

  // fallback: id가 0이거나 조회 실패 시 최근 삽입 레코드 조회
  if (!data) {
    data = await queryOne<any>(`
      SELECT * FROM treatment_records
      WHERE patient_id = ${input.patient_id} AND record_date = ${escapeString(today)}
      ORDER BY id DESC LIMIT 1
    `);
  }

  if (!data) {
    throw new Error('진료내역 생성 실패: 레코드를 찾을 수 없습니다');
  }

  console.log('✅ 진료내역 생성 완료, ID:', data.id);
  return mapTreatmentRecord(data);
}

/**
 * 진료내역 조회 (ID)
 */
export async function fetchTreatmentRecordById(id: number): Promise<TreatmentRecord | null> {
  const data = await queryOne<any>(`
    SELECT tr.*, p.name as patient_name, p.chart_number
    FROM treatment_records tr
    LEFT JOIN patients p ON tr.patient_id = p.id
    WHERE tr.id = ${id}
  `);

  if (!data) return null;

  // 타임라인 이벤트 조회
  const events = await query<any>(`
    SELECT * FROM treatment_timeline_events WHERE patient_id = ${data.patient_id} ORDER BY event_time ASC
  `);

  return mapTreatmentRecordWithRelations(data, events);
}

/**
 * 오늘 진료내역 조회
 */
export async function fetchTodayTreatmentRecords(): Promise<TreatmentRecord[]> {
  const today = getCurrentDate();
  return fetchTreatmentRecordsByDate(today);
}

/**
 * 날짜별 진료내역 조회
 */
export async function fetchTreatmentRecordsByDate(date: string): Promise<TreatmentRecord[]> {
  const data = await query<any>(`
    SELECT tr.*, p.name as patient_name, p.chart_number
    FROM treatment_records tr
    LEFT JOIN patients p ON tr.patient_id = p.id
    WHERE tr.record_date = ${escapeString(date)}
    ORDER BY tr.created_at ASC
  `);

  return data.map(d => mapTreatmentRecord(d));
}

/**
 * 환자별 진료내역 조회
 */
export async function fetchTreatmentRecordsByPatient(patientId: number): Promise<TreatmentRecord[]> {
  const data = await query<any>(`
    SELECT tr.*, p.name as patient_name, p.chart_number
    FROM treatment_records tr
    LEFT JOIN patients p ON tr.patient_id = p.id
    WHERE tr.patient_id = ${patientId}
    ORDER BY tr.record_date DESC
  `);

  return data.map(d => mapTreatmentRecord(d));
}

/**
 * 환자의 오늘 진행 중인 진료내역 조회 (있으면 반환, 없으면 null)
 */
export async function fetchActiveRecordForPatient(patientId: number): Promise<TreatmentRecord | null> {
  const today = getCurrentDate();

  const data = await queryOne<any>(`
    SELECT tr.*, p.name as patient_name, p.chart_number
    FROM treatment_records tr
    LEFT JOIN patients p ON tr.patient_id = p.id
    WHERE tr.patient_id = ${patientId}
    AND tr.record_date = ${escapeString(today)}
    ORDER BY tr.created_at DESC
    LIMIT 1
  `);

  if (!data) return null;
  return mapTreatmentRecord(data);
}

/**
 * 진료내역 업데이트
 */
export async function updateTreatmentRecord(
  id: number,
  updates: Partial<TreatmentRecord>
): Promise<void> {
  const now = getCurrentTimestamp();
  const updateParts: string[] = [];

  if (updates.doctor_name !== undefined) updateParts.push(`doctor_name = ${escapeString(updates.doctor_name || '')}`);
  if (updates.memo !== undefined) updateParts.push(`content = ${escapeString(updates.memo || '')}`);
  updateParts.push(`updated_at = ${escapeString(now)}`);

  await execute(`UPDATE treatment_records SET ${updateParts.join(', ')} WHERE id = ${id}`);
}

/**
 * 진료내역 완료 처리
 */
export async function completeTreatmentRecord(id: number): Promise<void> {
  // 상태 필드가 없으므로 로그만 남김
  console.log(`진료내역 완료 처리 (id: ${id})`);
}

/**
 * 타임라인 이벤트 추가
 */
export async function addTimelineEvent(
  input: CreateTimelineEventInput
): Promise<TimelineEvent> {
  const now = getCurrentTimestamp();

  // treatment_record에서 patient_id 조회
  const record = await queryOne<{ patient_id: number }>(`SELECT patient_id FROM treatment_records WHERE id = ${input.treatment_record_id}`);
  const patientId = record?.patient_id || 0;

  await execute(`
    INSERT INTO treatment_timeline_events (patient_id, event_type, event_time, details, created_at)
    VALUES (${patientId}, ${escapeString(input.event_type)}, ${escapeString(input.timestamp || now)},
            ${escapeString(JSON.stringify({ location: input.location, staff_name: input.staff_name, memo: input.memo }))},
            ${escapeString(now)})
  `);

  console.log(`✅ 타임라인 이벤트 추가: ${input.event_type}`);

  // 방금 삽입한 데이터 조회 (patient_id + event_type + event_time으로 특정)
  const data = await queryOne<any>(`
    SELECT * FROM treatment_timeline_events
    WHERE patient_id = ${patientId} AND event_type = ${escapeString(input.event_type)}
    ORDER BY id DESC LIMIT 1
  `);
  return mapTimelineEvent(data);
}

/**
 * 진료내역의 타임라인 이벤트 조회
 */
export async function fetchTimelineEvents(treatmentRecordId: number): Promise<TimelineEvent[]> {
  // treatment_record에서 patient_id 조회
  const record = await queryOne<{ patient_id: number }>(`SELECT patient_id FROM treatment_records WHERE id = ${treatmentRecordId}`);
  if (!record) return [];

  const data = await query<any>(`
    SELECT * FROM treatment_timeline_events
    WHERE patient_id = ${record.patient_id}
    ORDER BY event_time ASC
  `);

  return data.map(mapTimelineEvent);
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
    treatment_date: data.record_date,
    doctor_name: data.doctor_name,
    treatment_room: undefined,
    visit_type: data.record_type,
    services: [],
    treatment_items: [],
    reservation_id: undefined,
    payment_id: undefined,
    status: 'in_progress',
    memo: data.content,
    created_at: data.created_at,
    updated_at: data.updated_at,
    patient_name: data.patient_name,
    chart_number: data.chart_number,
  };
}

function mapTreatmentRecordWithRelations(data: any, events: any[]): TreatmentRecord {
  const record = mapTreatmentRecord(data);

  if (events && events.length > 0) {
    record.timeline_events = events
      .map(mapTimelineEvent)
      .sort((a: TimelineEvent, b: TimelineEvent) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  return record;
}

function mapTimelineEvent(data: any): TimelineEvent | null {
  if (!data) return null;

  let details: any = {};
  try {
    details = data.details ? JSON.parse(data.details) : {};
  } catch {}

  return {
    id: data.id,
    treatment_record_id: 0, // 원래 구조와 다르므로 0
    event_type: data.event_type,
    timestamp: data.event_time,
    location: details.location,
    staff_name: details.staff_name,
    memo: details.memo,
    created_at: data.created_at,
  };
}
