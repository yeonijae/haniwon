/**
 * 청구검토 API - MSSQL Detail/Customer 테이블 조회 및 규칙 필터링
 */

import { query, escapeString } from '@shared/lib/postgres';

const MSSQL_API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// --- 타입 ---

export interface BillingReviewRow {
  /** 진료일 (YYYY-MM-DD) */
  txDate: string;
  /** 환자 이름 */
  patientName: string;
  /** 차트번호 */
  chartNo: string;
  /** 담당의 */
  doctor: string;
  /** 진단명(진단코드) */
  diagnosisItems: string;
  /** 검출 사유 */
  reasonText: string;
  /** 급여청구내역 (세부 항목 전체 문자열) */
  claimItems: string;
  /** 해당 규칙 ID 목록 */
  matchedRules: string[];
  /** Customer_PK (그룹핑 키) */
  customerPk: number;
}

/** 쿼리 결과 원시 행 */
interface RawDetailRow {
  Customer_PK: number;
  tx_date: string;
  patient_name: string;
  chart_no: string;
  doctor: string;
  px_name: string;
  dx_name: string | null;
  is_insurance: number | boolean;
}

// --- 규칙 정의 ---

export interface BillingRule {
  id: string;
  label: string;
  description: string;
}

export const BILLING_RULES: BillingRule[] = [
  {
    id: 'RULE1',
    label: '일회용부항컵 → 자락관법/유관법 필요',
    description: '일회용부항컵이 있으면 자락관법 또는 유관법이 함께 있어야 합니다.',
  },
  {
    id: 'RULE2',
    label: '침술 최대 2종 / DxName 조건',
    description: '침술(투자/척추/복강내/관절강/안와내) 최대 2종, 2종이면 DxName 2개 이상 필요.',
  },
  {
    id: 'RULE3',
    label: '경피경근온열/한랭 청구불가',
    description: '경피경근온열 또는 경피경근한랭은 급여 청구 불가 항목입니다.',
  },
  {
    id: 'RULE4',
    label: '침술2종+기기구술+부항요법 동시',
    description: '침술 2종 + 기기구술 + 부항요법(자락관법/유관법) 동시 포함 (분류용).',
  },
];

// --- 침술 종류 판별 ---

const ACUPUNCTURE_TYPES = ['투자침술', '척추침술', '복강침술', '관절침술', '안와내침술', '복강내침술', '관절강침술', '흉복강침술'];

