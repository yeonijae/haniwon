/**
 * 환자관리 API
 * 해피콜, 치료 종결, 정기 관리 메시지 등
 */

import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentDate, getCurrentTimestamp } from '@shared/lib/postgres';
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
 * 오늘의 환자관리 목록 조회
 */
export async function fetchTodayPatientCare(): Promise<PatientCareItem[]> {
  const today = getCurrentDate();

  const data = await query<any>(`
    SELECT pci.*, p.name as patient_name, p.chart_number as patient_chart_number, p.phone as patient_phone
    FROM patient_care_items pci
    LEFT JOIN patients p ON pci.patient_id = p.id
    WHERE pci.scheduled_date = ${escapeString(today)}
    OR (pci.status IN ('pending', 'scheduled') AND pci.scheduled_date <= ${escapeString(today)})
    ORDER BY pci.scheduled_date ASC
  `);

  return data;
}

/**
 * 관리 필요 환자 목록 조회 (30일 이상 미방문)
 */
export async function fetchPatientsNeedFollowup(): Promise<any[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const data = await query<any>(`
    SELECT pts.*, p.name, p.chart_number, p.phone,
           julianday('now') - julianday(pts.last_visit_date) as days_since_last_visit
    FROM patient_treatment_status pts
    LEFT JOIN patients p ON pts.patient_id = p.id
    WHERE pts.last_visit_date <= ${escapeString(dateStr)}
    AND pts.treatment_phase NOT IN ('completed', 'cancelled')
    ORDER BY days_since_last_visit DESC
  `);

  return data;
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
  let sql = `
    SELECT pci.*, p.name as patient_name, p.chart_number as patient_chart_number, p.phone as patient_phone
    FROM patient_care_items pci
    LEFT JOIN patients p ON pci.patient_id = p.id
    WHERE pci.patient_id = ${patientId}
  `;

  if (options?.status) {
    sql += ` AND pci.status = ${escapeString(options.status)}`;
  }
  if (options?.careType) {
    sql += ` AND pci.care_type = ${escapeString(options.careType)}`;
  }

  sql += ` ORDER BY pci.scheduled_date ASC`;

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  return await query<PatientCareItem>(sql);
}

/**
 * 관리 항목 생성
 */
export async function createPatientCareItem(
  input: CreatePatientCareItemInput
): Promise<PatientCareItem> {
  const now = getCurrentTimestamp();

  const id = await insert(`
    INSERT INTO patient_care_items (patient_id, care_type, status, scheduled_date, notes, priority, created_at, updated_at)
    VALUES (${input.patient_id}, ${escapeString(input.care_type)}, 'pending',
            ${escapeString(input.scheduled_date || '')}, ${escapeString(input.description || '')}, 0,
            ${escapeString(now)}, ${escapeString(now)})
  `);

  const data = await queryOne<any>(`SELECT * FROM patient_care_items WHERE id = ${id}`);
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
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE patient_care_items SET
      status = 'completed',
      completed_date = ${escapeString(now)},
      assigned_to = ${escapeString(completedBy || '')},
      notes = ${escapeString(result || '')},
      updated_at = ${escapeString(now)}
    WHERE id = ${itemId}
  `);
}

/**
 * 관리 항목 건너뛰기
 */
export async function skipPatientCareItem(
  itemId: number,
  reason?: string
): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE patient_care_items SET
      status = 'cancelled',
      notes = ${escapeString(reason || '')},
      updated_at = ${escapeString(now)}
    WHERE id = ${itemId}
  `);
}

/**
 * 관리 항목 일정 변경
 */
