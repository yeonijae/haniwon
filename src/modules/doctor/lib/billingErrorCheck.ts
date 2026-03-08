/**
 * 청구 오류 판정 헬퍼 (RULE1~3만 적용)
 * manage/lib/billingReviewApi.ts의 규칙 로직을 최소화하여 포팅
 * RULE4는 분류용이므로 오류 배경 표시 대상 아님
 *
 * 진료메모2 필수 토큰 검증 (치료 항목별 메모2 기재 필수)
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

/** 자락관법이체 급여 포함 여부 (점검 필요 항목) */
function checkJarakTransfer(treatments: ReceiptTreatment[]): boolean {
  return treatments.some(t => t.is_covered && t.name.includes('자락관법이체'));
}

/** RULE1~3 위반 또는 점검 필요 항목이 있으면 true */
export function hasBillingError(treatments: ReceiptTreatment[] | undefined): boolean {
  if (!treatments || treatments.length === 0) return false;
  return checkRule1(treatments) || checkRule2(treatments) || checkRule3(treatments) || checkJarakTransfer(treatments);
}

/** RULE1~3 위반 사유 목록 반환 (위반 없으면 빈 배열) */
export function getBillingErrorReasons(treatments: ReceiptTreatment[] | undefined): string[] {
  if (!treatments || treatments.length === 0) return [];
  const reasons: string[] = [];
  if (checkRule1(treatments)) reasons.push('일회용부항컵 사용 시 자락관법/유관법 필요');
  if (checkRule2(treatments)) reasons.push('침술 2종 초과 또는 2종 시 진단명 2개 이상 필요');
  if (checkRule3(treatments)) reasons.push('경피경근온열/한랭은 급여 청구 불가');
  if (checkJarakTransfer(treatments)) reasons.push('자락관법이체 점검 필요');
  return reasons;
}

// ── 진료메모2 필수 토큰 검증 ─────────────────────────────────────

/**
 * 토큰 뒤에 실질적 내용이 있는지 검증
 * - 같은 줄에서 토큰 뒤에 한글/영문/숫자가 1자 이상 있거나
 *   구두점·공백을 제외한 텍스트 길이가 2 이상이면 유효
 * - 예: '투자)' → 실패, '투자) L3-4' → 성공, '기기구) -' → 실패
 */
