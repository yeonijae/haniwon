/**
 * 한약 워크플로우 자동화 API
 * D-2/D-1 리마인더, 해피콜 자동 등록, 상태 자동 전이
 */

import { query, execute, getCurrentTimestamp, getCurrentDate } from '@shared/lib/postgres';
import { sendJandiWebhook } from '@modules/acting/api';
import { createDeliveryHappyCall, createMedicationHappyCall } from '@shared/api/patientCareApi';
import type { HerbalPackage } from '../types';

// ============================================
// 처방 리마인더 (D-2, D-1)
// ============================================

/**
 * D-2 처방 리마인더 대상 조회
 */
export async function getD2PrescriptionReminders(): Promise<HerbalPackage[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const dateStr = targetDate.toISOString().split('T')[0];

  const sql = `
    SELECT hp.*
    FROM cs_herbal_packages hp
    WHERE hp.decoction_date = '${dateStr}'
      AND hp.prescription_status = 'pending'
      AND hp.status = 'active'
    ORDER BY hp.doctor_name, hp.created_at
  `;
  return await query<HerbalPackage>(sql);
}

/**
 * D-1 처방 리마인더 대상 조회
 */
export async function getD1PrescriptionReminders(): Promise<HerbalPackage[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const dateStr = targetDate.toISOString().split('T')[0];

  const sql = `
    SELECT hp.*
    FROM cs_herbal_packages hp
    WHERE hp.decoction_date = '${dateStr}'
      AND hp.prescription_status = 'pending'
      AND hp.status = 'active'
    ORDER BY hp.doctor_name, hp.created_at
  `;
  return await query<HerbalPackage>(sql);
}

/**
 * D-Day (당일) 처방 미입력 긴급 알림 대상 조회
 */
export async function getDDayPrescriptionReminders(): Promise<HerbalPackage[]> {
  const today = getCurrentDate();

  const sql = `
    SELECT hp.*
    FROM cs_herbal_packages hp
    WHERE hp.decoction_date = '${today}'
      AND hp.prescription_status = 'pending'
      AND hp.status = 'active'
    ORDER BY hp.doctor_name, hp.created_at
  `;
  return await query<HerbalPackage>(sql);
}

/**
 * 처방 리마인더 잔디 알림 발송
 */
export async function sendPrescriptionReminder(
  packages: HerbalPackage[],
  urgencyLevel: 'D-2' | 'D-1' | 'D-Day'
): Promise<{ success: boolean; sentCount: number }> {
  if (packages.length === 0) {
    return { success: true, sentCount: 0 };
  }

  // 원장별로 그룹핑
  const byDoctor = packages.reduce((acc, pkg) => {
    const doctorName = pkg.doctor_name || '미지정';
    if (!acc[doctorName]) acc[doctorName] = [];
    acc[doctorName].push(pkg);
    return acc;
  }, {} as Record<string, HerbalPackage[]>);

  const colorMap = {
    'D-2': '#4CAF50', // 초록 - 여유 있음
    'D-1': '#FFA500', // 주황 - 주의
    'D-Day': '#FF0000', // 빨강 - 긴급
  };

  let sentCount = 0;

  for (const [doctorName, doctorPackages] of Object.entries(byDoctor)) {
    const patientList = doctorPackages
      .map(p => `- ${p.patient_name} (${p.herbal_name})`)
      .join('\n');

    try {
      await sendJandiWebhook({
        title: `[${urgencyLevel}] ${doctorName} 원장님 처방 입력 요청`,
        description: `처방 미입력 ${doctorPackages.length}건:\n${patientList}`,
        color: colorMap[urgencyLevel],
      });
      sentCount++;
    } catch (error) {
      console.error(`리마인더 발송 실패 (${doctorName}):`, error);
    }
  }

  return { success: true, sentCount };
}

/**
 * 처방 리마인더 배치 실행
 */
export async function runPrescriptionReminderBatch(): Promise<{
  d2: { count: number; sent: number };
  d1: { count: number; sent: number };
  dDay: { count: number; sent: number };
}> {
  const d2Packages = await getD2PrescriptionReminders();
  const d1Packages = await getD1PrescriptionReminders();
  const dDayPackages = await getDDayPrescriptionReminders();

  const d2Result = await sendPrescriptionReminder(d2Packages, 'D-2');
  const d1Result = await sendPrescriptionReminder(d1Packages, 'D-1');
  const dDayResult = await sendPrescriptionReminder(dDayPackages, 'D-Day');

  return {
    d2: { count: d2Packages.length, sent: d2Result.sentCount },
    d1: { count: d1Packages.length, sent: d1Result.sentCount },
    dDay: { count: dDayPackages.length, sent: dDayResult.sentCount },
  };
}

// ============================================
// 해피콜 자동 등록
// ============================================

/**
 * 배송 완료 후 해피콜 자동 등록
 * (markAsDelivered 호출 시 같이 호출)
 */
