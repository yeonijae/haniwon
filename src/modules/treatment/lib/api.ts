/**
 * 치료관리 모듈 - API 클라이언트
 * PostgreSQL 직접 연결
 */

import { Patient, TreatmentRoom, TreatmentItem, SessionTreatment, DefaultTreatment } from '../types';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/postgres';

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

  let gender = data.gender as 'male' | 'female' | undefined;
  let birthDate = data.birth_date || undefined;

  // 성별 또는 생년월일이 없으면 MSSQL에서 가져와서 업데이트
  if ((!gender || !birthDate) && data.chart_number) {
    try {
      const mssqlApiUrl = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
      const mssqlRes = await fetch(`${mssqlApiUrl}/api/patients/search?q=${data.chart_number}`);
      if (mssqlRes.ok) {
        const mssqlData = await mssqlRes.json();
        const patient = mssqlData[0];
        if (patient) {
          const updateParts: string[] = [];

          // 성별 처리
          if (!gender && (patient.sex === 'M' || patient.sex === 'F')) {
            gender = patient.sex === 'M' ? 'male' : 'female';
            updateParts.push(`gender = ${escapeString(gender)}`);
          }

          // 생년월일 처리 (MSSQL birth 형식: "Wed, 25 Dec 1985 00:00:00 GMT")
          if (!birthDate && patient.birth) {
            try {
              const parsedDate = new Date(patient.birth);
              if (!isNaN(parsedDate.getTime())) {
                birthDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
                updateParts.push(`birth_date = ${escapeString(birthDate)}`);
              }
            } catch {
              // 날짜 파싱 실패 시 무시
            }
          }

          // PostgreSQL 업데이트 (비동기)
          if (updateParts.length > 0) {
            execute(`UPDATE patients SET ${updateParts.join(', ')} WHERE id = ${patientId}`).catch(() => {});
          }
        }
      }
    } catch {
      // MSSQL 조회 실패 시 무시
    }
  }

  return {
    id: data.id,
    name: data.name,
    chartNumber: data.chart_number || '',
    status: 'COMPLETED' as any,
    time: '',
    details: '',
    dob: birthDate,
    gender,
    phone: data.phone || undefined,
    address: undefined,
    referralPath: undefined,
    registrationDate: data.created_at || undefined,
    treatmentClothing: data.treatment_clothing || undefined,
    treatmentNotes: data.treatment_notes || undefined,
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
    memo: t.memo || '',
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
      INSERT INTO patient_default_treatments (patient_id, treatment_name, duration, memo)
      VALUES (${patientId}, ${escapeString(t.name)}, ${t.duration}, ${escapeString(t.memo || '')})
    `);
  }
}

// 환자 치료 설정 저장 (환자복, 주의사항)
export async function savePatientTreatmentSettings(
  patientId: number,
  settings: { clothing?: string; notes?: string }
): Promise<void> {
  const updateParts: string[] = [];
  if (settings.clothing !== undefined) {
    updateParts.push(`treatment_clothing = ${escapeString(settings.clothing)}`);
  }
  if (settings.notes !== undefined) {
    updateParts.push(`treatment_notes = ${escapeString(settings.notes)}`);
  }
  if (updateParts.length > 0) {
    await execute(`UPDATE patients SET ${updateParts.join(', ')} WHERE id = ${patientId}`);
  }
}

/**
 * 치료실 관리 API
 */

// 모든 치료실 조회 (session_treatments 별도 테이블에서 조인)
export async function fetchTreatmentRooms(): Promise<TreatmentRoom[]> {
  // patients 테이블과 LEFT JOIN하여 성별/생년월일 정보를 보완
  const rooms = await query<any>(`
    SELECT tr.*, p.gender as patient_gender_from_patients, p.birth_date as patient_dob_from_patients
    FROM treatment_rooms tr
    LEFT JOIN patients p ON tr.patient_id = p.id
    ORDER BY tr.display_order ASC, tr.id ASC
  `);

  // 각 room에 대해 session_treatments 조회
  const result: TreatmentRoom[] = [];

  for (const room of rooms) {
    const sessionTreatments = await query<any>(`
      SELECT * FROM session_treatments WHERE room_id = ${room.id} ORDER BY display_order ASC
    `);

    // 치료실의 patient_gender가 없으면 patients 테이블에서 가져온 값 사용
    const patientGender = room.patient_gender || room.patient_gender_from_patients;
    // 치료실의 patient_dob가 없으면 patients 테이블에서 가져온 값 사용
    let patientDob = room.patient_dob || room.patient_dob_from_patients;

    const updateParts: string[] = [];

    // 성별이 누락된 경우
    if (!room.patient_gender && room.patient_gender_from_patients && room.patient_id) {
      updateParts.push(`patient_gender = ${escapeString(room.patient_gender_from_patients)}`);
    }

    // 생년월일이 누락된 경우
    if (!room.patient_dob && room.patient_dob_from_patients && room.patient_id) {
      updateParts.push(`patient_dob = ${escapeString(room.patient_dob_from_patients)}`);
    }

    // DB 업데이트 (다음 폴링부터는 정상)
    if (updateParts.length > 0) {
      execute(`
        UPDATE treatment_rooms SET ${updateParts.join(', ')}
        WHERE id = ${room.id}
      `).catch(() => {}); // 백그라운드로 업데이트
    }

    // 생년월일이 여전히 없고 차트번호가 있으면 MSSQL에서 가져오기 시도
    if (!patientDob && room.patient_chart_number && room.patient_id) {
      try {
        const mssqlApiUrl2 = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
        const mssqlRes = await fetch(`${mssqlApiUrl2}/api/patients/search?q=${room.patient_chart_number}`);
        if (mssqlRes.ok) {
          const mssqlData = await mssqlRes.json();
          const patient = mssqlData[0];
          if (patient?.birth) {
            try {
              const parsedDate = new Date(patient.birth);
              if (!isNaN(parsedDate.getTime())) {
                patientDob = parsedDate.toISOString().split('T')[0];
                // PostgreSQL patients 테이블과 치료실 테이블 모두 업데이트
                execute(`UPDATE patients SET birth_date = ${escapeString(patientDob)} WHERE id = ${room.patient_id}`).catch(() => {});
                execute(`UPDATE treatment_rooms SET patient_dob = ${escapeString(patientDob)} WHERE id = ${room.id}`).catch(() => {});
              }
            } catch {
              // 날짜 파싱 실패
            }
          }
        }
      } catch {
        // MSSQL 조회 실패
      }
    }

    result.push({
      id: room.id,
      name: room.name,
      status: room.status,
      sessionId: room.session_id,
      patientId: room.patient_id,
      patientName: room.patient_name,
      patientChartNumber: room.patient_chart_number,
      patientGender: patientGender,
      patientDob: patientDob,
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
      patientClothing: room.patient_clothing || undefined,
      patientNotes: room.patient_notes || undefined,
      idleSeconds: room.idle_seconds || 0,
      idleStartTime: room.idle_start_time || null,
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
  if (room.patientClothing !== undefined) updateParts.push(`patient_clothing = ${escapeString(room.patientClothing || '')}`);
  if (room.patientNotes !== undefined) updateParts.push(`patient_notes = ${escapeString(room.patientNotes || '')}`);
  if (room.idleSeconds !== undefined) updateParts.push(`idle_seconds = ${room.idleSeconds}`);
  if (room.idleStartTime !== undefined) updateParts.push(`idle_start_time = ${room.idleStartTime ? escapeString(room.idleStartTime) : 'NULL'}`);
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
        INSERT INTO session_treatments (room_id, treatment_name, duration, status, started_at, completed_at, elapsed_seconds, display_order, memo)
        VALUES (${roomId}, ${escapeString(st.name)}, ${st.duration}, ${escapeString(st.status)},
                ${st.startTime ? escapeString(st.startTime) : 'NULL'}, NULL, ${st.elapsedSeconds || 0}, ${i}, ${escapeString(st.memo || '')})
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
      idle_seconds = 0,
      idle_start_time = NULL,
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

  // id가 0이면 name으로 조회
  let data: any;
  if (id > 0) {
    data = await queryOne<any>(`SELECT * FROM treatment_items WHERE id = ${id}`);
  }
  if (!data) {
    data = await queryOne<any>(`SELECT * FROM treatment_items WHERE name = ${escapeString(item.name)} ORDER BY id DESC LIMIT 1`);
  }
  if (!data) {
    throw new Error('치료항목 생성 실패: 데이터를 찾을 수 없습니다');
  }

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
  doctor?: string;
  // MSSQL 동기화 필드
  patient_name?: string;
  chart_number?: string;
  age?: number;
  sex?: string;
  mssql_intotime?: string;
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
    INSERT INTO waiting_queue (patient_id, queue_type, details, position, doctor)
    VALUES (${item.patient_id}, ${escapeString(item.queue_type)}, ${escapeString(item.details)}, ${nextPosition}, ${item.doctor ? escapeString(item.doctor) : 'NULL'})
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

/**
 * 의료진(원장) 관련 API
 */

// 의료진 alias → MSSQL doctor ID 매핑 조회
// alias가 없으면 이름으로 매핑
export interface DoctorAliasMapping {
  alias: string;       // 호칭 (예: 김원장)
  name: string;        // 실제 이름 (예: 김대현)
  mssqlDoctorId: number; // MSSQL doctor ID
}

export async function fetchDoctorAliasMappings(): Promise<DoctorAliasMapping[]> {
  const data = await query<any>(`
    SELECT name, alias, mssql_doctor_id
    FROM staff
    WHERE employee_type = 'doctor'
      AND status = 'active'
      AND mssql_doctor_id IS NOT NULL
    ORDER BY name
  `);

  return (data || []).map((row) => {
    // mssql_doctor_id가 "doctor_13" 형식이면 숫자만 추출
    let doctorId = 0;
    const mssqlId = row.mssql_doctor_id || '';
    const match = mssqlId.match(/(\d+)/);
    if (match) {
      doctorId = parseInt(match[1], 10);
    }

    return {
      alias: row.alias || row.name, // alias가 없으면 이름 사용
      name: row.name,
      mssqlDoctorId: doctorId,
    };
  });
}

// 담당의 이름/alias로 doctor ID 찾기
export async function findDoctorIdByNameOrAlias(nameOrAlias: string): Promise<{ doctorId: number; doctorName: string } | null> {
  const mappings = await fetchDoctorAliasMappings();

  // 1. alias로 먼저 찾기
  let found = mappings.find(m => m.alias === nameOrAlias);

  // 2. 없으면 이름으로 찾기
  if (!found) {
    found = mappings.find(m => m.name === nameOrAlias);
  }

  if (found) {
    return {
      doctorId: found.mssqlDoctorId,
      doctorName: found.name,
    };
  }

  return null;
}
