/**
 * 치료 정보 관리 API
 * 환자별 기본 치료 정보, 당일 치료 기록, 치료 시간 로그, 액팅 시간 로그 관리
 */

import { query, queryOne, execute, insert, escapeString, toSqlValue, tableExists, isTableInitialized, markTableInitialized, getCurrentDate } from '@shared/lib/postgres';
import type {
  PatientDefaultTreatments,
  DailyTreatmentRecord,
  TreatmentTimeLog,
  ActingTimeLog,
  TreatmentTypeCode,
  ActingTypeCode,
  YakchimType,
  ActingStatus,
} from '../types';
import { TREATMENT_TYPE_INFO } from '../types';

// =====================================================
// 테이블 초기화
// =====================================================

/**
 * 치료 관련 테이블 생성
 */
export async function initTreatmentTables(): Promise<void> {
  // 이미 초기화되었으면 스킵
  if (isTableInitialized('treatment_tables')) {
    return;
  }

  // 1. patient_default_treatments (환자별 기본 치료 정보)
  const defaultTreatmentsExists = await tableExists('patient_default_treatments');
  if (!defaultTreatmentsExists) {
    await execute(`
      CREATE TABLE patient_default_treatments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL UNIQUE,
        has_acupuncture INTEGER DEFAULT 1,
        has_moxa INTEGER DEFAULT 1,
        has_hotpack INTEGER DEFAULT 1,
        has_cupping INTEGER DEFAULT 0,
        has_chuna INTEGER DEFAULT 0,
        has_ultrasound INTEGER DEFAULT 0,
        has_highfreq INTEGER DEFAULT 0,
        has_aroma INTEGER DEFAULT 0,
        yakchim_type TEXT,
        yakchim_quantity INTEGER DEFAULT 0,
        memo TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: patient_default_treatments');
  }

  // 2. daily_treatment_records (당일 치료 기록)
  const dailyRecordsExists = await tableExists('daily_treatment_records');
  if (!dailyRecordsExists) {
    await execute(`
      CREATE TABLE daily_treatment_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        patient_name TEXT,
        chart_number TEXT,
        treatment_date TEXT NOT NULL,
        reception_time TEXT,
        consultation_wait_start TEXT,
        consultation_start TEXT,
        consultation_end TEXT,
        treatment_wait_start TEXT,
        treatment_start TEXT,
        treatment_end TEXT,
        payment_time TEXT,
        has_acupuncture INTEGER DEFAULT 0,
        has_moxa INTEGER DEFAULT 0,
        has_hotpack INTEGER DEFAULT 0,
        has_cupping INTEGER DEFAULT 0,
        has_chuna INTEGER DEFAULT 0,
        has_ultrasound INTEGER DEFAULT 0,
        has_highfreq INTEGER DEFAULT 0,
        has_aroma INTEGER DEFAULT 0,
        yakchim_type TEXT,
        yakchim_quantity INTEGER DEFAULT 0,
        memo TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(patient_id, treatment_date)
      )
    `);
    console.log('Created table: daily_treatment_records');
  }

  // 3. treatment_time_logs (치료 항목별 시간 기록)
  const timeLogsExists = await tableExists('treatment_time_logs');
  if (!timeLogsExists) {
    await execute(`
      CREATE TABLE treatment_time_logs (
        id SERIAL PRIMARY KEY,
        daily_record_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        treatment_date TEXT NOT NULL,
        treatment_type TEXT NOT NULL,
        treatment_name TEXT,
        started_at TEXT,
        ended_at TEXT,
        duration_seconds INTEGER,
        room_id INTEGER,
        bed_number INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: treatment_time_logs');
  }

  // 4. acting_time_logs (액팅 시간 기록)
  const actingLogsExists = await tableExists('acting_time_logs');
  if (!actingLogsExists) {
    await execute(`
      CREATE TABLE acting_time_logs (
        id SERIAL PRIMARY KEY,
        daily_record_id INTEGER,
        patient_id INTEGER NOT NULL,
        patient_name TEXT,
        chart_number TEXT,
        treatment_date TEXT NOT NULL,
        acting_type TEXT NOT NULL,
        acting_name TEXT,
        doctor_id INTEGER,
        doctor_name TEXT,
        started_at TEXT,
        ended_at TEXT,
        duration_seconds INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: acting_time_logs');
  }

  // 5. waiting_queue 테이블에 doctor 컬럼 추가 (마이그레이션)
  try {
    await execute(`ALTER TABLE waiting_queue ADD COLUMN doctor TEXT`);
    console.log('Added column: waiting_queue.doctor');
  } catch {
    // 이미 컬럼이 존재하면 무시
  }

  markTableInitialized('treatment_tables');
}

// =====================================================
// 환자별 기본 치료 정보 (patient_default_treatments)
// =====================================================

/**
 * 환자의 기본 치료 정보 조회
 */
export async function fetchPatientDefaultTreatments(patientId: number): Promise<PatientDefaultTreatments | null> {
  const row = await queryOne<any>(`
    SELECT * FROM patient_default_treatments WHERE patient_id = ${patientId}
  `);

  if (!row) return null;

  return {
    id: row.id,
    patient_id: row.patient_id,
    has_acupuncture: !!row.has_acupuncture,
    has_moxa: !!row.has_moxa,
    has_hotpack: !!row.has_hotpack,
    has_cupping: !!row.has_cupping,
    has_chuna: !!row.has_chuna,
    has_ultrasound: !!row.has_ultrasound,
    has_highfreq: !!row.has_highfreq,
    has_aroma: !!row.has_aroma,
    yakchim_type: row.yakchim_type as YakchimType | null,
    yakchim_quantity: row.yakchim_quantity || 0,
    memo: row.memo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 환자의 기본 치료 정보 저장/업데이트
 */
export async function savePatientDefaultTreatments(
  patientId: number,
  treatments: Partial<PatientDefaultTreatments>
): Promise<number> {
  const existing = await fetchPatientDefaultTreatments(patientId);

  if (existing) {
    // UPDATE
    await execute(`
      UPDATE patient_default_treatments SET
        has_acupuncture = ${toSqlValue(treatments.has_acupuncture ?? existing.has_acupuncture)},
        has_moxa = ${toSqlValue(treatments.has_moxa ?? existing.has_moxa)},
        has_hotpack = ${toSqlValue(treatments.has_hotpack ?? existing.has_hotpack)},
        has_cupping = ${toSqlValue(treatments.has_cupping ?? existing.has_cupping)},
        has_chuna = ${toSqlValue(treatments.has_chuna ?? existing.has_chuna)},
        has_ultrasound = ${toSqlValue(treatments.has_ultrasound ?? existing.has_ultrasound)},
        has_highfreq = ${toSqlValue(treatments.has_highfreq ?? existing.has_highfreq)},
        has_aroma = ${toSqlValue(treatments.has_aroma ?? existing.has_aroma)},
        yakchim_type = ${toSqlValue(treatments.yakchim_type ?? existing.yakchim_type)},
        yakchim_quantity = ${toSqlValue(treatments.yakchim_quantity ?? existing.yakchim_quantity)},
        memo = ${toSqlValue(treatments.memo ?? existing.memo)},
        updated_at = NOW()
      WHERE patient_id = ${patientId}
    `);
    return existing.id!;
  } else {
    // INSERT
    return await insert(`
      INSERT INTO patient_default_treatments (
        patient_id,
        has_acupuncture, has_moxa, has_hotpack, has_cupping,
        has_chuna, has_ultrasound, has_highfreq, has_aroma,
        yakchim_type, yakchim_quantity, memo
      ) VALUES (
        ${patientId},
        ${toSqlValue(treatments.has_acupuncture ?? true)},
        ${toSqlValue(treatments.has_moxa ?? true)},
        ${toSqlValue(treatments.has_hotpack ?? true)},
        ${toSqlValue(treatments.has_cupping ?? false)},
        ${toSqlValue(treatments.has_chuna ?? false)},
        ${toSqlValue(treatments.has_ultrasound ?? false)},
        ${toSqlValue(treatments.has_highfreq ?? false)},
        ${toSqlValue(treatments.has_aroma ?? false)},
        ${toSqlValue(treatments.yakchim_type ?? null)},
        ${toSqlValue(treatments.yakchim_quantity ?? 0)},
        ${toSqlValue(treatments.memo ?? null)}
      )
    `);
  }
}

/**
 * 초진 환자용 기본 치료 정보 생성 (침, 물치, 핫팩)
 */
export async function createDefaultTreatmentsForNewPatient(patientId: number): Promise<number> {
  return await savePatientDefaultTreatments(patientId, {
    has_acupuncture: true,
    has_moxa: true,
    has_hotpack: true,
    has_cupping: false,
    has_chuna: false,
    has_ultrasound: false,
    has_highfreq: false,
    has_aroma: false,
    yakchim_type: null,
    yakchim_quantity: 0,
    memo: null,
  });
}

// =====================================================
// 당일 치료 기록 (daily_treatment_records)
// =====================================================

/**
 * 당일 치료 기록 조회
 */
export async function fetchDailyTreatmentRecord(
  patientId: number,
  date: string
): Promise<DailyTreatmentRecord | null> {
  const row = await queryOne<any>(`
    SELECT * FROM daily_treatment_records
    WHERE patient_id = ${patientId} AND treatment_date = ${escapeString(date)}
  `);

  if (!row) return null;

  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    chart_number: row.chart_number,
    treatment_date: row.treatment_date,
    reception_time: row.reception_time,
    consultation_wait_start: row.consultation_wait_start,
    consultation_start: row.consultation_start,
    consultation_end: row.consultation_end,
    treatment_wait_start: row.treatment_wait_start,
    treatment_start: row.treatment_start,
    treatment_end: row.treatment_end,
    payment_time: row.payment_time,
    has_acupuncture: !!row.has_acupuncture,
    has_moxa: !!row.has_moxa,
    has_hotpack: !!row.has_hotpack,
    has_cupping: !!row.has_cupping,
    has_chuna: !!row.has_chuna,
    has_ultrasound: !!row.has_ultrasound,
    has_highfreq: !!row.has_highfreq,
    has_aroma: !!row.has_aroma,
    yakchim_type: row.yakchim_type as YakchimType | null,
    yakchim_quantity: row.yakchim_quantity || 0,
    memo: row.memo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 당일 치료 기록 생성
 */
export async function createDailyTreatmentRecord(
  record: Omit<DailyTreatmentRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<number> {
  return await insert(`
    INSERT INTO daily_treatment_records (
      patient_id, patient_name, chart_number, treatment_date,
      reception_time, consultation_wait_start, consultation_start, consultation_end,
      treatment_wait_start, treatment_start, treatment_end, payment_time,
      has_acupuncture, has_moxa, has_hotpack, has_cupping,
      has_chuna, has_ultrasound, has_highfreq, has_aroma,
      yakchim_type, yakchim_quantity, memo
    ) VALUES (
      ${record.patient_id},
      ${toSqlValue(record.patient_name)},
      ${toSqlValue(record.chart_number)},
      ${escapeString(record.treatment_date)},
      ${toSqlValue(record.reception_time)},
      ${toSqlValue(record.consultation_wait_start)},
      ${toSqlValue(record.consultation_start)},
      ${toSqlValue(record.consultation_end)},
      ${toSqlValue(record.treatment_wait_start)},
      ${toSqlValue(record.treatment_start)},
      ${toSqlValue(record.treatment_end)},
      ${toSqlValue(record.payment_time)},
      ${toSqlValue(record.has_acupuncture)},
      ${toSqlValue(record.has_moxa)},
      ${toSqlValue(record.has_hotpack)},
      ${toSqlValue(record.has_cupping)},
      ${toSqlValue(record.has_chuna)},
      ${toSqlValue(record.has_ultrasound)},
      ${toSqlValue(record.has_highfreq)},
      ${toSqlValue(record.has_aroma)},
      ${toSqlValue(record.yakchim_type)},
      ${toSqlValue(record.yakchim_quantity)},
      ${toSqlValue(record.memo)}
    )
  `);
}

/**
 * 당일 치료 기록 업데이트
 */
export async function updateDailyTreatmentRecord(
  recordId: number,
  updates: Partial<DailyTreatmentRecord>
): Promise<void> {
  const setClauses: string[] = [];

  if (updates.reception_time !== undefined)
    setClauses.push(`reception_time = ${toSqlValue(updates.reception_time)}`);
  if (updates.consultation_wait_start !== undefined)
    setClauses.push(`consultation_wait_start = ${toSqlValue(updates.consultation_wait_start)}`);
  if (updates.consultation_start !== undefined)
    setClauses.push(`consultation_start = ${toSqlValue(updates.consultation_start)}`);
  if (updates.consultation_end !== undefined)
    setClauses.push(`consultation_end = ${toSqlValue(updates.consultation_end)}`);
  if (updates.treatment_wait_start !== undefined)
    setClauses.push(`treatment_wait_start = ${toSqlValue(updates.treatment_wait_start)}`);
  if (updates.treatment_start !== undefined)
    setClauses.push(`treatment_start = ${toSqlValue(updates.treatment_start)}`);
  if (updates.treatment_end !== undefined)
    setClauses.push(`treatment_end = ${toSqlValue(updates.treatment_end)}`);
  if (updates.payment_time !== undefined)
    setClauses.push(`payment_time = ${toSqlValue(updates.payment_time)}`);
  if (updates.has_acupuncture !== undefined)
    setClauses.push(`has_acupuncture = ${toSqlValue(updates.has_acupuncture)}`);
  if (updates.has_moxa !== undefined)
    setClauses.push(`has_moxa = ${toSqlValue(updates.has_moxa)}`);
  if (updates.has_hotpack !== undefined)
    setClauses.push(`has_hotpack = ${toSqlValue(updates.has_hotpack)}`);
  if (updates.has_cupping !== undefined)
    setClauses.push(`has_cupping = ${toSqlValue(updates.has_cupping)}`);
  if (updates.has_chuna !== undefined)
    setClauses.push(`has_chuna = ${toSqlValue(updates.has_chuna)}`);
  if (updates.has_ultrasound !== undefined)
    setClauses.push(`has_ultrasound = ${toSqlValue(updates.has_ultrasound)}`);
  if (updates.has_highfreq !== undefined)
    setClauses.push(`has_highfreq = ${toSqlValue(updates.has_highfreq)}`);
  if (updates.has_aroma !== undefined)
    setClauses.push(`has_aroma = ${toSqlValue(updates.has_aroma)}`);
  if (updates.yakchim_type !== undefined)
    setClauses.push(`yakchim_type = ${toSqlValue(updates.yakchim_type)}`);
  if (updates.yakchim_quantity !== undefined)
    setClauses.push(`yakchim_quantity = ${toSqlValue(updates.yakchim_quantity)}`);
  if (updates.memo !== undefined)
    setClauses.push(`memo = ${toSqlValue(updates.memo)}`);

  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length > 0) {
    await execute(`
      UPDATE daily_treatment_records SET ${setClauses.join(', ')}
      WHERE id = ${recordId}
    `);
  }
}

/**
 * 특정 날짜의 모든 치료 기록 조회
 */
export async function fetchDailyTreatmentRecordsByDate(date: string): Promise<DailyTreatmentRecord[]> {
  const rows = await query<any>(`
    SELECT * FROM daily_treatment_records
    WHERE treatment_date = ${escapeString(date)}
    ORDER BY reception_time ASC
  `);

  return rows.map(row => ({
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    chart_number: row.chart_number,
    treatment_date: row.treatment_date,
    reception_time: row.reception_time,
    consultation_wait_start: row.consultation_wait_start,
    consultation_start: row.consultation_start,
    consultation_end: row.consultation_end,
    treatment_wait_start: row.treatment_wait_start,
    treatment_start: row.treatment_start,
    treatment_end: row.treatment_end,
    payment_time: row.payment_time,
    has_acupuncture: !!row.has_acupuncture,
    has_moxa: !!row.has_moxa,
    has_hotpack: !!row.has_hotpack,
    has_cupping: !!row.has_cupping,
    has_chuna: !!row.has_chuna,
    has_ultrasound: !!row.has_ultrasound,
    has_highfreq: !!row.has_highfreq,
    has_aroma: !!row.has_aroma,
    yakchim_type: row.yakchim_type as YakchimType | null,
    yakchim_quantity: row.yakchim_quantity || 0,
    memo: row.memo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * 당일 치료 기록 가져오기 또는 생성 (upsert)
 */
export async function getOrCreateDailyTreatmentRecord(
  patientId: number,
  patientName: string,
  chartNumber: string | undefined,
  date: string
): Promise<DailyTreatmentRecord> {
  let record = await fetchDailyTreatmentRecord(patientId, date);

  if (!record) {
    // 환자의 기본 치료 정보 로드
    const defaults = await fetchPatientDefaultTreatments(patientId);

    const id = await createDailyTreatmentRecord({
      patient_id: patientId,
      patient_name: patientName,
      chart_number: chartNumber,
      treatment_date: date,
      has_acupuncture: defaults?.has_acupuncture ?? true,
      has_moxa: defaults?.has_moxa ?? true,
      has_hotpack: defaults?.has_hotpack ?? true,
      has_cupping: defaults?.has_cupping ?? false,
      has_chuna: defaults?.has_chuna ?? false,
      has_ultrasound: defaults?.has_ultrasound ?? false,
      has_highfreq: defaults?.has_highfreq ?? false,
      has_aroma: defaults?.has_aroma ?? false,
      yakchim_type: defaults?.yakchim_type ?? null,
      yakchim_quantity: defaults?.yakchim_quantity ?? 0,
      memo: defaults?.memo ?? null,
    });

    record = await fetchDailyTreatmentRecord(patientId, date);
  }

  return record!;
}

// =====================================================
// 치료 시간 로그 (treatment_time_logs)
// =====================================================

/**
 * 치료 시간 로그 생성
 */
export async function createTreatmentTimeLog(log: Omit<TreatmentTimeLog, 'id' | 'created_at'>): Promise<number> {
  return await insert(`
    INSERT INTO treatment_time_logs (
      daily_record_id, patient_id, treatment_date,
      treatment_type, treatment_name,
      started_at, ended_at, duration_seconds,
      room_id, bed_number
    ) VALUES (
      ${log.daily_record_id},
      ${log.patient_id},
      ${escapeString(log.treatment_date)},
      ${escapeString(log.treatment_type)},
      ${toSqlValue(log.treatment_name)},
      ${toSqlValue(log.started_at)},
      ${toSqlValue(log.ended_at)},
      ${toSqlValue(log.duration_seconds)},
      ${toSqlValue(log.room_id)},
      ${toSqlValue(log.bed_number)}
    )
  `);
}

/**
 * 치료 시간 로그 업데이트
 */
export async function updateTreatmentTimeLog(
  logId: number,
  updates: Partial<TreatmentTimeLog>
): Promise<void> {
  const setClauses: string[] = [];

  if (updates.started_at !== undefined)
    setClauses.push(`started_at = ${toSqlValue(updates.started_at)}`);
  if (updates.ended_at !== undefined)
    setClauses.push(`ended_at = ${toSqlValue(updates.ended_at)}`);
  if (updates.duration_seconds !== undefined)
    setClauses.push(`duration_seconds = ${toSqlValue(updates.duration_seconds)}`);
  if (updates.room_id !== undefined)
    setClauses.push(`room_id = ${toSqlValue(updates.room_id)}`);
  if (updates.bed_number !== undefined)
    setClauses.push(`bed_number = ${toSqlValue(updates.bed_number)}`);

  if (setClauses.length > 0) {
    await execute(`
      UPDATE treatment_time_logs SET ${setClauses.join(', ')}
      WHERE id = ${logId}
    `);
  }
}

/**
 * 당일 기록의 치료 시간 로그 조회
 */
export async function fetchTreatmentTimeLogsByDailyRecord(dailyRecordId: number): Promise<TreatmentTimeLog[]> {
  const rows = await query<any>(`
    SELECT * FROM treatment_time_logs
    WHERE daily_record_id = ${dailyRecordId}
    ORDER BY started_at ASC
  `);

  return rows.map(row => ({
    id: row.id,
    daily_record_id: row.daily_record_id,
    patient_id: row.patient_id,
    treatment_date: row.treatment_date,
    treatment_type: row.treatment_type as TreatmentTypeCode,
    treatment_name: row.treatment_name,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    room_id: row.room_id,
    bed_number: row.bed_number,
    created_at: row.created_at,
  }));
}

// =====================================================
// 액팅 시간 로그 (acting_time_logs)
// =====================================================

/**
 * 액팅 시간 로그 생성
 */
export async function createActingTimeLog(log: Omit<ActingTimeLog, 'id' | 'created_at'>): Promise<number> {
  return await insert(`
    INSERT INTO acting_time_logs (
      daily_record_id, patient_id, patient_name, chart_number, treatment_date,
      acting_type, acting_name,
      doctor_id, doctor_name,
      started_at, ended_at, duration_seconds,
      status
    ) VALUES (
      ${toSqlValue(log.daily_record_id)},
      ${log.patient_id},
      ${toSqlValue(log.patient_name)},
      ${toSqlValue(log.chart_number)},
      ${escapeString(log.treatment_date)},
      ${escapeString(log.acting_type)},
      ${toSqlValue(log.acting_name)},
      ${toSqlValue(log.doctor_id)},
      ${toSqlValue(log.doctor_name)},
      ${toSqlValue(log.started_at)},
      ${toSqlValue(log.ended_at)},
      ${toSqlValue(log.duration_seconds)},
      ${escapeString(log.status)}
    )
  `);
}

/**
 * 액팅 시간 로그 업데이트
 */
export async function updateActingTimeLog(
  logId: number,
  updates: Partial<ActingTimeLog>
): Promise<void> {
  const setClauses: string[] = [];

  if (updates.started_at !== undefined)
    setClauses.push(`started_at = ${toSqlValue(updates.started_at)}`);
  if (updates.ended_at !== undefined)
    setClauses.push(`ended_at = ${toSqlValue(updates.ended_at)}`);
  if (updates.duration_seconds !== undefined)
    setClauses.push(`duration_seconds = ${toSqlValue(updates.duration_seconds)}`);
  if (updates.status !== undefined)
    setClauses.push(`status = ${escapeString(updates.status)}`);
  if (updates.doctor_id !== undefined)
    setClauses.push(`doctor_id = ${toSqlValue(updates.doctor_id)}`);
  if (updates.doctor_name !== undefined)
    setClauses.push(`doctor_name = ${toSqlValue(updates.doctor_name)}`);

  if (setClauses.length > 0) {
    await execute(`
      UPDATE acting_time_logs SET ${setClauses.join(', ')}
      WHERE id = ${logId}
    `);
  }
}

/**
 * 액팅 시간 로그 상태 변경
 */
export async function updateActingStatus(
  logId: number,
  status: ActingStatus,
  timestamp?: string
): Promise<void> {
  const now = timestamp || new Date().toISOString();

  if (status === 'acting') {
    await execute(`
      UPDATE acting_time_logs SET
        status = ${escapeString(status)},
        started_at = ${escapeString(now)}
      WHERE id = ${logId}
    `);
  } else if (status === 'complete') {
    // 종료 시 duration 계산
    const log = await queryOne<any>(`SELECT started_at FROM acting_time_logs WHERE id = ${logId}`);
    let durationSeconds = null;
    if (log?.started_at) {
      const start = new Date(log.started_at);
      const end = new Date(now);
      durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    }

    await execute(`
      UPDATE acting_time_logs SET
        status = ${escapeString(status)},
        ended_at = ${escapeString(now)},
        duration_seconds = ${toSqlValue(durationSeconds)}
      WHERE id = ${logId}
    `);
  } else {
    await execute(`
      UPDATE acting_time_logs SET status = ${escapeString(status)}
      WHERE id = ${logId}
    `);
  }
}

/**
 * 특정 날짜의 액팅 로그 조회
 */
export async function fetchActingTimeLogsByDate(date: string): Promise<ActingTimeLog[]> {
  const rows = await query<any>(`
    SELECT * FROM acting_time_logs
    WHERE treatment_date = ${escapeString(date)}
    ORDER BY created_at ASC
  `);

  return rows.map(row => ({
    id: row.id,
    daily_record_id: row.daily_record_id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    chart_number: row.chart_number,
    treatment_date: row.treatment_date,
    acting_type: row.acting_type as ActingTypeCode,
    acting_name: row.acting_name,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    status: row.status as ActingStatus,
    created_at: row.created_at,
  }));
}

/**
 * 특정 의사의 대기 중인 액팅 조회
 */
export async function fetchPendingActingsByDoctor(
  doctorName: string,
  date: string
): Promise<ActingTimeLog[]> {
  const rows = await query<any>(`
    SELECT * FROM acting_time_logs
    WHERE doctor_name = ${escapeString(doctorName)}
      AND treatment_date = ${escapeString(date)}
      AND status != 'completed'
    ORDER BY created_at ASC
  `);

  return rows.map(row => ({
    id: row.id,
    daily_record_id: row.daily_record_id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    chart_number: row.chart_number,
    treatment_date: row.treatment_date,
    acting_type: row.acting_type as ActingTypeCode,
    acting_name: row.acting_name,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    status: row.status as ActingStatus,
    created_at: row.created_at,
  }));
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 치료 정보에서 액팅 항목 추출
 */
export function extractActingItems(treatments: PatientDefaultTreatments | DailyTreatmentRecord): {
  type: ActingTypeCode;
  name: string;
}[] {
  const actingItems: { type: ActingTypeCode; name: string }[] = [];

  if (treatments.has_acupuncture) {
    actingItems.push({ type: 'acupuncture', name: '침' });
  }
  if (treatments.has_chuna) {
    actingItems.push({ type: 'chuna', name: '추나' });
  }
  if (treatments.has_ultrasound) {
    actingItems.push({ type: 'ultrasound', name: '초음파' });
  }

  return actingItems;
}

/**
 * 치료 정보를 타이머 항목 목록으로 변환
 */
export function treatmentsToTimerItems(treatments: PatientDefaultTreatments | DailyTreatmentRecord): {
  type: TreatmentTypeCode;
  name: string;
  isActing: boolean;
}[] {
  const items: { type: TreatmentTypeCode; name: string; isActing: boolean }[] = [];

  const treatmentTypes: TreatmentTypeCode[] = [
    'acupuncture', 'moxa', 'hotpack', 'cupping',
    'chuna', 'ultrasound', 'highfreq', 'aroma'
  ];

  for (const type of treatmentTypes) {
    const key = `has_${type}` as keyof typeof treatments;
    if (treatments[key]) {
      const info = TREATMENT_TYPE_INFO[type];
      items.push({
        type,
        name: info.name,
        isActing: info.isActing,
      });
    }
  }

  return items;
}

// =====================================================
// 치료대기 진입 처리
// =====================================================

/**
 * 환자가 치료대기에 진입할 때 호출되는 함수
 * - 초진: 기본 치료(침, 물치, 핫팩) 자동 설정
 * - 재진: patient_default_treatments에서 로드
 * - 당일 치료 기록 생성
 * - 액팅 항목 추출 반환
 */
export interface TreatmentQueueEntryResult {
  /** 환자별 기본 치료 정보 */
  defaultTreatments: PatientDefaultTreatments;
  /** 당일 치료 기록 */
  dailyRecord: DailyTreatmentRecord;
  /** 추출된 액팅 항목 */
  actingItems: { type: ActingTypeCode; name: string }[];
  /** 초진 여부 */
  isFirstVisit: boolean;
}

export async function processPatientForTreatmentQueue(
  patientId: number,
  patientName: string,
  chartNumber: string | undefined,
  doctorName?: string
): Promise<TreatmentQueueEntryResult> {
  const today = getCurrentDate();

  // 1. 기본 치료 정보 조회
  let defaultTreatments = await fetchPatientDefaultTreatments(patientId);
  let isFirstVisit = false;

  // 2. 기본 치료 정보가 없으면 초진 - 기본값 생성
  if (!defaultTreatments) {
    isFirstVisit = true;
    console.log(`[치료대기] 초진 환자 ${patientName} (${chartNumber}) - 기본 치료 정보 생성`);

    await createDefaultTreatmentsForNewPatient(patientId);
    defaultTreatments = await fetchPatientDefaultTreatments(patientId);

    // 생성에 실패하면 기본값 사용
    if (!defaultTreatments) {
      defaultTreatments = {
        patient_id: patientId,
        has_acupuncture: true,
        has_moxa: true,
        has_hotpack: true,
        has_cupping: false,
        has_chuna: false,
        has_ultrasound: false,
        has_highfreq: false,
        has_aroma: false,
        yakchim_type: null,
        yakchim_quantity: 0,
        memo: null,
      };
    }
  } else {
    console.log(`[치료대기] 재진 환자 ${patientName} (${chartNumber}) - 기존 치료 정보 로드`);
  }

  // 3. 당일 치료 기록 생성 또는 조회
  const dailyRecord = await getOrCreateDailyTreatmentRecord(
    patientId,
    patientName,
    chartNumber,
    today
  );

  // 4. 치료대기 시작 시간 기록
  if (!dailyRecord.treatment_wait_start) {
    await updateDailyTreatmentRecord(dailyRecord.id!, {
      treatment_wait_start: new Date().toISOString(),
    });
    dailyRecord.treatment_wait_start = new Date().toISOString();
  }

  // 5. 액팅 항목 추출
  const actingItems = extractActingItems(defaultTreatments);

  console.log(`[치료대기] ${patientName} - 액팅 항목: ${actingItems.map(a => a.name).join(', ') || '없음'}`);

  return {
    defaultTreatments,
    dailyRecord,
    actingItems,
    isFirstVisit,
  };
}

/**
 * 환자의 초진 여부 확인 (오늘 기준)
 * - patient_default_treatments가 없으면 초진
 * - 오늘 daily_treatment_records가 없으면 첫 방문
 */
export async function checkIsFirstVisitToday(patientId: number): Promise<{
  hasDefaultTreatments: boolean;
  hasTodayRecord: boolean;
}> {
  const today = getCurrentDate();

  const [defaultTreatments, dailyRecord] = await Promise.all([
    fetchPatientDefaultTreatments(patientId),
    fetchDailyTreatmentRecord(patientId, today),
  ]);

  return {
    hasDefaultTreatments: defaultTreatments !== null,
    hasTodayRecord: dailyRecord !== null,
  };
}

// =====================================================
// 치료실 배정 처리
// =====================================================

/**
 * 치료 항목별 기본 시간 (분)
 */
export const TREATMENT_DEFAULT_DURATIONS: Record<TreatmentTypeCode, number> = {
  acupuncture: 15,  // 침: 15분
  moxa: 10,         // 물치: 10분
  hotpack: 15,      // 핫팩: 15분
  cupping: 10,      // 습부항: 10분
  chuna: 10,        // 추나: 10분
  ultrasound: 5,    // 초음파: 5분
  highfreq: 15,     // 고주파: 15분
  aroma: 10,        // 향기요법: 10분
};

/**
 * SessionTreatment 인터페이스 (TreatmentView와 호환)
 */
export interface SessionTreatmentItem {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed';
  duration: number;
  startTime?: string | null;
  elapsedSeconds: number;
  memo?: string;
  treatmentType?: TreatmentTypeCode;
}

/**
 * 환자의 치료 정보를 SessionTreatment 목록으로 변환
 * 치료실 배정 시 호출
 */
export async function loadSessionTreatmentsForRoom(
  patientId: number,
  patientName: string,
  chartNumber?: string
): Promise<{
  sessionTreatments: SessionTreatmentItem[];
  dailyRecord: DailyTreatmentRecord;
  isFirstVisit: boolean;
}> {
  const today = getCurrentDate();

  // 1. 기본 치료 정보 로드
  let defaultTreatments = await fetchPatientDefaultTreatments(patientId);
  let isFirstVisit = false;

  // 2. 없으면 초진 - 기본값 생성
  if (!defaultTreatments) {
    isFirstVisit = true;
    await createDefaultTreatmentsForNewPatient(patientId);
    defaultTreatments = await fetchPatientDefaultTreatments(patientId);

    if (!defaultTreatments) {
      // 생성 실패 시 기본값
      defaultTreatments = {
        patient_id: patientId,
        has_acupuncture: true,
        has_moxa: true,
        has_hotpack: true,
        has_cupping: false,
        has_chuna: false,
        has_ultrasound: false,
        has_highfreq: false,
        has_aroma: false,
        yakchim_type: null,
        yakchim_quantity: 0,
        memo: null,
      };
    }
  }

  // 3. 당일 치료 기록 생성/조회
  const dailyRecord = await getOrCreateDailyTreatmentRecord(
    patientId,
    patientName,
    chartNumber,
    today
  );

  // 4. 치료 시작 시간 기록
  if (!dailyRecord.treatment_start) {
    await updateDailyTreatmentRecord(dailyRecord.id!, {
      treatment_start: new Date().toISOString(),
    });
    dailyRecord.treatment_start = new Date().toISOString();
  }

  // 5. 치료 항목을 SessionTreatment로 변환
  const timerItems = treatmentsToTimerItems(defaultTreatments);
  const timestamp = Date.now();

  const sessionTreatments: SessionTreatmentItem[] = timerItems.map((item, index) => ({
    id: `tx-${patientId}-${timestamp}-${index}`,
    name: item.name,
    status: 'pending' as const,
    duration: TREATMENT_DEFAULT_DURATIONS[item.type],
    elapsedSeconds: 0,
    treatmentType: item.type,
    memo: item.isActing ? '원장 액팅' : undefined,
  }));

  console.log(`[치료실 배정] ${patientName} - 치료 항목: ${sessionTreatments.map(t => t.name).join(', ')}`);

  return {
    sessionTreatments,
    dailyRecord,
    isFirstVisit,
  };
}

/**
 * 치료 타이머 시작 시 로그 기록
 */
export async function logTreatmentStart(
  dailyRecordId: number,
  patientId: number,
  treatmentType: TreatmentTypeCode,
  treatmentName: string,
  roomId?: number,
  bedNumber?: number
): Promise<number> {
  const today = getCurrentDate();
  const now = new Date().toISOString();

  return await createTreatmentTimeLog({
    daily_record_id: dailyRecordId,
    patient_id: patientId,
    treatment_date: today,
    treatment_type: treatmentType,
    treatment_name: treatmentName,
    started_at: now,
    room_id: roomId,
    bed_number: bedNumber,
  });
}

/**
 * 치료 타이머 종료 시 로그 업데이트
 */
export async function logTreatmentEnd(
  logId: number
): Promise<void> {
  const now = new Date().toISOString();

  // 시작 시간 조회
  const log = await queryOne<any>(`SELECT started_at FROM treatment_time_logs WHERE id = ${logId}`);
  let durationSeconds = null;

  if (log?.started_at) {
    const start = new Date(log.started_at);
    const end = new Date(now);
    durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  }

  await updateTreatmentTimeLog(logId, {
    ended_at: now,
    duration_seconds: durationSeconds,
  });
}

/**
 * 환자 ID로 진행 중인 치료 시간 로그 조회
 */
export async function fetchActiveTreatmentTimeLog(
  patientId: number,
  treatmentType: TreatmentTypeCode,
  date?: string
): Promise<TreatmentTimeLog | null> {
  const targetDate = date || getCurrentDate();

  const row = await queryOne<any>(`
    SELECT * FROM treatment_time_logs
    WHERE patient_id = ${patientId}
      AND treatment_type = ${escapeString(treatmentType)}
      AND treatment_date = ${escapeString(targetDate)}
      AND started_at IS NOT NULL
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `);

  if (!row) return null;

  return {
    id: row.id,
    daily_record_id: row.daily_record_id,
    patient_id: row.patient_id,
    treatment_date: row.treatment_date,
    treatment_type: row.treatment_type as TreatmentTypeCode,
    treatment_name: row.treatment_name,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    room_id: row.room_id,
    bed_number: row.bed_number,
    created_at: row.created_at,
  };
}

// =====================================================
// 통계 및 리포트
// =====================================================

/**
 * 일별 치료 통계
 */
export interface DailyTreatmentStats {
  date: string;
  totalPatients: number;
  totalTreatments: number;
  treatmentCounts: Record<TreatmentTypeCode, number>;
  actingCounts: Record<ActingTypeCode, number>;
  avgTreatmentMinutes: number;
}

/**
 * 치료 항목별 통계
 */
export interface TreatmentTypeStats {
  type: TreatmentTypeCode;
  name: string;
  totalCount: number;
  totalDurationMinutes: number;
  avgDurationMinutes: number;
}

/**
 * 액팅 항목별 통계
 */
export interface ActingTypeStats {
  type: ActingTypeCode;
  name: string;
  totalCount: number;
  completedCount: number;
  totalDurationMinutes: number;
  avgDurationMinutes: number;
}

/**
 * 일별 치료 통계 조회
 */
export async function fetchDailyTreatmentStats(
  startDate: string,
  endDate: string
): Promise<DailyTreatmentStats[]> {
  // 일별 환자 수 및 치료 항목 집계
  const dailyRecords = await query<any>(`
    SELECT
      treatment_date,
      COUNT(DISTINCT patient_id) as total_patients,
      SUM(has_acupuncture) as acupuncture_count,
      SUM(has_moxa) as moxa_count,
      SUM(has_hotpack) as hotpack_count,
      SUM(has_cupping) as cupping_count,
      SUM(has_chuna) as chuna_count,
      SUM(has_ultrasound) as ultrasound_count,
      SUM(has_highfreq) as highfreq_count,
      SUM(has_aroma) as aroma_count
    FROM daily_treatment_records
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
    GROUP BY treatment_date
    ORDER BY treatment_date DESC
  `);

  // 치료 시간 로그에서 평균 시간 집계
  const timeLogs = await query<any>(`
    SELECT
      treatment_date,
      COUNT(*) as total_treatments,
      AVG(duration_seconds) as avg_duration
    FROM treatment_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
      AND duration_seconds IS NOT NULL
    GROUP BY treatment_date
  `);

  // 액팅 로그 집계
  const actingLogs = await query<any>(`
    SELECT
      treatment_date,
      acting_type,
      COUNT(*) as count
    FROM acting_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
    GROUP BY treatment_date, acting_type
  `);

  const timeLogsMap = new Map(timeLogs.map((t: any) => [t.treatment_date, t]));
  const actingLogsMap = new Map<string, Record<ActingTypeCode, number>>();

  for (const log of actingLogs) {
    if (!actingLogsMap.has(log.treatment_date)) {
      actingLogsMap.set(log.treatment_date, {
        acupuncture: 0,
        chuna: 0,
        ultrasound: 0,
        consultation: 0,
      });
    }
    const dateActing = actingLogsMap.get(log.treatment_date)!;
    if (log.acting_type in dateActing) {
      dateActing[log.acting_type as ActingTypeCode] = log.count;
    }
  }

  return dailyRecords.map((row: any) => {
    const timeLog = timeLogsMap.get(row.treatment_date);
    const actingCounts = actingLogsMap.get(row.treatment_date) || {
      acupuncture: 0,
      chuna: 0,
      ultrasound: 0,
      consultation: 0,
    };

    const treatmentCounts: Record<TreatmentTypeCode, number> = {
      acupuncture: row.acupuncture_count || 0,
      moxa: row.moxa_count || 0,
      hotpack: row.hotpack_count || 0,
      cupping: row.cupping_count || 0,
      chuna: row.chuna_count || 0,
      ultrasound: row.ultrasound_count || 0,
      highfreq: row.highfreq_count || 0,
      aroma: row.aroma_count || 0,
    };

    const totalTreatments = Object.values(treatmentCounts).reduce((a, b) => a + b, 0);

    return {
      date: row.treatment_date,
      totalPatients: row.total_patients,
      totalTreatments,
      treatmentCounts,
      actingCounts,
      avgTreatmentMinutes: timeLog ? Math.round(timeLog.avg_duration / 60) : 0,
    };
  });
}

/**
 * 기간별 치료 항목 통계 조회
 */
export async function fetchTreatmentTypeStats(
  startDate: string,
  endDate: string
): Promise<TreatmentTypeStats[]> {
  const rows = await query<any>(`
    SELECT
      treatment_type,
      treatment_name,
      COUNT(*) as total_count,
      SUM(duration_seconds) as total_duration,
      AVG(duration_seconds) as avg_duration
    FROM treatment_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
      AND duration_seconds IS NOT NULL
    GROUP BY treatment_type, treatment_name
    ORDER BY total_count DESC
  `);

  return rows.map((row: any) => ({
    type: row.treatment_type as TreatmentTypeCode,
    name: row.treatment_name || TREATMENT_TYPE_INFO[row.treatment_type as TreatmentTypeCode]?.name || row.treatment_type,
    totalCount: row.total_count,
    totalDurationMinutes: Math.round((row.total_duration || 0) / 60),
    avgDurationMinutes: Math.round((row.avg_duration || 0) / 60),
  }));
}

/**
 * 기간별 액팅 통계 조회
 */
export async function fetchActingTypeStats(
  startDate: string,
  endDate: string
): Promise<ActingTypeStats[]> {
  const rows = await query<any>(`
    SELECT
      acting_type,
      acting_name,
      COUNT(*) as total_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
      SUM(duration_seconds) as total_duration,
      AVG(CASE WHEN status = 'completed' THEN duration_seconds END) as avg_duration
    FROM acting_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
    GROUP BY acting_type, acting_name
    ORDER BY total_count DESC
  `);

  return rows.map((row: any) => ({
    type: row.acting_type as ActingTypeCode,
    name: row.acting_name || row.acting_type,
    totalCount: row.total_count,
    completedCount: row.completed_count || 0,
    totalDurationMinutes: Math.round((row.total_duration || 0) / 60),
    avgDurationMinutes: Math.round((row.avg_duration || 0) / 60),
  }));
}

/**
 * 요약 통계 조회 (대시보드용)
 */
export interface TreatmentSummaryStats {
  period: string;
  totalPatients: number;
  totalTreatments: number;
  totalActings: number;
  avgTreatmentsPerPatient: number;
  topTreatments: { name: string; count: number }[];
  topActings: { name: string; count: number }[];
}

export async function fetchTreatmentSummaryStats(
  startDate: string,
  endDate: string
): Promise<TreatmentSummaryStats> {
  // 환자 수
  const patientCount = await queryOne<{ count: number }>(`
    SELECT COUNT(DISTINCT patient_id) as count
    FROM daily_treatment_records
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
  `);

  // 치료 항목 합계
  const treatmentSums = await queryOne<any>(`
    SELECT
      SUM(has_acupuncture) as acupuncture,
      SUM(has_moxa) as moxa,
      SUM(has_hotpack) as hotpack,
      SUM(has_cupping) as cupping,
      SUM(has_chuna) as chuna,
      SUM(has_ultrasound) as ultrasound,
      SUM(has_highfreq) as highfreq,
      SUM(has_aroma) as aroma
    FROM daily_treatment_records
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
  `);

  // 액팅 수
  const actingCount = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM acting_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
  `);

  // 치료 항목별 집계
  const treatments = [
    { name: '침', count: treatmentSums?.acupuncture || 0 },
    { name: '물치', count: treatmentSums?.moxa || 0 },
    { name: '핫팩', count: treatmentSums?.hotpack || 0 },
    { name: '습부항', count: treatmentSums?.cupping || 0 },
    { name: '추나', count: treatmentSums?.chuna || 0 },
    { name: '초음파', count: treatmentSums?.ultrasound || 0 },
    { name: '고주파', count: treatmentSums?.highfreq || 0 },
    { name: '향기요법', count: treatmentSums?.aroma || 0 },
  ].sort((a, b) => b.count - a.count);

  // 액팅 항목별 집계
  const actingRows = await query<any>(`
    SELECT acting_name, COUNT(*) as count
    FROM acting_time_logs
    WHERE treatment_date >= ${escapeString(startDate)}
      AND treatment_date <= ${escapeString(endDate)}
    GROUP BY acting_name
    ORDER BY count DESC
  `);

  const totalPatients = patientCount?.count || 0;
  const totalTreatments = treatments.reduce((sum, t) => sum + t.count, 0);

  return {
    period: `${startDate} ~ ${endDate}`,
    totalPatients,
    totalTreatments,
    totalActings: actingCount?.count || 0,
    avgTreatmentsPerPatient: totalPatients > 0 ? Math.round((totalTreatments / totalPatients) * 10) / 10 : 0,
    topTreatments: treatments.filter(t => t.count > 0).slice(0, 5),
    topActings: actingRows.map((r: any) => ({ name: r.acting_name, count: r.count })).slice(0, 5),
  };
}
