/**
 * 환자 정보 동기화 모듈
 * MSSQL(EMR) → PostgreSQL(로컬) 동기화
 *
 * unified-server의 REST API를 사용하여 MSSQL 데이터 조회
 * - GET /api/patients/search?q=검색어 - 환자 검색
 * - GET /api/patients/:id - 환자 상세 조회
 */

import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

// unified-server MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// PostgreSQL 환자 타입 (로컬 저장용)
export interface LocalPatient {
  id: number;
  mssql_id: number | null;
  name: string;
  chart_number: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
  total_visits: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  // 추가 필드
  treatment_clothing: string | null;
  treatment_notes: string | null;
  deletion_date: string | null;
  // EMR 추가 정보
  main_doctor: string | null;
  doctor_memo: string | null;
  nurse_memo: string | null;
  referral_type: string | null;
}

// MSSQL 환자 타입 (unified-server API 응답)
export interface MssqlPatient {
  id: number;
  chart_no: string;
  name: string;
  phone: string | null;
  birth: string | null;
  sex: 'M' | 'F' | null;
  address: string | null;
  reg_date: string | null;
  last_visit: string | null;
  main_doctor: string | null;
  main_disease: string | null;
  doctor_memo: string | null;
  nurse_memo: string | null;
  etc_memo: string | null;
  treat_type: string | null;
  referral_type: string | null;
  referral_detail: string | null;
  referrer_info: string | null;
}

/**
 * unified-server API로 환자 검색
 */