export async function reschedulePatientCareItem(
  itemId: number,
  newDate: string
): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE patient_care_items SET
      scheduled_date = ${escapeString(newDate)},
      status = 'pending',
      updated_at = ${escapeString(now)}
    WHERE id = ${itemId}
  `);
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
  return await queryOne<PatientTreatmentStatus>(`
    SELECT * FROM patient_treatment_status WHERE patient_id = ${patientId}
  `);
}

/**
 * 환자 치료 상태 생성/업데이트 (upsert)
 */
export async function upsertPatientTreatmentStatus(
  patientId: number,
  updates: Partial<Omit<PatientTreatmentStatus, 'id' | 'patient_id' | 'created_at' | 'updated_at'>>
): Promise<PatientTreatmentStatus> {
  const now = getCurrentTimestamp();
  const existing = await fetchPatientTreatmentStatus(patientId);

  if (existing) {
    const updateParts: string[] = [];
    if (updates.treatment_phase !== undefined) updateParts.push(`treatment_phase = ${escapeString(updates.treatment_phase || '')}`);
    if (updates.last_visit_date !== undefined) updateParts.push(`last_visit_date = ${escapeString(updates.last_visit_date || '')}`);
    if (updates.next_visit_date !== undefined) updateParts.push(`next_visit_date = ${escapeString(updates.next_visit_date || '')}`);
    if (updates.total_visits !== undefined) updateParts.push(`total_visits = ${updates.total_visits}`);
    if (updates.notes !== undefined) updateParts.push(`notes = ${escapeString(updates.notes || '')}`);
    updateParts.push(`updated_at = ${escapeString(now)}`);

    await execute(`UPDATE patient_treatment_status SET ${updateParts.join(', ')} WHERE patient_id = ${patientId}`);
  } else {
    await execute(`
      INSERT INTO patient_treatment_status (patient_id, treatment_phase, last_visit_date, next_visit_date, total_visits, notes, created_at, updated_at)
      VALUES (${patientId}, ${escapeString(updates.treatment_phase || '')}, ${escapeString(updates.last_visit_date || '')},
              ${escapeString(updates.next_visit_date || '')}, ${updates.total_visits || 0}, ${escapeString(updates.notes || '')},
              ${escapeString(now)}, ${escapeString(now)})
    `);
  }

  return (await fetchPatientTreatmentStatus(patientId))!;
}

/**
 * 환자 방문 기록 업데이트 (내원 시 호출)
 */
export async function recordPatientVisit(patientId: number): Promise<void> {
  const today = getCurrentDate();
  const existing = await fetchPatientTreatmentStatus(patientId);

  if (existing) {
    await upsertPatientTreatmentStatus(patientId, {
      total_visits: existing.total_visits + 1,
      last_visit_date: today,
      treatment_phase: 'ongoing',
    });
  } else {
    await upsertPatientTreatmentStatus(patientId, {
      treatment_phase: 'ongoing',
      last_visit_date: today,
      total_visits: 1,
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
  const today = getCurrentDate();
  const now = getCurrentTimestamp();

  await execute(`
    UPDATE patient_treatment_status SET
      treatment_phase = 'completed',
      notes = ${escapeString(reason || '')},
      updated_at = ${escapeString(now)}
    WHERE patient_id = ${patientId}
  `);
}

/**
 * 환자 치료 재개
 */
export async function resumeTreatment(patientId: number): Promise<void> {
  const now = getCurrentTimestamp();

  await execute(`
    UPDATE patient_treatment_status SET
      treatment_phase = 'ongoing',
      updated_at = ${escapeString(now)}
    WHERE patient_id = ${patientId}
  `);
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
  let sql = `SELECT * FROM patient_care_rules`;

  if (activeOnly) {
    sql += ` WHERE is_active = 1`;
  }

  sql += ` ORDER BY rule_name`;

  return await query<PatientCareRule>(sql);
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
  // 이 기능은 규칙 테이블의 구조에 따라 구현
  // 현재는 빈 배열 반환
  console.log(`[환자관리] ${triggerEvent} 트리거 - 규칙 기반 생성 미구현`);
  return [];
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
  const scheduledDate = new Date(deliveryDate);
  scheduledDate.setDate(scheduledDate.getDate() + 1);

  return createPatientCareItem({
    patient_id: patientId,
    treatment_record_id: treatmentRecordId,
    care_type: 'after_call',
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
  const scheduledDate = new Date(startDate);
  scheduledDate.setDate(scheduledDate.getDate() + 7);

  return createPatientCareItem({
    patient_id: patientId,
    treatment_record_id: treatmentRecordId,
    care_type: 'medication',
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
  const today = getCurrentDate();

  const pending = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM patient_care_items WHERE status = 'pending'`);
  const scheduled = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM patient_care_items WHERE status = 'scheduled'`);
  const completedToday = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM patient_care_items
    WHERE status = 'completed' AND date(completed_date) = ${escapeString(today)}
  `);
  const overdue = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM patient_care_items
    WHERE status IN ('pending', 'scheduled') AND scheduled_date < ${escapeString(today)}
  `);

  return {
    pending: pending?.cnt || 0,
    scheduled: scheduled?.cnt || 0,
    completed_today: completedToday?.cnt || 0,
    overdue: overdue?.cnt || 0,
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

  const pendingData = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM patient_care_items
    WHERE patient_id = ${patientId} AND status IN ('pending', 'scheduled')
  `);

  const completedData = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM patient_care_items
    WHERE patient_id = ${patientId} AND status = 'completed'
  `);

  return {
    status,
    pendingCareItems: pendingData?.cnt || 0,
    completedCareItems: completedData?.cnt || 0,
  };
}
