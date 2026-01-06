import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp, getCurrentDate, isTableInitialized, markTableInitialized } from '@shared/lib/postgres';
import type {
  Inquiry,
  CreateInquiryRequest,
  UpdateInquiryRequest,
  TreatmentPackage,
  HerbalPackage,
  HerbalPackageRound,
  DeliveryMethod,
  RoundStatus,
  PointTransaction,
  PatientPointBalance,
  Membership,
  HerbalDispensing,
  GiftDispensing,
  DocumentIssue,
  ReceiptMemo,
  ReservationStatus,
  MedicineUsage,
  YakchimUsageRecord,
} from '../types';

// MSSQL API 기본 URL
const MSSQL_API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// ============================================
// 진료상세내역 조회 (MSSQL Detail 테이블)
// ============================================

export interface ReceiptDetailItem {
  item_name: string;      // PxName
  amount: number;         // TxMoney
  days: number;           // TxCount (일수)
  daily_dose: number;     // DAYTU (일투)
  is_insurance: boolean;  // InsuYes
  doctor: string;         // TxDoctor
  bonin_percent: number;  // BoninPercent
}

/**
 * 수납 진료상세내역 조회 (MSSQL Detail 테이블)
 * @param customerId Customer_PK
 * @param txDate 진료일 (YYYY-MM-DD)
 */
