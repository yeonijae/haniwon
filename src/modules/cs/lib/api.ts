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
  ReceiptStatus,
  ReservationStatus,
  MedicineUsage,
  YakchimUsageRecord,
  NokryongPackage,
  HerbalPickup,
  PackageUsage,
  PackageType as PackageTypeEnum,
  PackageUsageType,
  TimelineEvent,
  TimelineEventType,
  TimelineAuditLog,
  TimelineResult,
  HerbalDraft,
  JourneyStatus,
  StaffScheduleEntry,
  DecoctionDayCapacity,
  DecoctionOrder,
} from '../types';
import {
  TIMELINE_EVENT_ICONS,
} from '../types';

// Re-export types for external modules
export type { MedicineUsage } from '../types';

// MSSQL API 기본 URL
const MSSQL_API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// ============================================
// 진료상세내역 조회 (MSSQL Detail 테이블)
// ============================================

export interface ReceiptDetailItem {
  detail_id: number;      // Detail_PK (비급여 연결용)
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
        Detail_PK as detail_id,
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
  dateField?: 'created_at' | 'completed_at';
  includeOpen?: boolean;
  limit?: number;
}): Promise<Inquiry[]> {
  const dateField = options?.dateField || 'created_at';

  let sql = `
    SELECT i.*,
      p.name AS matched_patient_name,
      p.chart_number AS matched_chart_number
    FROM cs_inquiries i
    LEFT JOIN patients p ON i.patient_id = p.id
    WHERE 1=1`;

  if (options?.status) {
    sql += ` AND i.status = ${escapeString(options.status)}`;
  }

  if (options?.date) {
    if (options?.includeOpen) {
      // 미완료 항목은 항상 표시 + 선택 날짜의 완료 항목
      sql += ` AND (i.status IN ('pending', 'in_progress') OR DATE(i.${dateField}) = ${escapeString(options.date)})`;
    } else {
      sql += ` AND DATE(i.${dateField}) = ${escapeString(options.date)}`;
    }
  }

  sql += ' ORDER BY i.created_at DESC';

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
      channel, patient_name, contact, inquiry_type, content, response, status, staff_name, handler_name, created_at, updated_at
    ) VALUES (
      ${escapeString(data.channel)},
      ${toSqlValue(data.patient_name)},
      ${toSqlValue(data.contact)},
      ${escapeString(data.inquiry_type)},
      ${escapeString(data.content)},
      ${toSqlValue(data.response)},
      'pending',
      ${toSqlValue(data.staff_name)},
      ${toSqlValue(data.handler_name)},
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
  if (data.handler_name !== undefined) updates.push(`handler_name = ${data.handler_name === null ? 'NULL' : escapeString(data.handler_name)}`);
  if (data.patient_id !== undefined) updates.push(`patient_id = ${data.patient_id === null ? 'NULL' : Number(data.patient_id)}`);

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
  const isCompleted = status === 'completed' || status === 'converted';
  const completedAt = isCompleted ? escapeString(getCurrentTimestamp()) : 'NULL';
  await execute(`UPDATE cs_inquiries SET status = ${escapeString(status)}, completed_at = ${completedAt}, updated_at = ${escapeString(getCurrentTimestamp())} WHERE id = ${id}`);
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

  // patient_id 컬럼 마이그레이션
  await execute(`ALTER TABLE cs_inquiries ADD COLUMN IF NOT EXISTS patient_id INTEGER`);

  // completed_at, handler_name 컬럼 마이그레이션
  await execute(`ALTER TABLE cs_inquiries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);
  await execute(`ALTER TABLE cs_inquiries ADD COLUMN IF NOT EXISTS handler_name TEXT`);

  markTableInitialized('cs_inquiries');
}

// ============================================
// CS 담당자 관리
// ============================================

export interface CsHandler {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export async function ensureHandlersTable(): Promise<void> {
  if (isTableInitialized('cs_handlers')) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS cs_handlers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await execute(sql);
  markTableInitialized('cs_handlers');
}

export async function getHandlers(activeOnly = false): Promise<CsHandler[]> {
  await ensureHandlersTable();
  let sql = 'SELECT * FROM cs_handlers';
  if (activeOnly) sql += ' WHERE is_active = true';
  sql += ' ORDER BY sort_order, name';
  return query<CsHandler>(sql);
}

export async function createHandler(name: string): Promise<number> {
  await ensureHandlersTable();
  const sql = `INSERT INTO cs_handlers (name) VALUES (${escapeString(name)})`;
  return insert(sql);
}

export async function updateHandler(id: number, data: { name?: string; is_active?: boolean; sort_order?: number }): Promise<void> {
  const updates: string[] = [];
  if (data.name !== undefined) updates.push(`name = ${escapeString(data.name)}`);
  if (data.is_active !== undefined) updates.push(`is_active = ${data.is_active}`);
  if (data.sort_order !== undefined) updates.push(`sort_order = ${data.sort_order}`);
  if (updates.length === 0) return;
  await execute(`UPDATE cs_handlers SET ${updates.join(', ')} WHERE id = ${id}`);
}

export async function deleteHandler(id: number): Promise<void> {
  await execute(`DELETE FROM cs_handlers WHERE id = ${id}`);
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

  // 한약패키지 테이블 마이그레이션 - 누락된 컬럼 추가
  await execute(`ALTER TABLE cs_herbal_packages ADD COLUMN IF NOT EXISTS herbal_name TEXT`).catch(() => {});
  await execute(`ALTER TABLE cs_herbal_packages ADD COLUMN IF NOT EXISTS purpose TEXT`).catch(() => {});
  // 수납 연결용 컬럼 (선등록 → 후향 연결)
  await execute(`ALTER TABLE cs_herbal_packages ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});

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

  // 녹용 패키지 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_nokryong_packages (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      package_name TEXT,
      total_months INTEGER DEFAULT 3,
      remaining_months INTEGER DEFAULT 3,
      start_date TEXT NOT NULL,
      expire_date TEXT,
      memo TEXT,
      status TEXT DEFAULT 'active',
      mssql_detail_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});  // 이미 존재하면 무시

  // 한약 수령 기록 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_pickups (
      id SERIAL PRIMARY KEY,
      package_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      round_id INTEGER,
      receipt_id INTEGER,
      mssql_detail_id INTEGER,
      pickup_date TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      delivery_method TEXT DEFAULT 'pickup',
      with_nokryong BOOLEAN DEFAULT FALSE,
      nokryong_package_id INTEGER,
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (package_id) REFERENCES cs_herbal_packages(id) ON DELETE CASCADE
    )
  `).catch(() => {});  // 이미 존재하면 무시

  // 기존 테이블에 mssql_detail_id 컬럼 추가
  await execute(`ALTER TABLE cs_herbal_pickups ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});

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
  // mssql_detail_id 컬럼 추가 (비급여 항목 연결용)
  await execute(`ALTER TABLE cs_memberships ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});

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

  // 수납 메모 테이블 (순수 메모 전용)
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_receipt_memos (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      mssql_receipt_id INTEGER,
      mssql_detail_id INTEGER,
      receipt_date TEXT NOT NULL,
      memo TEXT,
      item_name TEXT,
      item_type TEXT,
      created_by TEXT,
      memo_type_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 기존 테이블 마이그레이션: 커스텀 메모용 컬럼 추가
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS item_name TEXT`).catch(() => {});
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS item_type TEXT`).catch(() => {});
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS created_by TEXT`).catch(() => {});
  await execute(`ALTER TABLE cs_receipt_memos ADD COLUMN IF NOT EXISTS memo_type_id INTEGER`).catch(() => {});

  // 수납 상태 테이블 (완료/예약 상태 전용)
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_receipt_status (
      id SERIAL PRIMARY KEY,
      receipt_id INTEGER NOT NULL UNIQUE,
      patient_id INTEGER NOT NULL,
      receipt_date TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      reservation_status TEXT DEFAULT 'none',
      reservation_date TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 마이그레이션: 기존 cs_receipt_memos에서 상태 데이터를 cs_receipt_status로 복사 (컬럼이 아직 존재할 때만)
  const migrationCols = await query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cs_receipt_memos' AND column_name = 'is_completed'
  `).catch(() => []);

  if (migrationCols.length > 0) {
    await execute(`
      INSERT INTO cs_receipt_status (receipt_id, patient_id, receipt_date, is_completed, reservation_status, reservation_date)
      SELECT mssql_receipt_id, patient_id, receipt_date, is_completed, reservation_status, reservation_date
      FROM cs_receipt_memos
      WHERE mssql_receipt_id IS NOT NULL AND (is_completed = 1 OR reservation_status IS NOT NULL AND reservation_status != 'none')
      ON CONFLICT (receipt_id) DO NOTHING
    `).catch(() => {});

    // 마이그레이션 완료 후 cs_receipt_memos에서 상태/패키지 컬럼 제거
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS is_completed`).catch(() => {});
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS reservation_status`).catch(() => {});
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS reservation_date`).catch(() => {});
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS herbal_package_id`).catch(() => {});
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS herbal_pickup_id`).catch(() => {});
    await execute(`ALTER TABLE cs_receipt_memos DROP COLUMN IF EXISTS nokryong_package_id`).catch(() => {});
  }

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

  // mssql_detail_id 컬럼 추가 (비급여 항목별 메모 연결용)
  await execute(`ALTER TABLE cs_yakchim_usage_records ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});
  await execute(`ALTER TABLE cs_medicine_usage ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});
  await execute(`ALTER TABLE cs_herbal_dispensings ADD COLUMN IF NOT EXISTS mssql_detail_id INTEGER`).catch(() => {});

  // 약침 사용 기록에 실제 차감 포인트 컬럼 추가 (약침 종류별 차감 포인트 합계)
  await execute(`ALTER TABLE cs_yakchim_usage_records ADD COLUMN IF NOT EXISTS deduction_points INTEGER`).catch(() => {});
  // 기존 데이터 마이그레이션: deduction_points가 없는 경우 quantity로 설정
  await execute(`UPDATE cs_yakchim_usage_records SET deduction_points = quantity WHERE deduction_points IS NULL`).catch(() => {});

  // 상비약 재고관리 테이블 - last_decoction_date 컬럼 추가
  await execute(`ALTER TABLE cs_medicine_inventory ADD COLUMN IF NOT EXISTS last_decoction_date TEXT`).catch(() => {});

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

  // 패키지 사용기록 통합 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_package_usage (
      id SERIAL PRIMARY KEY,
      package_type TEXT NOT NULL,
      package_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      usage_date TEXT NOT NULL,
      usage_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      mssql_detail_id INTEGER,
      mssql_receipt_id INTEGER,
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // 인덱스 추가
  await execute(`CREATE INDEX IF NOT EXISTS idx_package_usage_patient_date ON cs_package_usage(patient_id, usage_date)`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_package_usage_package ON cs_package_usage(package_type, package_id)`).catch(() => {});

  // 타임라인 수정 이력 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_timeline_audit_logs (
      id SERIAL PRIMARY KEY,
      source_table TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      modified_at TIMESTAMP DEFAULT NOW(),
      modified_by TEXT NOT NULL,
      modification_reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await execute(`CREATE INDEX IF NOT EXISTS idx_timeline_audit_source ON cs_timeline_audit_logs(source_table, source_id)`).catch(() => {});

  // 환자 메모 노트 테이블 (CRM)
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_patient_notes (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT NOT NULL,
      patient_name TEXT,

      note_type TEXT NOT NULL,
      channel TEXT,

      content TEXT NOT NULL,
      response TEXT,
      status TEXT DEFAULT 'active',

      mssql_receipt_id INTEGER,
      mssql_detail_id INTEGER,
      related_date TEXT,

      staff_name TEXT NOT NULL,
      staff_role TEXT NOT NULL,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await execute(`CREATE INDEX IF NOT EXISTS idx_patient_notes_patient_id ON cs_patient_notes(patient_id)`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_patient_notes_chart_number ON cs_patient_notes(chart_number)`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_patient_notes_note_type ON cs_patient_notes(note_type)`).catch(() => {});

  // 메모 종류 테이블
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_memo_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6b7280',
      icon TEXT DEFAULT 'comment',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 기본 메모 종류 추가 (없는 경우에만)
  await execute(`
    INSERT INTO cs_memo_types (name, color, icon, sort_order)
    SELECT '일반', '#6b7280', 'comment', 0
    WHERE NOT EXISTS (SELECT 1 FROM cs_memo_types WHERE name = '일반')
  `).catch(() => {});
  await execute(`
    INSERT INTO cs_memo_types (name, color, icon, sort_order)
    SELECT '컴플레인', '#ef4444', 'exclamation-circle', 1
    WHERE NOT EXISTS (SELECT 1 FROM cs_memo_types WHERE name = '컴플레인')
  `).catch(() => {});
  await execute(`
    INSERT INTO cs_memo_types (name, color, icon, sort_order)
    SELECT '요청사항', '#f59e0b', 'hand-paper', 2
    WHERE NOT EXISTS (SELECT 1 FROM cs_memo_types WHERE name = '요청사항')
  `).catch(() => {});
  await execute(`
    INSERT INTO cs_memo_types (name, color, icon, sort_order)
    SELECT '특이사항', '#8b5cf6', 'info-circle', 3
    WHERE NOT EXISTS (SELECT 1 FROM cs_memo_types WHERE name = '특이사항')
  `).catch(() => {});

  // memo_type_id 컬럼은 이미 cs_receipt_memos CREATE TABLE에 포함

  // 한약 기록 (Draft)
    await execute(`
      CREATE TABLE IF NOT EXISTS cs_herbal_drafts (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        chart_number TEXT,
        patient_name TEXT,
        herbal_name TEXT,
        consultation_type TEXT,
        payment_type TEXT,
        nokryong_type TEXT,
        visit_pattern TEXT,
        treatment_months TEXT,
        consultation_method TEXT,
        sub_type TEXT,
        nokryong_grade TEXT,
        nokryong_count INTEGER,
        delivery_method TEXT DEFAULT 'pickup',
        decoction_date TEXT,
        memo TEXT,
        status TEXT DEFAULT 'draft',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 한약 기록 마이그레이션 - 컬럼 추가
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS consultation_type TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS payment_type TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS nokryong_type TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS visit_pattern TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS treatment_months TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS consultation_method TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS sub_type TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS nokryong_grade TEXT`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS nokryong_count INTEGER`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS medicine_items TEXT`).catch(() => {});
    // 진료일 컬럼 추가 + 기존 데이터 마이그레이션 (created_at 날짜 부분으로)
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS receipt_date TEXT`).catch(() => {});
    await execute(`UPDATE cs_herbal_drafts SET receipt_date = TO_CHAR(created_at, 'YYYY-MM-DD') WHERE receipt_date IS NULL`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS doctor TEXT`).catch(() => {});
    // 빈 doctor 필드를 local_patients.main_doctor로 채우기 (cs_local_patients가 있을 때만)
    const lpExists = await query<{ exists: boolean }>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cs_local_patients') as exists`);
    if (lpExists[0]?.exists) {
      await execute(`UPDATE cs_herbal_drafts d SET doctor = p.main_doctor FROM cs_local_patients p WHERE d.chart_number = p.chart_no AND (d.doctor IS NULL OR d.doctor = '') AND p.main_doctor IS NOT NULL AND p.main_doctor != ''`).catch(() => {});
      await execute(`ALTER TABLE cs_local_patients ADD COLUMN IF NOT EXISTS consultation_memo TEXT`).catch(() => {});
    }
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS journey_status JSONB DEFAULT '{}'`).catch(() => {});

    // 탕전 인력 스케줄
    await execute(`
      CREATE TABLE IF NOT EXISTS cs_decoction_staff_schedule (
        id SERIAL PRIMARY KEY,
        schedule_date TEXT NOT NULL UNIQUE,
        staff_count INTEGER NOT NULL DEFAULT 1,
        is_holiday BOOLEAN DEFAULT false,
        memo TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
      includes, start_date, expire_date, memo, mssql_detail_id, status, created_at, updated_at
    ) VALUES (
      ${pkg.patient_id}, ${toSqlValue(pkg.chart_number)}, ${toSqlValue(pkg.patient_name)},
      ${escapeString(pkg.package_name)}, ${pkg.total_count}, ${pkg.used_count}, ${pkg.remaining_count},
      ${toSqlValue(pkg.includes)}, ${escapeString(pkg.start_date)}, ${toSqlValue(pkg.expire_date)},
      ${toSqlValue(pkg.memo)}, ${pkg.mssql_detail_id || 'NULL'}, ${escapeString(pkg.status)}, ${escapeString(now)}, ${escapeString(now)}
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
  const id = await insert(`
    INSERT INTO cs_herbal_packages (
      patient_id, chart_number, patient_name, herbal_name, package_type, total_count, used_count, remaining_count,
      start_date, next_delivery_date, memo, status,
      decoction_date, delivery_method, doctor_name, mssql_detail_id,
      created_at, updated_at
    ) VALUES (
      ${pkg.patient_id}, ${toSqlValue(pkg.chart_number)}, ${toSqlValue(pkg.patient_name)},
      ${toSqlValue(pkg.herbal_name)}, ${escapeString(pkg.package_type)}, ${pkg.total_count}, ${pkg.used_count}, ${pkg.remaining_count},
      ${escapeString(pkg.start_date)}, ${toSqlValue(pkg.next_delivery_date)},
      ${toSqlValue(pkg.memo)}, ${escapeString(pkg.status)},
      ${toSqlValue(pkg.decoction_date)}, ${toSqlValue(pkg.delivery_method)}, ${toSqlValue(pkg.doctor_name)}, ${pkg.mssql_detail_id || 'NULL'},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);

  // insert 함수가 0을 반환하면 직접 조회
  if (!id) {
    const result = await query<{ id: number }>(`
      SELECT id FROM cs_herbal_packages
      WHERE patient_id = ${pkg.patient_id} AND created_at = ${escapeString(now)}
      ORDER BY id DESC LIMIT 1
    `);
    if (result && result.length > 0) {
      return result[0].id;
    }
    throw new Error('한약 패키지 생성 실패');
  }
  return id;
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

export async function getHerbalPackageById(id: number): Promise<HerbalPackage | null> {
  const results = await query<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages WHERE id = ${id}`
  );
  return results[0] || null;
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
  // 탕전 관련 필드
  if (updates.doctor_id !== undefined) parts.push(`doctor_id = ${updates.doctor_id === null ? 'NULL' : updates.doctor_id}`);
  if (updates.doctor_name !== undefined) parts.push(`doctor_name = ${toSqlValue(updates.doctor_name)}`);
  if (updates.decoction_date !== undefined) parts.push(`decoction_date = ${toSqlValue(updates.decoction_date)}`);
  if (updates.decoction_status !== undefined) parts.push(`decoction_status = ${toSqlValue(updates.decoction_status)}`);
  if (updates.prescription_status !== undefined) parts.push(`prescription_status = ${toSqlValue(updates.prescription_status)}`);
  if (updates.prescription_due_date !== undefined) parts.push(`prescription_due_date = ${toSqlValue(updates.prescription_due_date)}`);
  if (updates.delivery_method !== undefined) parts.push(`delivery_method = ${toSqlValue(updates.delivery_method)}`);
  if (updates.delivery_status !== undefined) parts.push(`delivery_status = ${toSqlValue(updates.delivery_status)}`);
  if (updates.mssql_detail_id !== undefined) parts.push(`mssql_detail_id = ${updates.mssql_detail_id === null ? 'NULL' : updates.mssql_detail_id}`);
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

// 미연결 한약패키지 조회 (수납 연결 전 선등록 패키지)
export async function getUnlinkedHerbalPackages(patientId: number): Promise<HerbalPackage[]> {
  return query<HerbalPackage>(
    `SELECT * FROM cs_herbal_packages
     WHERE patient_id = ${patientId} AND status = 'active' AND mssql_detail_id IS NULL
     ORDER BY created_at DESC`
  );
}

// 한약 패키지를 수납 비급여 항목에 연결
export async function linkPackageToReceipt(packageId: number, mssqlDetailId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_herbal_packages
    SET mssql_detail_id = ${mssqlDetailId}, updated_at = ${escapeString(now)}
    WHERE id = ${packageId}
  `);
}

// 녹용 미연결 패키지 조회
export async function getUnlinkedNokryongPackages(patientId: number): Promise<NokryongPackage[]> {
  return query<NokryongPackage>(
    `SELECT * FROM cs_nokryong_packages
     WHERE patient_id = ${patientId} AND status = 'active' AND mssql_detail_id IS NULL
     ORDER BY created_at DESC`
  );
}

// 녹용 패키지를 수납 비급여 항목에 연결
export async function linkNokryongToReceipt(packageId: number, mssqlDetailId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_nokryong_packages
    SET mssql_detail_id = ${mssqlDetailId}, updated_at = ${escapeString(now)}
    WHERE id = ${packageId}
  `);
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
      patient_id, chart_number, patient_name, membership_type, quantity, remaining_count,
      start_date, expire_date, memo, mssql_detail_id, status, created_at, updated_at
    ) VALUES (
      ${membership.patient_id}, ${toSqlValue(membership.chart_number)}, ${toSqlValue(membership.patient_name)},
      ${escapeString(membership.membership_type)}, ${membership.quantity}, ${membership.quantity},
      ${escapeString(membership.start_date)}, ${escapeString(membership.expire_date)},
      ${toSqlValue(membership.memo)}, ${membership.mssql_detail_id || 'NULL'},
      ${escapeString(membership.status)}, ${escapeString(now)}, ${escapeString(now)}
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
      delivery_method, receipt_id, mssql_detail_id, memo, dispensing_date, created_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${escapeString(data.herbal_name)}, ${data.quantity}, ${escapeString(data.dispensing_type)},
      ${escapeString(data.delivery_method)}, ${data.receipt_id || 'NULL'}, ${data.mssql_detail_id || 'NULL'},
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
    `SELECT * FROM cs_receipt_memos WHERE mssql_receipt_id = ${receiptId} ORDER BY id DESC LIMIT 1`
  );
  return results.length > 0 ? results[0] : null;
}

