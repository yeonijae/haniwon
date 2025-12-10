/**
 * 치료관리 모듈 - API 클라이언트
 * SQLite 직접 연결
 */

import { Patient, TreatmentRoom, TreatmentItem, SessionTreatment, DefaultTreatment } from '../types';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/sqlite';

/**
 * 환자 관련 API
 */

// 환자 검색 (서버사이드)
export async function searchPatients(searchTerm: string): Promise<Patient[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const term = searchTerm.trim();
  const data = await query<any>(`
    SELECT * FROM patients
    WHERE name LIKE '%${term}%' OR chart_number LIKE '%${term}%'
    ORDER BY id ASC
  `);

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    chartNumber: p.chart_number || '',
    status: 'COMPLETED' as any,
    time: '',
    details: '',
    dob: p.birth_date || undefined,
    gender: p.gender as 'male' | 'female' | undefined,
    phone: p.phone || undefined,
    address: undefined,
    referralPath: undefined,
    registrationDate: p.created_at || undefined,
  }));
}

// 개별 환자 조회 (ID로)
export async function fetchPatientById(patientId: number): Promise<Patient | null> {
  const data = await queryOne<any>(`SELECT * FROM patients WHERE id = ${patientId}`);

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    chartNumber: data.chart_number || '',
    status: 'COMPLETED' as any,
    time: '',
    details: '',
    dob: data.birth_date || undefined,
    gender: data.gender as 'male' | 'female' | undefined,
    phone: data.phone || undefined,
    address: undefined,
    referralPath: undefined,
    registrationDate: data.created_at || undefined,
  };
}

/**
 * 환자 기본 치료 관련 API
 */

// 환자의 기본 치료 조회
export async function fetchPatientDefaultTreatments(patientId: number): Promise<DefaultTreatment[]> {
  const data = await query<any>(`
    SELECT * FROM patient_default_treatments
    WHERE patient_id = ${patientId}
    ORDER BY id ASC
  `);

  return data.map((t) => ({
    name: t.treatment_name,
    duration: t.duration,
    memo: '',
  }));
}

// 환자 기본 치료 저장
export async function savePatientDefaultTreatments(
  patientId: number,
  treatments: DefaultTreatment[]
): Promise<void> {
  // 기존 치료 삭제
  await execute(`DELETE FROM patient_default_treatments WHERE patient_id = ${patientId}`);

  // 새 치료 추가
  for (const t of treatments) {
    await execute(`
      INSERT INTO patient_default_treatments (patient_id, treatment_name, duration)
      VALUES (${patientId}, ${escapeString(t.name)}, ${t.duration})
    `);
  }
}

/**
 * 치료실 관리 API
 */

// 모든 치료실 조회 (session_treatments 별도 테이블에서 조인)
export async function fetchTreatmentRooms(): Promise<TreatmentRoom[]> {
  const rooms = await query<any>(`
    SELECT * FROM treatment_rooms ORDER BY display_order ASC, id ASC
  `);

  // 각 room에 대해 session_treatments 조회
  const result: TreatmentRoom[] = [];

  for (const room of rooms) {
    const sessionTreatments = await query<any>(`
      SELECT * FROM session_treatments WHERE room_id = ${room.id} ORDER BY display_order ASC
    `);

    result.push({
      id: room.id,
      name: room.name,
      status: room.status,
      sessionId: room.session_id,
      patientId: room.patient_id,
      patientName: room.patient_name,
      patientChartNumber: room.patient_chart_number,
      patientGender: room.patient_gender,
      patientDob: room.patient_dob,
      doctorName: room.doctor_name,
      inTime: room.in_time,
      sessionTreatments: sessionTreatments.map((st: any) => ({
        id: st.id,
        name: st.treatment_name,
        status: st.status,
        duration: st.duration,
        startTime: st.started_at ? (st.started_at.endsWith('Z') ? st.started_at : st.started_at + 'Z') : null,
        elapsedSeconds: st.elapsed_seconds || 0,
        memo: st.memo,
      })),
    });
  }

  return result;
}

// 치료실 업데이트 (전체) - session_treatments는 별도 처리
export async function updateTreatmentRoom(roomId: number, room: Partial<TreatmentRoom>): Promise<void> {
  // 1. 치료실 기본 정보 업데이트
  const updateParts: string[] = [];
  if (room.status !== undefined) updateParts.push(`status = ${escapeString(room.status)}`);
  if (room.sessionId !== undefined) updateParts.push(`session_id = ${toSqlValue(room.sessionId)}`);
  if (room.patientId !== undefined) updateParts.push(`patient_id = ${toSqlValue(room.patientId)}`);
  if (room.patientName !== undefined) updateParts.push(`patient_name = ${escapeString(room.patientName || '')}`);
  if (room.patientChartNumber !== undefined) updateParts.push(`patient_chart_number = ${escapeString(room.patientChartNumber || '')}`);
  if (room.patientGender !== undefined) updateParts.push(`patient_gender = ${escapeString(room.patientGender || '')}`);
  if (room.patientDob !== undefined) updateParts.push(`patient_dob = ${escapeString(room.patientDob || '')}`);
  if (room.doctorName !== undefined) updateParts.push(`doctor_name = ${escapeString(room.doctorName || '')}`);
  if (room.inTime !== undefined) updateParts.push(`in_time = ${escapeString(room.inTime || '')}`);
  updateParts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  if (updateParts.length > 0) {
    await execute(`UPDATE treatment_rooms SET ${updateParts.join(', ')} WHERE id = ${roomId}`);
  }

  // 2. session_treatments 업데이트 (별도 테이블)
  if (room.sessionTreatments !== undefined) {
    // 기존 것 삭제하고 새로 추가 (간단한 방식)
    await execute(`DELETE FROM session_treatments WHERE room_id = ${roomId}`);

    for (let i = 0; i < room.sessionTreatments.length; i++) {
      const st = room.sessionTreatments[i];
      await execute(`
        INSERT INTO session_treatments (room_id, treatment_name, duration, status, started_at, completed_at, display_order)
        VALUES (${roomId}, ${escapeString(st.name)}, ${st.duration}, ${escapeString(st.status)},
                ${st.startTime ? escapeString(st.startTime) : 'NULL'}, NULL, ${i})
      `);
    }
  }
}

