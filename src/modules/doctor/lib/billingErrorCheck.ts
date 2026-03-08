/**
 * 청구 오류 판정 헬퍼 (RULE1~3만 적용)
 * manage/lib/billingReviewApi.ts의 규칙 로직을 최소화하여 포팅
 * RULE4는 분류용이므로 오류 배경 표시 대상 아님
 */

import type { ReceiptTreatment } from '@modules/manage/lib/api';

// 침술 종류 판별 (billingReviewApi.ts와 동일 로직)
const ACUPUNCTURE_TYPES = [
  '투자침술', '척추침술', '복강침술', '관절침술',
  '안와내침술', '복강내침술', '관절강침술', '흉복강침술',
];

function getAcupunctureType(name: string): string | null {
  for (const t of ACUPUNCTURE_TYPES) {
    if (name.includes(t)) return t;
  }
  if (name.includes('침술')) {
    if (name.includes('투자')) return '투자침술';
    if (name.includes('척추')) return '척추침술';
    if (name.includes('복강')) return '복강침술';
    if (name.includes('관절')) return '관절침술';
    if (name.includes('안와')) return '안와내침술';
    if (name.includes('흉복강')) return '흉복강침술';
  }
  return null;
}

/** RULE1: 일회용부항컵 있으면 자락관법/유관법 필요 */
function checkRule1(treatments: ReceiptTreatment[]): boolean {
  const hasCup = treatments.some(t => t.name.includes('일회용부항컵'));
  if (!hasCup) return false;
  return !treatments.some(t => t.name.includes('자락관법') || t.name.includes('유관법'));
}

/** RULE2: 침술 최대 2종, 2종이면 DxName 2개 이상 */
function checkRule2(treatments: ReceiptTreatment[]): boolean {
  const insured = treatments.filter(t => t.is_covered);
  const acuTypes = new Set<string>();
  for (const t of insured) {
    const type = getAcupunctureType(t.name);
    if (type) acuTypes.add(type);
  }
  if (acuTypes.size > 2) return true;
  if (acuTypes.size === 2) {
    const uniqueDx = new Set(
      insured.map(t => (t.diagnosis || '').trim()).filter(d => d !== '')
    );
    if (uniqueDx.size < 2) return true;
  }
  return false;
}

/** RULE3: 경피경근온열/한랭은 급여 청구 불가 */
function checkRule3(treatments: ReceiptTreatment[]): boolean {
  return treatments.some(
    t => t.is_covered && (t.name.includes('경피경근온열') || t.name.includes('경피경근한랭'))
  );
}

/** RULE1~3 중 하나라도 위반이면 true */
export function hasBillingError(treatments: ReceiptTreatment[] | undefined): boolean {
  if (!treatments || treatments.length === 0) return false;
  return checkRule1(treatments) || checkRule2(treatments) || checkRule3(treatments);
}

/** RULE1~3 위반 사유 목록 반환 (위반 없으면 빈 배열) */
export function getBillingErrorReasons(treatments: ReceiptTreatment[] | undefined): string[] {
  if (!treatments || treatments.length === 0) return [];
  const reasons: string[] = [];
  if (checkRule1(treatments)) reasons.push('일회용부항컵 사용 시 자락관법/유관법 필요');
  if (checkRule2(treatments)) reasons.push('침술 2종 초과 또는 2종 시 진단명 2개 이상 필요');
  if (checkRule3(treatments)) reasons.push('경피경근온열/한랭은 급여 청구 불가');
  return reasons;
}
