/**
 * Doctor Dashboard API
 * 대시보드에서 사용하는 API 함수들
 */

import { query, queryOne, escapeString } from '@shared/lib/postgres';
import type { HerbalPackage } from '@modules/cs/types';
import type { ActingQueueItem } from '@modules/acting/types';

// DB 응답을 ActingQueueItem으로 변환
const mapQueueItem = (row: any): ActingQueueItem => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name,
  chartNo: row.chart_no || '',
  doctorId: row.doctor_id,
  doctorName: row.doctor_name,
  actingType: row.acting_type,
  orderNum: row.order_num,
  status: row.status,
  source: row.source,
  sourceId: row.source_id,
  memo: row.memo,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  durationSec: row.duration_sec,
  workDate: row.work_date,
});

/**
 * 복용법 입력 대기 패키지 조회
 * dosage_status가 'pending'인 한약 패키지 목록
 */
export async function getDosagePendingByDoctor(doctorId: number): Promise<HerbalPackage[]> {
  const today = new Date().toISOString().split('T')[0];
  const sql = `
    SELECT
      hp.*,
      hp.decoction_date::date - '${today}'::date as days_until_decoction
    FROM cs_herbal_packages hp
    WHERE hp.doctor_id = ${doctorId}
      AND hp.dosage_status = 'pending'
      AND hp.prescription_status = 'done'
      AND hp.decoction_date IS NOT NULL
    ORDER BY hp.decoction_date ASC, hp.created_at ASC
  `;
  return await query(sql);
}

/**
 * 현재 진행 중인 액팅 조회
 * 특정 원장이 현재 진행 중인(status='acting') 액팅 1건
 */
export async function getCurrentActing(doctorId: number): Promise<ActingQueueItem | null> {
  const today = new Date().toISOString().split('T')[0];
  const sql = `
    SELECT * FROM daily_acting_records
    WHERE doctor_id = ${doctorId}
      AND work_date = ${escapeString(today)}
      AND status = 'acting'
    LIMIT 1
  `;
  const data = await queryOne<any>(sql);
  if (!data) return null;
  return mapQueueItem(data);
}

/**
 * 원장별 긴급 처방 수 조회 (D-2 이내)
 */
export async function getUrgentPrescriptionCount(doctorId: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const sql = `
    SELECT COUNT(*) as count
    FROM cs_herbal_packages
    WHERE doctor_id = ${doctorId}
      AND prescription_status = 'pending'
      AND decoction_date IS NOT NULL
      AND decoction_date::date - '${today}'::date <= 2
  `;
  const result = await queryOne<{ count: string }>(sql);
  return parseInt(result?.count || '0', 10);
}

/**
 * 모든 원장의 긴급 처방 수 조회
 */
export async function getAllDoctorsUrgentCounts(): Promise<Map<number, number>> {
  const today = new Date().toISOString().split('T')[0];
  const sql = `
    SELECT doctor_id, COUNT(*) as count
    FROM cs_herbal_packages
    WHERE prescription_status = 'pending'
      AND decoction_date IS NOT NULL
      AND decoction_date::date - '${today}'::date <= 2
    GROUP BY doctor_id
  `;
  const data = await query<{ doctor_id: number; count: string }>(sql);
  const result = new Map<number, number>();
  for (const row of data) {
    result.set(row.doctor_id, parseInt(row.count, 10));
  }
  return result;
}