// 치료실 초기화 (환자 배정 해제)
export async function clearTreatmentRoom(roomId: number): Promise<void> {
  // 세션 치료 항목 먼저 삭제
  await execute(`DELETE FROM session_treatments WHERE room_id = ${roomId}`);

  // 치료실 초기화
  await execute(`
    UPDATE treatment_rooms SET
      status = '사용가능',
      session_id = NULL,
      patient_id = NULL,
      patient_name = NULL,
      patient_chart_number = NULL,
      doctor_name = NULL,
      in_time = NULL,
      updated_at = ${escapeString(getCurrentTimestamp())}
    WHERE id = ${roomId}
  `);
}

/**
 * 치료항목 관리 API
 */

// 치료항목 조회
export async function fetchTreatmentItems(): Promise<TreatmentItem[]> {
  const data = await query<any>(`
    SELECT * FROM treatment_items WHERE is_active = 1 ORDER BY display_order ASC, id ASC
  `);

  return data.map((item) => ({
    id: item.id,
    name: item.name,
    defaultDuration: item.default_duration,
    displayOrder: item.display_order ?? 0,
  }));
}

// 치료항목 생성
export async function createTreatmentItem(item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  const id = await insert(`
    INSERT INTO treatment_items (name, default_duration, display_order, is_active)
    VALUES (${escapeString(item.name)}, ${item.defaultDuration}, ${item.displayOrder || 0}, 1)
  `);

  const data = await queryOne<any>(`SELECT * FROM treatment_items WHERE id = ${id}`);

  return {
    id: data.id,
    name: data.name,
    defaultDuration: data.default_duration,
    displayOrder: data.display_order ?? 0,
  };
}

// 치료항목 수정
export async function updateTreatmentItem(id: number, item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  await execute(`
    UPDATE treatment_items SET
      name = ${escapeString(item.name)},
      default_duration = ${item.defaultDuration},
      display_order = ${item.displayOrder || 0}
    WHERE id = ${id}
  `);

  const data = await queryOne<any>(`SELECT * FROM treatment_items WHERE id = ${id}`);

  return {
    id: data.id,
    name: data.name,
    defaultDuration: data.default_duration,
    displayOrder: data.display_order ?? 0,
  };
}

// 치료항목 삭제
export async function deleteTreatmentItem(id: number): Promise<void> {
  await execute(`UPDATE treatment_items SET is_active = 0 WHERE id = ${id}`);
}

// 치료항목 순서 일괄 업데이트
export async function updateTreatmentItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  for (const item of items) {
    await execute(`UPDATE treatment_items SET display_order = ${item.displayOrder} WHERE id = ${item.id}`);
  }
}

/**
 * 대기 목록 관리 API
 * waiting_queue 테이블 사용
 */

export interface WaitingQueueItem {
  id?: number;
  patient_id: number;
  queue_type: 'consultation' | 'treatment';
  details: string;
  position: number;
  created_at?: string;
}

// 대기 목록 조회
export async function fetchWaitingQueue(queueType: 'consultation' | 'treatment'): Promise<WaitingQueueItem[]> {
  const data = await query<any>(`
    SELECT * FROM waiting_queue
    WHERE queue_type = ${escapeString(queueType)}
    ORDER BY position ASC
  `);

  return data;
}

// 대기 목록에 환자 추가
export async function addToWaitingQueue(item: Omit<WaitingQueueItem, 'id' | 'created_at'>): Promise<WaitingQueueItem> {
  // 현재 최대 position 조회
  const maxData = await queryOne<{ position: number }>(`
    SELECT MAX(position) as position FROM waiting_queue WHERE queue_type = ${escapeString(item.queue_type)}
  `);

  const nextPosition = (maxData?.position ?? -1) + 1;

  const id = await insert(`
    INSERT INTO waiting_queue (patient_id, queue_type, details, position)
    VALUES (${item.patient_id}, ${escapeString(item.queue_type)}, ${escapeString(item.details)}, ${nextPosition})
  `);

  const data = await queryOne<any>(`SELECT * FROM waiting_queue WHERE id = ${id}`);
  return data;
}

// 대기 목록에서 환자 제거
export async function removeFromWaitingQueue(patientId: number, queueType: 'consultation' | 'treatment'): Promise<void> {
  await execute(`
    DELETE FROM waiting_queue
    WHERE patient_id = ${patientId} AND queue_type = ${escapeString(queueType)}
  `);
}

/**
 * 결제(수납) 관련 API
 */

// 수납 대기 생성
export async function createPayment(patientId: number): Promise<number> {
  console.log('🔍 수납 대기 생성 시도 - patientId:', patientId);

  // payments 테이블이 아직 스키마에 없으므로 로그만 남김
  // 추후 payments 테이블 추가시 구현
  console.log('⚠️ payments 테이블 미구현, 임시 ID 반환');
  return 0;
}