function getAcupunctureType(pxName: string): string | null {
  const name = (pxName || '').replace(/\s+/g, '');
  for (const t of ACUPUNCTURE_TYPES) {
    if (name.includes(t.replace(/\s+/g, ''))) return t;
  }
  // 포괄 매칭: "투자", "척추", "복강", "관절", "안와" 포함 + "침술" 포함
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

// --- 규칙 판정 ---

interface DayGroup {
  customerPk: number;
  txDate: string;
  patientName: string;
  chartNo: string;
  doctor: string;
  items: { pxName: string; dxName: string | null; isInsurance: number | boolean }[];
}

function isInsuranceItem(v: number | boolean): boolean {
  return v === 1 || v === true;
}

function normalizeDxName(s: string): string {
  let r = s;
  for (const ch of [' ', '\u3000', '(', ')', '\uFF08', '\uFF09', ',', '\uFF0C', '\u00B7', '\u30FB', '\t', '\r', '\n']) {
    r = r.split(ch).join('');
  }
  return r.trim().toLowerCase();
}

function checkRule1(group: DayGroup): boolean {
  const hasDisposableCup = group.items.some(
    (i) => i.pxName.includes('일회용부항컵')
  );
  if (!hasDisposableCup) return false;
  const hasJarakOrYugwan = group.items.some(
    (i) => i.pxName.includes('자락관법') || i.pxName.includes('유관법')
  );
  // 위반: 일회용부항컵 있는데 자락관법/유관법 없음
  return !hasJarakOrYugwan;
}

function evaluateRule2(
  group: DayGroup,
  diagnosisCodeMap: Map<string, string>
): { violates: boolean; acuClaimCount: number; dxCount: number } {
  // RULE2는 급여 청구 기준 + "침술 청구 건수" 기준으로 판정
  // DX 개수는 "진단코드가 매핑된 진단명"만 카운트
  const insuranceItems = group.items.filter((i) => isInsuranceItem(i.isInsurance));
  const acupunctureItems = insuranceItems.filter((i) => !!getAcupunctureType(i.pxName));

  const acuClaimCount = acupunctureItems.length;
  const uniqueDxWithCode = new Set(
    acupunctureItems
      .map((i) => (i.dxName || '').trim())
      .filter((d) => d.length > 0 && !!diagnosisCodeMap.get(d))
  );

  // 침술 청구 3건 이상이면 위반
  if (acuClaimCount > 2) {
    return { violates: true, acuClaimCount, dxCount: uniqueDxWithCode.size };
  }

  // 침술 청구 2건이면 DX(코드있는 진단명) 2개 이상 필요
  if (acuClaimCount === 2 && uniqueDxWithCode.size < 2) {
    return { violates: true, acuClaimCount, dxCount: uniqueDxWithCode.size };
  }

  return { violates: false, acuClaimCount, dxCount: uniqueDxWithCode.size };
}

function checkRule3(group: DayGroup): boolean {
  return group.items.some((i) => {
    const name = (i.pxName || '').replace(/\s+/g, '');
    // RULE3: 경피경근온열/한랭 관련 항목이 있으면 표시
    // (InsuYes 값과 무관하게 탐지하여 누락 방지)
    return (
      name.includes('경피경근온열') ||
      name.includes('경피경근한랭') ||
      (name.includes('경피경근') && (name.includes('온열') || name.includes('한랭')))
    );
  });
}

function checkRule4(group: DayGroup): boolean {
  const insuranceItems = group.items.filter((i) => isInsuranceItem(i.isInsurance));
  const acuTypes = new Set<string>();
  for (const item of insuranceItems) {
    const t = getAcupunctureType(item.pxName);
    if (t) acuTypes.add(t);
  }
  const has2Acu = acuTypes.size >= 2;
  const hasGigigu = insuranceItems.some((i) => i.pxName.includes('기기구술'));
  const hasCupping = insuranceItems.some(
    (i) => i.pxName.includes('자락관법') || i.pxName.includes('유관법')
  );
  return has2Acu && hasGigigu && hasCupping;
}

const RULE_CHECKS: Record<string, (g: DayGroup) => boolean> = {
  RULE1: checkRule1,
  RULE3: checkRule3,
  RULE4: checkRule4,
};

// --- 데이터 조회 ---

export async function fetchBillingReviewData(
  startDate: string,
  endDate: string,
  selectedRules: string[]
): Promise<BillingReviewRow[]> {
  // 급여 항목(InsuYes=1) 전체 조회 + 규칙 판정에 필요한 비급여 항목도 포함
  const sql = `
    SELECT
      d.Customer_PK,
      CONVERT(varchar, d.TxDate, 23) AS tx_date,
      c.name AS patient_name,
      c.sn AS chart_no,
      ISNULL(d.TxDoctor, '') AS doctor,
      ISNULL(d.PxName, '') AS px_name,
      d.DxName AS dx_name,
      d.InsuYes AS is_insurance
    FROM Detail d
    JOIN Customer c ON d.Customer_PK = c.Customer_PK
    WHERE CONVERT(varchar, d.TxDate, 23) >= '${startDate}'
      AND CONVERT(varchar, d.TxDate, 23) <= '${endDate}'
    ORDER BY d.TxDate, c.name
  `;

  const response = await fetch(`${MSSQL_API_BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    let serverMessage = '';
    try {
      const errJson = await response.json();
      serverMessage = errJson?.error || errJson?.message || '';
    } catch {
      // ignore json parse error
    }
    throw new Error(`MSSQL API 오류: ${response.status}${serverMessage ? ` - ${serverMessage}` : ''}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  // columns + rows 를 객체 배열로 변환
  const columns: string[] = data.columns || [];
  const rows: any[][] = data.rows || [];

  const rawRows: RawDetailRow[] = rows.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as RawDetailRow;
  });

  // Customer_PK + tx_date 로 그룹핑
  const groupMap = new Map<string, DayGroup>();
  for (const r of rawRows) {
    const key = `${r.Customer_PK}_${r.tx_date}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        customerPk: r.Customer_PK,
        txDate: r.tx_date,
        patientName: r.patient_name || '',
        chartNo: r.chart_no || '',
        doctor: r.doctor || '',
        items: [],
      });
    }
    const g = groupMap.get(key)!;
    g.items.push({
      pxName: r.px_name || '',
      dxName: r.dx_name,
      isInsurance: r.is_insurance ?? 0,
    });
    // 담당의: 첫 번째 비어있지 않은 값 사용
    if (!g.doctor && r.doctor) {
      g.doctor = r.doctor;
    }
  }

  // 진단명 -> 진단코드 매핑 (PostgreSQL diagnosis_code_map)
  const diagnosisCodeMap = new Map<string, string>();
  try {
    const uniqueDxNames = [...new Set(
      Array.from(groupMap.values())
        .flatMap((g) => g.items.map((i) => (i.dxName || '').trim()))
        .filter((name) => name.length > 0)
    )];

    const normNames = [...new Set(uniqueDxNames.map((name) => normalizeDxName(name)).filter(Boolean))];

    if (normNames.length > 0) {
      const inClause = normNames.map((n) => escapeString(n)).join(',');
      const pgRows = await query<{ dx_name_norm: string; kcd_code: string }>(
        `SELECT dx_name_norm, kcd_code FROM diagnosis_code_map WHERE dx_name_norm IN (${inClause}) AND is_active = true AND kcd_code IS NOT NULL`
      );

      const normToCode = new Map<string, string>();
      for (const row of pgRows) {
        normToCode.set(row.dx_name_norm, row.kcd_code);
      }

      for (const original of uniqueDxNames) {
        const code = normToCode.get(normalizeDxName(original));
        if (code) diagnosisCodeMap.set(original, code);
      }
    }
  } catch (pgError) {
    console.error('PG diagnosis_code_map 조회 오류:', pgError);
  }

  // 규칙 필터링 적용
  const activeRules = selectedRules.length > 0 ? selectedRules : BILLING_RULES.map((r) => r.id);

  const result: BillingReviewRow[] = [];

  for (const group of groupMap.values()) {
    const matched: string[] = [];
    for (const ruleId of activeRules) {
      if (ruleId === 'RULE2') {
        if (evaluateRule2(group, diagnosisCodeMap).violates) {
          matched.push(ruleId);
        }
        continue;
      }

      const check = RULE_CHECKS[ruleId];
      if (check && check(group)) {
        matched.push(ruleId);
      }
    }

    if (matched.length === 0) continue;

    // 급여청구내역: 급여 항목의 PxName 전체 나열
    const insuranceItemNames = group.items
      .filter((i) => isInsuranceItem(i.isInsurance))
      .map((i) => i.pxName)
      .filter((n) => n);

    // 비급여 항목도 표시 (일회용부항컵 등)
    const nonInsuranceItemNames = group.items
      .filter((i) => !isInsuranceItem(i.isInsurance))
      .map((i) => i.pxName)
      .filter((n) => n);

    const claimParts: string[] = [];
    if (insuranceItemNames.length > 0) {
      claimParts.push(`[급여] ${insuranceItemNames.join(', ')}`);
    }
    if (nonInsuranceItemNames.length > 0) {
      claimParts.push(`[비급여] ${nonInsuranceItemNames.join(', ')}`);
    }

    const diagnosisSet = new Set(
      group.items
        .map((i) => (i.dxName || '').trim())
        .filter((d) => d.length > 0)
    );
    const diagnosisDisplay = Array.from(diagnosisSet).map((name) => {
      const code = diagnosisCodeMap.get(name);
      return code ? `${name} (${code})` : name;
    });

    const reasonParts: string[] = [];
    for (const ruleId of matched) {
      if (ruleId === 'RULE2') {
        const r2 = evaluateRule2(group, diagnosisCodeMap);
        reasonParts.push(`RULE2: 침술청구 ${r2.acuClaimCount}건, DX(코드있음) ${r2.dxCount}개`);
      } else {
        const label = BILLING_RULES.find((r) => r.id === ruleId)?.label || ruleId;
        reasonParts.push(`${ruleId}: ${label}`);
      }
    }

    result.push({
      txDate: group.txDate,
      patientName: group.patientName,
      chartNo: group.chartNo,
      doctor: group.doctor,
      diagnosisItems: diagnosisDisplay.length > 0 ? diagnosisDisplay.join(', ') : '-',
      reasonText: reasonParts.join(' | '),
      claimItems: claimParts.join(' | '),
      matchedRules: matched,
      customerPk: group.customerPk,
    });
  }

  // 날짜 → 환자이름 순으로 정렬
  result.sort((a, b) => {
    if (a.txDate !== b.txDate) return a.txDate.localeCompare(b.txDate);
    return a.patientName.localeCompare(b.patientName);
  });

  return result;
}
