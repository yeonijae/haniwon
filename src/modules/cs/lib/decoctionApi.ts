/**
 * 탕전 슬롯 관리 API
 * 일별 탕전 용량 관리 및 예약 처리
 */

import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type { DecoctionSlot } from '../types';

/**
 * 탕전 슬롯 조회 (날짜 범위)
 */
export async function getDecoctionSlots(startDate: string, endDate: string): Promise<DecoctionSlot[]> {
  const sql = `
    SELECT * FROM decoction_slots
    WHERE slot_date >= '${startDate}' AND slot_date <= '${endDate}'
    ORDER BY slot_date ASC
  `;
  return await query<DecoctionSlot>(sql);
}

/**
 * 특정 날짜 탕전 슬롯 조회 (없으면 생성)
 */
export async function getOrCreateSlot(slotDate: string): Promise<DecoctionSlot> {
  let slot = await queryOne<DecoctionSlot>(
    `SELECT * FROM decoction_slots WHERE slot_date::date = '${slotDate}'::date`
  );

  if (!slot) {
    const now = getCurrentTimestamp();
    try {
      await execute(`
        INSERT INTO decoction_slots (slot_date, total_capacity, reserved_capacity, is_available, created_at, updated_at)
        VALUES ('${slotDate}', 30, 0, true, '${now}', '${now}')
        ON CONFLICT (slot_date) DO NOTHING
      `);
    } catch (e) {
      // 중복 에러 무시 (race condition 대응)
    }
    // 다시 조회
    slot = await queryOne<DecoctionSlot>(
      `SELECT * FROM decoction_slots WHERE slot_date::date = '${slotDate}'::date`
    );
    if (!slot) throw new Error('슬롯 생성 실패');
  }

  return slot;
}

/**
 * 탕전 슬롯 예약 (용량 증가)
 */
export async function reserveSlot(slotDate: string, amount: number = 1): Promise<DecoctionSlot> {
  const slot = await getOrCreateSlot(slotDate);

  if (!slot.is_available) {
    throw new Error('해당 날짜는 예약이 불가능합니다.');
  }

  const newReserved = slot.reserved_capacity + amount;
  if (newReserved > slot.total_capacity) {
    throw new Error(`용량 초과: 현재 ${slot.reserved_capacity}/${slot.total_capacity}, 추가 요청 ${amount}`);
  }

  const now = getCurrentTimestamp();
  await execute(`
    UPDATE decoction_slots
    SET reserved_capacity = ${newReserved}, updated_at = '${now}'
    WHERE id = ${slot.id}
  `);

  return { ...slot, reserved_capacity: newReserved, updated_at: now };
}

/**
 * 탕전 슬롯 예약 취소 (용량 감소)
 */
export async function cancelSlotReservation(slotDate: string, amount: number = 1): Promise<DecoctionSlot> {
  const slot = await getOrCreateSlot(slotDate);

  const newReserved = Math.max(0, slot.reserved_capacity - amount);

  const now = getCurrentTimestamp();
  await execute(`
    UPDATE decoction_slots
    SET reserved_capacity = ${newReserved}, updated_at = '${now}'
    WHERE id = ${slot.id}
  `);

  return { ...slot, reserved_capacity: newReserved, updated_at: now };
}

/**
 * 탕전 슬롯 설정 업데이트
 */
export async function updateSlot(
  slotId: number,
  data: Partial<Pick<DecoctionSlot, 'total_capacity' | 'is_available' | 'memo'>>
): Promise<DecoctionSlot> {
  const updates: string[] = [];

  if (data.total_capacity !== undefined) {
    updates.push(`total_capacity = ${data.total_capacity}`);
  }
  if (data.is_available !== undefined) {
    updates.push(`is_available = ${data.is_available}`);
  }
  if (data.memo !== undefined) {
    updates.push(`memo = ${escapeString(data.memo)}`);
  }

  if (updates.length === 0) {
    const slot = await queryOne<DecoctionSlot>(`SELECT * FROM decoction_slots WHERE id = ${slotId}`);
    if (!slot) throw new Error('슬롯을 찾을 수 없습니다.');
    return slot;
  }

  const now = getCurrentTimestamp();
  updates.push(`updated_at = '${now}'`);

  await execute(`
    UPDATE decoction_slots
    SET ${updates.join(', ')}
    WHERE id = ${slotId}
  `);

  const slot = await queryOne<DecoctionSlot>(`SELECT * FROM decoction_slots WHERE id = ${slotId}`);
  if (!slot) throw new Error('슬롯을 찾을 수 없습니다.');
  return slot;
}