export async function searchPatientsFromMssql(searchTerm: string, limit: number = 50): Promise<MssqlPatient[]> {
  try {
    const response = await fetch(
      `${MSSQL_API_URL}/api/patients/search?q=${encodeURIComponent(searchTerm)}&limit=${limit}`
    );

    if (!response.ok) {
      console.error('MSSQL 환자 검색 실패:', response.status);
      return [];
    }

    const data = await response.json();

    // 에러 응답 처리
    if (data.error) {
      console.error('MSSQL 환자 검색 오류:', data.error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('MSSQL 환자 검색 오류:', err);
    return [];
  }
}

/**
 * unified-server API로 환자 상세 조회 (ID로)
 */
export async function fetchPatientFromMssql(mssqlId: number): Promise<MssqlPatient | null> {
  try {
    const response = await fetch(`${MSSQL_API_URL}/api/patients/${mssqlId}`);

    if (!response.ok) {
      // 404인 경우 검색으로 fallback
      if (response.status === 404) {
        return null;
      }
      console.error('MSSQL 환자 조회 실패:', response.status);
      return null;
    }

    const data = await response.json();
    return data.error ? null : data;
  } catch (err) {
    console.error('MSSQL 환자 조회 오류:', err);
    return null;
  }
}

/**
 * 로컬 PostgreSQL에서 환자 조회 (mssql_id로)
 */
export async function getLocalPatientByMssqlId(mssqlId: number): Promise<LocalPatient | null> {
  const results = await query<LocalPatient>(
    `SELECT * FROM patients WHERE mssql_id = ${mssqlId}`
  );
  return results[0] || null;
}

/**
 * 로컬 PostgreSQL에서 환자 조회 (차트번호로)
 */
export async function getLocalPatientByChartNo(chartNo: string): Promise<LocalPatient | null> {
  const results = await query<LocalPatient>(
    `SELECT * FROM patients WHERE chart_number = ${escapeString(chartNo)}`
  );
  return results[0] || null;
}

/**
 * 단일 환자 동기화 (MSSQL → PostgreSQL)
 * upsert: mssql_id가 있으면 업데이트, 없으면 삽입
 */
export async function syncPatient(mssqlPatient: MssqlPatient): Promise<LocalPatient | null> {
  const now = getCurrentTimestamp();

  // 성별 변환 (M/F → 남/여)
  const gender = mssqlPatient.sex === 'M' ? '남' : mssqlPatient.sex === 'F' ? '여' : null;

  // 기존 레코드 확인
  const existing = await getLocalPatientByMssqlId(mssqlPatient.id);

  if (existing) {
    // UPDATE
    await execute(`
      UPDATE patients SET
        name = ${escapeString(mssqlPatient.name)},
        chart_number = ${escapeString(mssqlPatient.chart_no)},
        phone = ${escapeString(mssqlPatient.phone)},
        birth_date = ${escapeString(mssqlPatient.birth)},
        gender = ${escapeString(gender)},
        address = ${escapeString(mssqlPatient.address)},
        first_visit_date = ${escapeString(mssqlPatient.reg_date)},
        last_visit_date = ${escapeString(mssqlPatient.last_visit)},
        updated_at = ${escapeString(now)},
        synced_at = ${escapeString(now)}
      WHERE mssql_id = ${mssqlPatient.id}
    `);

    return await getLocalPatientByMssqlId(mssqlPatient.id);
  } else {
    // INSERT
    await execute(`
      INSERT INTO patients (
        mssql_id, name, chart_number, phone, birth_date, gender, address,
        first_visit_date, last_visit_date, total_visits,
        created_at, updated_at, synced_at
      ) VALUES (
        ${mssqlPatient.id},
        ${escapeString(mssqlPatient.name)},
        ${escapeString(mssqlPatient.chart_no)},
        ${escapeString(mssqlPatient.phone)},
        ${escapeString(mssqlPatient.birth)},
        ${escapeString(gender)},
        ${escapeString(mssqlPatient.address)},
        ${escapeString(mssqlPatient.reg_date)},
        ${escapeString(mssqlPatient.last_visit)},
        0,
        ${escapeString(now)},
        ${escapeString(now)},
        ${escapeString(now)}
      )
    `);

    return await getLocalPatientByMssqlId(mssqlPatient.id);
  }
}

/**
 * 환자 검색 및 동기화
 * 검색 결과를 로컬에 동기화하고 반환
 */
export async function searchAndSyncPatients(searchTerm: string): Promise<LocalPatient[]> {
  try {
    // 1. unified-server API로 환자 검색
    const mssqlPatients = await searchPatientsFromMssql(searchTerm);

    // 2. 각 환자를 로컬에 동기화
    const syncedPatients: LocalPatient[] = [];
    for (const mssqlPatient of mssqlPatients) {
      const synced = await syncPatient(mssqlPatient);
      if (synced) {
        syncedPatients.push(synced);
      }
    }

    return syncedPatients;
  } catch (err) {
    console.error('환자 검색 및 동기화 오류:', err);
    return [];
  }
}

/**
 * 특정 환자 동기화 (mssql_id로)
 */
export async function syncPatientById(mssqlId: number): Promise<LocalPatient | null> {
  const mssqlPatient = await fetchPatientFromMssql(mssqlId);
  if (!mssqlPatient) {
    return null;
  }
  return await syncPatient(mssqlPatient);
}

/**
 * 특정 환자 동기화 (차트번호로)
 * 검색 API를 사용하여 차트번호로 조회 후 동기화
 */
export async function syncPatientByChartNo(chartNo: string): Promise<LocalPatient | null> {
  const patients = await searchPatientsFromMssql(chartNo, 1);
  const mssqlPatient = patients.find(p => p.chart_no === chartNo);

  if (!mssqlPatient) {
    return null;
  }
  return await syncPatient(mssqlPatient);
}

/**
 * 환자 검색 (동기화 없이 MSSQL만 조회)
 * 빠른 검색이 필요할 때 사용
 */
export async function searchPatientsOnly(searchTerm: string): Promise<MssqlPatient[]> {
  return searchPatientsFromMssql(searchTerm);
}

/**
 * 최근 내원 환자 일괄 동기화
 * 주의: unified-server에 별도 엔드포인트가 필요함
 * 현재는 구현되지 않음 - 필요시 unified-server에 엔드포인트 추가 필요
 */
export async function syncRecentPatients(_daysAgo: number = 30): Promise<{ synced: number; errors: number }> {
  console.warn('syncRecentPatients: unified-server에 별도 엔드포인트 필요');
  return { synced: 0, errors: 0 };
}

// ============ 로컬 환자 등록 (MSSQL 없이) ============

/**
 * 로컬 차트번호 접두사
 */
export const LOCAL_CHART_PREFIX = 'L-';

/**
 * 다음 로컬 차트번호 생성
 * 형식: L-00001, L-00002, ...
 */
export async function generateLocalChartNumber(): Promise<string> {
  const results = await query<{ chart_number: string }>(
    `SELECT chart_number FROM patients
     WHERE chart_number LIKE '${LOCAL_CHART_PREFIX}%'
     ORDER BY chart_number DESC LIMIT 1`
  );

  if (results.length === 0) {
    return `${LOCAL_CHART_PREFIX}00001`;
  }

  const lastNumber = results[0].chart_number;
  const numPart = parseInt(lastNumber.replace(LOCAL_CHART_PREFIX, ''), 10);
  const nextNum = (numPart + 1).toString().padStart(5, '0');
  return `${LOCAL_CHART_PREFIX}${nextNum}`;
}

/**
 * 로컬 환자 등록 파라미터
 */
export interface CreateLocalPatientParams {
  name: string;
  phone?: string;
  birth_date?: string;
  gender?: '남' | '여';
  address?: string;
  memo?: string;
}

/**
 * 로컬 환자 등록 (MSSQL 없이 PostgreSQL에만 저장)
 */
export async function createLocalPatient(params: CreateLocalPatientParams): Promise<LocalPatient | null> {
  const now = getCurrentTimestamp();
  const chartNumber = await generateLocalChartNumber();

  try {
    await execute(`
      INSERT INTO patients (
        mssql_id, name, chart_number, phone, birth_date, gender, address,
        first_visit_date, last_visit_date, total_visits,
        created_at, updated_at, synced_at
      ) VALUES (
        NULL,
        ${escapeString(params.name)},
        ${escapeString(chartNumber)},
        ${escapeString(params.phone || null)},
        ${escapeString(params.birth_date || null)},
        ${escapeString(params.gender || null)},
        ${escapeString(params.address || null)},
        ${escapeString(now.split('T')[0])},
        NULL,
        0,
        ${escapeString(now)},
        ${escapeString(now)},
        NULL
      )
    `);

    return await getLocalPatientByChartNo(chartNumber);
  } catch (err) {
    console.error('로컬 환자 등록 오류:', err);
    return null;
  }
}

/**
 * 로컬 환자 검색 (MSSQL 없이 PostgreSQL에서만)
 */
export async function searchLocalPatients(searchTerm: string, limit: number = 50): Promise<LocalPatient[]> {
  const escaped = escapeString(`%${searchTerm}%`);
  return await query<LocalPatient>(
    `SELECT * FROM patients
     WHERE (name ILIKE ${escaped} OR chart_number ILIKE ${escaped} OR phone ILIKE ${escaped})
     ORDER BY updated_at DESC
     LIMIT ${limit}`
  );
}

/**
 * 로컬 전용 환자 목록 조회 (mssql_id가 NULL인 환자)
 */
export async function getLocalOnlyPatients(limit: number = 100): Promise<LocalPatient[]> {
  return await query<LocalPatient>(
    `SELECT * FROM patients
     WHERE mssql_id IS NULL
     ORDER BY created_at DESC
     LIMIT ${limit}`
  );
}