export async function fetchReceiptDetails(customerId: number, txDate: string): Promise<ReceiptDetailItem[]> {
  try {
    const sql = `
      SELECT
        PxName as item_name,
        TxMoney as amount,
        TxCount as days,
        DAYTU as daily_dose,
        InsuYes as is_insurance,
        TxDoctor as doctor,
        BoninPercent as bonin_percent
      FROM Detail
      WHERE Customer_PK = ${customerId}
      AND CONVERT(varchar, TxDate, 23) = '${txDate}'
      ORDER BY Detail_PK
    `;

    const response = await fetch(`${MSSQL_API_BASE_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error(`MSSQL API 오류: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    // columns + rows 형식을 객체 배열로 변환
    if (data.columns && data.rows) {
      return data.rows.map((row: any[]) => {
        const obj: any = {};
        data.columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj as ReceiptDetailItem;
      });
    }

    return data.rows || [];
  } catch (error) {
    console.error('진료상세내역 조회 오류:', error);
    return [];
  }
}

/**
 * 문의 목록 조회
 */
export async function getInquiries(options?: {
  status?: string;
  date?: string;
  limit?: number;
}): Promise<Inquiry[]> {
  let sql = 'SELECT * FROM cs_inquiries WHERE 1=1';

  if (options?.status) {
    sql += ` AND status = ${escapeString(options.status)}`;
  }

  if (options?.date) {
    sql += ` AND DATE(created_at) = ${escapeString(options.date)}`;
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  return query<Inquiry>(sql);
}

/**
 * 오늘 문의 조회
 */
export async function getTodayInquiries(): Promise<Inquiry[]> {
  const today = getCurrentDate();
  return getInquiries({ date: today });
}

/**
 * 미처리 문의 조회
 */
export async function getPendingInquiries(): Promise<Inquiry[]> {
  return getInquiries({ status: 'pending' });
}

/**
 * 문의 상세 조회
 */
export async function getInquiry(id: number): Promise<Inquiry | null> {
  const results = await query<Inquiry>(
    `SELECT * FROM cs_inquiries WHERE id = ${id}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 문의 등록
 */
export async function createInquiry(data: CreateInquiryRequest): Promise<number> {
  const sql = `
    INSERT INTO cs_inquiries (
      channel, patient_name, contact, inquiry_type, content, response, status, staff_name, created_at, updated_at
    ) VALUES (
      ${escapeString(data.channel)},
      ${toSqlValue(data.patient_name)},
      ${toSqlValue(data.contact)},
      ${escapeString(data.inquiry_type)},
      ${escapeString(data.content)},
      ${toSqlValue(data.response)},
      'pending',
      ${toSqlValue(data.staff_name)},
      ${escapeString(getCurrentTimestamp())},
      ${escapeString(getCurrentTimestamp())}
    )
  `;
  return insert(sql);
}

/**
 * 문의 수정
 */
export async function updateInquiry(id: number, data: UpdateInquiryRequest): Promise<void> {
  const updates: string[] = [];

  if (data.channel !== undefined) updates.push(`channel = ${escapeString(data.channel)}`);
  if (data.patient_name !== undefined) updates.push(`patient_name = ${toSqlValue(data.patient_name)}`);
  if (data.contact !== undefined) updates.push(`contact = ${toSqlValue(data.contact)}`);
  if (data.inquiry_type !== undefined) updates.push(`inquiry_type = ${escapeString(data.inquiry_type)}`);
  if (data.content !== undefined) updates.push(`content = ${escapeString(data.content)}`);
  if (data.response !== undefined) updates.push(`response = ${toSqlValue(data.response)}`);
  if (data.status !== undefined) updates.push(`status = ${escapeString(data.status)}`);
  if (data.staff_name !== undefined) updates.push(`staff_name = ${toSqlValue(data.staff_name)}`);

  updates.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  const sql = `UPDATE cs_inquiries SET ${updates.join(', ')} WHERE id = ${id}`;
  await execute(sql);
}

/**
 * 문의 삭제
 */
export async function deleteInquiry(id: number): Promise<void> {
  await execute(`DELETE FROM cs_inquiries WHERE id = ${id}`);
}

/**
 * 문의 상태 변경
 */
export async function updateInquiryStatus(id: number, status: string): Promise<void> {
  await updateInquiry(id, { status: status as any });
}

/**
 * cs_inquiries 테이블 생성 (없으면)
 */
export async function ensureInquiriesTable(): Promise<void> {
  if (isTableInitialized('cs_inquiries')) {
    return;
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS cs_inquiries (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL,
      patient_name TEXT,
      contact TEXT,
      inquiry_type TEXT NOT NULL,
      content TEXT NOT NULL,
      response TEXT,
      status TEXT DEFAULT 'pending',
      staff_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await execute(sql);
  markTableInitialized('cs_inquiries');
}

// ============================================
// 수납관리 테이블 생성
// ============================================

export async function ensureReceiptTables(): Promise<void> {
  // 이미 초기화되었으면 스킵 (세션당 한 번만 실행)
  if (isTableInitialized('cs_receipt_tables')) {
    return;
  }

  // 시술패키지 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_treatment_packages (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      package_name TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      used_count INTEGER DEFAULT 0,
      remaining_count INTEGER NOT NULL,
      includes TEXT,
      start_date TEXT NOT NULL,
      expire_date TEXT,
      memo TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 한약패키지 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_packages (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      herbal_name TEXT,
      package_type TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      used_count INTEGER DEFAULT 0,
      remaining_count INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      next_delivery_date TEXT,
      memo TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 한약패키지 회차별 관리 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_package_rounds (
      id SERIAL PRIMARY KEY,
      package_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      delivery_method TEXT DEFAULT 'pickup',
      scheduled_date TEXT,
      delivered_date TEXT,
      status TEXT DEFAULT 'pending',
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (package_id) REFERENCES cs_herbal_packages(id) ON DELETE CASCADE
    )
  `);

  // 포인트 거래 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_point_transactions (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      transaction_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      receipt_id INTEGER,
      transaction_date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 멤버십 테이블 (기간 기반 무제한 사용)
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_memberships (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      membership_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      expire_date TEXT NOT NULL,
      memo TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 기존 테이블에 quantity 컬럼 추가 (remaining_count → quantity 마이그레이션)
  await execute(`ALTER TABLE cs_memberships ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await execute(`UPDATE cs_memberships SET quantity = remaining_count WHERE remaining_count IS NOT NULL AND quantity = 1`).catch(() => {});

  // 약침 패키지 테이블 (통증마일리지)
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_yakchim_packages (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      package_name TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      used_count INTEGER DEFAULT 0,
      remaining_count INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      expire_date TEXT,
      memo TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 약침/멤버십 사용 기록 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_yakchim_usage_records (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      source_name TEXT,
      usage_date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      remaining_after INTEGER NOT NULL,
      receipt_id INTEGER,
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 한약 출납 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_dispensings (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      herbal_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      dispensing_type TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      receipt_id INTEGER,
      memo TEXT,
      dispensing_date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 증정품 출납 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_gift_dispensings (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      receipt_id INTEGER,
      dispensing_date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 서류발급 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_document_issues (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      document_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      receipt_id INTEGER,
      issue_date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 수납 메모 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_receipt_memos (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      mssql_receipt_id INTEGER,
      receipt_date TEXT NOT NULL,
      memo TEXT,
      reservation_status TEXT DEFAULT 'none',
      reservation_date TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // is_completed 컬럼이 없으면 추가 (기존 테이블 마이그레이션)
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS is_completed INTEGER DEFAULT 0`).catch(() => {});

  // 상비약 사용내역 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_medicine_usage (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT NOT NULL,
      patient_name TEXT,
      receipt_id INTEGER,
      usage_date TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // cs_medicine_usage 테이블 확장 (inventory_id, purpose 컬럼 추가)
  await execute(`ALTER TABLE cs_medicine_usage ADD COLUMN IF NOT EXISTS inventory_id INTEGER`).catch(() => {});
  await execute(`ALTER TABLE cs_medicine_usage ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT '상비약'`).catch(() => {});

  // 상비약 재고관리 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_medicine_inventory (
      id SERIAL PRIMARY KEY,
      prescription_id INTEGER,
      name TEXT NOT NULL,
      alias TEXT,
      category TEXT DEFAULT '상비약',
      total_stock INTEGER DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      doses_per_batch INTEGER DEFAULT 20,
      packs_per_batch INTEGER DEFAULT 30,
      unit TEXT DEFAULT '팩',
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 상비약 탕전관리 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_medicine_decoctions (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL,
      decoction_date TEXT NOT NULL,
      doses INTEGER NOT NULL,
      packs INTEGER NOT NULL,
      memo TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 초기화 완료 표시
  markTableInitialized('cs_receipt_tables');
}

// ============================================
// MSSQL 수납 내역 조회
// ============================================

export interface MssqlReceiptItem {
  id: number;
  receipt_time: string;
  patient_id: number;
  patient_name: string;
  chart_number: string;
  age?: number;
  doctor: string;
  insurance_type: string;
  insurance_amount: number;
  general_amount: number;
  payment_method?: string;
  treatment_summary?: string;
}

/**
 * MSSQL에서 날짜별 수납 내역 조회
 */
export async function fetchMssqlReceipts(date: string): Promise<MssqlReceiptItem[]> {
  try {
    const response = await fetch(`${MSSQL_API_BASE_URL}/api/receipts/by-date?date=${date}`);
    if (!response.ok) {
      throw new Error(`MSSQL API 오류: ${response.status}`);
    }
    const data = await response.json();
    return data.receipts || [];
  } catch (error) {
    console.error('❌ MSSQL 수납 내역 조회 오류:', error);
    return [];
  }
}

// ============================================
// 시술패키지 API
// ============================================

export async function getTreatmentPackages(patientId: number): Promise<TreatmentPackage[]> {
  return query<TreatmentPackage>(
    `SELECT * FROM cs_treatment_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

export async function getActiveTreatmentPackages(patientId: number): Promise<TreatmentPackage[]> {
  return query<TreatmentPackage>(
    `SELECT * FROM cs_treatment_packages WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC`
  );
}

export async function createTreatmentPackage(pkg: Omit<TreatmentPackage, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_treatment_packages (
      patient_id, chart_number, patient_name, package_name, total_count, used_count, remaining_count,
      includes, start_date, expire_date, memo, status, created_at, updated_at
    ) VALUES (
      ${pkg.patient_id}, ${toSqlValue(pkg.chart_number)}, ${toSqlValue(pkg.patient_name)},
      ${escapeString(pkg.package_name)}, ${pkg.total_count}, ${pkg.used_count}, ${pkg.remaining_count},
      ${toSqlValue(pkg.includes)}, ${escapeString(pkg.start_date)}, ${toSqlValue(pkg.expire_date)},
      ${toSqlValue(pkg.memo)}, ${escapeString(pkg.status)}, ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

export async function useTreatmentPackage(id: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_treatment_packages SET
      used_count = used_count + 1,
      remaining_count = remaining_count - 1,
      status = CASE WHEN remaining_count - 1 <= 0 THEN 'completed' ELSE status END,
      updated_at = ${escapeString(now)}
    WHERE id = ${id}
  `);
}

export async function updateTreatmentPackage(id: number, updates: Partial<TreatmentPackage>): Promise<void> {
  const parts: string[] = [];
  if (updates.package_name !== undefined) parts.push(`package_name = ${escapeString(updates.package_name)}`);
  if (updates.total_count !== undefined) parts.push(`total_count = ${updates.total_count}`);
  if (updates.used_count !== undefined) parts.push(`used_count = ${updates.used_count}`);
  if (updates.remaining_count !== undefined) parts.push(`remaining_count = ${updates.remaining_count}`);
  if (updates.includes !== undefined) parts.push(`includes = ${toSqlValue(updates.includes)}`);
  if (updates.expire_date !== undefined) parts.push(`expire_date = ${toSqlValue(updates.expire_date)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_treatment_packages SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deleteTreatmentPackage(id: number): Promise<void> {
  await execute(`DELETE FROM cs_treatment_packages WHERE id = ${id}`);
}

// ============================================
// 한약패키지 API
// ============================================

export async function getHerbalPackages(patientId: number): Promise<HerbalPackage[]> {
  return query<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

export async function getActiveHerbalPackages(patientId: number): Promise<HerbalPackage[]> {
  return query<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC`
  );
}

export async function createHerbalPackage(pkg: Omit<HerbalPackage, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_herbal_packages (
      patient_id, chart_number, patient_name, package_type, total_count, used_count, remaining_count,
      start_date, next_delivery_date, memo, status, created_at, updated_at
    ) VALUES (
      ${pkg.patient_id}, ${toSqlValue(pkg.chart_number)}, ${toSqlValue(pkg.patient_name)},
      ${escapeString(pkg.package_type)}, ${pkg.total_count}, ${pkg.used_count}, ${pkg.remaining_count},
      ${escapeString(pkg.start_date)}, ${toSqlValue(pkg.next_delivery_date)},
      ${toSqlValue(pkg.memo)}, ${escapeString(pkg.status)}, ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

export async function useHerbalPackage(id: number, nextDeliveryDate?: string): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages SET
      used_count = used_count + 1,
      remaining_count = remaining_count - 1,
      next_delivery_date = ${toSqlValue(nextDeliveryDate)},
      status = CASE WHEN remaining_count - 1 <= 0 THEN 'completed' ELSE status END,
      updated_at = ${escapeString(now)}
    WHERE id = ${id}
  `);
}

export async function updateHerbalPackage(id: number, updates: Partial<HerbalPackage>): Promise<void> {
  const parts: string[] = [];
  if (updates.herbal_name !== undefined) parts.push(`herbal_name = ${escapeString(updates.herbal_name)}`);
  if (updates.package_type !== undefined) parts.push(`package_type = ${escapeString(updates.package_type)}`);
  if (updates.total_count !== undefined) parts.push(`total_count = ${updates.total_count}`);
  if (updates.used_count !== undefined) parts.push(`used_count = ${updates.used_count}`);
  if (updates.remaining_count !== undefined) parts.push(`remaining_count = ${updates.remaining_count}`);
  if (updates.next_delivery_date !== undefined) parts.push(`next_delivery_date = ${toSqlValue(updates.next_delivery_date)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_herbal_packages SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deleteHerbalPackage(id: number): Promise<void> {
  // 회차 데이터도 함께 삭제됨 (CASCADE)
  await execute(`DELETE FROM cs_herbal_packages WHERE id = ${id}`);
}

// 모든 활성 한약패키지 조회 (선결제관리용)
export async function getAllActiveHerbalPackages(): Promise<HerbalPackage[]> {
  return query<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages WHERE status = 'active' ORDER BY next_delivery_date ASC, created_at DESC`
  );
}

// 모든 한약패키지 조회 (완료 포함)
export async function getAllHerbalPackages(includeCompleted: boolean = false): Promise<HerbalPackage[]> {
  let sql = 'SELECT * FROM cs_herbal_packages';
  if (!includeCompleted) {
    sql += " WHERE status = 'active'";
  }
  sql += ' ORDER BY status ASC, next_delivery_date ASC, created_at DESC';
  return query<HerbalPackage>(sql);
}

// ============================================
// 한약패키지 회차 API
// ============================================

export async function getPackageRounds(packageId: number): Promise<HerbalPackageRound[]> {
  return query<HerbalPackageRound>(
    `SELECT * FROM cs_herbal_package_rounds WHERE package_id = ${packageId} ORDER BY round_number ASC`
  );
}

export async function createPackageRound(round: Omit<HerbalPackageRound, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_herbal_package_rounds (
      package_id, round_number, delivery_method, scheduled_date, delivered_date, status, memo, created_at, updated_at
    ) VALUES (
      ${round.package_id}, ${round.round_number}, ${escapeString(round.delivery_method)},
      ${toSqlValue(round.scheduled_date)}, ${toSqlValue(round.delivered_date)},
      ${escapeString(round.status)}, ${toSqlValue(round.memo)}, ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

export async function updatePackageRound(id: number, updates: Partial<HerbalPackageRound>): Promise<void> {
  const parts: string[] = [];
  if (updates.delivery_method !== undefined) parts.push(`delivery_method = ${escapeString(updates.delivery_method)}`);
  if (updates.scheduled_date !== undefined) parts.push(`scheduled_date = ${toSqlValue(updates.scheduled_date)}`);
  if (updates.delivered_date !== undefined) parts.push(`delivered_date = ${toSqlValue(updates.delivered_date)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_herbal_package_rounds SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deletePackageRound(id: number): Promise<void> {
  await execute(`DELETE FROM cs_herbal_package_rounds WHERE id = ${id}`);
}

// 패키지 생성 시 회차 자동 생성
export async function initializePackageRounds(packageId: number, totalCount: number): Promise<void> {
  for (let i = 1; i <= totalCount; i++) {
    await createPackageRound({
      package_id: packageId,
      round_number: i,
      delivery_method: 'pickup',
      status: 'pending',
    });
  }
}

// 회차 상태 변경 및 패키지 used_count 업데이트
export async function completePackageRound(roundId: number, deliveredDate?: string): Promise<void> {
  const now = getCurrentTimestamp();
  const delivered = deliveredDate || getCurrentDate();

  // 회차 정보 조회
  const round = await queryOne<HerbalPackageRound>(
    `SELECT * FROM cs_herbal_package_rounds WHERE id = ${roundId}`
  );
  if (!round) throw new Error('회차를 찾을 수 없습니다.');

  // 회차 상태 업데이트
  await execute(`
    UPDATE cs_herbal_package_rounds SET
      status = 'delivered',
      delivered_date = ${escapeString(delivered)},
      updated_at = ${escapeString(now)}
    WHERE id = ${roundId}
  `);

  // 패키지 used_count 증가, remaining_count 감소
  await execute(`
    UPDATE cs_herbal_packages SET
      used_count = used_count + 1,
      remaining_count = remaining_count - 1,
      status = CASE WHEN remaining_count - 1 <= 0 THEN 'completed' ELSE status END,
      updated_at = ${escapeString(now)}
    WHERE id = ${round.package_id}
  `);

  // 다음 배송일 업데이트 (다음 pending 회차의 scheduled_date)
  const nextRound = await queryOne<HerbalPackageRound>(
    `SELECT * FROM cs_herbal_package_rounds
     WHERE package_id = ${round.package_id} AND status = 'pending'
     ORDER BY round_number ASC LIMIT 1`
  );
  if (nextRound?.scheduled_date) {
    await execute(`
      UPDATE cs_herbal_packages SET
        next_delivery_date = ${escapeString(nextRound.scheduled_date)}
      WHERE id = ${round.package_id}
    `);
  }
}

// 패키지와 회차 정보 함께 조회
export interface HerbalPackageWithRounds extends HerbalPackage {
  rounds: HerbalPackageRound[];
}

export async function getHerbalPackageWithRounds(packageId: number): Promise<HerbalPackageWithRounds | null> {
  const pkg = await queryOne<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages WHERE id = ${packageId}`
  );
  if (!pkg) return null;

  const rounds = await getPackageRounds(packageId);
  return { ...pkg, rounds };
}

export async function getAllHerbalPackagesWithRounds(includeCompleted: boolean = false): Promise<HerbalPackageWithRounds[]> {
  const packages = await getAllHerbalPackages(includeCompleted);
  const result: HerbalPackageWithRounds[] = [];

  for (const pkg of packages) {
    const rounds = await getPackageRounds(pkg.id!);
    result.push({ ...pkg, rounds });
  }

  return result;
}

// ============================================
// 포인트 API
// ============================================

export async function getPointBalance(patientId: number): Promise<number> {
  const result = await queryOne<{ balance: number }>(
    `SELECT balance_after as balance FROM cs_point_transactions
     WHERE patient_id = ${patientId}
     ORDER BY created_at DESC LIMIT 1`
  );
  return result?.balance || 0;
}

export async function getPointTransactions(patientId: number, limit: number = 20): Promise<PointTransaction[]> {
  return query<PointTransaction>(
    `SELECT * FROM cs_point_transactions WHERE patient_id = ${patientId} ORDER BY created_at DESC LIMIT ${limit}`
  );
}

export async function earnPoints(data: {
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  amount: number;
  description?: string;
  receipt_id?: number;
}): Promise<number> {
  const currentBalance = await getPointBalance(data.patient_id);
  const newBalance = currentBalance + data.amount;
  const today = getCurrentDate();

  return insert(`
    INSERT INTO cs_point_transactions (
      patient_id, chart_number, patient_name, transaction_type, amount, balance_after,
      description, receipt_id, transaction_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      'earn', ${data.amount}, ${newBalance}, ${toSqlValue(data.description)},
      ${data.receipt_id || 'NULL'}, ${escapeString(today)}, ${escapeString(getCurrentTimestamp())}
    )
  `);
}

export async function usePoints(data: {
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  amount: number;
  description?: string;
  receipt_id?: number;
}): Promise<number> {
  const currentBalance = await getPointBalance(data.patient_id);
  if (currentBalance < data.amount) {
    throw new Error(`포인트 부족: 현재 ${currentBalance}P, 사용 요청 ${data.amount}P`);
  }
  const newBalance = currentBalance - data.amount;
  const today = getCurrentDate();

  return insert(`
    INSERT INTO cs_point_transactions (
      patient_id, chart_number, patient_name, transaction_type, amount, balance_after,
      description, receipt_id, transaction_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      'use', ${data.amount}, ${newBalance}, ${toSqlValue(data.description)},
      ${data.receipt_id || 'NULL'}, ${escapeString(today)}, ${escapeString(getCurrentTimestamp())}
    )
  `);
}

// ============================================
// 멤버십 API
// ============================================

export async function getMemberships(patientId: number): Promise<Membership[]> {
  return query<Membership>(
    `SELECT * FROM cs_memberships WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

export async function getActiveMembership(patientId: number): Promise<Membership | null> {
  const results = await query<Membership>(
    `SELECT * FROM cs_memberships WHERE patient_id = ${patientId} AND status = 'active' ORDER BY expire_date DESC LIMIT 1`
  );
  return results.length > 0 ? results[0] : null;
}

export async function createMembership(membership: Omit<Membership, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_memberships (
      patient_id, chart_number, patient_name, membership_type, quantity,
      start_date, expire_date, memo, status, created_at, updated_at
    ) VALUES (
      ${membership.patient_id}, ${toSqlValue(membership.chart_number)}, ${toSqlValue(membership.patient_name)},
      ${escapeString(membership.membership_type)}, ${membership.quantity},
      ${escapeString(membership.start_date)}, ${escapeString(membership.expire_date)},
      ${toSqlValue(membership.memo)}, ${escapeString(membership.status)}, ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

// 멤버십은 차감 없음 (기간 동안 무제한 사용, 사용 기록만 남김)

export async function updateMembership(id: number, updates: Partial<Membership>): Promise<void> {
  const parts: string[] = [];
  if (updates.membership_type !== undefined) parts.push(`membership_type = ${escapeString(updates.membership_type)}`);
  if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
  if (updates.start_date !== undefined) parts.push(`start_date = ${escapeString(updates.start_date)}`);
  if (updates.expire_date !== undefined) parts.push(`expire_date = ${escapeString(updates.expire_date)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_memberships SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deleteMembership(id: number): Promise<void> {
  await execute(`DELETE FROM cs_memberships WHERE id = ${id}`);
}

// ============================================
// 한약 출납 API
// ============================================

export async function getHerbalDispensings(patientId: number, date?: string): Promise<HerbalDispensing[]> {
  let sql = `SELECT * FROM cs_herbal_dispensings WHERE patient_id = ${patientId}`;
  if (date) {
    sql += ` AND dispensing_date = ${escapeString(date)}`;
  }
  sql += ' ORDER BY created_at DESC';
  return query<HerbalDispensing>(sql);
}

export async function getHerbalDispensingsByDate(date: string): Promise<HerbalDispensing[]> {
  return query<HerbalDispensing>(
    `SELECT * FROM cs_herbal_dispensings WHERE dispensing_date = ${escapeString(date)} ORDER BY created_at DESC`
  );
}

export async function createHerbalDispensing(data: Omit<HerbalDispensing, 'id' | 'created_at'>): Promise<number> {
  return insert(`
    INSERT INTO cs_herbal_dispensings (
      patient_id, chart_number, patient_name, herbal_name, quantity, dispensing_type,
      delivery_method, receipt_id, memo, dispensing_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${escapeString(data.herbal_name)}, ${data.quantity}, ${escapeString(data.dispensing_type)},
      ${escapeString(data.delivery_method)}, ${data.receipt_id || 'NULL'},
      ${toSqlValue(data.memo)}, ${escapeString(data.dispensing_date)}, ${escapeString(getCurrentTimestamp())}
    )
  `);
}

export async function updateHerbalDispensing(id: number, updates: Partial<HerbalDispensing>): Promise<void> {
  const parts: string[] = [];
  if (updates.herbal_name !== undefined) parts.push(`herbal_name = ${escapeString(updates.herbal_name)}`);
  if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
  if (updates.dispensing_type !== undefined) parts.push(`dispensing_type = ${escapeString(updates.dispensing_type)}`);
  if (updates.delivery_method !== undefined) parts.push(`delivery_method = ${escapeString(updates.delivery_method)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);

  if (parts.length > 0) {
    await execute(`UPDATE cs_herbal_dispensings SET ${parts.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteHerbalDispensing(id: number): Promise<void> {
  await execute(`DELETE FROM cs_herbal_dispensings WHERE id = ${id}`);
}

// ============================================
// 증정품 출납 API
// ============================================

export async function getGiftDispensings(patientId: number, date?: string): Promise<GiftDispensing[]> {
  let sql = `SELECT * FROM cs_gift_dispensings WHERE patient_id = ${patientId}`;
  if (date) {
    sql += ` AND dispensing_date = ${escapeString(date)}`;
  }
  sql += ' ORDER BY created_at DESC';
  return query<GiftDispensing>(sql);
}

export async function getGiftDispensingsByDate(date: string): Promise<GiftDispensing[]> {
  return query<GiftDispensing>(
    `SELECT * FROM cs_gift_dispensings WHERE dispensing_date = ${escapeString(date)} ORDER BY created_at DESC`
  );
}

export async function createGiftDispensing(data: Omit<GiftDispensing, 'id' | 'created_at'>): Promise<number> {
  return insert(`
    INSERT INTO cs_gift_dispensings (
      patient_id, chart_number, patient_name, item_name, quantity, reason,
      receipt_id, dispensing_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${escapeString(data.item_name)}, ${data.quantity}, ${toSqlValue(data.reason)},
      ${data.receipt_id || 'NULL'}, ${escapeString(data.dispensing_date)}, ${escapeString(getCurrentTimestamp())}
    )
  `);
}

export async function updateGiftDispensing(id: number, updates: Partial<GiftDispensing>): Promise<void> {
  const parts: string[] = [];
  if (updates.item_name !== undefined) parts.push(`item_name = ${escapeString(updates.item_name)}`);
  if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
  if (updates.reason !== undefined) parts.push(`reason = ${toSqlValue(updates.reason)}`);

  if (parts.length > 0) {
    await execute(`UPDATE cs_gift_dispensings SET ${parts.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteGiftDispensing(id: number): Promise<void> {
  await execute(`DELETE FROM cs_gift_dispensings WHERE id = ${id}`);
}

// ============================================
// 서류발급 API
// ============================================

export async function getDocumentIssues(patientId: number, date?: string): Promise<DocumentIssue[]> {
  let sql = `SELECT * FROM cs_document_issues WHERE patient_id = ${patientId}`;
  if (date) {
    sql += ` AND issue_date = ${escapeString(date)}`;
  }
  sql += ' ORDER BY created_at DESC';
  return query<DocumentIssue>(sql);
}

export async function getDocumentIssuesByDate(date: string): Promise<DocumentIssue[]> {
  return query<DocumentIssue>(
    `SELECT * FROM cs_document_issues WHERE issue_date = ${escapeString(date)} ORDER BY created_at DESC`
  );
}

export async function createDocumentIssue(data: Omit<DocumentIssue, 'id' | 'created_at'>): Promise<number> {
  return insert(`
    INSERT INTO cs_document_issues (
      patient_id, chart_number, patient_name, document_type, quantity,
      receipt_id, issue_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${escapeString(data.document_type)}, ${data.quantity},
      ${data.receipt_id || 'NULL'}, ${escapeString(data.issue_date)}, ${escapeString(getCurrentTimestamp())}
    )
  `);
}

// ============================================
// 수납 메모 API
// ============================================

export async function getReceiptMemo(patientId: number, date: string): Promise<ReceiptMemo | null> {
  const results = await query<ReceiptMemo>(
    `SELECT * FROM cs_receipt_memos WHERE patient_id = ${patientId} AND receipt_date = ${escapeString(date)}`
  );
  return results.length > 0 ? results[0] : null;
}

export async function getReceiptMemoByReceiptId(receiptId: number): Promise<ReceiptMemo | null> {
  const results = await query<ReceiptMemo>(
    `SELECT * FROM cs_receipt_memos WHERE mssql_receipt_id = ${receiptId}`
  );
  return results.length > 0 ? results[0] : null;
}

export async function upsertReceiptMemo(data: {
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  mssql_receipt_id?: number;
  receipt_date: string;
  memo?: string;
  reservation_status?: ReservationStatus;
  reservation_date?: string;
  is_completed?: boolean;
}): Promise<number> {
  const now = getCurrentTimestamp();

  // 기존 메모 확인
  const existing = await getReceiptMemo(data.patient_id, data.receipt_date);

  if (existing) {
    // 업데이트
    const parts: string[] = [];
    if (data.memo !== undefined) parts.push(`memo = ${toSqlValue(data.memo)}`);
    if (data.reservation_status !== undefined) parts.push(`reservation_status = ${escapeString(data.reservation_status)}`);
    if (data.reservation_date !== undefined) parts.push(`reservation_date = ${toSqlValue(data.reservation_date)}`);
    if (data.mssql_receipt_id !== undefined) parts.push(`mssql_receipt_id = ${data.mssql_receipt_id}`);
    if (data.is_completed !== undefined) parts.push(`is_completed = ${data.is_completed ? 1 : 0}`);
    parts.push(`updated_at = ${escapeString(now)}`);

    await execute(`UPDATE cs_receipt_memos SET ${parts.join(', ')} WHERE id = ${existing.id}`);
    return existing.id!;
  } else {
    // 신규 생성
    return insert(`
      INSERT INTO cs_receipt_memos (
        patient_id, chart_number, patient_name, mssql_receipt_id, receipt_date,
        memo, reservation_status, reservation_date, is_completed, created_at, updated_at
      ) VALUES (
        ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
        ${data.mssql_receipt_id || 'NULL'}, ${escapeString(data.receipt_date)},
        ${toSqlValue(data.memo)}, ${escapeString(data.reservation_status || 'none')},
        ${toSqlValue(data.reservation_date)}, ${data.is_completed ? 1 : 0},
        ${escapeString(now)}, ${escapeString(now)}
      )
    `);
  }
}

/**
 * 수납 기록 완료 처리
 */
export async function markReceiptCompleted(
  patientId: number,
  receiptDate: string,
  chartNumber?: string,
  patientName?: string,
  mssqlReceiptId?: number
): Promise<void> {
  await upsertReceiptMemo({
    patient_id: patientId,
    chart_number: chartNumber,
    patient_name: patientName,
    mssql_receipt_id: mssqlReceiptId,
    receipt_date: receiptDate,
    is_completed: true,
  });
}

/**
 * 수납 기록 완료 토글
 */
export async function toggleReceiptCompleted(
  patientId: number,
  receiptDate: string,
  isCompleted: boolean,
  chartNumber?: string,
  patientName?: string,
  mssqlReceiptId?: number
): Promise<void> {
  await upsertReceiptMemo({
    patient_id: patientId,
    chart_number: chartNumber,
    patient_name: patientName,
    mssql_receipt_id: mssqlReceiptId,
    receipt_date: receiptDate,
    is_completed: isCompleted,
  });
}

/**
 * 날짜별 완료된 수납 메모 ID 목록 조회
 */
export async function getCompletedReceiptIds(date: string): Promise<Set<number>> {
  const memos = await query<ReceiptMemo>(
    `SELECT mssql_receipt_id FROM cs_receipt_memos WHERE receipt_date = ${escapeString(date)} AND is_completed = 1`
  );
  return new Set(memos.filter(m => m.mssql_receipt_id).map(m => m.mssql_receipt_id!));
}

export async function updateReservationStatus(
  patientId: number,
  date: string,
  status: ReservationStatus,
  reservationDate?: string
): Promise<void> {
  await upsertReceiptMemo({
    patient_id: patientId,
    receipt_date: date,
    reservation_status: status,
    reservation_date: reservationDate,
  });
}

// ============================================
// 환자별 메모 요약 데이터 조회
// ============================================

export async function getPatientMemoData(patientId: number, date: string): Promise<{
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  membership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  documentIssues: DocumentIssue[];
  medicineUsages: MedicineUsage[];
  yakchimUsageRecords: YakchimUsageRecord[];
  memo: ReceiptMemo | null;
}> {
  const [
    treatmentPackages,
    herbalPackages,
    pointBalance,
    pointTransactions,
    membership,
    herbalDispensings,
    giftDispensings,
    documentIssues,
    medicineUsages,
    yakchimUsageRecords,
    memo,
  ] = await Promise.all([
    getActiveTreatmentPackages(patientId),
    getActiveHerbalPackages(patientId),
    getPointBalance(patientId),
    getPointTransactions(patientId, 10),
    getActiveMembership(patientId),
    getHerbalDispensings(patientId, date),
    getGiftDispensings(patientId, date),
    getDocumentIssues(patientId, date),
    getMedicineUsages(patientId, date),
    getYakchimUsageRecords(patientId, date),
    getReceiptMemo(patientId, date),
  ]);

  // 오늘 포인트 사용/적립 계산
  const todayTransactions = pointTransactions.filter(t => t.transaction_date === date);
  const todayPointUsed = todayTransactions
    .filter(t => t.transaction_type === 'use')
    .reduce((sum, t) => sum + t.amount, 0);
  const todayPointEarned = todayTransactions
    .filter(t => t.transaction_type === 'earn')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    treatmentPackages,
    herbalPackages,
    pointBalance,
    todayPointUsed,
    todayPointEarned,
    membership,
    herbalDispensings,
    giftDispensings,
    documentIssues,
    medicineUsages,
    yakchimUsageRecords,
    memo,
  };
}

// ============================================
// 배치 쿼리: 여러 환자의 메모 데이터 한 번에 조회
// ============================================

export interface PatientMemoData {
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  membership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  documentIssues: DocumentIssue[];
  medicineUsages: MedicineUsage[];
  yakchimUsageRecords: YakchimUsageRecord[];
  memo: ReceiptMemo | null;
}

/**
 * 여러 환자의 메모 데이터를 배치로 조회 (최적화)
 * 기존: 환자 50명 × 11쿼리 = 550쿼리
 * 최적화: 11개 배치 쿼리
 */
export async function getPatientsMemoDataBatch(
  patientIds: number[],
  date: string
): Promise<Map<number, PatientMemoData>> {
  if (patientIds.length === 0) {
    return new Map();
  }

  // 중복 제거
  const uniqueIds = [...new Set(patientIds)];
  const idsStr = uniqueIds.join(',');

  // 11개 배치 쿼리 병렬 실행
  const [
    allTreatmentPackages,
    allHerbalPackages,
    allPointTransactions,
    allMemberships,
    allHerbalDispensings,
    allGiftDispensings,
    allDocumentIssues,
    allMedicineUsages,
    allYakchimUsageRecords,
    allReceiptMemos,
  ] = await Promise.all([
    // 시술패키지 (활성)
    query<TreatmentPackage>(
      `SELECT * FROM cs_treatment_packages WHERE patient_id IN (${idsStr}) AND status = 'active'`
    ),
    // 한약패키지 (활성)
    query<HerbalPackage>(
      `SELECT * FROM cs_herbal_packages WHERE patient_id IN (${idsStr}) AND status = 'active'`
    ),
    // 포인트 거래 (오늘 날짜)
    query<PointTransaction>(
      `SELECT * FROM cs_point_transactions WHERE patient_id IN (${idsStr}) AND transaction_date = ${escapeString(date)}`
    ),
    // 멤버십 (활성)
    query<Membership>(
      `SELECT * FROM cs_memberships WHERE patient_id IN (${idsStr}) AND status = 'active'`
    ),
    // 한약 출납 (오늘)
    query<HerbalDispensing>(
      `SELECT * FROM cs_herbal_dispensings WHERE patient_id IN (${idsStr}) AND dispensing_date = ${escapeString(date)}`
    ),
    // 증정품 출납 (오늘)
    query<GiftDispensing>(
      `SELECT * FROM cs_gift_dispensings WHERE patient_id IN (${idsStr}) AND dispensing_date = ${escapeString(date)}`
    ),
    // 서류발급 (오늘)
    query<DocumentIssue>(
      `SELECT * FROM cs_document_issues WHERE patient_id IN (${idsStr}) AND issue_date = ${escapeString(date)}`
    ),
    // 상비약 사용 (오늘)
    query<MedicineUsage>(
      `SELECT * FROM cs_medicine_usage WHERE patient_id IN (${idsStr}) AND usage_date = ${escapeString(date)}`
    ),
    // 약침 사용 기록 (오늘)
    query<YakchimUsageRecord>(
      `SELECT * FROM cs_yakchim_usage_records WHERE patient_id IN (${idsStr}) AND usage_date = ${escapeString(date)}`
    ),
    // 수납 메모 (오늘)
    query<ReceiptMemo>(
      `SELECT * FROM cs_receipt_memos WHERE patient_id IN (${idsStr}) AND receipt_date = ${escapeString(date)}`
    ),
  ]);

  // 포인트 잔액 조회 (각 환자의 최신 거래에서)
  const pointBalances = await query<{ patient_id: number; balance: number }>(
    `SELECT patient_id, balance_after as balance FROM cs_point_transactions
     WHERE id IN (
       SELECT MAX(id) FROM cs_point_transactions WHERE patient_id IN (${idsStr}) GROUP BY patient_id
     )`
  );
  const balanceMap = new Map(pointBalances.map(p => [p.patient_id, p.balance]));

  // 결과 맵 생성
  const result = new Map<number, PatientMemoData>();

  for (const patientId of uniqueIds) {
    // 해당 환자 데이터 필터링
    const treatmentPackages = allTreatmentPackages.filter(p => p.patient_id === patientId);
    const herbalPackages = allHerbalPackages.filter(p => p.patient_id === patientId);
    const pointTransactions = allPointTransactions.filter(p => p.patient_id === patientId);
    const memberships = allMemberships.filter(m => m.patient_id === patientId);
    const herbalDispensings = allHerbalDispensings.filter(d => d.patient_id === patientId);
    const giftDispensings = allGiftDispensings.filter(d => d.patient_id === patientId);
    const documentIssues = allDocumentIssues.filter(d => d.patient_id === patientId);
    const medicineUsages = allMedicineUsages.filter(u => u.patient_id === patientId);
    const yakchimUsageRecords = allYakchimUsageRecords.filter(r => r.patient_id === patientId);
    const memos = allReceiptMemos.filter(m => m.patient_id === patientId);

    // 포인트 계산
    const todayPointUsed = pointTransactions
      .filter(t => t.transaction_type === 'use')
      .reduce((sum, t) => sum + t.amount, 0);
    const todayPointEarned = pointTransactions
      .filter(t => t.transaction_type === 'earn')
      .reduce((sum, t) => sum + t.amount, 0);

    // 가장 최근 만료일 멤버십
    const membership = memberships.length > 0
      ? memberships.sort((a, b) => (b.expire_date || '').localeCompare(a.expire_date || ''))[0]
      : null;

    result.set(patientId, {
      treatmentPackages,
      herbalPackages,
      pointBalance: balanceMap.get(patientId) || 0,
      todayPointUsed,
      todayPointEarned,
      membership,
      herbalDispensings,
      giftDispensings,
      documentIssues,
      medicineUsages,
      yakchimUsageRecords,
      memo: memos.length > 0 ? memos[0] : null,
    });
  }

  return result;
}

// ============================================
// 상비약 사용내역 API
// ============================================

/**
 * 환자별 상비약 사용내역 조회
 */
export async function getMedicineUsages(patientId: number, date?: string): Promise<MedicineUsage[]> {
  let sql = `SELECT * FROM cs_medicine_usage WHERE patient_id = ${patientId}`;
  if (date) {
    sql += ` AND usage_date = ${escapeString(date)}`;
  }
  sql += ' ORDER BY created_at DESC';
  return query<MedicineUsage>(sql);
}

/**
 * 날짜별 상비약 사용내역 조회
 */
export async function getMedicineUsagesByDate(date: string): Promise<MedicineUsage[]> {
  return query<MedicineUsage>(
    `SELECT * FROM cs_medicine_usage WHERE usage_date = ${escapeString(date)} ORDER BY created_at DESC`
  );
}

// ============================================
// 약침 사용 기록 API
// ============================================

/**
 * 환자별 약침 사용 기록 조회 (날짜 기준)
 */
export async function getYakchimUsageRecords(patientId: number, date: string): Promise<YakchimUsageRecord[]> {
  return query<YakchimUsageRecord>(
    `SELECT * FROM cs_yakchim_usage_records
     WHERE patient_id = ${patientId} AND usage_date = ${escapeString(date)}
     ORDER BY created_at DESC`
  );
}

/**
 * 영수증 ID로 약침 사용 기록 조회
 */
export async function getYakchimUsageRecordsByReceiptId(receiptId: number): Promise<YakchimUsageRecord[]> {
  return query<YakchimUsageRecord>(
    `SELECT * FROM cs_yakchim_usage_records
     WHERE receipt_id = ${receiptId}
     ORDER BY created_at DESC`
  );
}

/**
 * 상비약 사용내역 추가
 */
export async function createMedicineUsage(data: Omit<MedicineUsage, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_medicine_usage (
      patient_id, chart_number, patient_name, receipt_id, usage_date,
      medicine_name, quantity, memo, created_at, updated_at
    ) VALUES (
      ${data.patient_id}, ${escapeString(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${data.receipt_id || 'NULL'}, ${escapeString(data.usage_date)},
      ${escapeString(data.medicine_name)}, ${data.quantity}, ${toSqlValue(data.memo)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

/**
 * 상비약 사용내역 수정
 */
export async function updateMedicineUsage(id: number, updates: Partial<MedicineUsage>): Promise<void> {
  const parts: string[] = [];
  if (updates.medicine_name !== undefined) parts.push(`medicine_name = ${escapeString(updates.medicine_name)}`);
  if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.usage_date !== undefined) parts.push(`usage_date = ${escapeString(updates.usage_date)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  if (parts.length > 0) {
    await execute(`UPDATE cs_medicine_usage SET ${parts.join(', ')} WHERE id = ${id}`);
  }
}

/**
 * 상비약 사용내역 삭제
 */
export async function deleteMedicineUsage(id: number): Promise<void> {
  await execute(`DELETE FROM cs_medicine_usage WHERE id = ${id}`);
}

// ============================================
// 상비약 재고 관리 API
// ============================================

export interface MedicineInventory {
  id: number;
  prescription_id: number | null;
  name: string;
  alias: string | null;
  category: string; // 상비약, 공진단, 증정품, 치료약, 감기약
  total_stock: number;
  current_stock: number;
  doses_per_batch: number;
  packs_per_batch: number;
  unit: string;
  is_active: boolean;
  sort_order: number;
  memo: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MedicineDecoction {
  id: number;
  inventory_id: number;
  decoction_date: string;
  doses: number;
  packs: number;
  memo: string | null;
  created_by: string | null;
  created_at?: string;
  // 조인용
  medicine_name?: string;
}

export const MEDICINE_PURPOSES = ['상비약', '치료약', '감기약', '증정', '보완'] as const;
export type MedicinePurpose = typeof MEDICINE_PURPOSES[number];

export const MEDICINE_CATEGORIES = ['상비약', '공진단', '증정품', '치료약', '감기약'] as const;
export type MedicineCategory = typeof MEDICINE_CATEGORIES[number];

/**
 * 상비약 재고 목록 조회
 */
export async function getMedicineInventory(activeOnly = true): Promise<MedicineInventory[]> {
  let sql = `SELECT * FROM cs_medicine_inventory`;
  if (activeOnly) {
    sql += ` WHERE is_active = TRUE`;
  }
  sql += ` ORDER BY sort_order, name`;
  return query<MedicineInventory>(sql);
}

/**
 * 상비약 재고 상세 조회
 */
export async function getMedicineInventoryById(id: number): Promise<MedicineInventory | null> {
  const results = await query<MedicineInventory>(
    `SELECT * FROM cs_medicine_inventory WHERE id = ${id}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 상비약 검색 (이름/별명)
 */
export async function searchMedicineInventory(
  keyword: string,
  category?: string,
  activeOnly = true
): Promise<MedicineInventory[]> {
  const escapedKeyword = escapeString(`%${keyword}%`);
  let sql = `SELECT * FROM cs_medicine_inventory WHERE (name ILIKE ${escapedKeyword} OR alias ILIKE ${escapedKeyword})`;
  if (activeOnly) {
    sql += ` AND is_active = TRUE`;
  }
  if (category) {
    sql += ` AND category = ${escapeString(category)}`;
  }
  sql += ` ORDER BY sort_order, name`;
  return query<MedicineInventory>(sql);
}

/**
 * 상비약 재고 등록
 */
export async function createMedicineInventory(
  data: Omit<MedicineInventory, 'id' | 'created_at' | 'updated_at'>
): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_medicine_inventory (
      prescription_id, name, alias, category, total_stock, current_stock,
      doses_per_batch, packs_per_batch, unit, is_active, sort_order, memo,
      created_at, updated_at
    ) VALUES (
      ${data.prescription_id ?? 'NULL'}, ${escapeString(data.name)}, ${toSqlValue(data.alias)},
      ${escapeString(data.category)}, ${data.total_stock}, ${data.current_stock},
      ${data.doses_per_batch}, ${data.packs_per_batch}, ${escapeString(data.unit)},
      ${data.is_active}, ${data.sort_order}, ${toSqlValue(data.memo)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

/**
 * 상비약 재고 수정
 */
export async function updateMedicineInventory(
  id: number,
  updates: Partial<MedicineInventory>
): Promise<void> {
  const parts: string[] = [];
  if (updates.prescription_id !== undefined) parts.push(`prescription_id = ${updates.prescription_id ?? 'NULL'}`);
  if (updates.name !== undefined) parts.push(`name = ${escapeString(updates.name)}`);
  if (updates.alias !== undefined) parts.push(`alias = ${toSqlValue(updates.alias)}`);
  if (updates.category !== undefined) parts.push(`category = ${escapeString(updates.category)}`);
  if (updates.total_stock !== undefined) parts.push(`total_stock = ${updates.total_stock}`);
  if (updates.current_stock !== undefined) parts.push(`current_stock = ${updates.current_stock}`);
  if (updates.doses_per_batch !== undefined) parts.push(`doses_per_batch = ${updates.doses_per_batch}`);
  if (updates.packs_per_batch !== undefined) parts.push(`packs_per_batch = ${updates.packs_per_batch}`);
  if (updates.unit !== undefined) parts.push(`unit = ${escapeString(updates.unit)}`);
  if (updates.is_active !== undefined) parts.push(`is_active = ${updates.is_active}`);
  if (updates.sort_order !== undefined) parts.push(`sort_order = ${updates.sort_order}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  if (parts.length > 0) {
    await execute(`UPDATE cs_medicine_inventory SET ${parts.join(', ')} WHERE id = ${id}`);
  }
}

/**
 * 상비약 재고 삭제 (소프트 삭제 - is_active = false)
 */
export async function deleteMedicineInventory(id: number, hardDelete = false): Promise<void> {
  if (hardDelete) {
    await execute(`DELETE FROM cs_medicine_inventory WHERE id = ${id}`);
  } else {
    await execute(`UPDATE cs_medicine_inventory SET is_active = FALSE, updated_at = ${escapeString(getCurrentTimestamp())} WHERE id = ${id}`);
  }
}

/**
 * 상비약 재고 사용 (차감) - 사용내역 기록 + 재고 차감
 */
export async function useMedicineStock(
  inventoryId: number,
  patientId: number,
  chartNumber: string,
  patientName: string,
  quantity: number,
  purpose: MedicinePurpose,
  usageDate: string,
  memo?: string,
  receiptId?: number
): Promise<number> {
  // 재고 조회
  const inventory = await getMedicineInventoryById(inventoryId);
  if (!inventory) {
    throw new Error('상비약을 찾을 수 없습니다.');
  }

  // 재고 부족 체크
  if (inventory.current_stock < quantity) {
    throw new Error(`재고가 부족합니다. (현재: ${inventory.current_stock}${inventory.unit})`);
  }

  // 사용내역 기록
  const now = getCurrentTimestamp();
  const usageId = await insert(`
    INSERT INTO cs_medicine_usage (
      patient_id, chart_number, patient_name, receipt_id, usage_date,
      medicine_name, quantity, memo, inventory_id, purpose,
      created_at, updated_at
    ) VALUES (
      ${patientId}, ${escapeString(chartNumber)}, ${toSqlValue(patientName)},
      ${receiptId ?? 'NULL'}, ${escapeString(usageDate)},
      ${escapeString(inventory.name)}, ${quantity}, ${toSqlValue(memo)},
      ${inventoryId}, ${escapeString(purpose)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);

  // 재고 차감
  await execute(`
    UPDATE cs_medicine_inventory SET
      current_stock = current_stock - ${quantity},
      updated_at = ${escapeString(now)}
    WHERE id = ${inventoryId}
  `);

  return usageId;
}

/**
 * 상비약 재고 추가 (탕전으로 인한 입고)
 */
export async function addMedicineStock(
  inventoryId: number,
  packs: number,
  doses: number,
  decocctionDate: string,
  createdBy?: string,
  memo?: string
): Promise<number> {
  const now = getCurrentTimestamp();

  // 탕전 기록
  const decocctionId = await insert(`
    INSERT INTO cs_medicine_decoctions (
      inventory_id, decoction_date, doses, packs, memo, created_by, created_at
    ) VALUES (
      ${inventoryId}, ${escapeString(decocctionDate)}, ${doses}, ${packs},
      ${toSqlValue(memo)}, ${toSqlValue(createdBy)}, ${escapeString(now)}
    )
  `);

  // 재고 증가
  await execute(`
    UPDATE cs_medicine_inventory SET
      current_stock = current_stock + ${packs},
      total_stock = total_stock + ${packs},
      updated_at = ${escapeString(now)}
    WHERE id = ${inventoryId}
  `);

  return decocctionId;
}

/**
 * 상비약 탕전 내역 조회
 */
export async function getMedicineDecoctions(
  inventoryId?: number,
  startDate?: string,
  endDate?: string
): Promise<MedicineDecoction[]> {
  let sql = `
    SELECT d.*, i.name as medicine_name
    FROM cs_medicine_decoctions d
    LEFT JOIN cs_medicine_inventory i ON d.inventory_id = i.id
    WHERE 1=1
  `;
  if (inventoryId) {
    sql += ` AND d.inventory_id = ${inventoryId}`;
  }
  if (startDate) {
    sql += ` AND d.decoction_date >= ${escapeString(startDate)}`;
  }
  if (endDate) {
    sql += ` AND d.decoction_date <= ${escapeString(endDate)}`;
  }
  sql += ` ORDER BY d.decoction_date DESC, d.created_at DESC`;
  return query<MedicineDecoction>(sql);
}

/**
 * 처방정의 목록 조회 (상비약 등록용)
 */
export async function fetchPrescriptionDefinitions(
  keyword?: string,
  category?: string,
  activeOnly = true
): Promise<Array<{id: number; name: string; category: string; alias: string | null; is_active: boolean}>> {
  let sql = `SELECT id, name, category, alias, is_active FROM prescription_definitions WHERE 1=1`;
  if (activeOnly) {
    sql += ` AND is_active = 1`;
  }
  if (keyword) {
    const escapedKeyword = escapeString(`%${keyword}%`);
    sql += ` AND (name LIKE ${escapedKeyword} OR alias LIKE ${escapedKeyword})`;
  }
  if (category) {
    sql += ` AND category = ${escapeString(category)}`;
  }
  sql += ` ORDER BY category, name`;
  return query(sql);
}

/**
 * 처방정의를 상비약 재고로 일괄 등록
 */
export async function importPrescriptionsToInventory(
  prescriptionIds: number[],
  category: MedicineCategory = '상비약'
): Promise<{success: number; failed: number; errors: string[]}> {
  const result = { success: 0, failed: 0, errors: [] as string[] };

  for (const prescriptionId of prescriptionIds) {
    try {
      // 처방정의 조회
      const prescriptions = await query<{id: number; name: string; alias: string | null}>(
        `SELECT id, name, alias FROM prescription_definitions WHERE id = ${prescriptionId}`
      );
      if (prescriptions.length === 0) {
        result.failed++;
        result.errors.push(`처방정의 ID ${prescriptionId}를 찾을 수 없습니다.`);
        continue;
      }

      const prescription = prescriptions[0];

      // 이미 등록되어 있는지 확인
      const existing = await query<MedicineInventory>(
        `SELECT id FROM cs_medicine_inventory WHERE prescription_id = ${prescriptionId}`
      );
      if (existing.length > 0) {
        result.failed++;
        result.errors.push(`${prescription.name}은(는) 이미 등록되어 있습니다.`);
        continue;
      }

      // 재고 등록
      await createMedicineInventory({
        prescription_id: prescriptionId,
        name: prescription.name,
        alias: prescription.alias,
        category,
        total_stock: 0,
        current_stock: 0,
        doses_per_batch: 20,
        packs_per_batch: 30,
        unit: '팩',
        is_active: true,
        sort_order: 0,
        memo: null,
      });

      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`처방 ID ${prescriptionId}: ${error.message}`);
    }
  }

  return result;
}
