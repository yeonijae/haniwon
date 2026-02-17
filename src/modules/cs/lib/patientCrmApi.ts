// 환자 CRM API 함수

import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp, getCurrentDate, isTableInitialized, markTableInitialized } from '@shared/lib/postgres';

// 통마 패키지 매칭 조건 (package_name 기준)
const TONGMA_MATCH_CONDITION = `(package_name LIKE '%통증마일리지%' OR package_name LIKE '%통마%')`;
import type {
  PatientNote,
  CreatePatientNoteRequest,
  UpdatePatientNoteRequest,
  PatientNoteType,
  NoteChannel,
  NoteStatus,
  NoteFilterOptions,
  PackageStatusSummary,
} from '../types/crm';
import type {
  TreatmentPackage,
  HerbalPackage,
  NokryongPackage,
  Membership,
} from '../types';

// ============================================
// cs_patient_notes 테이블 생성
// ============================================

export async function ensurePatientNotesTable(): Promise<void> {
  if (isTableInitialized('cs_patient_notes')) {
    return;
  }

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

  // 인덱스 생성
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_patient_notes_patient_id ON cs_patient_notes(patient_id)
  `).catch(() => {});

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_patient_notes_chart_number ON cs_patient_notes(chart_number)
  `).catch(() => {});

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_patient_notes_note_type ON cs_patient_notes(note_type)
  `).catch(() => {});

  markTableInitialized('cs_patient_notes');
}

// ============================================
// 환자 메모 노트 CRUD
// ============================================

/**
 * 환자 메모 노트 목록 조회
 */
export async function getPatientNotes(
  patientId: number,
  options?: NoteFilterOptions
): Promise<PatientNote[]> {
  await ensurePatientNotesTable();

  let sql = `SELECT * FROM cs_patient_notes WHERE patient_id = ${patientId}`;

  if (options?.noteType) {
    sql += ` AND note_type = ${escapeString(options.noteType)}`;
  }

  if (options?.channel) {
    sql += ` AND channel = ${escapeString(options.channel)}`;
  }

  if (options?.status) {
    sql += ` AND status = ${escapeString(options.status)}`;
  }

  if (options?.startDate) {
    sql += ` AND DATE(created_at) >= ${escapeString(options.startDate)}`;
  }

  if (options?.endDate) {
    sql += ` AND DATE(created_at) <= ${escapeString(options.endDate)}`;
  }

  sql += ' ORDER BY created_at DESC';

  return query<PatientNote>(sql);
}

/**
 * 차트번호로 환자 메모 노트 조회
 */
export async function getPatientNotesByChartNumber(
  chartNumber: string,
  options?: NoteFilterOptions
): Promise<PatientNote[]> {
  await ensurePatientNotesTable();

  let sql = `SELECT * FROM cs_patient_notes WHERE chart_number = ${escapeString(chartNumber)}`;

  if (options?.noteType) {
    sql += ` AND note_type = ${escapeString(options.noteType)}`;
  }

  if (options?.channel) {
    sql += ` AND channel = ${escapeString(options.channel)}`;
  }

  if (options?.status) {
    sql += ` AND status = ${escapeString(options.status)}`;
  }

  if (options?.startDate) {
    sql += ` AND DATE(created_at) >= ${escapeString(options.startDate)}`;
  }

  if (options?.endDate) {
    sql += ` AND DATE(created_at) <= ${escapeString(options.endDate)}`;
  }

  sql += ' ORDER BY created_at DESC';

  return query<PatientNote>(sql);
}

/**
 * 메모 노트 상세 조회
 */
export async function getPatientNote(id: number): Promise<PatientNote | null> {
  await ensurePatientNotesTable();

  return queryOne<PatientNote>(
    `SELECT * FROM cs_patient_notes WHERE id = ${id}`
  );
}

/**
 * 메모 노트 생성
 */
export async function createPatientNote(data: CreatePatientNoteRequest): Promise<number> {
  await ensurePatientNotesTable();

  const sql = `
    INSERT INTO cs_patient_notes (
      patient_id, chart_number, patient_name,
      note_type, channel,
      content, response, status,
      mssql_receipt_id, mssql_detail_id, related_date,
      staff_name, staff_role,
      created_at, updated_at
    ) VALUES (
      ${data.patient_id},
      ${escapeString(data.chart_number)},
      ${toSqlValue(data.patient_name)},
      ${escapeString(data.note_type)},
      ${toSqlValue(data.channel)},
      ${escapeString(data.content)},
      ${toSqlValue(data.response)},
      'active',
      ${toSqlValue(data.mssql_receipt_id)},
      ${toSqlValue(data.mssql_detail_id)},
      ${toSqlValue(data.related_date)},
      ${escapeString(data.staff_name)},
      ${escapeString(data.staff_role)},
      ${escapeString(getCurrentTimestamp())},
      ${escapeString(getCurrentTimestamp())}
    )
  `;

  return insert(sql);
}

/**
 * 메모 노트 수정
 */
export async function updatePatientNote(id: number, data: UpdatePatientNoteRequest): Promise<void> {
  await ensurePatientNotesTable();

  const updates: string[] = [];

  if (data.note_type !== undefined) updates.push(`note_type = ${escapeString(data.note_type)}`);
  if (data.channel !== undefined) updates.push(`channel = ${toSqlValue(data.channel)}`);
  if (data.content !== undefined) updates.push(`content = ${escapeString(data.content)}`);
  if (data.response !== undefined) updates.push(`response = ${toSqlValue(data.response)}`);
  if (data.status !== undefined) updates.push(`status = ${escapeString(data.status)}`);
  if (data.staff_name !== undefined) updates.push(`staff_name = ${escapeString(data.staff_name)}`);
  if (data.staff_role !== undefined) updates.push(`staff_role = ${escapeString(data.staff_role)}`);

  updates.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  const sql = `UPDATE cs_patient_notes SET ${updates.join(', ')} WHERE id = ${id}`;
  await execute(sql);
}

/**
 * 메모 노트 삭제
 */
export async function deletePatientNote(id: number): Promise<void> {
  await ensurePatientNotesTable();

  await execute(`DELETE FROM cs_patient_notes WHERE id = ${id}`);
}

/**
 * 메모 노트 상태 변경
 */
export async function updatePatientNoteStatus(id: number, status: NoteStatus): Promise<void> {
  await updatePatientNote(id, { status });
}

// ============================================
// 패키지 현황 조회
// ============================================

/**
 * 환자 패키지 현황 요약 조회
 */
export async function getPatientPackageStatus(patientId: number): Promise<PackageStatusSummary> {
  // 통마 (활성 시술패키지 중 통증마일리지)
  const tongmaPackage = await queryOne<TreatmentPackage>(`
    SELECT * FROM cs_treatment_packages
    WHERE patient_id = ${patientId}
    AND ${TONGMA_MATCH_CONDITION}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 한약 선결
  const herbalPackage = await queryOne<HerbalPackage>(`
    SELECT * FROM cs_herbal_packages
    WHERE patient_id = ${patientId}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 녹용 선결
  const nokryongPackage = await queryOne<NokryongPackage>(`
    SELECT * FROM cs_nokryong_packages
    WHERE patient_id = ${patientId}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 멤버십
  const membership = await queryOne<Membership>(`
    SELECT * FROM cs_memberships
    WHERE patient_id = ${patientId}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return {
    tongma: tongmaPackage ? {
      active: true,
      totalCount: tongmaPackage.total_count,
      usedCount: tongmaPackage.used_count,
      remainingCount: tongmaPackage.remaining_count,
      expireDate: tongmaPackage.expire_date,
    } : null,

    herbal: herbalPackage ? {
      active: true,
      herbalName: herbalPackage.herbal_name,
      totalCount: herbalPackage.total_count,
      usedCount: herbalPackage.used_count,
      remainingCount: herbalPackage.remaining_count,
    } : null,

    nokryong: nokryongPackage ? {
      active: true,
      packageName: nokryongPackage.package_name,
      totalMonths: nokryongPackage.total_months,
      remainingMonths: nokryongPackage.remaining_months,
    } : null,

    membership: membership ? {
      active: true,
      membershipType: membership.membership_type,
      quantity: membership.quantity,
      expireDate: membership.expire_date,
    } : null,
  };
}

/**
 * 환자 패키지 현황 조회 (차트번호 기준)
 */
export async function getPatientPackageStatusByChartNumber(chartNumber: string): Promise<PackageStatusSummary> {
  // 통마
  const tongmaPackage = await queryOne<TreatmentPackage>(`
    SELECT * FROM cs_treatment_packages
    WHERE chart_number = ${escapeString(chartNumber)}
    AND ${TONGMA_MATCH_CONDITION}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 한약 선결
  const herbalPackage = await queryOne<HerbalPackage>(`
    SELECT * FROM cs_herbal_packages
    WHERE chart_number = ${escapeString(chartNumber)}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 녹용 선결
  const nokryongPackage = await queryOne<NokryongPackage>(`
    SELECT * FROM cs_nokryong_packages
    WHERE chart_number = ${escapeString(chartNumber)}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // 멤버십
  const membership = await queryOne<Membership>(`
    SELECT * FROM cs_memberships
    WHERE chart_number = ${escapeString(chartNumber)}
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return {
    tongma: tongmaPackage ? {
      active: true,
      totalCount: tongmaPackage.total_count,
      usedCount: tongmaPackage.used_count,
      remainingCount: tongmaPackage.remaining_count,
      startDate: tongmaPackage.start_date,
      expireDate: tongmaPackage.expire_date,
      packageName: tongmaPackage.package_name,
    } : null,

    herbal: herbalPackage ? {
      active: true,
      herbalName: herbalPackage.herbal_name,
      totalCount: herbalPackage.total_count,
      usedCount: herbalPackage.used_count,
      remainingCount: herbalPackage.remaining_count,
    } : null,

    nokryong: nokryongPackage ? {
      active: true,
      packageName: nokryongPackage.package_name,
      totalMonths: nokryongPackage.total_months,
      remainingMonths: nokryongPackage.remaining_months,
    } : null,

    membership: membership ? {
      active: true,
      membershipType: membership.membership_type,
      quantity: membership.quantity,
      startDate: membership.start_date,
      expireDate: membership.expire_date,
    } : null,
  };
}

// ============================================
// 통계 및 요약
// ============================================

/**
 * 환자 메모 통계 조회
 */
export async function getPatientNoteStats(patientId: number): Promise<{
  total: number;
  byType: Record<PatientNoteType, number>;
  activeComplaints: number;
}> {
  await ensurePatientNotesTable();

  const total = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM cs_patient_notes WHERE patient_id = ${patientId}
  `);

  const byTypeCounts = await query<{ note_type: PatientNoteType; count: number }>(`
    SELECT note_type, COUNT(*) as count
    FROM cs_patient_notes
    WHERE patient_id = ${patientId}
    GROUP BY note_type
  `);

  const activeComplaints = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM cs_patient_notes
    WHERE patient_id = ${patientId}
    AND note_type = 'complaint'
    AND status = 'active'
  `);

  const byType: Record<PatientNoteType, number> = {
    memo: 0,
    complaint: 0,
    inquiry: 0,
  };

  byTypeCounts.forEach(row => {
    byType[row.note_type] = Number(row.count);
  });

  return {
    total: Number(total?.count || 0),
    byType,
    activeComplaints: Number(activeComplaints?.count || 0),
  };
}

/**
 * 최근 메모 노트 조회
 */
export async function getRecentPatientNotes(
  patientId: number,
  limit: number = 5
): Promise<PatientNote[]> {
  await ensurePatientNotesTable();

  return query<PatientNote>(`
    SELECT * FROM cs_patient_notes
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
}

/**
 * 활성 컴플레인 조회
 */
export async function getActiveComplaints(patientId: number): Promise<PatientNote[]> {
  await ensurePatientNotesTable();

  return query<PatientNote>(`
    SELECT * FROM cs_patient_notes
    WHERE patient_id = ${patientId}
    AND note_type = 'complaint'
    AND status = 'active'
    ORDER BY created_at DESC
  `);
}
