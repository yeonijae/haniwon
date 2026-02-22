/**
 * VIP 관리 API
 * patient_vip_history 테이블 CRUD + 자동 스코어링
 */
import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

const MSSQL_API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

async function mssqlQuery<T = any>(sql: string): Promise<T[]> {
  const response = await fetch(`${MSSQL_API_BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!response.ok) throw new Error('MSSQL query failed');
  const data = await response.json();
  const columns: string[] = data.columns || [];
  const rows: any[] = data.rows || data.data || [];
  // rows가 배열의 배열이면 객체로 변환
  if (rows.length > 0 && Array.isArray(rows[0])) {
    return rows.map(row => {
      const obj: any = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) as T[];
  }
  return rows as T[];
}

export interface VipRecord {
  id: number;
  patient_id: number;
  year: number;
  grade: 'VVIP' | 'VIP';
  reason: string | null;
  score: number | null;
  created_by: string | null;
  created_at: string;
  // JOIN
  name?: string;
  chart_number?: string;
  phone?: string;
  last_visit_date?: string;
  vip_years?: number[]; // 이 환자의 전체 VIP 연도 목록
}

export interface VipFamilyMember {
  name: string;
  chart_number: string;
  revenue: number;
  noncovered: number;
  copay: number;
  visit_count: number;
}

export interface VipCandidate {
  patient_id: number;
  name: string;
  chart_number: string;
  phone: string | null;
  score: number;
  revenue: number;          // 총진료비
  noncovered: number;       // 비급여
  copay: number;            // 본인부담금
  visit_count: number;
  first_visit_year: number | null;
  suggested_grade: 'VVIP' | 'VIP';
  reason: string;
  familyMembers?: VipFamilyMember[];  // 가족합산 시 구성원 상세
  referral_count: number;      // 소개한 환자 수
  referral_total_revenue: number;  // 소개 환자들의 총매출
  referral_noncovered: number;     // 소개 환자들의 비급여매출
}

export interface VipStats {
  year: number;
  vvip_count: number;
  vip_count: number;
  total: number;
}

// ── 테이블 자동 생성 ──

export async function ensureVipTables(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS patient_vip_history (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      grade TEXT NOT NULL DEFAULT 'VIP',
      reason TEXT,
      score NUMERIC,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(patient_id, year)
    )
  `);

  // patients 테이블에 vip 캐시 컬럼
  await Promise.all([
    execute(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS vip_grade TEXT`).catch(() => {}),
    execute(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS vip_since DATE`).catch(() => {}),
  ]);
}

// ── CRUD ──

export async function getVipListByYear(year: number): Promise<VipRecord[]> {
  await ensureVipTables();

  const records = await query<VipRecord>(`
    SELECT
      v.id, v.patient_id, v.year, v.grade, v.reason, v.score, v.created_by, v.created_at,
      p.name, p.chart_number, p.phone, p.last_visit_date
    FROM patient_vip_history v
    JOIN patients p ON v.patient_id = p.id
    WHERE v.year = ${year}
    ORDER BY v.grade ASC, v.score DESC NULLS LAST, p.name ASC
  `);

  // 각 환자의 전체 VIP 연도 가져오기
  if (records.length > 0) {
    const patientIds = [...new Set(records.map(r => r.patient_id))];
    const allYears = await query<{ patient_id: number; year: number }>(`
      SELECT patient_id, year FROM patient_vip_history
      WHERE patient_id IN (${patientIds.join(',')})
      ORDER BY year
    `);
    const yearMap = new Map<number, number[]>();
    allYears.forEach(r => {
      if (!yearMap.has(r.patient_id)) yearMap.set(r.patient_id, []);
      yearMap.get(r.patient_id)!.push(r.year);
    });
    records.forEach(r => { r.vip_years = yearMap.get(r.patient_id) || []; });
  }

  return records;
}

export async function addVip(
  patientId: number,
  year: number,
  grade: 'VVIP' | 'VIP',
  reason?: string,
  score?: number,
  createdBy?: string,
): Promise<void> {
  await ensureVipTables();
  const now = getCurrentTimestamp();

  await execute(`
    INSERT INTO patient_vip_history (patient_id, year, grade, reason, score, created_by, created_at)
    VALUES (${patientId}, ${year}, ${escapeString(grade)}, ${reason ? escapeString(reason) : 'NULL'}, ${score ?? 'NULL'}, ${createdBy ? escapeString(createdBy) : 'NULL'}, ${escapeString(now)})
    ON CONFLICT (patient_id, year) DO UPDATE SET grade = ${escapeString(grade)}, reason = ${reason ? escapeString(reason) : 'NULL'}, score = ${score ?? 'NULL'}
  `);

  // 현재 연도면 캐시 업데이트
  const currentYear = new Date().getFullYear();
  if (year === currentYear) {
    await execute(`UPDATE patients SET vip_grade = ${escapeString(grade)}, vip_since = COALESCE(vip_since, CURRENT_DATE) WHERE id = ${patientId}`);
  }
}