export async function getReceiptMemosByReceiptId(receiptId: number): Promise<ReceiptMemo[]> {
  return query<ReceiptMemo>(
    `SELECT * FROM cs_receipt_memos WHERE mssql_receipt_id = ${receiptId} ORDER BY created_at ASC`
  );
}

/**
 * 수납 메모 추가 (항상 INSERT - 순수 메모 전용)
 */
export async function addReceiptMemo(data: {
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  mssql_receipt_id?: number;
  mssql_detail_id?: number;
  receipt_id?: number;
  receipt_date: string;
  memo: string;
  item_name?: string;
  item_type?: string;
  created_by?: string;
  memo_type_id?: number;
}): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_receipt_memos (
      patient_id, chart_number, patient_name, mssql_receipt_id, mssql_detail_id, receipt_date,
      memo, item_name, item_type, created_by, memo_type_id, created_at, updated_at
    ) VALUES (
      ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${data.mssql_receipt_id || 'NULL'}, ${data.mssql_detail_id || 'NULL'}, ${escapeString(data.receipt_date)},
      ${toSqlValue(data.memo)}, ${toSqlValue(data.item_name)}, ${toSqlValue(data.item_type)}, ${toSqlValue(data.created_by)}, ${data.memo_type_id || 'NULL'},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

/**
 * 수납 메모 수정 (ID 기준)
 */
export async function updateReceiptMemoById(id: number, memo: string): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_receipt_memos
    SET memo = ${toSqlValue(memo)}, updated_at = ${escapeString(now)}
    WHERE id = ${id}
  `);
}

/**
 * 수납 메모 삭제 (ID 기준)
 */
export async function deleteReceiptMemoById(id: number): Promise<void> {
  await execute(`DELETE FROM cs_receipt_memos WHERE id = ${id}`);
}

// ============================================
// 수납 상태 API (cs_receipt_status)
// ============================================

/**
 * 수납 상태 조회
 */
export async function getReceiptStatus(receiptId: number): Promise<ReceiptStatus | null> {
  const results = await query<ReceiptStatus>(
    `SELECT * FROM cs_receipt_status WHERE receipt_id = ${receiptId}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 수납 상태 UPSERT (완료/예약 상태)
 */
export async function upsertReceiptStatus(data: {
  receipt_id: number;
  patient_id: number;
  receipt_date: string;
  is_completed?: boolean;
  reservation_status?: ReservationStatus;
  reservation_date?: string;
}): Promise<void> {
  const now = getCurrentTimestamp();
  const existing = await getReceiptStatus(data.receipt_id);

  if (existing) {
    const parts: string[] = [];
    if (data.is_completed !== undefined) parts.push(`is_completed = ${data.is_completed ? 1 : 0}`);
    if (data.reservation_status !== undefined) parts.push(`reservation_status = ${escapeString(data.reservation_status)}`);
    if (data.reservation_date !== undefined) parts.push(`reservation_date = ${toSqlValue(data.reservation_date)}`);
    parts.push(`updated_at = ${escapeString(now)}`);
    await execute(`UPDATE cs_receipt_status SET ${parts.join(', ')} WHERE receipt_id = ${data.receipt_id}`);
  } else {
    await execute(`
      INSERT INTO cs_receipt_status (receipt_id, patient_id, receipt_date, is_completed, reservation_status, reservation_date, created_at, updated_at)
      VALUES (
        ${data.receipt_id}, ${data.patient_id}, ${escapeString(data.receipt_date)},
        ${data.is_completed ? 1 : 0}, ${escapeString(data.reservation_status || 'none')},
        ${toSqlValue(data.reservation_date)}, ${escapeString(now)}, ${escapeString(now)}
      )
    `);
  }
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
  if (!mssqlReceiptId) return;
  await upsertReceiptStatus({
    receipt_id: mssqlReceiptId,
    patient_id: patientId,
    receipt_date: receiptDate,
    is_completed: isCompleted,
  });
}

/**
 * 날짜별 완료된 수납 ID 목록 조회
 */
export async function getCompletedReceiptIds(date: string): Promise<Set<number>> {
  const statuses = await query<ReceiptStatus>(
    `SELECT receipt_id FROM cs_receipt_status WHERE receipt_date = ${escapeString(date)} AND is_completed = 1`
  );
  return new Set(statuses.map(s => s.receipt_id));
}

/**
 * 예약 상태 변경
 */
export async function updateReservationStatus(
  patientId: number,
  date: string,
  status: ReservationStatus,
  reservationDate?: string,
  mssqlReceiptId?: number
): Promise<void> {
  if (!mssqlReceiptId) return;
  await upsertReceiptStatus({
    receipt_id: mssqlReceiptId,
    patient_id: patientId,
    receipt_date: date,
    reservation_status: status,
    reservation_date: reservationDate,
  });
}

/**
 * 환자별 이전 메모 통합 조회 (일반메모 + 비급여메모)
 * - cs_receipt_memos와 payment_memo_items를 통합
 * - 날짜별로 그룹화하여 /로 구분
 * - 기록된 순서대로 정렬 (created_at ASC)
 */
export interface PreviousMemoItem {
  date: string;        // YY/MM/DD 형식
  memos: string[];     // 해당 날짜의 메모들
}

export async function fetchPatientPreviousMemos(
  patientId: number,
  excludeDate?: string,
  limit: number = 20
): Promise<PreviousMemoItem[]> {
  // 1. cs_receipt_memos에서 일반메모 조회
  const receiptMemos = await query<{
    receipt_date: string;
    memo: string;
    created_at: string;
  }>(`
    SELECT receipt_date, memo, created_at
    FROM cs_receipt_memos
    WHERE patient_id = ${patientId}
      AND memo IS NOT NULL
      AND memo != ''
      AND memo != '/'
      AND memo != 'x'
      AND memo != 'X'
      ${excludeDate ? `AND receipt_date != ${escapeString(excludeDate)}` : ''}
    ORDER BY created_at ASC
  `);

  // 2. payment_memo_items에서 비급여메모 조회
  const paymentMemos = await query<{
    receipt_date: string;
    memo_content: string;
    created_at: string;
  }>(`
    SELECT receipt_date, memo_content, created_at
    FROM payment_memo_items
    WHERE patient_id = ${patientId}
      AND memo_content IS NOT NULL
      AND memo_content != ''
      ${excludeDate ? `AND receipt_date != ${escapeString(excludeDate)}` : ''}
    ORDER BY created_at ASC
  `);

  // 3. 통합 및 날짜별 그룹화
  const memoMap = new Map<string, { memos: string[]; latestCreated: string }>();

  // 일반메모 추가
  for (const m of receiptMemos) {
    if (!m.receipt_date || !m.memo) continue;
    const existing = memoMap.get(m.receipt_date);
    if (existing) {
      existing.memos.push(m.memo);
      if (m.created_at > existing.latestCreated) {
        existing.latestCreated = m.created_at;
      }
    } else {
      memoMap.set(m.receipt_date, {
        memos: [m.memo],
        latestCreated: m.created_at || ''
      });
    }
  }

  // 비급여메모 추가
  for (const m of paymentMemos) {
    if (!m.receipt_date || !m.memo_content) continue;
    const existing = memoMap.get(m.receipt_date);
    if (existing) {
      existing.memos.push(m.memo_content);
      if (m.created_at > existing.latestCreated) {
        existing.latestCreated = m.created_at;
      }
    } else {
      memoMap.set(m.receipt_date, {
        memos: [m.memo_content],
        latestCreated: m.created_at || ''
      });
    }
  }

  // 4. 날짜 내림차순 정렬 후 YY/MM/DD 형식으로 변환
  const sortedDates = Array.from(memoMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // 최신 날짜 먼저
    .slice(0, limit);

  return sortedDates.map(([date, data]) => {
    // YYYY-MM-DD -> YY/MM/DD
    const parts = date.split('-');
    const formattedDate = parts.length === 3
      ? `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`
      : date;

    return {
      date: formattedDate,
      memos: data.memos
    };
  });
}

// ============================================
// 환자별 메모 요약 데이터 조회
// ============================================

export async function getPatientMemoData(patientId: number, date: string): Promise<{
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  nokryongPackages: NokryongPackage[];
  packageUsages: PackageUsage[];
  herbalPickups: HerbalPickup[];
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
    nokryongPackages,
    packageUsages,
    herbalPickups,
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
    getActiveNokryongPackages(patientId),
    getPackageUsagesByDate(patientId, date),
    getHerbalPickupsByDate(patientId, date),
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
    nokryongPackages,
    packageUsages,
    herbalPickups,
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
  nokryongPackages: NokryongPackage[];
  packageUsages: PackageUsage[];
  herbalPickups: HerbalPickup[];
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

  // 14개 배치 쿼리 병렬 실행
  const [
    allTreatmentPackages,
    allHerbalPackages,
    allNokryongPackages,
    allPackageUsages,
    allHerbalPickups,
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
    // 녹용패키지 (활성)
    query<NokryongPackage>(
      `SELECT * FROM cs_nokryong_packages WHERE patient_id IN (${idsStr}) AND status = 'active'`
    ),
    // 패키지 사용기록 (오늘)
    query<PackageUsage>(
      `SELECT * FROM cs_package_usage WHERE patient_id IN (${idsStr}) AND usage_date = ${escapeString(date)}`
    ),
    // 한약 수령기록 (오늘)
    query<HerbalPickup>(
      `SELECT * FROM cs_herbal_pickups WHERE patient_id IN (${idsStr}) AND pickup_date = ${escapeString(date)}`
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
    const nokryongPackages = allNokryongPackages.filter(p => p.patient_id === patientId);
    const packageUsages = allPackageUsages.filter(p => p.patient_id === patientId);
    const herbalPickups = allHerbalPickups.filter(p => p.patient_id === patientId);
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
      nokryongPackages,
      packageUsages,
      herbalPickups,
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

/**
 * 기간별 상비약 사용내역 조회
 */
export async function getMedicineUsagesByDateRange(
  startDate: string,
  endDate: string,
  medicineName?: string,
  patientName?: string
): Promise<MedicineUsage[]> {
  let sql = `SELECT * FROM cs_medicine_usage WHERE usage_date >= ${escapeString(startDate)} AND usage_date <= ${escapeString(endDate)}`;

  if (medicineName) {
    sql += ` AND medicine_name ILIKE ${escapeString('%' + medicineName + '%')}`;
  }
  if (patientName) {
    sql += ` AND patient_name ILIKE ${escapeString('%' + patientName + '%')}`;
  }

  sql += ' ORDER BY usage_date DESC, created_at DESC';
  return query<MedicineUsage>(sql);
}

/**
 * 기간별 상비약 사용 통계
 */
export interface MedicineUsageStats {
  medicine_name: string;
  total_quantity: number;
  usage_count: number;
  patient_count: number;
}

export async function getMedicineUsageStatsByDateRange(
  startDate: string,
  endDate: string
): Promise<MedicineUsageStats[]> {
  return query<MedicineUsageStats>(`
    SELECT
      medicine_name,
      SUM(quantity) as total_quantity,
      COUNT(*) as usage_count,
      COUNT(DISTINCT patient_id) as patient_count
    FROM cs_medicine_usage
    WHERE usage_date >= ${escapeString(startDate)} AND usage_date <= ${escapeString(endDate)}
    GROUP BY medicine_name
    ORDER BY total_quantity DESC
  `);
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
 * 약침 사용 기록 추가
 */
export async function createYakchimUsageRecord(data: {
  patient_id: number;
  source_type: 'package' | 'membership' | 'one-time';
  source_id: number;
  source_name: string;
  usage_date: string;
  item_name: string;
  remaining_after: number;
  receipt_id?: number;
  mssql_detail_id?: number;
  memo?: string;
  quantity?: number;  // 약침 갯수
  deduction_points?: number;  // 실제 차감 포인트 (약침 종류별 차감 포인트 합계)
}): Promise<number> {
  const now = getCurrentTimestamp();
  // deduction_points가 없으면 quantity로 설정
  const deductionPoints = data.deduction_points ?? data.quantity ?? 1;
  return insert(`
    INSERT INTO cs_yakchim_usage_records (
      patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id, mssql_detail_id, memo, quantity, deduction_points, created_at
    ) VALUES (
      ${data.patient_id}, ${escapeString(data.source_type)}, ${data.source_id}, ${escapeString(data.source_name)},
      ${escapeString(data.usage_date)}, ${escapeString(data.item_name)}, ${data.remaining_after},
      ${data.receipt_id || 'NULL'}, ${data.mssql_detail_id || 'NULL'}, ${toSqlValue(data.memo)}, ${data.quantity || 1}, ${deductionPoints}, ${escapeString(now)}
    )
  `);
}

/**
 * 약침 사용내역 단건 조회
 */
export async function getYakchimUsageRecordById(id: number): Promise<YakchimUsageRecord | null> {
  const results = await query<YakchimUsageRecord>(
    `SELECT * FROM cs_yakchim_usage_records WHERE id = ${id}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 약침 사용내역 수정
 * - 수량(quantity) 변경 시 패키지 remaining_count 조정
 * - 사용방식(source_type) 변경 시 이전 소스 재고 복구 및 새 소스 차감
 */
export async function updateYakchimUsageRecord(id: number, updates: {
  item_name?: string;
  quantity?: number;
  memo?: string;
  source_type?: 'membership' | 'package' | 'one-time';
  source_id?: number;
  source_name?: string;
  deduction_points?: number;  // 패키지 차감 포인트 (각 약침의 차감 포인트 합계)
}): Promise<boolean> {
  try {
    // 기존 레코드 조회
    const record = await getYakchimUsageRecordById(id);
    if (!record) {
      console.error('약침 사용 기록을 찾을 수 없습니다:', id);
      return false;
    }

    const oldQuantity = record.quantity || 1;
    const newQuantity = updates.quantity ?? oldQuantity;
    // 실제 차감 포인트 (DB에 저장된 값 사용, 없으면 quantity로 폴백)
    const oldDeductionPoints = record.deduction_points ?? oldQuantity;
    const newDeductionPoints = updates.deduction_points ?? oldDeductionPoints;  // 변경 없으면 기존 값 유지
    const deductionDiff = newDeductionPoints - oldDeductionPoints;

    // 사용방식 변경 여부 확인
    const isSourceTypeChanging = updates.source_type !== undefined && updates.source_type !== record.source_type;
    const isSourceIdChanging = updates.source_id !== undefined && updates.source_id !== record.source_id;
    const isSourceChanging = isSourceTypeChanging || isSourceIdChanging;

    let newRemainingAfter = record.remaining_after;

    // 1. 사용방식 변경 시: 이전 소스 재고 복구
    if (isSourceChanging) {
      if (record.source_type === 'package') {
        // 이전 패키지 재고 복구 (이전 차감 포인트만큼 복구)
        await execute(`
          UPDATE cs_treatment_packages
          SET remaining_count = remaining_count + ${oldDeductionPoints},
              used_count = used_count - ${oldDeductionPoints},
              status = 'active',
              updated_at = ${escapeString(getCurrentTimestamp())}
          WHERE id = ${record.source_id}
        `);
      }
      // 멤버십과 일회성은 재고 복구 불필요

      // 2. 새 소스에서 차감
      const newSourceType = updates.source_type ?? record.source_type;
      const newSourceId = updates.source_id ?? record.source_id;

      if (newSourceType === 'package' && newSourceId) {
        // 새 패키지에서 차감 (새 차감 포인트 사용)
        await execute(`
          UPDATE cs_treatment_packages
          SET remaining_count = remaining_count - ${newDeductionPoints},
              used_count = used_count + ${newDeductionPoints},
              status = CASE WHEN remaining_count - ${newDeductionPoints} <= 0 THEN 'completed' ELSE 'active' END,
              updated_at = ${escapeString(getCurrentTimestamp())}
          WHERE id = ${newSourceId}
        `);

        // 새 remaining_after 조회
        const pkgResult = await query<{ remaining_count: number }>(
          `SELECT remaining_count FROM cs_treatment_packages WHERE id = ${newSourceId}`
        );
        if (pkgResult.length > 0) {
          newRemainingAfter = pkgResult[0].remaining_count;
        }
      } else {
        // 멤버십이나 일회성은 remaining_after = 0
        newRemainingAfter = 0;
      }
    } else if (!isSourceChanging && record.source_type === 'package' && deductionDiff !== 0) {
      // 사용방식 변경 없이 차감 포인트만 변경한 경우
      await execute(`
        UPDATE cs_treatment_packages
        SET remaining_count = remaining_count - ${deductionDiff},
            used_count = used_count + ${deductionDiff},
            status = CASE WHEN remaining_count - ${deductionDiff} <= 0 THEN 'completed' ELSE 'active' END,
            updated_at = ${escapeString(getCurrentTimestamp())}
        WHERE id = ${record.source_id}
      `);

      // remaining_after도 업데이트
      const pkgResult = await query<{ remaining_count: number }>(
        `SELECT remaining_count FROM cs_treatment_packages WHERE id = ${record.source_id}`
      );
      if (pkgResult.length > 0) {
        newRemainingAfter = pkgResult[0].remaining_count;
      }
    }

    // 레코드 업데이트
    const parts: string[] = [];
    if (updates.item_name !== undefined) parts.push(`item_name = ${escapeString(updates.item_name)}`);
    if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
    if (updates.memo !== undefined) {
      // 빈 문자열이면 NULL로 저장
      parts.push(`memo = ${updates.memo ? escapeString(updates.memo) : 'NULL'}`);
    }
    if (updates.source_type !== undefined) parts.push(`source_type = ${escapeString(updates.source_type)}`);
    if (updates.source_id !== undefined) parts.push(`source_id = ${updates.source_id}`);
    if (updates.source_name !== undefined) parts.push(`source_name = ${escapeString(updates.source_name)}`);
    if (newRemainingAfter !== record.remaining_after) parts.push(`remaining_after = ${newRemainingAfter}`);
    // 실제 차감 포인트 저장 (변경이 있을 때만)
    if (updates.deduction_points !== undefined && updates.deduction_points !== oldDeductionPoints) {
      parts.push(`deduction_points = ${updates.deduction_points}`);
    }

    if (parts.length > 0) {
      await execute(`UPDATE cs_yakchim_usage_records SET ${parts.join(', ')} WHERE id = ${id}`);
    }

    return true;
  } catch (err) {
    console.error('약침 사용내역 수정 오류:', err);
    return false;
  }
}

/**
 * 약침 사용내역 삭제
 * - 패키지인 경우 remaining_count 복원
 */
export async function deleteYakchimUsageRecord(id: number): Promise<void> {
  // 삭제 전 레코드 조회
  const record = await getYakchimUsageRecordById(id);

  if (record && record.source_type === 'package') {
    const quantity = record.quantity || 1;
    // 패키지 remaining_count 복원
    await execute(`
      UPDATE cs_treatment_packages
      SET remaining_count = remaining_count + ${quantity},
          used_count = used_count - ${quantity},
          status = 'active',
          updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${record.source_id}
    `);
  }

  // 레코드 삭제
  await execute(`DELETE FROM cs_yakchim_usage_records WHERE id = ${id}`);
}

/**
 * 상비약 사용내역 추가
 */
export async function createMedicineUsage(data: Omit<MedicineUsage, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_medicine_usage (
      patient_id, chart_number, patient_name, receipt_id, usage_date,
      medicine_name, quantity, mssql_detail_id, memo, created_at, updated_at
    ) VALUES (
      ${data.patient_id}, ${escapeString(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${data.receipt_id || 'NULL'}, ${escapeString(data.usage_date)},
      ${escapeString(data.medicine_name)}, ${data.quantity}, ${data.mssql_detail_id || 'NULL'}, ${toSqlValue(data.memo)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

/**
 * 상비약 사용내역 단건 조회
 */
export async function getMedicineUsageById(id: number): Promise<MedicineUsage | null> {
  const results = await query<MedicineUsage>(
    `SELECT * FROM cs_medicine_usage WHERE id = ${id}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 상비약 사용내역 수정 (재고 반영)
 * - 약 종류 변경: 기존 재고 복원 + 새 재고 차감
 * - 수량만 변경: 차이만큼 재고 조정
 */
export async function updateMedicineUsage(
  id: number,
  updates: Partial<MedicineUsage> & { newInventoryId?: number }
): Promise<void> {
  // 기존 사용내역 조회
  const existing = await getMedicineUsageById(id);
  if (!existing) {
    throw new Error('사용내역을 찾을 수 없습니다.');
  }

  const oldInventoryId = existing.inventory_id;
  const oldQuantity = existing.quantity;
  const newInventoryId = updates.newInventoryId;
  const newQuantity = updates.quantity ?? oldQuantity;

  // 약 종류가 변경된 경우
  if (newInventoryId && newInventoryId !== oldInventoryId) {
    // 새 재고 확인
    const newInventory = await getMedicineInventoryById(newInventoryId);
    if (!newInventory) {
      throw new Error('선택한 상비약을 찾을 수 없습니다.');
    }
    if (newInventory.current_stock < newQuantity) {
      throw new Error(`재고가 부족합니다. (현재: ${newInventory.current_stock}${newInventory.unit})`);
    }

    // 기존 재고 복원 (oldInventoryId가 있는 경우)
    if (oldInventoryId) {
      await execute(`
        UPDATE cs_medicine_inventory
        SET current_stock = current_stock + ${oldQuantity},
            updated_at = ${escapeString(getCurrentTimestamp())}
        WHERE id = ${oldInventoryId}
      `);
    }

    // 새 재고 차감
    await execute(`
      UPDATE cs_medicine_inventory
      SET current_stock = current_stock - ${newQuantity},
          updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${newInventoryId}
    `);

    // 사용내역 업데이트 (inventory_id, medicine_name 변경)
    updates.inventory_id = newInventoryId;
    updates.medicine_name = newInventory.name;
  }
  // 수량만 변경된 경우
  else if (updates.quantity !== undefined && updates.quantity !== oldQuantity && oldInventoryId) {
    const quantityDiff = newQuantity - oldQuantity;

    // 증가한 경우 재고 확인
    if (quantityDiff > 0) {
      const inventory = await getMedicineInventoryById(oldInventoryId);
      if (inventory && inventory.current_stock < quantityDiff) {
        throw new Error(`재고가 부족합니다. (현재: ${inventory.current_stock}${inventory.unit})`);
      }
    }

    // 재고 조정 (증가 시 차감, 감소 시 복원)
    await execute(`
      UPDATE cs_medicine_inventory
      SET current_stock = current_stock - ${quantityDiff},
          updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${oldInventoryId}
    `);
  }

  // 사용내역 업데이트
  const parts: string[] = [];
  if (updates.medicine_name !== undefined) parts.push(`medicine_name = ${escapeString(updates.medicine_name)}`);
  if (updates.quantity !== undefined) parts.push(`quantity = ${updates.quantity}`);
  if (updates.inventory_id !== undefined) parts.push(`inventory_id = ${updates.inventory_id}`);
  if (updates.purpose !== undefined) parts.push(`purpose = ${escapeString(updates.purpose)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.usage_date !== undefined) parts.push(`usage_date = ${escapeString(updates.usage_date)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  if (parts.length > 0) {
    await execute(`UPDATE cs_medicine_usage SET ${parts.join(', ')} WHERE id = ${id}`);
  }
}

/**
 * 상비약 사용내역 삭제 (재고 복원)
 */
export async function deleteMedicineUsage(id: number): Promise<void> {
  // 기존 사용내역 조회
  const existing = await getMedicineUsageById(id);
  if (!existing) {
    throw new Error('사용내역을 찾을 수 없습니다.');
  }

  // 재고 복원 (inventory_id가 있는 경우)
  if (existing.inventory_id) {
    await execute(`
      UPDATE cs_medicine_inventory
      SET current_stock = current_stock + ${existing.quantity},
          updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${existing.inventory_id}
    `);
  }

  // 사용내역 삭제
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
  category: string; // 관리 목적 분류 (자유 입력)
  total_stock: number;
  current_stock: number;
  doses_per_batch: number;
  packs_per_batch: number;
  unit: string;
  is_active: boolean;
  sort_order: number;
  memo: string | null;
  last_decoction_date: string | null;  // 최근탕전일
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
      last_decoction_date, created_at, updated_at
    ) VALUES (
      ${data.prescription_id ?? 'NULL'}, ${escapeString(data.name)}, ${toSqlValue(data.alias)},
      ${escapeString(data.category)}, ${data.total_stock}, ${data.current_stock},
      ${data.doses_per_batch}, ${data.packs_per_batch}, ${escapeString(data.unit)},
      ${data.is_active}, ${data.sort_order}, ${toSqlValue(data.memo)},
      ${toSqlValue(data.last_decoction_date)}, ${escapeString(now)}, ${escapeString(now)}
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
  purpose: string,
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
        last_decoction_date: null,
      });

      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`처방 ID ${prescriptionId}: ${error.message}`);
    }
  }

  return result;
}

// ============================================
// 상비약 일괄 등록 API
// ============================================

export interface BulkImportItem {
  name: string;              // 처방명
  lastDecoction?: string;    // 최근탕전일
  totalStock: number;        // 누적
  currentStock: number;      // 재고
  dosesPerBatch: number;     // 첩
  packsPerBatch: number;     // 팩
  category: string;          // 분류
  isActive: boolean;         // 사용
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * 상비약 일괄 등록/수정
 * @param items 등록할 항목 배열
 * @param mode 'overwrite' = 덮어쓰기, 'newOnly' = 신규만
 */
export async function bulkUpsertMedicineInventory(
  items: BulkImportItem[],
  mode: 'overwrite' | 'newOnly'
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const now = getCurrentTimestamp();

  for (const item of items) {
    try {
      // 기존 데이터 확인 (이름으로 검색)
      const existing = await query<MedicineInventory>(
        `SELECT * FROM cs_medicine_inventory WHERE name = ${escapeString(item.name)}`
      );

      if (existing.length > 0) {
        // 기존 데이터 있음
        if (mode === 'newOnly') {
          result.skipped++;
          continue;
        }

        // 덮어쓰기 모드: 업데이트
        await execute(`
          UPDATE cs_medicine_inventory SET
            total_stock = ${item.totalStock},
            current_stock = ${item.currentStock},
            doses_per_batch = ${item.dosesPerBatch},
            packs_per_batch = ${item.packsPerBatch},
            category = ${escapeString(item.category)},
            is_active = ${item.isActive},
            last_decoction_date = ${item.lastDecoction ? escapeString(item.lastDecoction) : 'NULL'},
            updated_at = ${escapeString(now)}
          WHERE id = ${existing[0].id}
        `);
        result.updated++;
      } else {
        // 신규 등록
        await execute(`
          INSERT INTO cs_medicine_inventory (
            name, category, total_stock, current_stock,
            doses_per_batch, packs_per_batch, unit, is_active,
            sort_order, last_decoction_date, created_at, updated_at
          ) VALUES (
            ${escapeString(item.name)}, ${escapeString(item.category)},
            ${item.totalStock}, ${item.currentStock},
            ${item.dosesPerBatch}, ${item.packsPerBatch}, '팩', ${item.isActive},
            0, ${item.lastDecoction ? escapeString(item.lastDecoction) : 'NULL'},
            ${escapeString(now)}, ${escapeString(now)}
          )
        `);
        result.inserted++;
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(`${item.name}: ${error.message}`);
    }
  }

  return result;
}

/**
 * 이름으로 상비약 조회 (일괄등록 검증용)
 */
export async function getMedicineInventoryByName(name: string): Promise<MedicineInventory | null> {
  const results = await query<MedicineInventory>(
    `SELECT * FROM cs_medicine_inventory WHERE name = ${escapeString(name)}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 여러 이름으로 상비약 조회 (일괄등록 검증용)
 */
export async function getMedicineInventoryByNames(names: string[]): Promise<Map<string, MedicineInventory>> {
  if (names.length === 0) return new Map();

  const escapedNames = names.map(n => escapeString(n)).join(', ');
  const results = await query<MedicineInventory>(
    `SELECT * FROM cs_medicine_inventory WHERE name IN (${escapedNames})`
  );

  const map = new Map<string, MedicineInventory>();
  results.forEach(item => map.set(item.name, item));
  return map;
}

// ============================================
// CS 설정 관리
// ============================================

export interface CsSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * CS 설정 조회
 */
export async function getCsSetting(key: string): Promise<string | null> {
  const result = await queryOne<{ value: string }>(
    `SELECT value FROM cs_settings WHERE key = ${escapeString(key)}`
  );
  return result?.value || null;
}

/**
 * CS 설정 저장 (upsert)
 */
export async function setCsSetting(key: string, value: string, description?: string): Promise<void> {
  await execute(`
    INSERT INTO cs_settings (key, value, description, updated_at)
    VALUES (${escapeString(key)}, ${escapeString(value)}, ${toSqlValue(description)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = ${escapeString(value)},
      description = COALESCE(${toSqlValue(description)}, cs_settings.description),
      updated_at = NOW()
  `);
}

/**
 * 모든 CS 설정 조회
 */
export async function getAllCsSettings(): Promise<CsSetting[]> {
  return query<CsSetting>(`SELECT * FROM cs_settings ORDER BY key`);
}

/**
 * 상비약 사용목적 옵션 조회
 */
export async function getMedicinePurposes(): Promise<string[]> {
  const value = await getCsSetting('medicine_purposes');
  if (value) {
    try {
      const purposes = JSON.parse(value);
      if (Array.isArray(purposes)) return purposes;
    } catch {
      // JSON 파싱 실패
    }
  }
  return ['감기약', '상비약', '보완처방', '증정', '치료약'];
}

/**
 * 상비약 사용목적 옵션 저장
 */
export async function setMedicinePurposes(purposes: string[]): Promise<void> {
  await setCsSetting('medicine_purposes', JSON.stringify(purposes), '상비약 사용목적 옵션');
}

/**
 * 한약 치료목적 옵션 조회
 */
export async function getHerbalPurposes(): Promise<string[]> {
  const value = await getCsSetting('herbal_purposes');
  if (value) {
    try {
      const purposes = JSON.parse(value);
      if (Array.isArray(purposes)) return purposes;
    } catch {
      // JSON 파싱 실패
    }
  }
  return ['보약', '다이어트', '여성', '임신출산', '피부', '소화기', '머리'];
}

/**
 * 한약 치료목적 옵션 저장
 */
export async function setHerbalPurposes(purposes: string[]): Promise<void> {
  await setCsSetting('herbal_purposes', JSON.stringify(purposes), '한약 치료목적 옵션');
}

// ============================================================
// 녹용 종류 옵션
// ============================================================

/**
 * 녹용 종류 옵션 조회
 */
export async function getNokryongTypes(): Promise<string[]> {
  const value = await getCsSetting('nokryong_types');
  if (value) {
    try {
      const types = JSON.parse(value);
      if (Array.isArray(types) && types.length > 0) {
        return types;
      }
    } catch {
      // ignore parse error
    }
  }
  return ['원대', '분골', '상대', '특상대'];  // 기본값
}

/**
 * 녹용 종류 옵션 저장
 */
export async function setNokryongTypes(types: string[]): Promise<void> {
  await setCsSetting('nokryong_types', JSON.stringify(types), '녹용 종류 옵션');
}

// ============================================================
// 한약 질환명 태그 (테이블 기반)
// ============================================================

export interface HerbalDiseaseTag {
  id: number;
  name: string;
  created_at?: string;
}

// 테이블 생성
let diseaseTagsTableReady = false;
async function ensureHerbalDiseaseTagsTable(): Promise<void> {
  if (diseaseTagsTableReady) return;

  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_disease_tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_package_diseases (
      id SERIAL PRIMARY KEY,
      package_id INTEGER NOT NULL REFERENCES cs_herbal_packages(id) ON DELETE CASCADE,
      disease_tag_id INTEGER NOT NULL REFERENCES cs_herbal_disease_tags(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(package_id, disease_tag_id)
    )
  `).catch(() => {});

  diseaseTagsTableReady = true;
}

// 초기화 호출
ensureHerbalDiseaseTagsTable();

/**
 * 모든 질환명 태그 조회
 */
export async function getHerbalDiseaseTags(): Promise<HerbalDiseaseTag[]> {
  await ensureHerbalDiseaseTagsTable();

  const result = await query<HerbalDiseaseTag>(`
    SELECT id, name, created_at
    FROM cs_herbal_disease_tags
    ORDER BY name
  `);
  return result || [];
}

/**
 * 질환명 태그 생성
 */
export async function createHerbalDiseaseTag(name: string): Promise<number> {
  await ensureHerbalDiseaseTagsTable();

  const id = await insert(`
    INSERT INTO cs_herbal_disease_tags (name)
    VALUES (${escapeString(name)})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);

  if (!id) {
    // RETURNING이 작동하지 않은 경우, SELECT로 ID 조회
    const result = await query<{ id: number }>(`
      SELECT id FROM cs_herbal_disease_tags WHERE name = ${escapeString(name)}
    `);
    if (result && result.length > 0) {
      return result[0].id;
    }
    throw new Error('질환명 태그 생성 실패');
  }
  return id;
}

/**
 * 질환명 태그 수정
 */
export async function updateHerbalDiseaseTag(id: number, name: string): Promise<void> {
  await ensureHerbalDiseaseTagsTable();

  await execute(`
    UPDATE cs_herbal_disease_tags
    SET name = ${escapeString(name)}
    WHERE id = ${id}
  `);
}

/**
 * 질환명 태그 삭제
 */
export async function deleteHerbalDiseaseTag(id: number): Promise<void> {
  await ensureHerbalDiseaseTagsTable();
  await execute(`DELETE FROM cs_herbal_disease_tags WHERE id = ${id}`);
}

/**
 * 한약 패키지에 연결된 질환명 태그 조회
 */
export async function getPackageDiseaseTags(packageId: number): Promise<HerbalDiseaseTag[]> {
  await ensureHerbalDiseaseTagsTable();

  const result = await query<HerbalDiseaseTag>(`
    SELECT t.id, t.name, t.created_at
    FROM cs_herbal_disease_tags t
    JOIN cs_herbal_package_diseases pd ON pd.disease_tag_id = t.id
    WHERE pd.package_id = ${packageId}
    ORDER BY t.name
  `);
  return result || [];
}

/**
 * 한약 패키지에 질환명 태그 연결
 */
export async function setPackageDiseaseTags(packageId: number, diseaseTagIds: number[]): Promise<void> {
  await ensureHerbalDiseaseTagsTable();

  // 기존 연결 삭제
  await execute(`DELETE FROM cs_herbal_package_diseases WHERE package_id = ${packageId}`);

  // 새 연결 추가
  for (const tagId of diseaseTagIds) {
    await execute(`
      INSERT INTO cs_herbal_package_diseases (package_id, disease_tag_id)
      VALUES (${packageId}, ${tagId})
      ON CONFLICT DO NOTHING
    `);
  }
}

/**
 * 이름으로 질환명 태그 찾기 또는 생성
 */
export async function findOrCreateDiseaseTag(name: string): Promise<number> {
  await ensureHerbalDiseaseTagsTable();

  const result = await query<{ id: number }>(`
    SELECT id FROM cs_herbal_disease_tags WHERE name = ${escapeString(name)}
  `);
  if (result && result.length > 0) {
    return result[0].id;
  }
  return createHerbalDiseaseTag(name);
}

// 하위 호환용 (기존 코드 지원)
export async function getHerbalDiseases(): Promise<string[]> {
  const tags = await getHerbalDiseaseTags();
  return tags.map(t => t.name);
}

export async function addHerbalDisease(disease: string): Promise<number> {
  return findOrCreateDiseaseTag(disease);
}

/**
 * 멤버십 종류 옵션 조회
 */
export async function getMembershipTypes(): Promise<string[]> {
  // package_types 테이블에서 membership 타입 조회
  try {
    const types = await getPackageTypes();
    const membershipTypes = types.filter(t => t.type === 'membership').map(t => t.name);
    if (membershipTypes.length > 0) {
      return membershipTypes;
    }
  } catch (err) {
    console.error('멤버십 종류 조회 오류:', err);
  }
  return ['녹용'];  // 기본값
}

/**
 * 멤버십 종류 옵션 저장
 */
export async function setMembershipTypes(types: string[]): Promise<void> {
  await setCsSetting('membership_types', JSON.stringify(types), '멤버십 종류 옵션');
}

// ============================================
// 패키지/멤버십 종류 관리
// ============================================

export interface PackageType {
  id: number;
  name: string;
  type: 'deduction' | 'membership' | 'yakchim' | 'yobup';  // deduction: 차감형, membership: 멤버십, yakchim: 약침, yobup: 요법
  description: string | null;
  deduction_count: number;  // 패키지 차감 횟수 (약침/요법용, 기본값 1)
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 패키지/멤버십 종류 목록 조회
 */
export async function getPackageTypes(includeInactive: boolean = false): Promise<PackageType[]> {
  try {
    const whereClause = includeInactive ? '' : 'WHERE is_active = true';
    const rows = await query<PackageType>(`
      SELECT * FROM package_types
      ${whereClause}
      ORDER BY display_order, name
    `);
    return rows;
  } catch (error) {
    console.error('패키지 종류 조회 오류:', error);
    return [];
  }
}

/**
 * 패키지/멤버십/약침/요법 종류 추가
 */
export async function createPackageType(
  name: string,
  type: 'deduction' | 'membership' | 'yakchim' | 'yobup',
  description?: string,
  deductionCount: number = 1
): Promise<PackageType | null> {
  try {
    const now = getCurrentTimestamp();
    // 다음 display_order 조회
    const maxOrder = await queryOne<{ max_order: number }>(`
      SELECT COALESCE(MAX(display_order), 0) as max_order FROM package_types
    `);
    const nextOrder = (maxOrder?.max_order || 0) + 1;

    const id = await insert(`
      INSERT INTO package_types (name, type, description, deduction_count, display_order, created_at, updated_at)
      VALUES (
        ${escapeString(name)},
        ${escapeString(type)},
        ${description ? escapeString(description) : 'NULL'},
        ${deductionCount},
        ${nextOrder},
        ${escapeString(now)},
        ${escapeString(now)}
      )
    `);

    return {
      id,
      name,
      type,
      description: description || null,
      deduction_count: deductionCount,
      is_active: true,
      display_order: nextOrder,
      created_at: now,
      updated_at: now,
    };
  } catch (error) {
    console.error('패키지 종류 추가 오류:', error);
    return null;
  }
}

/**
 * 패키지/멤버십/약침/요법 종류 수정
 */
export async function updatePackageType(
  id: number,
  updates: { name?: string; type?: 'deduction' | 'membership' | 'yakchim' | 'yobup'; description?: string; is_active?: boolean; deduction_count?: number }
): Promise<boolean> {
  try {
    const setClauses: string[] = [];
    if (updates.name !== undefined) {
      setClauses.push(`name = ${escapeString(updates.name)}`);
    }
    if (updates.type !== undefined) {
      setClauses.push(`type = ${escapeString(updates.type)}`);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = ${updates.description ? escapeString(updates.description) : 'NULL'}`);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = ${updates.is_active}`);
    }
    if (updates.deduction_count !== undefined) {
      setClauses.push(`deduction_count = ${updates.deduction_count}`);
    }
    setClauses.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

    await execute(`
      UPDATE package_types
      SET ${setClauses.join(', ')}
      WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    console.error('패키지 종류 수정 오류:', error);
    return false;
  }
}

/**
 * 패키지/멤버십 종류 삭제
 */
export async function deletePackageType(id: number): Promise<boolean> {
  try {
    await execute(`DELETE FROM package_types WHERE id = ${id}`);
    return true;
  } catch (error) {
    console.error('패키지 종류 삭제 오류:', error);
    return false;
  }
}

/**
 * 패키지/멤버십 종류 순서 변경
 */
export async function reorderPackageTypes(orderedIds: number[]): Promise<boolean> {
  try {
    const now = getCurrentTimestamp();
    for (let i = 0; i < orderedIds.length; i++) {
      await execute(`
        UPDATE package_types
        SET display_order = ${i + 1}, updated_at = ${escapeString(now)}
        WHERE id = ${orderedIds[i]}
      `);
    }
    return true;
  } catch (error) {
    console.error('패키지 종류 순서 변경 오류:', error);
    return false;
  }
}

// ============================================
// 녹용 패키지 API
// ============================================

export async function getNokryongPackages(patientId: number): Promise<NokryongPackage[]> {
  return query<NokryongPackage>(
    `SELECT * FROM cs_nokryong_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

export async function getActiveNokryongPackages(patientId: number): Promise<NokryongPackage[]> {
  return query<NokryongPackage>(
    `SELECT * FROM cs_nokryong_packages WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC`
  );
}

export async function getNokryongPackageById(id: number): Promise<NokryongPackage | null> {
  const results = await query<NokryongPackage>(
    `SELECT * FROM cs_nokryong_packages WHERE id = ${id}`
  );
  return results[0] || null;
}

export async function createNokryongPackage(pkg: Omit<NokryongPackage, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_nokryong_packages (
      patient_id, chart_number, patient_name, package_name, total_months, remaining_months,
      start_date, expire_date, memo, status, mssql_detail_id, created_at, updated_at
    ) VALUES (
      ${pkg.patient_id}, ${toSqlValue(pkg.chart_number)}, ${toSqlValue(pkg.patient_name)},
      ${toSqlValue(pkg.package_name)}, ${pkg.total_months}, ${pkg.remaining_months},
      ${escapeString(pkg.start_date)}, ${toSqlValue(pkg.expire_date)},
      ${toSqlValue(pkg.memo)}, ${escapeString(pkg.status)}, ${toSqlValue(pkg.mssql_detail_id)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);
}

export async function useNokryongPackage(id: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE cs_nokryong_packages SET
      remaining_months = remaining_months - 1,
      status = CASE WHEN remaining_months - 1 <= 0 THEN 'completed' ELSE status END,
      updated_at = ${escapeString(now)}
    WHERE id = ${id}
  `);
}

export async function updateNokryongPackage(id: number, updates: Partial<NokryongPackage>): Promise<void> {
  const parts: string[] = [];
  if (updates.package_name !== undefined) parts.push(`package_name = ${toSqlValue(updates.package_name)}`);
  if (updates.total_months !== undefined) parts.push(`total_months = ${updates.total_months}`);
  if (updates.remaining_months !== undefined) parts.push(`remaining_months = ${updates.remaining_months}`);
  if (updates.expire_date !== undefined) parts.push(`expire_date = ${toSqlValue(updates.expire_date)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_nokryong_packages SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deleteNokryongPackage(id: number): Promise<void> {
  await execute(`DELETE FROM cs_nokryong_packages WHERE id = ${id}`);
}

// ============================================
// 한약 수령 기록 API
// ============================================

export async function getHerbalPickups(patientId: number, limit?: number): Promise<HerbalPickup[]> {
  let sql = `SELECT * FROM cs_herbal_pickups WHERE patient_id = ${patientId} ORDER BY pickup_date DESC, created_at DESC`;
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  return query<HerbalPickup>(sql);
}

export async function getHerbalPickupsByDate(patientId: number, date: string): Promise<HerbalPickup[]> {
  return query<HerbalPickup>(
    `SELECT * FROM cs_herbal_pickups WHERE patient_id = ${patientId} AND pickup_date = ${escapeString(date)} ORDER BY created_at DESC`
  );
}

export async function getHerbalPickupsByPackage(packageId: number): Promise<HerbalPickup[]> {
  return query<HerbalPickup>(
    `SELECT * FROM cs_herbal_pickups WHERE package_id = ${packageId} ORDER BY round_number ASC`
  );
}

export async function getHerbalPickupById(id: number): Promise<HerbalPickup | null> {
  const results = await query<HerbalPickup>(
    `SELECT * FROM cs_herbal_pickups WHERE id = ${id}`
  );
  return results[0] || null;
}

export async function getHerbalPickupByReceiptId(receiptId: number): Promise<HerbalPickup | null> {
  const results = await query<HerbalPickup>(
    `SELECT * FROM cs_herbal_pickups WHERE receipt_id = ${receiptId} ORDER BY created_at DESC LIMIT 1`
  );
  return results[0] || null;
}

export async function createHerbalPickup(data: Omit<HerbalPickup, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const now = getCurrentTimestamp();
  const pickupId = await insert(`
    INSERT INTO cs_herbal_pickups (
      package_id, patient_id, chart_number, patient_name, round_id, receipt_id, mssql_detail_id, pickup_date,
      round_number, delivery_method, with_nokryong, nokryong_package_id, memo, created_at, updated_at
    ) VALUES (
      ${data.package_id}, ${data.patient_id}, ${toSqlValue(data.chart_number)}, ${toSqlValue(data.patient_name)},
      ${toSqlValue(data.round_id)}, ${toSqlValue(data.receipt_id)}, ${toSqlValue(data.mssql_detail_id)}, ${escapeString(data.pickup_date)},
      ${data.round_number}, ${escapeString(data.delivery_method)}, ${data.with_nokryong},
      ${toSqlValue(data.nokryong_package_id)}, ${toSqlValue(data.memo)},
      ${escapeString(now)}, ${escapeString(now)}
    )
  `);

  // 한약 패키지 차감
  await useHerbalPackage(data.package_id);

  // 녹용 추가인 경우 녹용 패키지도 차감
  if (data.with_nokryong && data.nokryong_package_id) {
    await useNokryongPackage(data.nokryong_package_id);
  }

  return pickupId;
}

export async function updateHerbalPickup(
  id: number,
  updates: {
    delivery_method?: string;
    with_nokryong?: boolean;
    nokryong_package_id?: number | null;
    memo?: string;
  },
  previousNokryongId?: number | null
): Promise<void> {
  const now = getCurrentTimestamp();
  const parts: string[] = [];

  if (updates.delivery_method !== undefined) parts.push(`delivery_method = ${escapeString(updates.delivery_method)}`);
  if (updates.memo !== undefined) parts.push(`memo = ${toSqlValue(updates.memo)}`);

  // 녹용 변경 처리
  if (updates.with_nokryong !== undefined) {
    parts.push(`with_nokryong = ${updates.with_nokryong}`);
    parts.push(`nokryong_package_id = ${updates.nokryong_package_id || 'NULL'}`);

    // 이전에 녹용이 있었는데 제거된 경우 → 녹용 패키지 복원
    if (previousNokryongId && (!updates.with_nokryong || !updates.nokryong_package_id)) {
      await execute(`
        UPDATE cs_nokryong_packages SET
          remaining_months = remaining_months + 1,
          status = 'active',
          updated_at = ${escapeString(now)}
        WHERE id = ${previousNokryongId}
      `);
    }
    // 새로 녹용이 추가된 경우 → 녹용 패키지 차감
    else if (updates.with_nokryong && updates.nokryong_package_id && updates.nokryong_package_id !== previousNokryongId) {
      // 이전 녹용 패키지 복원
      if (previousNokryongId) {
        await execute(`
          UPDATE cs_nokryong_packages SET
            remaining_months = remaining_months + 1,
            status = 'active',
            updated_at = ${escapeString(now)}
          WHERE id = ${previousNokryongId}
        `);
      }
      // 새 녹용 패키지 차감
      await useNokryongPackage(updates.nokryong_package_id);
    }
  }

  parts.push(`updated_at = ${escapeString(now)}`);

  await execute(`UPDATE cs_herbal_pickups SET ${parts.join(', ')} WHERE id = ${id}`);
}

export async function deleteHerbalPickup(id: number): Promise<void> {
  // 삭제 전에 패키지/녹용 복원을 위해 정보 조회
  const pickup = await queryOne<HerbalPickup>(`SELECT * FROM cs_herbal_pickups WHERE id = ${id}`);
  if (!pickup) return;

  // 한약 패키지 복원
  await execute(`
    UPDATE cs_herbal_packages SET
      used_count = used_count - 1,
      remaining_count = remaining_count + 1,
      status = 'active',
      updated_at = ${escapeString(getCurrentTimestamp())}
    WHERE id = ${pickup.package_id}
  `);

  // 녹용 패키지 복원
  if (pickup.with_nokryong && pickup.nokryong_package_id) {
    await execute(`
      UPDATE cs_nokryong_packages SET
        remaining_months = remaining_months + 1,
        status = 'active',
        updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${pickup.nokryong_package_id}
    `);
  }

  // 수령 기록 삭제
  await execute(`DELETE FROM cs_herbal_pickups WHERE id = ${id}`);
}

// ============================================
// 패키지 사용기록 통합 API
// ============================================

/**
 * 패키지 사용기록 추가
 */
export async function addPackageUsage(usage: Omit<PackageUsage, 'id' | 'created_at'>): Promise<number> {
  const columns = [
    'package_type',
    'package_id',
    'patient_id',
    'chart_number',
    'patient_name',
    'usage_date',
    'usage_type',
    'count',
    'mssql_detail_id',
    'mssql_receipt_id',
    'memo',
  ];

  const values = [
    escapeString(usage.package_type),
    usage.package_id,
    usage.patient_id,
    usage.chart_number ? escapeString(usage.chart_number) : 'NULL',
    usage.patient_name ? escapeString(usage.patient_name) : 'NULL',
    escapeString(usage.usage_date),
    escapeString(usage.usage_type),
    usage.count,
    usage.mssql_detail_id ?? 'NULL',
    usage.mssql_receipt_id ?? 'NULL',
    usage.memo ? escapeString(usage.memo) : 'NULL',
  ];

  const sql = `INSERT INTO cs_package_usage (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING id`;
  const result = await queryOne<{ id: number }>(sql);
  return result?.id ?? 0;
}

/**
 * 환자의 특정 날짜 패키지 사용기록 조회
 */
export async function getPackageUsagesByDate(patientId: number, date: string): Promise<PackageUsage[]> {
  const sql = `
    SELECT * FROM cs_package_usage
    WHERE patient_id = ${patientId}
    AND usage_date = ${escapeString(date)}
    ORDER BY created_at DESC
  `;
  return query<PackageUsage>(sql);
}

/**
 * 패키지별 사용기록 조회
 */
export async function getPackageUsagesByPackage(
  packageType: PackageTypeEnum,
  packageId: number
): Promise<PackageUsage[]> {
  const sql = `
    SELECT * FROM cs_package_usage
    WHERE package_type = ${escapeString(packageType)}
    AND package_id = ${packageId}
    ORDER BY usage_date DESC, created_at DESC
  `;
  return query<PackageUsage>(sql);
}

/**
 * 사용기록 삭제
 */
export async function deletePackageUsage(id: number): Promise<void> {
  await execute(`DELETE FROM cs_package_usage WHERE id = ${id}`);
}

/**
 * 패키지 차감 처리 (사용기록 추가 + 패키지 잔여 감소)
 */
export async function deductPackage(params: {
  packageType: PackageTypeEnum;
  packageId: number;
  patientId: number;
  chartNumber?: string;
  patientName?: string;
  usageDate: string;
  count: number;
  mssqlDetailId?: number;
  mssqlReceiptId?: number;
  memo?: string;
}): Promise<number> {
  const { packageType, packageId, patientId, chartNumber, patientName, usageDate, count, mssqlDetailId, mssqlReceiptId, memo } = params;

  // 1. 패키지 잔여 횟수 감소
  let updateSql = '';
  if (packageType === 'herbal') {
    updateSql = `
      UPDATE cs_herbal_packages SET
        used_count = used_count + ${count},
        remaining_count = remaining_count - ${count},
        updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${packageId}
    `;
  } else if (packageType === 'nokryong') {
    updateSql = `
      UPDATE cs_nokryong_packages SET
        remaining_months = remaining_months - ${count},
        updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${packageId}
    `;
  } else if (packageType === 'treatment') {
    updateSql = `
      UPDATE cs_treatment_packages SET
        used_count = used_count + ${count},
        remaining_count = remaining_count - ${count},
        updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${packageId}
    `;
  }

  if (updateSql) {
    await execute(updateSql);
  }

  // 2. 사용기록 추가
  const usageId = await addPackageUsage({
    package_type: packageType,
    package_id: packageId,
    patient_id: patientId,
    chart_number: chartNumber,
    patient_name: patientName,
    usage_date: usageDate,
    usage_type: 'deduct',
    count: -count, // 차감은 음수
    mssql_detail_id: mssqlDetailId,
    mssql_receipt_id: mssqlReceiptId,
    memo,
  });

  return usageId;
}

/**
 * 멤버십 적용 기록 추가
 */
export async function applyMembership(params: {
  membershipId: number;
  patientId: number;
  chartNumber?: string;
  patientName?: string;
  usageDate: string;
  mssqlDetailId: number;
  mssqlReceiptId?: number;
  memo?: string;
}): Promise<number> {
  const { membershipId, patientId, chartNumber, patientName, usageDate, mssqlDetailId, mssqlReceiptId, memo } = params;

  // 멤버십 적용 기록 추가
  const usageId = await addPackageUsage({
    package_type: 'membership',
    package_id: membershipId,
    patient_id: patientId,
    chart_number: chartNumber,
    patient_name: patientName,
    usage_date: usageDate,
    usage_type: 'apply',
    count: 1, // 적용은 1회로 기록
    mssql_detail_id: mssqlDetailId,
    mssql_receipt_id: mssqlReceiptId,
    memo,
  });

  return usageId;
}

/**
 * 모든 활성 패키지 조회 (환자별)
 */
export async function getAllActivePackages(patientId: number): Promise<{
  herbal: HerbalPackage[];
  nokryong: NokryongPackage[];
  treatment: TreatmentPackage[];
  membership: Membership[];
}> {
  const [herbal, nokryong, treatment, membership] = await Promise.all([
    getActiveHerbalPackages(patientId),
    getActiveNokryongPackages(patientId),
    query<TreatmentPackage>(`
      SELECT * FROM cs_treatment_packages
      WHERE patient_id = ${patientId}
      AND status = 'active'
      AND remaining_count > 0
      ORDER BY created_at DESC
    `),
    query<Membership>(`
      SELECT * FROM cs_memberships
      WHERE patient_id = ${patientId}
      AND status = 'active'
      AND expire_date >= ${escapeString(getCurrentDate())}
      ORDER BY created_at DESC
    `),
  ]);

  return { herbal, nokryong, treatment, membership };
}

// ============================================
// CS 타임라인 API
// ============================================

/**
 * 환자 타임라인 조회
 * 모든 비급여 기록을 시간순으로 병합하여 반환
 */
export async function getPatientTimeline(
  patientId: number,
  options?: { limit?: number; offset?: number }
): Promise<TimelineResult> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;
  const today = getCurrentDate();

  // 모든 관련 데이터 병렬 조회
  const [
    herbalPackages,
    herbalPickups,
    nokryongPackages,
    treatmentPackages,
    memberships,
    yakchimRecords,
    receiptMemos,
    herbalPackageDiseaseTags,
  ] = await Promise.all([
    query<HerbalPackage>(`SELECT * FROM cs_herbal_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<HerbalPickup>(`SELECT * FROM cs_herbal_pickups WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<NokryongPackage>(`SELECT * FROM cs_nokryong_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<TreatmentPackage>(`SELECT * FROM cs_treatment_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<Membership>(`SELECT * FROM cs_memberships WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<YakchimUsageRecord>(`SELECT * FROM cs_yakchim_usage_records WHERE patient_id = ${patientId} ORDER BY created_at DESC`),
    query<ReceiptMemo>(`SELECT * FROM cs_receipt_memos WHERE patient_id = ${patientId} AND memo IS NOT NULL AND memo != '' ORDER BY created_at DESC`),
    // 한약 패키지 질환명 태그 조회
    query<{ package_id: number; tag_name: string }>(`
      SELECT pd.package_id, t.name as tag_name
      FROM cs_herbal_package_diseases pd
      JOIN cs_herbal_disease_tags t ON t.id = pd.disease_tag_id
      JOIN cs_herbal_packages p ON p.id = pd.package_id
      WHERE p.patient_id = ${patientId}
    `),
  ]);

  // 패키지별 질환명 태그 맵 생성
  const packageDiseaseMap = new Map<number, string[]>();
  (herbalPackageDiseaseTags || []).forEach(row => {
    if (!packageDiseaseMap.has(row.package_id)) {
      packageDiseaseMap.set(row.package_id, []);
    }
    packageDiseaseMap.get(row.package_id)!.push(row.tag_name);
  });

  const events: TimelineEvent[] = [];

  // 한약 선결제 등록 이벤트
  herbalPackages.forEach(pkg => {
    // subLabel 구성: 치료목적, 종류, 질환명, 추가메모
    const subLabelParts: string[] = [];
    if (pkg.herbal_name) subLabelParts.push(pkg.herbal_name);
    if (pkg.package_type) {
      const typeLabel = pkg.package_type.replace('month', 'M');
      subLabelParts.push(typeLabel);
    }
    const diseaseTags = packageDiseaseMap.get(pkg.id!) || [];
    if (diseaseTags.length > 0) {
      subLabelParts.push(diseaseTags.join(', '));
    }
    if (pkg.memo) subLabelParts.push(pkg.memo);

    events.push({
      id: `herbal_package_add_${pkg.id}`,
      type: 'herbal_package_add',
      date: pkg.start_date,
      timestamp: pkg.created_at || pkg.start_date,
      icon: TIMELINE_EVENT_ICONS.herbal_package_add,
      label: '한약 선결제',
      subLabel: subLabelParts.length > 0 ? subLabelParts.join(' | ') : undefined,
      sourceTable: 'cs_herbal_packages',
      sourceId: pkg.id!,
      isEditable: pkg.start_date === today,
      isCompleted: pkg.status === 'completed',
      originalData: pkg,
    });
  });

  // 한약 수령 이벤트
  herbalPickups.forEach(pickup => {
    const pkg = herbalPackages.find(p => p.id === pickup.package_id);

    // 라벨 구성: 한약{총회차}-{사용회차}
    let label = pkg
      ? `한약${pkg.total_count}-${pickup.round_number}`
      : `한약 ${pickup.round_number}회차`;

    // 녹용 사용 시 라벨에 추가
    if (pickup.with_nokryong && pickup.nokryong_package_id) {
      const nokPkg = nokryongPackages.find(n => n.id === pickup.nokryong_package_id);
      if (nokPkg) {
        // 이 녹용 패키지의 몇 번째 사용인지 계산
        const nokryongUsagesBefore = herbalPickups.filter(p =>
          p.nokryong_package_id === pickup.nokryong_package_id &&
          (p.created_at || p.pickup_date) <= (pickup.created_at || pickup.pickup_date)
        ).length;
        label += ` + 녹용${nokPkg.total_months}-${nokryongUsagesBefore}`;
      } else {
        label += ' + 녹용';
      }
    }

    events.push({
      id: `herbal_pickup_${pickup.id}`,
      type: 'herbal_pickup',
      date: pickup.pickup_date,
      timestamp: pickup.created_at || pickup.pickup_date,
      icon: TIMELINE_EVENT_ICONS.herbal_pickup,
      label,
      subLabel: pkg ? `잔여 ${pkg.total_count - pickup.round_number}회` : undefined,
      sourceTable: 'cs_herbal_pickups',
      sourceId: pickup.id!,
      isEditable: pickup.pickup_date === today,
      isCompleted: false,
      originalData: pickup,
    });
  });

  // 녹용 선결제 등록 이벤트
  nokryongPackages.forEach(pkg => {
    events.push({
      id: `nokryong_package_add_${pkg.id}`,
      type: 'nokryong_package_add',
      date: pkg.start_date,
      timestamp: pkg.created_at || pkg.start_date,
      icon: TIMELINE_EVENT_ICONS.nokryong_package_add,
      label: `녹용 선결제 +${pkg.total_months}회`,
      subLabel: pkg.package_name || undefined,
      sourceTable: 'cs_nokryong_packages',
      sourceId: pkg.id!,
      isEditable: pkg.start_date === today,
      isCompleted: pkg.status === 'completed',
      originalData: pkg,
    });
  });

  // 통증마일리지 추가 이벤트
  treatmentPackages.forEach(pkg => {
    const isTongma = pkg.package_name.includes('통증마일리지') || pkg.package_name.includes('통마');
    events.push({
      id: `treatment_package_add_${pkg.id}`,
      type: 'treatment_package_add',
      date: pkg.start_date,
      timestamp: pkg.created_at || pkg.start_date,
      icon: TIMELINE_EVENT_ICONS.treatment_package_add,
      label: isTongma ? `통마 추가 +${pkg.total_count}회` : `${pkg.package_name} +${pkg.total_count}회`,
      subLabel: pkg.includes || undefined,
      sourceTable: 'cs_treatment_packages',
      sourceId: pkg.id!,
      isEditable: pkg.start_date === today,
      isCompleted: pkg.status === 'completed',
      originalData: pkg,
    });
  });

  // 멤버십 등록 이벤트
  memberships.forEach(membership => {
    events.push({
      id: `membership_add_${membership.id}`,
      type: 'membership_add',
      date: membership.start_date,
      timestamp: membership.created_at || membership.start_date,
      icon: TIMELINE_EVENT_ICONS.membership_add,
      label: `${membership.membership_type} 등록`,
      subLabel: `${membership.quantity}개, ~${membership.expire_date.slice(5)}`,
      sourceTable: 'cs_memberships',
      sourceId: membership.id!,
      isEditable: membership.start_date === today,
      isCompleted: membership.status === 'expired',
      originalData: membership,
    });
  });

  // 약침 사용 이벤트
  yakchimRecords.forEach(record => {
    // source_type에 따라 타임라인 이벤트 타입 결정
    const eventType: TimelineEventType = record.source_type === 'membership'
      ? 'yakchim-membership'
      : record.source_type === 'package'
      ? 'yakchim-package'
      : 'yakchim-onetime';

    const isMembership = record.source_type === 'membership';
    const isOnetime = record.source_type === 'one-time';
    const isPackage = record.source_type === 'package';
    const quantity = record.quantity || 1;

    // 라벨 생성: 약침종류 갯수개 · 사용방식
    let label: string;
    const itemName = record.item_name || '약침';
    const quantityText = quantity > 1 ? ` ${quantity}개` : '';

    if (isMembership) {
      // 예: "녹용약침 2개 · 멤버십"
      label = `${itemName}${quantityText} · 멤버십`;
    } else if (isOnetime) {
      // 예: "경근약침 1개 · 일회성"
      label = `${itemName}${quantityText} · 일회성`;
    } else if (isPackage) {
      // 예: "녹용약침 2개 · 통마"
      const shortPackageName = (record.source_name?.includes('통증마일리지') || record.source_name?.includes('통마'))
        ? '통마'
        : record.source_name || '패키지';
      label = `${itemName}${quantityText} · ${shortPackageName}`;
    } else {
      label = `${itemName}${quantityText}`;
    }

    // subLabel 생성: 패키지는 이전잔여-사용=현재잔여, 그 외는 메모만
    let subLabel: string | undefined;

    if (isPackage) {
      // 차감 포인트 (약침 종류별 차감 포인트 합계, 없으면 수량 사용)
      const deductedPoints = record.deduction_points ?? quantity;
      // 이전 잔여 = 현재 잔여 + 차감 포인트
      const previousRemaining = (record.remaining_after ?? 0) + deductedPoints;
      const countText = `${previousRemaining}-${deductedPoints}=${record.remaining_after}`;
      
      if (record.memo && record.memo.trim()) {
        subLabel = `${countText} / ${record.memo.trim()}`;
      } else {
        subLabel = countText;
      }
    } else {
      // 멤버십/일회성은 메모만 표시
      if (record.memo && record.memo.trim()) {
        subLabel = record.memo.trim();
      }
    }

    events.push({
      id: `${eventType}_${record.id}`,
      type: eventType,
      date: record.usage_date,
      timestamp: record.created_at || record.usage_date,
      icon: TIMELINE_EVENT_ICONS[eventType],
      label,
      subLabel,
      sourceTable: 'cs_yakchim_usage_records',
      sourceId: record.id!,
      isEditable: true,  // 약침 사용 기록은 항상 수정 가능
      isCompleted: false,
      originalData: record,
    });
  });

  // 커스텀 메모 이벤트
  receiptMemos.forEach(memo => {
    if (memo.memo && memo.memo.trim()) {
      events.push({
        id: `custom_memo_${memo.id}`,
        type: 'custom_memo',
        date: memo.receipt_date,
        timestamp: memo.created_at || memo.receipt_date,
        icon: TIMELINE_EVENT_ICONS.custom_memo,
        label: memo.memo.length > 20 ? memo.memo.slice(0, 20) + '...' : memo.memo,
        subLabel: undefined,
        sourceTable: 'cs_receipt_memos',
        sourceId: memo.id!,
        isEditable: memo.receipt_date === today,
        isCompleted: false,
        originalData: memo,
      });
    }
  });

  // 최신순 정렬 (기록된 날짜 기준, 같은 날짜면 timestamp로 추가 정렬)
  events.sort((a, b) => {
    // 먼저 날짜(date) 기준 정렬
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    // 같은 날짜면 timestamp로 정렬
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  const totalCount = events.length;
  const hasMore = totalCount > offset + limit;

  // 페이지네이션 적용
  const paginatedEvents = events.slice(offset, offset + limit);

  return {
    events: paginatedEvents,
    totalCount,
    hasMore,
  };
}

/**
 * 타임라인 수정 이력 생성
 * 완료된 항목 수정 시 반드시 호출
 */
export async function createTimelineAuditLog(
  log: Omit<TimelineAuditLog, 'id' | 'created_at'>
): Promise<number> {
  const sql = `
    INSERT INTO cs_timeline_audit_logs (
      source_table, source_id, patient_id, field_name,
      old_value, new_value, modified_at, modified_by, modification_reason
    ) VALUES (
      ${escapeString(log.source_table)},
      ${log.source_id},
      ${log.patient_id},
      ${escapeString(log.field_name)},
      ${toSqlValue(log.old_value)},
      ${toSqlValue(log.new_value)},
      ${escapeString(log.modified_at)},
      ${escapeString(log.modified_by)},
      ${escapeString(log.modification_reason)}
    )
  `;
  return insert(sql);
}

/**
 * 특정 레코드의 수정 이력 조회
 */
export async function getTimelineAuditLogs(
  sourceTable: string,
  sourceId: number
): Promise<TimelineAuditLog[]> {
  return query<TimelineAuditLog>(`
    SELECT * FROM cs_timeline_audit_logs
    WHERE source_table = ${escapeString(sourceTable)}
    AND source_id = ${sourceId}
    ORDER BY modified_at DESC
  `);
}

/**
 * 환자의 모든 수정 이력 조회
 */
export async function getPatientAuditLogs(
  patientId: number,
  limit: number = 50
): Promise<TimelineAuditLog[]> {
  return query<TimelineAuditLog>(`
    SELECT * FROM cs_timeline_audit_logs
    WHERE patient_id = ${patientId}
    ORDER BY modified_at DESC
    LIMIT ${limit}
  `);
}

// ============================================
// 패키지 히스토리 조회
// ============================================

export interface PackageHistoryItem {
  id: string;
  type: 'add' | 'usage';  // 등록 또는 사용
  date: string;
  label: string;
  subLabel?: string;
  deductionPoints?: number;  // 차감 포인트 (사용시)
  remainingAfter?: number;   // 차감 후 잔여
}

/**
 * 특정 패키지의 히스토리 조회
 * @param packageId 패키지 ID
 * @returns 패키지 등록 및 사용 히스토리
 */
export async function getPackageHistory(packageId: number): Promise<PackageHistoryItem[]> {
  const items: PackageHistoryItem[] = [];

  // 1. 패키지 등록 정보 조회
  const pkg = await queryOne<TreatmentPackage>(`
    SELECT * FROM cs_treatment_packages WHERE id = ${packageId}
  `);

  if (pkg) {
    items.push({
      id: `add_${pkg.id}`,
      type: 'add',
      date: pkg.start_date,
      label: `${pkg.package_name} 등록`,
      subLabel: `총 ${pkg.total_count}회${pkg.includes ? `, ${pkg.includes}` : ''}`,
    });
  }

  // 2. 약침 사용 기록 조회 (해당 패키지에서 차감된 것)
  const usageRecords = await query<YakchimUsageRecord>(`
    SELECT * FROM cs_yakchim_usage_records
    WHERE source_type = 'package' AND source_id = ${packageId}
    ORDER BY usage_date DESC, created_at DESC
  `);

  usageRecords.forEach(record => {
    const deductionPoints = record.deduction_points ?? record.quantity ?? 1;
    items.push({
      id: `usage_${record.id}`,
      type: 'usage',
      date: record.usage_date,
      label: record.item_name || '약침 사용',
      subLabel: record.memo || undefined,
      deductionPoints,
      remainingAfter: record.remaining_after,
    });
  });

  // 날짜순 정렬 (최신순)
  items.sort((a, b) => b.date.localeCompare(a.date));

  return items;
}

/**
 * 한약 패키지의 히스토리 조회
 * @param packageId 한약 패키지 ID
 * @returns 패키지 등록 및 수령 히스토리
 */
export async function getHerbalPackageHistory(packageId: number): Promise<PackageHistoryItem[]> {
  const items: PackageHistoryItem[] = [];

  // 1. 한약 패키지 등록 정보 조회
  const pkg = await queryOne<HerbalPackage>(`
    SELECT * FROM cs_herbal_packages WHERE id = ${packageId}
  `);

  if (pkg) {
    items.push({
      id: `add_herbal_${pkg.id}`,
      type: 'add',
      date: pkg.start_date,
      label: `${pkg.purpose || '한약'} 선결제 등록`,
      subLabel: `${pkg.total_count}회${pkg.purpose ? ` (${pkg.purpose})` : ''}`,
    });
  }

  // 2. 한약 수령 기록 조회
  const pickups = await query<HerbalPickup>(`
    SELECT * FROM cs_herbal_pickups
    WHERE package_id = ${packageId}
    ORDER BY pickup_date DESC, round_number DESC
  `);

  pickups.forEach(pickup => {
    const deliveryText = pickup.delivery_method === 'pickup' ? '수령' :
                        pickup.delivery_method === 'local' ? '시내배송' : '택배';
    items.push({
      id: `usage_herbal_${pickup.id}`,
      type: 'usage',
      date: pickup.pickup_date,
      label: `${pickup.round_number}차 ${deliveryText}`,
      subLabel: pickup.with_nokryong ? '녹용 포함' : undefined,
      remainingAfter: pkg ? pkg.total_count - pickup.round_number : undefined,
    });
  });

  // 날짜순 정렬 (최신순)
  items.sort((a, b) => b.date.localeCompare(a.date));

  return items;
}

/**
 * 녹용 패키지의 히스토리 조회
 * @param packageId 녹용 패키지 ID
 * @returns 패키지 등록 및 사용 히스토리
 */
export async function getNokryongPackageHistory(packageId: number): Promise<PackageHistoryItem[]> {
  const items: PackageHistoryItem[] = [];

  // 1. 녹용 패키지 등록 정보 조회
  const pkg = await queryOne<NokryongPackage>(`
    SELECT * FROM cs_nokryong_packages WHERE id = ${packageId}
  `);

  if (pkg) {
    items.push({
      id: `add_nokryong_${pkg.id}`,
      type: 'add',
      date: pkg.start_date,
      label: `${pkg.package_name || '녹용'} 선결제 등록`,
      subLabel: `${pkg.total_months}회`,
    });
  }

  // 2. 녹용은 한약 수령과 함께 사용됨 - 한약 수령 기록에서 녹용 사용 내역 조회
  const pickups = await query<HerbalPickup>(`
    SELECT * FROM cs_herbal_pickups
    WHERE nokryong_package_id = ${packageId} AND with_nokryong = true
    ORDER BY pickup_date DESC, created_at DESC
  `);

  pickups.forEach(pickup => {
    items.push({
      id: `usage_nokryong_${pickup.id}`,
      type: 'usage',
      date: pickup.pickup_date,
      label: `한약 ${pickup.round_number}차와 함께 사용`,
      subLabel: pickup.memo || undefined,
    });
  });

  // 날짜순 정렬 (최신순)
  items.sort((a, b) => b.date.localeCompare(a.date));

  return items;
}

/**
 * 멤버십의 히스토리 조회
 * @param membershipId 멤버십 ID
 * @returns 멤버십 등록 및 사용 히스토리
 */
export async function getMembershipHistory(membershipId: number): Promise<PackageHistoryItem[]> {
  const items: PackageHistoryItem[] = [];

  // 1. 멤버십 등록 정보 조회
  const membership = await queryOne<Membership>(`
    SELECT * FROM cs_memberships WHERE id = ${membershipId}
  `);

  if (membership) {
    items.push({
      id: `add_membership_${membership.id}`,
      type: 'add',
      date: membership.start_date,
      label: `${membership.membership_type} 등록`,
      subLabel: `${membership.quantity}개, ~${membership.expire_date}`,
    });
  }

  // 2. 약침 사용 기록 조회 (해당 멤버십에서 차감된 것)
  const usageRecords = await query<YakchimUsageRecord>(`
    SELECT * FROM cs_yakchim_usage_records
    WHERE source_type = 'membership' AND source_id = ${membershipId}
    ORDER BY usage_date DESC, created_at DESC
  `);

  usageRecords.forEach(record => {
    const deductionPoints = record.deduction_points ?? record.quantity ?? 1;
    items.push({
      id: `usage_membership_${record.id}`,
      type: 'usage',
      date: record.usage_date,
      label: record.item_name || '약침 사용',
      subLabel: record.memo || undefined,
      deductionPoints,
      remainingAfter: record.remaining_after,
    });
  });

  // 날짜순 정렬 (최신순)
  items.sort((a, b) => b.date.localeCompare(a.date));

  return items;
}

// ============================================
// 메모 종류 관리
// ============================================

export interface MemoType {
  id: number;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 메모 종류 목록 조회
 */
export async function getMemoTypes(includeInactive: boolean = false): Promise<MemoType[]> {
  // 테이블이 없을 수 있으므로 초기화 먼저 실행
  await ensureReceiptTables();
  const whereClause = includeInactive ? '' : 'WHERE is_active = true';
  return query<MemoType>(`
    SELECT * FROM cs_memo_types
    ${whereClause}
    ORDER BY sort_order ASC, id ASC
  `);
}

/**
 * 메모 종류 추가
 */
export async function createMemoType(data: {
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}): Promise<number> {
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_memo_types (name, color, icon, sort_order, created_at, updated_at)
    VALUES (
      ${escapeString(data.name)},
      ${escapeString(data.color || '#6b7280')},
      ${escapeString(data.icon || 'comment')},
      ${data.sort_order ?? 0},
      ${escapeString(now)},
      ${escapeString(now)}
    )
  `);
}

/**
 * 메모 종류 수정
 */
export async function updateMemoType(id: number, data: {
  name?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<void> {
  const parts: string[] = [];
  if (data.name !== undefined) parts.push(`name = ${escapeString(data.name)}`);
  if (data.color !== undefined) parts.push(`color = ${escapeString(data.color)}`);
  if (data.icon !== undefined) parts.push(`icon = ${escapeString(data.icon)}`);
  if (data.sort_order !== undefined) parts.push(`sort_order = ${data.sort_order}`);
  if (data.is_active !== undefined) parts.push(`is_active = ${data.is_active}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  await execute(`UPDATE cs_memo_types SET ${parts.join(', ')} WHERE id = ${id}`);
}

/**
 * 메모 종류 삭제
 */
export async function deleteMemoType(id: number): Promise<void> {
  await execute(`DELETE FROM cs_memo_types WHERE id = ${id}`);
}

// === 일별 비급여 처리 현황 ===

export type UncoveredRecordType = 'yakchim' | 'medicine' | 'herbal' | 'package' | 'membership' | 'memo';

export interface DailyUncoveredRecord {
  id: number;
  recordType: UncoveredRecordType;
  patientId: number;
  patientName: string;
  chartNumber: string;
  itemName: string;
  detail: string;
  createdAt: string;
  sourceTable: string;
  sourceData?: Record<string, any>;
}

export async function getDailyUncoveredSummary(date: string): Promise<DailyUncoveredRecord[]> {
  const escaped = escapeString(date);

  const [yakchimRows, medicineRows, herbalRows, packageRows, membershipRows, memoRows] = await Promise.all([
    // 약침 사용 기록
    query<any>(`SELECT id, patient_id, COALESCE((SELECT name FROM patients WHERE id = cs_yakchim_usage_records.patient_id), '') as patient_name, COALESCE((SELECT chart_number FROM patients WHERE id = cs_yakchim_usage_records.patient_id), '') as chart_number, item_name, source_type, source_name, quantity, deduction_points, created_at FROM cs_yakchim_usage_records WHERE usage_date = ${escaped} ORDER BY created_at DESC`),
    // 상비약 사용 기록
    query<any>(`SELECT id, patient_id, patient_name, chart_number, medicine_name, quantity, purpose, inventory_id, created_at FROM cs_medicine_usage WHERE usage_date = ${escaped} ORDER BY created_at DESC`),
    // 한약 픽업 기록
    query<any>(`SELECT hp.id, hp.patient_id, hp.patient_name, hp.chart_number, hp.round_number, hp.delivery_method, hp.with_nokryong, hp.nokryong_package_id, hp.package_id, hp.created_at, COALESCE(pkg.herbal_name, '한약') as herbal_name FROM cs_herbal_pickups hp LEFT JOIN cs_herbal_packages pkg ON hp.package_id = pkg.id WHERE hp.pickup_date = ${escaped} ORDER BY hp.created_at DESC`),
    // 패키지 등록 기록
    query<any>(`SELECT id, patient_id, patient_name, chart_number, package_name, total_count, memo, mssql_detail_id, created_at FROM cs_treatment_packages WHERE DATE(created_at) = ${escaped} ORDER BY created_at DESC`),
    // 멤버십 등록 기록
    query<any>(`SELECT id, patient_id, patient_name, chart_number, membership_type, quantity, start_date, expire_date, memo, mssql_detail_id, created_at FROM cs_memberships WHERE DATE(created_at) = ${escaped} ORDER BY created_at DESC`),
    // 메모 기록 (detail_id가 있는 비급여 항목 메모만)
    query<any>(`SELECT id, patient_id, patient_name, chart_number, memo, mssql_detail_id, mssql_receipt_id, created_at FROM cs_receipt_memos WHERE receipt_date = ${escaped} AND mssql_detail_id IS NOT NULL ORDER BY created_at DESC`),
  ]);

  const records: DailyUncoveredRecord[] = [];

  // 약침
  for (const r of yakchimRows) {
    const sourceLabel = r.source_type === 'package' ? '패키지차감' : r.source_type === 'membership' ? '멤버십' : '일회성';
    records.push({
      id: r.id,
      recordType: 'yakchim',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: r.item_name || '약침',
      detail: `${sourceLabel}${r.source_name ? ' · ' + r.source_name : ''}${r.quantity ? ' · ' + r.quantity + '개' : ''}${r.deduction_points ? ' · ' + r.deduction_points + 'p' : ''}`,
      createdAt: r.created_at,
      sourceTable: 'cs_yakchim_usage_records',
      sourceData: { source_type: r.source_type, source_id: r.source_id, deduction_points: r.deduction_points },
    });
  }

  // 상비약
  for (const r of medicineRows) {
    records.push({
      id: r.id,
      recordType: 'medicine',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: r.medicine_name,
      detail: `${r.purpose || ''} · ${r.quantity}개`,
      createdAt: r.created_at,
      sourceTable: 'cs_medicine_usage',
      sourceData: { inventory_id: r.inventory_id, quantity: r.quantity },
    });
  }

  // 한약
  for (const r of herbalRows) {
    const deliveryLabel = r.delivery_method === 'pickup' ? '직접수령' : r.delivery_method === 'delivery' ? '택배' : r.delivery_method === 'quick' ? '퀵' : r.delivery_method;
    records.push({
      id: r.id,
      recordType: 'herbal',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: r.herbal_name,
      detail: `${r.round_number}회차 · ${deliveryLabel}${r.with_nokryong ? ' · +녹용' : ''}`,
      createdAt: r.created_at,
      sourceTable: 'cs_herbal_pickups',
      sourceData: { package_id: r.package_id, with_nokryong: r.with_nokryong, nokryong_package_id: r.nokryong_package_id },
    });
  }

  // 패키지
  for (const r of packageRows) {
    records.push({
      id: r.id,
      recordType: 'package',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: r.package_name,
      detail: `총 ${r.total_count}회${r.memo ? ' · ' + r.memo : ''}`,
      createdAt: r.created_at,
      sourceTable: 'cs_treatment_packages',
    });
  }

  // 멤버십
  for (const r of membershipRows) {
    records.push({
      id: r.id,
      recordType: 'membership',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: r.membership_type,
      detail: `${r.quantity}개월 · ${r.start_date}~${r.expire_date}`,
      createdAt: r.created_at,
      sourceTable: 'cs_memberships',
    });
  }

  // 메모
  for (const r of memoRows) {
    records.push({
      id: r.id,
      recordType: 'memo',
      patientId: r.patient_id,
      patientName: r.patient_name,
      chartNumber: r.chart_number,
      itemName: '메모',
      detail: r.memo || '',
      createdAt: r.created_at,
      sourceTable: 'cs_receipt_memos',
    });
  }

  // 시간순 정렬 (최신 먼저)
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return records;
}

/**
 * 비급여 처리 기록 삭제 (되돌리기)
 */
export async function deleteUncoveredRecord(record: DailyUncoveredRecord): Promise<void> {
  switch (record.sourceTable) {
    case 'cs_yakchim_usage_records': {
      // 패키지 차감이었으면 복원
      if (record.sourceData?.source_type === 'package' && record.sourceData?.source_id) {
        const points = record.sourceData.deduction_points || 0;
        await execute(`UPDATE cs_treatment_packages SET remaining_count = remaining_count + ${points}, used_count = used_count - ${points}, status = 'active' WHERE id = ${record.sourceData.source_id}`);
      }
      await execute(`DELETE FROM cs_yakchim_usage_records WHERE id = ${record.id}`);
      break;
    }
    case 'cs_medicine_usage': {
      // 재고 복원
      if (record.sourceData?.inventory_id && record.sourceData?.quantity) {
        await execute(`UPDATE cs_medicine_inventory SET current_stock = current_stock + ${record.sourceData.quantity} WHERE id = ${record.sourceData.inventory_id}`);
      }
      await execute(`DELETE FROM cs_medicine_usage WHERE id = ${record.id}`);
      break;
    }
    case 'cs_herbal_pickups': {
      // 한약 패키지 복원
      if (record.sourceData?.package_id) {
        await execute(`UPDATE cs_herbal_packages SET used_count = used_count - 1, remaining_count = remaining_count + 1, status = 'active' WHERE id = ${record.sourceData.package_id}`);
      }
      // 녹용 복원
      if (record.sourceData?.with_nokryong && record.sourceData?.nokryong_package_id) {
        await execute(`UPDATE cs_nokryong_packages SET used_months = used_months - 1, remaining_months = remaining_months + 1, status = 'active' WHERE id = ${record.sourceData.nokryong_package_id}`);
      }
      await execute(`DELETE FROM cs_herbal_pickups WHERE id = ${record.id}`);
      break;
    }
    case 'cs_treatment_packages': {
      await execute(`DELETE FROM cs_treatment_packages WHERE id = ${record.id}`);
      break;
    }
    case 'cs_memberships': {
      await execute(`DELETE FROM cs_memberships WHERE id = ${record.id}`);
      break;
    }
    case 'cs_receipt_memos': {
      await execute(`DELETE FROM cs_receipt_memos WHERE id = ${record.id}`);
      break;
    }
  }
}

// ─── 패키지 관리 알림 ───────────────────────────────────────

export type PackageAlertType = 'expire-soon' | 'unused-1month' | 'herbal-3month' | 'membership-expire' | 'low-remaining';

export interface PackageAlertItem {
  id: number;
  alertType: PackageAlertType;
  packageType: 'treatment' | 'herbal' | 'nokryong' | 'membership';
  patientId: number;
  patientName: string;
  chartNumber: string;
  packageName: string;
  detail: string;
  expireDate?: string;
  remainingCount?: number;
  lastUsageDate?: string;
  createdAt: string;
}

export interface PackageAlertSummary {
  alerts: PackageAlertItem[];
  counts: Record<PackageAlertType, number>;
}

export async function getPackageAlerts(): Promise<PackageAlertSummary> {
  const now = getCurrentDate();

  const [
    expireSoonRows,
    unused1monthTreatment,
    unused1monthHerbal,
    herbal3monthRows,
    membershipExpireRows,
    lowRemainingTreatment,
    lowRemainingHerbal,
  ] = await Promise.all([
    // 1. 유효기간 7일 이내 (treatment + nokryong)
    query<any>(`
      SELECT id, patient_id, patient_name, chart_number, package_name,
        remaining_count, expire_date, created_at, 'treatment' as pkg_type
      FROM cs_treatment_packages
      WHERE status = 'active' AND expire_date IS NOT NULL
        AND expire_date <= (DATE ${escapeString(now)} + INTERVAL '7 days')::text
        AND expire_date >= ${escapeString(now)}
      UNION ALL
      SELECT id, patient_id, patient_name, chart_number, package_name,
        remaining_months as remaining_count, expire_date, created_at, 'nokryong' as pkg_type
      FROM cs_nokryong_packages
      WHERE expire_date IS NOT NULL AND remaining_months > 0
        AND expire_date <= (DATE ${escapeString(now)} + INTERVAL '7 days')::text
        AND expire_date >= ${escapeString(now)}
      ORDER BY expire_date ASC
    `),

    // 2a. 미사용 1개월 - treatment (LEFT JOIN usage)
    query<any>(`
      SELECT p.id, p.patient_id, p.patient_name, p.chart_number, p.package_name,
        p.remaining_count, p.expire_date, p.created_at,
        MAX(u.usage_date) as last_usage
      FROM cs_treatment_packages p
      LEFT JOIN cs_yakchim_usage_records u
        ON u.source_type = 'package' AND u.source_id = p.id
      WHERE p.status = 'active' AND p.remaining_count > 0
      GROUP BY p.id, p.patient_id, p.patient_name, p.chart_number,
        p.package_name, p.remaining_count, p.expire_date, p.created_at
      HAVING MAX(u.usage_date) IS NULL
        OR MAX(u.usage_date) <= (DATE ${escapeString(now)} - INTERVAL '30 days')::text
    `),

    // 2b. 미사용 1개월 - herbal (LEFT JOIN pickups)
    query<any>(`
      SELECT p.id, p.patient_id, p.patient_name, p.chart_number, p.herbal_name as package_name,
        p.remaining_count, p.created_at,
        MAX(pk.pickup_date) as last_usage
      FROM cs_herbal_packages p
      LEFT JOIN cs_herbal_pickups pk ON pk.package_id = p.id
      WHERE p.status = 'active' AND p.remaining_count > 0
      GROUP BY p.id, p.patient_id, p.patient_name, p.chart_number,
        p.herbal_name, p.remaining_count, p.created_at
      HAVING MAX(pk.pickup_date) IS NULL
        OR MAX(pk.pickup_date) <= (DATE ${escapeString(now)} - INTERVAL '30 days')::text
    `),

    // 3. 한약 선결제 3개월 경과
    query<any>(`
      SELECT id, patient_id, patient_name, chart_number, herbal_name as package_name,
        remaining_count, total_count, created_at
      FROM cs_herbal_packages
      WHERE status = 'active' AND remaining_count > 0
        AND created_at <= NOW() - INTERVAL '3 months'
    `),

    // 4. 멤버십 만료 14일 이내
    query<any>(`
      SELECT id, patient_id, patient_name, chart_number, membership_type as package_name,
        expire_date, created_at
      FROM cs_memberships
      WHERE status = 'active'
        AND expire_date <= (DATE ${escapeString(now)} + INTERVAL '14 days')::text
        AND expire_date >= ${escapeString(now)}
    `),

    // 5a. 잔여 1회 이하 - treatment
    query<any>(`
      SELECT id, patient_id, patient_name, chart_number, package_name,
        remaining_count, total_count, expire_date, created_at
      FROM cs_treatment_packages
      WHERE status = 'active' AND remaining_count <= 1
    `),

    // 5b. 잔여 1회 이하 - herbal
    query<any>(`
      SELECT id, patient_id, patient_name, chart_number, herbal_name as package_name,
        remaining_count, total_count, created_at
      FROM cs_herbal_packages
      WHERE status = 'active' AND remaining_count <= 1
    `),
  ]);

  const alerts: PackageAlertItem[] = [];

  // 1. 만료 임박
  for (const r of expireSoonRows) {
    alerts.push({
      id: r.id,
      alertType: 'expire-soon',
      packageType: r.pkg_type,
      patientId: r.patient_id,
      patientName: r.patient_name || '',
      chartNumber: r.chart_number || '',
      packageName: r.package_name || '',
      detail: `만료 ${r.expire_date} / 잔여 ${r.remaining_count}회`,
      expireDate: r.expire_date,
      remainingCount: r.remaining_count,
      createdAt: r.created_at,
    });
  }

  // 2. 미사용 1개월
  for (const r of [...unused1monthTreatment, ...unused1monthHerbal]) {
    const pkgType = r.herbal_name !== undefined ? 'herbal' : 'treatment';
    alerts.push({
      id: r.id,
      alertType: 'unused-1month',
      packageType: pkgType as any,
      patientId: r.patient_id,
      patientName: r.patient_name || '',
      chartNumber: r.chart_number || '',
      packageName: r.package_name || '',
      detail: r.last_usage ? `최근사용 ${r.last_usage}` : '사용 기록 없음',
      lastUsageDate: r.last_usage,
      remainingCount: r.remaining_count,
      createdAt: r.created_at,
    });
  }

  // 3. 한약 3개월 경과
  for (const r of herbal3monthRows) {
    alerts.push({
      id: r.id,
      alertType: 'herbal-3month',
      packageType: 'herbal',
      patientId: r.patient_id,
      patientName: r.patient_name || '',
      chartNumber: r.chart_number || '',
      packageName: r.package_name || '',
      detail: `등록 ${(r.created_at || '').slice(0, 10)} / 잔여 ${r.remaining_count}/${r.total_count}회`,
      remainingCount: r.remaining_count,
      createdAt: r.created_at,
    });
  }

  // 4. 멤버십 만료
  for (const r of membershipExpireRows) {
    alerts.push({
      id: r.id,
      alertType: 'membership-expire',
      packageType: 'membership',
      patientId: r.patient_id,
      patientName: r.patient_name || '',
      chartNumber: r.chart_number || '',
      packageName: r.package_name || '',
      detail: `만료 ${r.expire_date}`,
      expireDate: r.expire_date,
      createdAt: r.created_at,
    });
  }

  // 5. 잔여 부족
  for (const r of [...lowRemainingTreatment, ...lowRemainingHerbal]) {
    alerts.push({
      id: r.id,
      alertType: 'low-remaining',
      packageType: r.herbal_name !== undefined ? 'herbal' : 'treatment',
      patientId: r.patient_id,
      patientName: r.patient_name || '',
      chartNumber: r.chart_number || '',
      packageName: r.package_name || '',
      detail: `잔여 ${r.remaining_count}/${r.total_count}회`,
      remainingCount: r.remaining_count,
      expireDate: r.expire_date,
      createdAt: r.created_at,
    });
  }

  // 건수 집계
  const counts: Record<PackageAlertType, number> = {
    'expire-soon': 0,
    'unused-1month': 0,
    'herbal-3month': 0,
    'membership-expire': 0,
    'low-remaining': 0,
  };
  for (const a of alerts) {
    counts[a.alertType]++;
  }

  return { alerts, counts };
}

// ============================================================
// 한약 Draft (기록) CRUD
// ============================================================

export async function getHerbalDrafts(patientId: number): Promise<HerbalDraft[]> {
  await ensureReceiptTables();
  return query<HerbalDraft>(
    `SELECT * FROM cs_herbal_drafts WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

let _herbalMedicineColAdded = false;
export async function createHerbalDraft(draft: Omit<HerbalDraft, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  await ensureReceiptTables();
  if (!_herbalMedicineColAdded) {
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS medicine_items TEXT`).catch(() => {});
    _herbalMedicineColAdded = true;
  }
  const now = getCurrentTimestamp();
  return insert(`
    INSERT INTO cs_herbal_drafts (patient_id, chart_number, patient_name, herbal_name, consultation_type, payment_type, nokryong_type, visit_pattern, treatment_months, consultation_method, sub_type, nokryong_grade, nokryong_count, delivery_method, decoction_date, memo, medicine_items, receipt_date, doctor, journey_status, status, created_by, created_at, updated_at)
    VALUES (${draft.patient_id}, ${escapeString(draft.chart_number)}, ${escapeString(draft.patient_name)}, ${escapeString(draft.herbal_name)}, ${escapeString(draft.consultation_type)}, ${escapeString(draft.payment_type)}, ${escapeString(draft.nokryong_type)}, ${escapeString(draft.visit_pattern)}, ${escapeString(draft.treatment_months)}, ${escapeString(draft.consultation_method)}, ${escapeString(draft.sub_type)}, ${escapeString(draft.nokryong_grade)}, ${draft.nokryong_count ?? 'NULL'}, ${escapeString(draft.delivery_method)}, ${escapeString(draft.decoction_date)}, ${escapeString(draft.memo)}, ${escapeString(draft.medicine_items)}, ${escapeString(draft.receipt_date || getCurrentDate())}, ${escapeString(draft.doctor)}, ${draft.journey_status ? `${escapeString(JSON.stringify(draft.journey_status))}::jsonb` : "'{}'"}, ${escapeString(draft.status)}, ${escapeString(draft.created_by)}, ${escapeString(now)}, ${escapeString(now)})
  `);
}

export async function updateHerbalDraft(id: number, updates: Partial<HerbalDraft>): Promise<void> {
  await ensureReceiptTables();
  const setClauses: string[] = [];
  if (updates.herbal_name !== undefined) setClauses.push(`herbal_name = ${escapeString(updates.herbal_name)}`);
  if (updates.consultation_type !== undefined) setClauses.push(`consultation_type = ${escapeString(updates.consultation_type)}`);
  if (updates.payment_type !== undefined) setClauses.push(`payment_type = ${escapeString(updates.payment_type)}`);
  if (updates.nokryong_type !== undefined) setClauses.push(`nokryong_type = ${escapeString(updates.nokryong_type)}`);
  if (updates.visit_pattern !== undefined) setClauses.push(`visit_pattern = ${escapeString(updates.visit_pattern)}`);
  if (updates.treatment_months !== undefined) setClauses.push(`treatment_months = ${escapeString(updates.treatment_months)}`);
  if (updates.consultation_method !== undefined) setClauses.push(`consultation_method = ${escapeString(updates.consultation_method)}`);
  if (updates.sub_type !== undefined) setClauses.push(`sub_type = ${escapeString(updates.sub_type)}`);
  if (updates.nokryong_grade !== undefined) setClauses.push(`nokryong_grade = ${escapeString(updates.nokryong_grade)}`);
  if (updates.nokryong_count !== undefined) setClauses.push(`nokryong_count = ${updates.nokryong_count}`);
  if (updates.delivery_method !== undefined) setClauses.push(`delivery_method = ${escapeString(updates.delivery_method)}`);
  if (updates.decoction_date !== undefined) setClauses.push(`decoction_date = ${escapeString(updates.decoction_date)}`);
  if (updates.memo !== undefined) setClauses.push(`memo = ${escapeString(updates.memo)}`);
  if (updates.receipt_date !== undefined) setClauses.push(`receipt_date = ${escapeString(updates.receipt_date)}`);
  if (updates.doctor !== undefined) setClauses.push(`doctor = ${escapeString(updates.doctor)}`);
  if (updates.journey_status !== undefined) setClauses.push(`journey_status = ${escapeString(JSON.stringify(updates.journey_status))}::jsonb`);
  if (updates.status !== undefined) setClauses.push(`status = ${escapeString(updates.status)}`);
  setClauses.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);
  await execute(`UPDATE cs_herbal_drafts SET ${setClauses.join(', ')} WHERE id = ${id}`);
}

export async function updateHerbalDraftJourney(id: number, journeyStatus: JourneyStatus): Promise<void> {
  await ensureReceiptTables();
  await execute(`UPDATE cs_herbal_drafts SET journey_status = ${escapeString(JSON.stringify(journeyStatus))}::jsonb, updated_at = ${escapeString(getCurrentTimestamp())} WHERE id = ${id}`);
}

export async function deleteHerbalDraft(id: number): Promise<void> {
  await ensureReceiptTables();
  await execute(`DELETE FROM cs_herbal_drafts WHERE id = ${id}`);
}

// ============================================================
// 탕전 인력 스케줄
// ============================================================

export async function getStaffSchedule(startDate: string, endDate: string): Promise<StaffScheduleEntry[]> {
  await ensureReceiptTables();
  return query<StaffScheduleEntry>(
    `SELECT * FROM cs_decoction_staff_schedule WHERE schedule_date >= ${escapeString(startDate)} AND schedule_date <= ${escapeString(endDate)} ORDER BY schedule_date`
  );
}

export async function upsertStaffSchedule(date: string, staffCount: number, isHoliday: boolean, memo?: string): Promise<void> {
  await ensureReceiptTables();
  const now = getCurrentTimestamp();
  await execute(`
    INSERT INTO cs_decoction_staff_schedule (schedule_date, staff_count, is_holiday, memo, created_at, updated_at)
    VALUES (${escapeString(date)}, ${staffCount}, ${isHoliday}, ${escapeString(memo)}, ${escapeString(now)}, ${escapeString(now)})
    ON CONFLICT (schedule_date) DO UPDATE SET staff_count = ${staffCount}, is_holiday = ${isHoliday}, memo = ${escapeString(memo)}, updated_at = ${escapeString(now)}
  `);
}

// ============================================================
// 탕전 용량 계산
// ============================================================

function calculateMaxCapacity(staffCount: number, isWeekendOrHoliday: boolean): number {
  if (isWeekendOrHoliday) {
    return staffCount >= 2 ? 14 : 6;
  }
  return staffCount >= 2 ? 22 : 8;
}

export async function getDecoctionCapacity(startDate: string, endDate: string): Promise<DecoctionDayCapacity[]> {
  await ensureReceiptTables();

  // 1. 인력 스케줄 조회
  const schedules = await getStaffSchedule(startDate, endDate);
  const scheduleMap = new Map<string, StaffScheduleEntry>();
  for (const s of schedules) {
    scheduleMap.set(s.schedule_date, s);
  }

  // 2. 해당 기간 draft 건수 집계
  const draftCounts = await query<{ decoction_date: string; cnt: string }>(
    `SELECT decoction_date, COUNT(*)::text as cnt FROM cs_herbal_drafts WHERE decoction_date >= ${escapeString(startDate)} AND decoction_date <= ${escapeString(endDate)} AND decoction_date IS NOT NULL GROUP BY decoction_date`
  );
  const countMap = new Map<string, number>();
  for (const row of draftCounts) {
    countMap.set(row.decoction_date, parseInt(row.cnt, 10));
  }

  // 3. 날짜별 용량 계산
  const result: DecoctionDayCapacity[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getDay(); // 0=일, 6=토
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const schedule = scheduleMap.get(dateStr);
    const staffCount = schedule?.staff_count ?? 1;
    const isHoliday = schedule?.is_holiday ?? false;
    const isWeekendOrHoliday = isWeekend || isHoliday;
    const maxCapacity = calculateMaxCapacity(staffCount, isWeekendOrHoliday);
    const usedCapacity = countMap.get(dateStr) ?? 0;

    result.push({
      date: dateStr,
      staffCount,
      isHoliday,
      isWeekend,
      maxCapacity,
      usedCapacity,
      remainingCapacity: Math.max(0, maxCapacity - usedCapacity),
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

// ============================================================
// 탕전 주문 (Decoction Orders) API
// ============================================================

export async function ensureDecoctionOrdersTable(): Promise<void> {
  if (isTableInitialized('cs_decoction_orders')) return;

  await execute(`
    CREATE TABLE IF NOT EXISTS cs_decoction_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      herbal_draft_id TEXT,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_date TEXT NOT NULL,
      scheduled_slot TEXT NOT NULL,
      recipe_name TEXT,
      delivery_method TEXT,
      assigned_to TEXT,
      notes TEXT,
      color TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // 기존 UUID 컬럼을 TEXT로 마이그레이션
  await execute(`ALTER TABLE cs_decoction_orders ALTER COLUMN herbal_draft_id TYPE TEXT`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_decoction_orders_date ON cs_decoction_orders(scheduled_date)`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_decoction_orders_patient ON cs_decoction_orders(patient_id)`).catch(() => {});

  markTableInitialized('cs_decoction_orders');
}

export async function createDecoctionOrder(order: Omit<DecoctionOrder, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  await ensureDecoctionOrdersTable();
  const now = getCurrentTimestamp();
  const result = await query<{ id: string }>(`
    INSERT INTO cs_decoction_orders (
      herbal_draft_id, patient_id, patient_name, status, scheduled_date, scheduled_slot,
      recipe_name, delivery_method, assigned_to, notes, color, created_by, created_at, updated_at
    ) VALUES (
      ${order.herbal_draft_id ? escapeString(order.herbal_draft_id) : 'NULL'},
      ${escapeString(order.patient_id)}, ${escapeString(order.patient_name)},
      ${escapeString(order.status || 'pending')}, ${escapeString(order.scheduled_date)}, ${escapeString(order.scheduled_slot)},
      ${toSqlValue(order.recipe_name)}, ${toSqlValue(order.delivery_method)},
      ${toSqlValue(order.assigned_to)}, ${toSqlValue(order.notes)}, ${toSqlValue(order.color)},
      ${toSqlValue(order.created_by)}, ${escapeString(now)}, ${escapeString(now)}
    ) RETURNING id
  `);
  return result[0]?.id || '';
}

export async function updateDecoctionOrder(id: string, updates: Partial<DecoctionOrder>): Promise<void> {
  await ensureDecoctionOrdersTable();
  const parts: string[] = [];
  if (updates.herbal_draft_id !== undefined) parts.push(`herbal_draft_id = ${updates.herbal_draft_id ? escapeString(updates.herbal_draft_id) : 'NULL'}`);
  if (updates.patient_id !== undefined) parts.push(`patient_id = ${escapeString(updates.patient_id)}`);
  if (updates.patient_name !== undefined) parts.push(`patient_name = ${escapeString(updates.patient_name)}`);
  if (updates.status !== undefined) parts.push(`status = ${escapeString(updates.status)}`);
  if (updates.scheduled_date !== undefined) parts.push(`scheduled_date = ${escapeString(updates.scheduled_date)}`);
  if (updates.scheduled_slot !== undefined) parts.push(`scheduled_slot = ${escapeString(updates.scheduled_slot)}`);
  if (updates.recipe_name !== undefined) parts.push(`recipe_name = ${toSqlValue(updates.recipe_name)}`);
  if (updates.delivery_method !== undefined) parts.push(`delivery_method = ${toSqlValue(updates.delivery_method)}`);
  if (updates.assigned_to !== undefined) parts.push(`assigned_to = ${toSqlValue(updates.assigned_to)}`);
  if (updates.notes !== undefined) parts.push(`notes = ${toSqlValue(updates.notes)}`);
  if (updates.color !== undefined) parts.push(`color = ${toSqlValue(updates.color)}`);
  parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);
  if (parts.length === 0) return;
  await execute(`UPDATE cs_decoction_orders SET ${parts.join(', ')} WHERE id = ${escapeString(id)}`);
}

export async function deleteDecoctionOrder(id: string): Promise<void> {
  await ensureDecoctionOrdersTable();
  await execute(`DELETE FROM cs_decoction_orders WHERE id = ${escapeString(id)}`);
}

export async function getDecoctionOrders(filters?: {
  patientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DecoctionOrder[]> {
  await ensureDecoctionOrdersTable();
  let sql = 'SELECT * FROM cs_decoction_orders WHERE 1=1';
  if (filters?.patientId) sql += ` AND patient_id = ${escapeString(filters.patientId)}`;
  if (filters?.status) sql += ` AND status = ${escapeString(filters.status)}`;
  if (filters?.dateFrom) sql += ` AND scheduled_date >= ${escapeString(filters.dateFrom)}`;
  if (filters?.dateTo) sql += ` AND scheduled_date <= ${escapeString(filters.dateTo)}`;
  sql += ' ORDER BY scheduled_date, scheduled_slot';
  return query<DecoctionOrder>(sql);
}

export async function getDecoctionOrdersByWeek(startDate: string): Promise<DecoctionOrder[]> {
  await ensureDecoctionOrdersTable();
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endY = end.getFullYear();
  const endM = String(end.getMonth() + 1).padStart(2, '0');
  const endD = String(end.getDate()).padStart(2, '0');
  const endDate = `${endY}-${endM}-${endD}`;
  return query<DecoctionOrder>(
    `SELECT * FROM cs_decoction_orders WHERE scheduled_date >= ${escapeString(startDate)} AND scheduled_date <= ${escapeString(endDate)} ORDER BY scheduled_date, scheduled_slot`
  );
}

// ============================================================
// 상담 메모 (cs_consultation_memos 테이블)
// ============================================================

export interface ConsultationMemo {
  id: number;
  patient_id: number;
  memo: string;
  created_by: string;
  created_at: string;
}

export async function ensureConsultationMemosTable(): Promise<void> {
  if (isTableInitialized('cs_consultation_memos')) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS cs_consultation_memos (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        memo TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_consult_memos_patient ON cs_consultation_memos(patient_id)`).catch(() => {});
    markTableInitialized('cs_consultation_memos');
  } catch (err) {
    console.error('ensureConsultationMemosTable error:', err);
  }
}

export async function getConsultationMemos(patientId: number): Promise<ConsultationMemo[]> {
  await ensureConsultationMemosTable();
  return query<ConsultationMemo>(
    `SELECT * FROM cs_consultation_memos WHERE patient_id = ${patientId} ORDER BY created_at DESC`
  );
}

export async function addConsultationMemo(patientId: number, memo: string, createdBy?: string): Promise<number> {
  await ensureConsultationMemosTable();
  return insert(
    `INSERT INTO cs_consultation_memos (patient_id, memo, created_by) VALUES (${patientId}, ${escapeString(memo)}, ${escapeString(createdBy || '')})`
  );
}

export async function deleteConsultationMemo(id: number): Promise<void> {
  await ensureConsultationMemosTable();
  await execute(`DELETE FROM cs_consultation_memos WHERE id = ${id}`);
}

// =====================================================
// 약상담 기록 (cs_herbal_consultations)
// =====================================================

export interface HerbalConsultation {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  // 상담 정보
  consult_date: string;          // 진료일
  doctor: string;                // 담당의
  consult_type: string;          // 약초진/연복/재초진/점검/마무리
  purpose: string;               // 치료목적
  disease_tags: string;          // 질환명 (JSON array)
  treatment_period: string;      // 치료기간 (15일~6개월 등)
  visit_pattern: string;         // 내원패턴 15일/30일
  nokryong_recommendation: string; // 녹용필수/권유/배제/언급없음
  // 후상담 및 결제
  follow_up_staff?: string;      // 후상담 담당자
  herbal_payment?: string;       // 맞춤한약 결제 결과
  nokryong_type?: string;        // 녹용 종류
  nokryong_payment?: string;     // 녹용 횟수(매번결제/함께결제)
  follow_up_memo?: string;       // 후상담 메모
  // 메타
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

async function ensureHerbalConsultationsTable() {
  if (isTableInitialized('cs_herbal_consultations')) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS cs_herbal_consultations (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      chart_number TEXT,
      patient_name TEXT,
      consult_date TEXT NOT NULL,
      doctor TEXT,
      consult_type TEXT,
      purpose TEXT,
      disease_tags TEXT DEFAULT '[]',
      treatment_period TEXT,
      visit_pattern TEXT,
      nokryong_recommendation TEXT DEFAULT '언급없음',
      follow_up_staff TEXT,
      herbal_payment TEXT,
      nokryong_type TEXT,
      nokryong_payment TEXT,
      follow_up_memo TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await execute(`CREATE INDEX IF NOT EXISTS idx_herbal_consult_patient ON cs_herbal_consultations(patient_id)`).catch(() => {});
  await execute(`CREATE INDEX IF NOT EXISTS idx_herbal_consult_date ON cs_herbal_consultations(consult_date)`).catch(() => {});
  markTableInitialized('cs_herbal_consultations');
}

export async function getHerbalConsultations(patientId: number): Promise<HerbalConsultation[]> {
  await ensureHerbalConsultationsTable();
  return query<HerbalConsultation>(
    `SELECT * FROM cs_herbal_consultations WHERE patient_id = ${patientId} ORDER BY consult_date DESC, created_at DESC`
  );
}

export async function getAllHerbalConsultations(dateFrom?: string, dateTo?: string): Promise<HerbalConsultation[]> {
  await ensureHerbalConsultationsTable();
  let sql = `SELECT * FROM cs_herbal_consultations WHERE 1=1`;
  if (dateFrom) sql += ` AND consult_date >= ${escapeString(dateFrom)}`;
  if (dateTo) sql += ` AND consult_date <= ${escapeString(dateTo)}`;
  sql += ` ORDER BY consult_date DESC, created_at DESC`;
  return query<HerbalConsultation>(sql);
}

export async function addHerbalConsultation(data: Omit<HerbalConsultation, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  await ensureHerbalConsultationsTable();
  const result = await query<{ id: number }>(`
    INSERT INTO cs_herbal_consultations (
      patient_id, chart_number, patient_name, consult_date, doctor, consult_type,
      purpose, disease_tags, treatment_period, visit_pattern, nokryong_recommendation,
      follow_up_staff, herbal_payment, nokryong_type, nokryong_payment, follow_up_memo, created_by
    ) VALUES (
      ${data.patient_id}, ${escapeString(data.chart_number)}, ${escapeString(data.patient_name)},
      ${escapeString(data.consult_date)}, ${escapeString(data.doctor || '')}, ${escapeString(data.consult_type || '')},
      ${escapeString(data.purpose || '')}, ${escapeString(data.disease_tags || '[]')},
      ${escapeString(data.treatment_period || '')}, ${escapeString(data.visit_pattern || '')},
      ${escapeString(data.nokryong_recommendation || '언급없음')},
      ${escapeString(data.follow_up_staff || '')}, ${escapeString(data.herbal_payment || '')},
      ${escapeString(data.nokryong_type || '')}, ${escapeString(data.nokryong_payment || '')},
      ${escapeString(data.follow_up_memo || '')}, ${escapeString(data.created_by || '')}
    ) RETURNING id
  `);
  return result[0]?.id;
}

export async function updateHerbalConsultation(id: number, data: Partial<HerbalConsultation>): Promise<void> {
  await ensureHerbalConsultationsTable();
  const sets: string[] = [];
  if (data.consult_date !== undefined) sets.push(`consult_date = ${escapeString(data.consult_date)}`);
  if (data.doctor !== undefined) sets.push(`doctor = ${escapeString(data.doctor)}`);
  if (data.consult_type !== undefined) sets.push(`consult_type = ${escapeString(data.consult_type)}`);
  if (data.purpose !== undefined) sets.push(`purpose = ${escapeString(data.purpose)}`);
  if (data.disease_tags !== undefined) sets.push(`disease_tags = ${escapeString(data.disease_tags)}`);
  if (data.treatment_period !== undefined) sets.push(`treatment_period = ${escapeString(data.treatment_period)}`);
  if (data.visit_pattern !== undefined) sets.push(`visit_pattern = ${escapeString(data.visit_pattern)}`);
  if (data.nokryong_recommendation !== undefined) sets.push(`nokryong_recommendation = ${escapeString(data.nokryong_recommendation)}`);
  if (data.follow_up_staff !== undefined) sets.push(`follow_up_staff = ${escapeString(data.follow_up_staff)}`);
  if (data.herbal_payment !== undefined) sets.push(`herbal_payment = ${escapeString(data.herbal_payment)}`);
  if (data.nokryong_type !== undefined) sets.push(`nokryong_type = ${escapeString(data.nokryong_type)}`);
  if (data.nokryong_payment !== undefined) sets.push(`nokryong_payment = ${escapeString(data.nokryong_payment)}`);
  if (data.follow_up_memo !== undefined) sets.push(`follow_up_memo = ${escapeString(data.follow_up_memo)}`);
  sets.push(`updated_at = NOW()`);
  await execute(`UPDATE cs_herbal_consultations SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function deleteHerbalConsultation(id: number): Promise<void> {
  await ensureHerbalConsultationsTable();
  await execute(`DELETE FROM cs_herbal_consultations WHERE id = ${id}`);
}