/**
 * 예약 가능한 날짜 목록 조회 (다음 N일)
 */
export async function getAvailableSlots(days: number = 14): Promise<DecoctionSlot[]> {
  const today = new Date();
  const slots: DecoctionSlot[] = [];

  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const dateStr = date.toISOString().split('T')[0];
    const slot = await getOrCreateSlot(dateStr);

    if (slot.is_available && slot.reserved_capacity < slot.total_capacity) {
      slots.push(slot);
    }
  }

  return slots;
}

/**
 * 오늘 탕전 예정 패키지 목록
 */
export async function getTodayDecoctionPackages(): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const sql = `
    SELECT hp.*, p.name as patient_name_full
    FROM cs_herbal_packages hp
    LEFT JOIN patients p ON hp.patient_id = p.id
    WHERE hp.decoction_date = '${today}'
      AND hp.decoction_status IN ('pending', 'ready', 'in_progress')
    ORDER BY hp.created_at ASC
  `;
  return await query(sql);
}

/**
 * 처방 미입력 패키지 목록 (탕전일 기준)
 */
export async function getPendingPrescriptionPackages(daysUntilDecoction?: number): Promise<any[]> {
  let dateCondition = '';
  if (daysUntilDecoction !== undefined) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilDecoction);
    const dateStr = targetDate.toISOString().split('T')[0];
    dateCondition = `AND hp.decoction_date = '${dateStr}'`;
  }

  const sql = `
    SELECT hp.*, p.name as patient_name_full
    FROM cs_herbal_packages hp
    LEFT JOIN patients p ON hp.patient_id = p.id
    WHERE hp.prescription_status = 'pending'
      AND hp.decoction_date IS NOT NULL
      ${dateCondition}
    ORDER BY hp.decoction_date ASC, hp.created_at ASC
  `;
  return await query(sql);
}

/**
 * 담당원장별 처방 대기 패키지 목록
 */
export async function getPendingPrescriptionsByDoctor(doctorId: number, doctorName?: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];

  // 1) 기존: 패키지 기반 처방 대기
  const pkgSql = `
    SELECT hp.*,
      hp.decoction_date::date - '${today}'::date as days_until_decoction
    FROM cs_herbal_packages hp
    WHERE hp.doctor_id = ${doctorId}
      AND hp.prescription_status = 'pending'
      AND hp.decoction_date IS NOT NULL
      AND hp.decoction_date >= '${today}'
    ORDER BY hp.decoction_date ASC, hp.created_at ASC
  `;
  const pkgs = await query(pkgSql).catch(() => [] as any[]);

  // 2) 탕약기록(drafts) 기반 처방 대기: decoction_queue에 아직 없는 것
  const draftFilter = doctorName ? `AND d.doctor = '${doctorName.replace(/'/g, "''")}'` : '';
  const draftSql = `
    SELECT
      d.id, d.patient_id, d.patient_name, d.chart_number,
      COALESCE(d.consultation_type, '') as herbal_name,
      d.shipping_date as decoction_date, 0 as prescription_request_count, d.created_at,
      CASE WHEN d.shipping_date IS NOT NULL THEN d.shipping_date::date - '${today}'::date ELSE 999 END as days_until_decoction,
      'draft' as source_type
    FROM cs_herbal_drafts d
    LEFT JOIN decoction_queue q ON q.source = 'draft' AND q.source_id = d.id
    WHERE q.id IS NULL ${draftFilter}
    ORDER BY d.created_at DESC
  `;
  const drafts = await query(draftSql).catch(() => [] as any[]);

  // 합치고 정렬
  const all = [
    ...pkgs.map(p => ({ ...p, source_type: 'package' })),
    ...drafts,
  ].sort((a, b) => (a.days_until_decoction ?? 999) - (b.days_until_decoction ?? 999));

  return all;
}