export async function autoRegisterDeliveryHappyCall(
  packageId: number
): Promise<{ success: boolean; careItemId?: number }> {
  try {
    // 패키지 정보 조회
    const pkg = await query<HerbalPackage & { patient_id: number }>(
      `SELECT * FROM cs_herbal_packages WHERE id = ${packageId}`
    );

    if (pkg.length === 0) {
      return { success: false };
    }

    const pkgData = pkg[0];

    // 해피콜 항목 생성
    const today = getCurrentDate();
    const careItem = await createDeliveryHappyCall(
      pkgData.patient_id,
      pkgData.patient_name,
      today
    );

    return { success: true, careItemId: careItem.id };
  } catch (error) {
    console.error('해피콜 자동 등록 오류:', error);
    return { success: false };
  }
}

/**
 * 복약 시작 시 7일차 해피콜 자동 등록
 */
export async function autoRegisterMedicationHappyCall(
  packageId: number
): Promise<{ success: boolean; careItemId?: number }> {
  try {
    const pkg = await query<HerbalPackage & { patient_id: number }>(
      `SELECT * FROM cs_herbal_packages WHERE id = ${packageId}`
    );

    if (pkg.length === 0) {
      return { success: false };
    }

    const pkgData = pkg[0];
    const today = getCurrentDate();

    const careItem = await createMedicationHappyCall(
      pkgData.patient_id,
      pkgData.patient_name,
      today
    );

    return { success: true, careItemId: careItem.id };
  } catch (error) {
    console.error('복약 해피콜 자동 등록 오류:', error);
    return { success: false };
  }
}

// ============================================
// 상태 자동 전이
// ============================================

/**
 * 탕전일 도래 시 decoction_status를 'pending' → 'ready'로 변경
 */
export async function autoTransitionToReady(): Promise<{ count: number }> {
  const today = getCurrentDate();
  const now = getCurrentTimestamp();

  const result = await execute(`
    UPDATE cs_herbal_packages
    SET
      decoction_status = 'ready',
      updated_at = '${now}'
    WHERE decoction_date = '${today}'
      AND decoction_status = 'pending'
      AND prescription_status = 'completed'
      AND status = 'active'
  `);

  // 변경된 건수 조회
  const countResult = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM cs_herbal_packages
     WHERE decoction_date = '${today}'
       AND decoction_status = 'ready'
       AND updated_at >= '${now}'::timestamp - interval '1 minute'`
  );

  return { count: parseInt(countResult[0]?.cnt || '0') };
}

/**
 * 오래된 pending 패키지 알림 (D+1 이상 경과)
 */
export async function getOverduePackages(): Promise<HerbalPackage[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const sql = `
    SELECT hp.*
    FROM cs_herbal_packages hp
    WHERE hp.decoction_date <= '${dateStr}'
      AND hp.decoction_status NOT IN ('completed')
      AND hp.status = 'active'
    ORDER BY hp.decoction_date ASC
  `;
  return await query<HerbalPackage>(sql);
}

/**
 * 상태 자동 전이 배치 실행
 */
export async function runStatusTransitionBatch(): Promise<{
  readyTransition: number;
  overdueCount: number;
}> {
  const readyResult = await autoTransitionToReady();
  const overduePackages = await getOverduePackages();

  // 오래된 패키지가 있으면 알림
  if (overduePackages.length > 0) {
    const overdueList = overduePackages
      .slice(0, 5) // 최대 5건만 표시
      .map(p => `- ${p.patient_name} (탕전일: ${p.decoction_date})`)
      .join('\n');

    await sendJandiWebhook({
      title: `[경고] 탕전 지연 패키지 ${overduePackages.length}건`,
      description: overdueList + (overduePackages.length > 5 ? `\n외 ${overduePackages.length - 5}건...` : ''),
      color: '#FF0000',
    });
  }

  return {
    readyTransition: readyResult.count,
    overdueCount: overduePackages.length,
  };
}

// ============================================
// 전체 배치 실행
// ============================================

export interface BatchResult {
  timestamp: string;
  prescriptionReminder: {
    d2: { count: number; sent: number };
    d1: { count: number; sent: number };
    dDay: { count: number; sent: number };
  };
  statusTransition: {
    readyTransition: number;
    overdueCount: number;
  };
}

/**
 * 전체 자동화 배치 실행
 */
export async function runAllBatches(): Promise<BatchResult> {
  const prescriptionResult = await runPrescriptionReminderBatch();
  const statusResult = await runStatusTransitionBatch();

  return {
    timestamp: getCurrentTimestamp(),
    prescriptionReminder: prescriptionResult,
    statusTransition: statusResult,
  };
}

/**
 * 배치 실행 시간 확인 (아침 8시, 오후 2시 실행 권장)
 */
export function shouldRunBatch(): boolean {
  const now = new Date();
  const hour = now.getHours();

  // 아침 8시 또는 오후 2시에 실행
  return hour === 8 || hour === 14;
}