function hasContentAfterToken(text: string, token: string, allowNextLine = false, invalidContentPattern?: RegExp): boolean {
  // 각 줄의 앞 공백을 무시하여 ' [추나]' 등 변형도 매칭
  const normalized = text.replace(/^[ \t]+/gm, '');
  const idx = normalized.indexOf(token);
  if (idx === -1) return false;

  // 토큰 뒤 같은 줄의 텍스트 추출
  const afterToken = normalized.substring(idx + token.length);
  const lineEnd = afterToken.indexOf('\n');
  const restOfLine = lineEnd === -1 ? afterToken : afterToken.substring(0, lineEnd);

  // 토큰별 무효 콘텐츠 패턴 체크 (예: 적외선 템플릿 텍스트 '부위 10분')
  if (invalidContentPattern && invalidContentPattern.test(restOfLine)) return false;

  // 한글/영문/숫자가 1자 이상 포함되면 유효
  if (/[가-힣a-zA-Z0-9]/.test(restOfLine)) return true;

  // 구두점·공백·기호 제외 후 길이 2 이상이면 유효
  const stripped = restOfLine.replace(/[\s\-_.,;:!?'"()\[\]{}/<>@#$%^&*+=~`|\\]/g, '');
  if (stripped.length >= 2) return true;

  // 추나 예외: 같은 줄에 내용이 없으면 다음 비어있지 않은 줄에서 내용 검증
  if (allowNextLine && lineEnd !== -1) {
    const remainingLines = afterToken.substring(lineEnd + 1).split('\n');
    const nextNonEmpty = remainingLines.find(l => l.trim().length > 0);
    if (nextNonEmpty) {
      if (/[가-힣a-zA-Z0-9]/.test(nextNonEmpty)) return true;
      const strippedNext = nextNonEmpty.replace(/[\s\-_.,;:!?'"()\[\]{}/<>@#$%^&*+=~`|\\]/g, '');
      return strippedNext.length >= 2;
    }
  }

  return false;
}

/** 치료 항목 → 메모2 필수 토큰 매핑 */
const MEMO2_RULES: { match: string; covered: boolean; token: string | string[]; label: string; allowNextLine?: boolean; invalidContentPattern?: RegExp }[] = [
  { match: '추나', covered: true,  token: ['[추나]', '추나)'],    label: '추나 → [추나] 또는 추나)', allowNextLine: true },
  { match: '약침', covered: false, token: '약침)',     label: '약침 → 약침)' },
  { match: '기기구술', covered: true,  token: '기기구)',   label: '기기구술 → 기기구)' },
  { match: '자락관법', covered: true,  token: '습부)',     label: '자락관법 → 습부)' },
  { match: '척추침술', covered: true,  token: '척추)',     label: '척추침술 → 척추)' },
  { match: '관절강침술', covered: true,  token: '관절)',   label: '관절강침술 → 관절)' },
  { match: '투자침술', covered: true,  token: '투자)',     label: '투자침술 → 투자)' },
  { match: '복강내침술', covered: true,  token: '복강)',   label: '복강내침술 → 복강)' },
  { match: '경피적외선조사', covered: true, token: ['적외선)', '경피적외선)', '경피적외선요법)'], label: '경피적외선조사 → 적외선)/경피적외선)/경피적외선요법', invalidContentPattern: /^\s*부위\s*\d+분\s*$/ },
  { match: '유관법', covered: true,  token: '유관법)',   label: '유관법 → 유관법)' },
];

/** 진료메모2 누락 토큰 사유 반환 (위반 없으면 빈 배열) */
export function getMemo2Warnings(
  treatments: ReceiptTreatment[] | undefined,
  memo2: string | undefined,
): string[] {
  if (!treatments || treatments.length === 0) return [];
  const text = memo2 || '';
  const normalized = text.replace(/^[ \t]+/gm, '');
  const reasons: string[] = [];

  for (const rule of MEMO2_RULES) {
    const hasTreatment = treatments.some(t =>
      t.name.includes(rule.match) && (rule.covered ? t.is_covered : !t.is_covered),
    );
    const tokens = Array.isArray(rule.token) ? rule.token : [rule.token];
    const displayToken = tokens[0];

    if (hasTreatment) {
      // 토큰 존재 + 토큰 뒤 실질적 내용까지 검증
      if (!tokens.some(t => hasContentAfterToken(text, t, rule.allowNextLine, rule.invalidContentPattern))) {
        const tokenExists = tokens.some(t => normalized.includes(t));
        if (tokenExists) {
          reasons.push(`${displayToken} 내용 누락`);
        } else {
          reasons.push(`${displayToken} 누락`);
        }
      }
    } else {
      // 치료 항목 없는데 토큰이 존재하면 불필요
      if (tokens.some(t => normalized.includes(t))) {
        reasons.push(`${displayToken} 불필요`);
      }
    }
  }
  return reasons;
}

/** 진료메모2 위반 여부 (빠른 판별) */
export function hasMemo2Warning(
  treatments: ReceiptTreatment[] | undefined,
  memo2: string | undefined,
): boolean {
  if (!treatments || treatments.length === 0) return false;
  const text = memo2 || '';
  const normalized = text.replace(/^[ \t]+/gm, '');
  for (const rule of MEMO2_RULES) {
    const hasTreatment = treatments.some(t =>
      t.name.includes(rule.match) && (rule.covered ? t.is_covered : !t.is_covered),
    );
    const tokens = Array.isArray(rule.token) ? rule.token : [rule.token];
    if (hasTreatment) {
      // 토큰 존재 + 토큰 뒤 실질적 내용까지 검증
      if (!tokens.some(t => hasContentAfterToken(text, t, rule.allowNextLine, rule.invalidContentPattern))) return true;
    } else {
      // 치료 항목 없는데 토큰이 존재하면 불필요
      if (tokens.some(t => normalized.includes(t))) return true;
    }
  }
  return false;
}