/**
 * 모든 원장의 처방 대기 패키지 요약
 */
export async function getAllDoctorsPrescriptionSummary(): Promise<{
  doctorId: number;
  doctorName: string;
  pendingCount: number;
  urgentCount: number; // D-1, D-0
}[]> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const sql = `
    SELECT
      doctor_id,
      doctor_name,
      COUNT(*) as pending_count,
      COUNT(*) FILTER (WHERE decoction_date <= '${tomorrowStr}') as urgent_count
    FROM cs_herbal_packages
    WHERE prescription_status = 'pending'
      AND decoction_date IS NOT NULL
      AND decoction_date >= '${today}'
      AND doctor_id IS NOT NULL
    GROUP BY doctor_id, doctor_name
    ORDER BY urgent_count DESC, pending_count DESC
  `;
  const rows = await query<{
    doctor_id: number;
    doctor_name: string;
    pending_count: string;
    urgent_count: string;
  }>(sql);

  return rows.map(row => ({
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    pendingCount: parseInt(row.pending_count) || 0,
    urgentCount: parseInt(row.urgent_count) || 0,
  }));
}

/**
 * 패키지에 처방 연결
 */
export async function linkPrescriptionToPackage(
  packageId: number,
  prescriptionId: number,
  dosageInstruction?: string
): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      prescription_id = ${prescriptionId},
      prescription_status = 'completed',
      dosage_instruction = ${dosageInstruction ? escapeString(dosageInstruction) : 'NULL'},
      dosage_status = ${dosageInstruction ? "'completed'" : "'pending'"},
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

/**
 * 처방 요청 (탕전실 → 원장)
 */
export async function requestPrescription(packageId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      prescription_requested_at = '${now}',
      prescription_request_count = COALESCE(prescription_request_count, 0) + 1,
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

// ============================================
// 배송 관리 API
// ============================================

/**
 * 배송/수령 대기 패키지 목록 (탕전 완료된 것)
 */
export async function getDeliveryPendingPackages(): Promise<any[]> {
  const sql = `
    SELECT hp.*
    FROM cs_herbal_packages hp
    WHERE hp.decoction_status = 'completed'
      AND hp.delivery_status IN ('pending', 'ready', 'shipped')
      AND hp.status = 'active'
    ORDER BY
      CASE hp.delivery_method
        WHEN 'pickup' THEN 1
        WHEN 'local' THEN 2
        WHEN 'express' THEN 3
        ELSE 4
      END,
      hp.decoction_completed_at ASC
  `;
  return await query(sql);
}

/**
 * 송장번호 등록
 */
export async function updateTrackingNumber(packageId: number, trackingNumber: string): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      tracking_number = ${escapeString(trackingNumber)},
      delivery_status = 'shipped',
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

/**
 * 내원 수령 알림 발송 기록
 */
export async function markPickupNotified(packageId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      pickup_notified_at = '${now}',
      delivery_status = 'ready',
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

/**
 * 배송 알림 발송 기록
 */
export async function markShippingNotified(packageId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      shipping_notified_at = '${now}',
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

/**
 * 배송/수령 완료 처리
 */
export async function markAsDelivered(packageId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      delivery_status = 'delivered',
      delivery_completed_at = '${now}',
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}

/**
 * 배송일 설정
 */
export async function setDeliveryDate(packageId: number, deliveryDate: string): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET
      delivery_date = '${deliveryDate}',
      updated_at = '${now}'
    WHERE id = ${packageId}
  `);
}