export async function removeVip(patientId: number, year: number): Promise<void> {
  await execute(`DELETE FROM patient_vip_history WHERE patient_id = ${patientId} AND year = ${year}`);

  // 현재 연도면 캐시 제거
  const currentYear = new Date().getFullYear();
  if (year === currentYear) {
    // 다른 연도 VIP가 있는지 확인
    const remaining = await query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM patient_vip_history WHERE patient_id = ${patientId} AND year = ${currentYear}`);
    if (!remaining[0]?.cnt) {
      await execute(`UPDATE patients SET vip_grade = NULL WHERE id = ${patientId}`);
    }
  }
}

export async function updateVipGrade(id: number, grade: 'VVIP' | 'VIP'): Promise<void> {
  await execute(`UPDATE patient_vip_history SET grade = ${escapeString(grade)} WHERE id = ${id}`);
}

export async function getVipStats(year: number): Promise<VipStats> {
  const result = await query<{ grade: string; cnt: number }>(`
    SELECT grade, COUNT(*) as cnt FROM patient_vip_history WHERE year = ${year} GROUP BY grade
  `);
  const vvip = result.find(r => r.grade === 'VVIP')?.cnt || 0;
  const vip = result.find(r => r.grade === 'VIP')?.cnt || 0;
  return { year, vvip_count: vvip, vip_count: vip, total: vvip + vip };
}

// ── 환자의 VIP 이력 조회 (대시보드용) ──

export async function getPatientVipYears(patientId: number): Promise<{ year: number; grade: string }[]> {
  await ensureVipTables();
  return query<{ year: number; grade: string }>(`
    SELECT year, grade FROM patient_vip_history WHERE patient_id = ${patientId} ORDER BY year
  `);
}

// ── VIP 후보 자동 스코어링 ──
// 비급여 매출(한약 선결제) + 내원 횟수 기반

export type RevenueCriteria = 'total' | 'noncovered' | 'copay';

export interface VipCriteriaOptions {
  revenueCriteria?: RevenueCriteria[];  // 매출 세분: 총진료비, 비급여, 본인부담금 (단일 선택)
  visits?: boolean;    // 내원횟수
  loyalty?: boolean;   // 충성도 (연차)
  familySum?: boolean; // 가족합산
  referral?: boolean;  // 소개자 기준 포함 여부
  minScore?: number;
  maxCount?: number;
}

export async function generateVipCandidates(year: number, limit: number = 30, options?: VipCriteriaOptions): Promise<VipCandidate[]> {
  await ensureVipTables();

  // 1. MSSQL Receipt 테이블에서 연간 환자별 매출(3종) + 내원횟수 조회
  const mssqlData = await mssqlQuery<{
    Customer_PK: number;
    total_revenue: number;   // 총진료비 (본인부담 + 청구 + 비급여)
    noncovered: number;      // 비급여
    copay: number;           // 본인부담금
    visit_count: number;
  }>(`
    SELECT
      Customer_PK,
      SUM(CAST(Bonin_Money AS bigint) + CAST(CheongGu_Money AS bigint) + CAST(General_Money AS bigint)) as total_revenue,
      SUM(CAST(General_Money AS bigint)) as noncovered,
      SUM(CAST(Bonin_Money AS bigint)) as copay,
      COUNT(DISTINCT CONVERT(varchar, TxDate, 23)) as visit_count
    FROM Receipt
    WHERE YEAR(TxDate) = ${year}
    GROUP BY Customer_PK
    HAVING SUM(CAST(Bonin_Money AS bigint) + CAST(CheongGu_Money AS bigint) + CAST(General_Money AS bigint)) > 0
    ORDER BY total_revenue DESC
  `);

  if (!mssqlData.length) return [];

  const useFamilySum = options?.familySum === true;
  const customerDataMap = new Map(mssqlData.map(d => [d.Customer_PK, d]));

  // 1b. 가족합산: regFamily로 그룹핑
  let familyMap: Map<number, number[]> | null = null; // regFamily → Customer_PK[]
  let customerToFamily: Map<number, number> | null = null; // Customer_PK → regFamily
  if (useFamilySum) {
    // Step 1: 상위 환자들의 regFamily 조회
    const topIds = mssqlData.slice(0, limit * 3).map(d => d.Customer_PK);
    const familyRows: { Customer_PK: number; regFamily: number }[] = [];
    for (let i = 0; i < topIds.length; i += 500) {
      const batch = topIds.slice(i, i + 500);
      const rows = await mssqlQuery<{ Customer_PK: number; regFamily: number }>(
        `SELECT Customer_PK, regFamily FROM Customer WHERE Customer_PK IN (${batch.join(',')}) AND regFamily IS NOT NULL AND regFamily != 0`
      );
      familyRows.push(...rows);
    }

    // Step 2: 발견된 regFamily의 모든 구성원 조회 (mssqlData에 없는 구성원 포함)
    const familyIds = [...new Set(familyRows.map(r => r.regFamily))];
    const allFamilyMembers: { Customer_PK: number; regFamily: number }[] = [];
    for (let i = 0; i < familyIds.length; i += 200) {
      const batch = familyIds.slice(i, i + 200);
      const rows = await mssqlQuery<{ Customer_PK: number; regFamily: number }>(
        `SELECT Customer_PK, regFamily FROM Customer WHERE regFamily IN (${batch.join(',')})`
      );
      allFamilyMembers.push(...rows);
    }

    familyMap = new Map();
    customerToFamily = new Map();
    for (const r of allFamilyMembers) {
      customerToFamily.set(r.Customer_PK, r.regFamily);
      if (!familyMap.has(r.regFamily)) familyMap.set(r.regFamily, []);
      familyMap.get(r.regFamily)!.push(r.Customer_PK);
    }

    // Step 3: mssqlData에 없는 가족 구성원의 매출 조회
    const existingIds = new Set(mssqlData.map(d => d.Customer_PK));
    const missingIds = allFamilyMembers.map(r => r.Customer_PK).filter(id => !existingIds.has(id));
    if (missingIds.length > 0) {
      for (let i = 0; i < missingIds.length; i += 500) {
        const batch = missingIds.slice(i, i + 500);
        const rows = await mssqlQuery<{
          Customer_PK: number; total_revenue: number; noncovered: number; copay: number; visit_count: number;
        }>(`
          SELECT Customer_PK,
            ISNULL(SUM(CAST(Bonin_Money AS bigint) + CAST(CheongGu_Money AS bigint) + CAST(General_Money AS bigint)), 0) as total_revenue,
            ISNULL(SUM(CAST(General_Money AS bigint)), 0) as noncovered,
            ISNULL(SUM(CAST(Bonin_Money AS bigint)), 0) as copay,
            COUNT(DISTINCT CONVERT(varchar, TxDate, 23)) as visit_count
          FROM Receipt WHERE Customer_PK IN (${batch.join(',')}) AND YEAR(TxDate) = ${year}
          GROUP BY Customer_PK
        `);
        for (const r of rows) {
          mssqlData.push(r);
          customerDataMap.set(r.Customer_PK, r);
        }
      }
    }
  }

  // 2. MSSQL Customer_PK → PostgreSQL patients 매핑 (가족 포함)
  let topCustomerIds = mssqlData.slice(0, limit * 3).map(d => d.Customer_PK);
  if (useFamilySum && familyMap) {
    const extraIds = new Set<number>();
    for (const cid of topCustomerIds) {
      const famId = customerToFamily?.get(cid);
      if (famId) {
        for (const mid of familyMap.get(famId) || []) extraIds.add(mid);
      }
    }
    topCustomerIds = [...new Set([...topCustomerIds, ...extraIds])];
  }
  const patients = await query<{
    id: number; mssql_id: number; name: string; chart_number: string;
    phone: string | null; first_visit_date: string | null;
  }>(`
    SELECT id, mssql_id, name, chart_number, phone, first_visit_date
    FROM patients
    WHERE mssql_id IN (${topCustomerIds.join(',')})
  `);

  const patientMap = new Map(patients.map(p => [p.mssql_id, p]));

  // 2b. 소개자 데이터 조회
  const useReferral = options?.referral === true;
  const referralMap = new Map<string, { referral_count: number; referral_total_revenue: number; referral_noncovered: number }>();
  if (useReferral) {
    const referralRows = await mssqlQuery<{
      referrer_sn: string; referral_count: number; referral_total_revenue: number; referral_noncovered: number;
    }>(`
      SELECT 
        ref.sn AS referrer_sn,
        COUNT(DISTINCT c.Customer_PK) AS referral_count,
        ISNULL(SUM(rev.total_rev), 0) AS referral_total_revenue,
        ISNULL(SUM(rev.noncovered_rev), 0) AS referral_noncovered
      FROM Customer c
      CROSS APPLY (
        SELECT SUBSTRING(c.suggcustnamesn, CHARINDEX('[', c.suggcustnamesn) + 1, 
               CHARINDEX(']', c.suggcustnamesn) - CHARINDEX('[', c.suggcustnamesn) - 1) AS ref_sn
      ) parsed
      JOIN Customer ref ON ref.sn = parsed.ref_sn
      LEFT JOIN (
        SELECT Customer_PK, 
          SUM(CAST(Bonin_Money AS bigint) + CAST(General_Money AS bigint)) AS total_rev, 
          SUM(CAST(General_Money AS bigint)) AS noncovered_rev
        FROM Receipt
        GROUP BY Customer_PK
      ) rev ON rev.Customer_PK = c.Customer_PK
      WHERE c.suggcustnamesn IS NOT NULL AND c.suggcustnamesn != '' 
        AND c.suggcustnamesn LIKE '%[[]%]%'
      GROUP BY ref.sn
    `);
    for (const r of referralRows) {
      referralMap.set(String(r.referrer_sn), {
        referral_count: Number(r.referral_count),
        referral_total_revenue: Number(r.referral_total_revenue),
        referral_noncovered: Number(r.referral_noncovered),
      });
    }
  }

  // 3. 이미 해당 연도 VIP인 환자 제외
  const existing = await query<{ patient_id: number }>(`SELECT patient_id FROM patient_vip_history WHERE year = ${year}`);
  const existingIds = new Set(existing.map(e => e.patient_id));

  // 4. 기준 옵션 적용
  const revCriteria = options?.revenueCriteria ?? ['total'];  // 기본: 총진료비
  const useVisits = options?.visits !== false;
  const useLoyalty = options?.loyalty !== false;
  const minScore = options?.minScore ?? 0;
  const maxCount = options?.maxCount || limit;

  // 기준별 기본 가중치 (매출 세분류는 각각 동일 비중으로 나눔)
  const revWeight = revCriteria.length > 0 ? 40 / revCriteria.length : 0;
  const visitWeight = useVisits ? 30 : 0;
  const loyaltyWeight = useLoyalty ? 20 : 0;
  const totalWeight = revWeight * revCriteria.length + visitWeight + loyaltyWeight;
  const normalize = totalWeight > 0 ? 100 / totalWeight : 1;

  const maxTotal = Math.max(...mssqlData.map(d => d.total_revenue), 1);
  const maxNoncovered = Math.max(...mssqlData.map(d => d.noncovered), 1);
  const maxCopay = Math.max(...mssqlData.map(d => d.copay), 1);
  const maxVisits = Math.max(...mssqlData.map(d => d.visit_count), 1);
  const currentYear = new Date().getFullYear();

  const candidates: VipCandidate[] = [];
  const processedFamilies = new Set<number>(); // 이미 처리한 가족 그룹

  for (const d of mssqlData) {
    const p = patientMap.get(d.Customer_PK);
    if (!p) continue;
    if (existingIds.has(p.id)) continue;

    // 가족합산 처리
    let effectiveRevenue = d.total_revenue;
    let effectiveNoncovered = d.noncovered;
    let effectiveCopay = d.copay;
    let effectiveVisits = d.visit_count;
    let familyMemberDetails: VipFamilyMember[] = [];

    if (useFamilySum && customerToFamily) {
      const famId = customerToFamily.get(d.Customer_PK);
      if (famId && familyMap) {
        if (processedFamilies.has(famId)) continue;
        processedFamilies.add(famId);
        const members = familyMap.get(famId) || [];
        for (const memberId of members) {
          if (memberId === d.Customer_PK) continue;
          const md = customerDataMap.get(memberId);
          const mp = patientMap.get(memberId);
          if (md) {
            effectiveRevenue += md.total_revenue;
            effectiveNoncovered += md.noncovered;
            effectiveCopay += md.copay;
            effectiveVisits += md.visit_count;
            familyMemberDetails.push({
              name: mp?.name || `#${memberId}`,
              chart_number: mp?.chart_number || '',
              revenue: md.total_revenue,
              noncovered: md.noncovered,
              copay: md.copay,
              visit_count: md.visit_count,
            });
          }
        }
      }
    }

    const firstVisitYear = p.first_visit_date ? new Date(p.first_visit_date).getFullYear() : null;

    // 매출 점수
    let revenueScore = 0;
    if (revCriteria.includes('total')) revenueScore += (effectiveRevenue / maxTotal) * revWeight * normalize;
    if (revCriteria.includes('noncovered')) revenueScore += (effectiveNoncovered / maxNoncovered) * revWeight * normalize;
    if (revCriteria.includes('copay')) revenueScore += (effectiveCopay / maxCopay) * revWeight * normalize;

    const visitScore = useVisits ? (effectiveVisits / maxVisits) * visitWeight * normalize : 0;
    const loyaltyScore = useLoyalty && firstVisitYear ? Math.min(((currentYear - firstVisitYear) / 5) * loyaltyWeight * normalize, loyaltyWeight * normalize) : 0;
    const score = Math.round(revenueScore + visitScore + loyaltyScore);

    // 소개자 데이터 매칭
    const refData = referralMap.get(p.chart_number) || { referral_count: 0, referral_total_revenue: 0, referral_noncovered: 0 };

    // 소개자 스코어링
    let referralScore = 0;
    if (useReferral) {
      if (refData.referral_count >= 3) referralScore += 15;
      else if (refData.referral_count >= 1) referralScore += 10;
      if (refData.referral_total_revenue >= 5_000_000) referralScore += 10;
      else if (refData.referral_total_revenue >= 1_000_000) referralScore += 5;
    }

    const finalScore = score + referralScore;
    if (finalScore <= minScore) continue;

    const reasons: string[] = [];
    if (revCriteria.includes('total') && effectiveRevenue > 0) reasons.push(`총진료 ${Math.round(effectiveRevenue / 10000)}만`);
    if (revCriteria.includes('noncovered') && effectiveNoncovered > 0) reasons.push(`비급여 ${Math.round(effectiveNoncovered / 10000)}만`);
    if (revCriteria.includes('copay') && effectiveCopay > 0) reasons.push(`본인부담 ${Math.round(effectiveCopay / 10000)}만`);
    if (useVisits && effectiveVisits > 0) reasons.push(`내원 ${effectiveVisits}회`);
    if (useLoyalty && firstVisitYear && currentYear - firstVisitYear >= 3) reasons.push(`${currentYear - firstVisitYear}년 충성`);
    if (familyMemberDetails.length > 0) reasons.push(`가족 ${familyMemberDetails.length}명 합산`);
    if (useReferral && refData.referral_count > 0) reasons.push(`소개 ${refData.referral_count}명`);

    candidates.push({
      patient_id: p.id,
      name: p.name + (familyMemberDetails.length > 0 ? ` 외${familyMemberDetails.length}` : ''),
      chart_number: p.chart_number,
      phone: p.phone,
      score: finalScore,
      revenue: effectiveRevenue,
      noncovered: effectiveNoncovered,
      copay: effectiveCopay,
      visit_count: effectiveVisits,
      first_visit_year: firstVisitYear,
      suggested_grade: finalScore >= 80 ? 'VVIP' : 'VIP',
      reason: reasons.join(', '),
      referral_count: refData.referral_count,
      referral_total_revenue: refData.referral_total_revenue,
      referral_noncovered: refData.referral_noncovered,
      familyMembers: familyMemberDetails.length > 0 ? [
        // 본인도 포함
        { name: p.name, chart_number: p.chart_number, revenue: d.total_revenue, noncovered: d.noncovered, copay: d.copay, visit_count: d.visit_count },
        ...familyMemberDetails,
      ] : undefined,
    });

    if (candidates.length >= maxCount) break;
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ── 일괄 선정 ──

export async function batchAddVip(
  candidates: { patient_id: number; grade: 'VVIP' | 'VIP'; reason: string; score: number }[],
  year: number,
  createdBy?: string,
): Promise<number> {
  let count = 0;
  for (const c of candidates) {
    try {
      await addVip(c.patient_id, year, c.grade, c.reason, c.score, createdBy);
      count++;
    } catch (e) {
      console.error('VIP 등록 실패:', c.patient_id, e);
    }
  }
  return count;
}
