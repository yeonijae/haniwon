/**
 * 직원관리 API
 */

import { query, execute } from '@shared/lib/postgres';
import type {
  StaffMember,
  WorkPattern,
  WorkSchedule,
  SalaryInterview,
  LeaveRecord,
  ScheduleTemplate,
  ShiftType,
  EmployeeType,
  BatchScheduleChange,
  DoctorPermissions,
  Gender,
  ConsultationRoom
} from '../types';
import { DEFAULT_DOCTOR_PERMISSIONS } from '../types';

// MSSQL API URL
const MSSQL_API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// MSSQL 의료진 타입
export interface MssqlDoctor {
  id: string;
  name: string;
  color: string;
  resigned: boolean;
  isOther: boolean;
  workStartDate: string | null;
  workEndDate: string | null;
}

// 운영관리시스템 의료진 타입 (Settings.tsx와 동일)
export interface ManageMedicalStaffWorkPattern {
  id: string;
  days: boolean[]; // index 0 = Monday, ..., 6 = Sunday
  dayWorkHours: ({ startTime: string; endTime: string } | null)[];
  startDate: string;
  endDate: string;
}

export interface ManageMedicalStaff {
  id: number;
  name: string;
  dob: string;
  gender: 'male' | 'female';
  hireDate: string;
  fireDate?: string | null;
  status: 'working' | 'retired';
  permissions: {
    prescription: boolean;
    chart: boolean;
    payment: boolean;
    statistics: boolean;
  };
  workPatterns: ManageMedicalStaffWorkPattern[];
  consultationRoom?: string | null;
}

// =====================================================
// MSSQL 의료진 조회
// =====================================================

export async function fetchMssqlDoctors(): Promise<MssqlDoctor[]> {
  try {
    const response = await fetch(`${MSSQL_API_BASE_URL}/api/doctors`);
    if (!response.ok) {
      throw new Error(`MSSQL API 오류: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('MSSQL 의료진 조회 오류:', error);
    return [];
  }
}

export async function fetchActiveMssqlDoctors(): Promise<MssqlDoctor[]> {
  const doctors = await fetchMssqlDoctors();
  const filtered = doctors.filter(doc =>
    !doc.resigned &&
    !doc.isOther &&
    doc.name !== 'DOCTOR'
  );

  // 중복 제거 (id 기준)
  const uniqueMap = new Map<string, MssqlDoctor>();
  for (const doc of filtered) {
    if (!uniqueMap.has(doc.id)) {
      uniqueMap.set(doc.id, doc);
    }
  }
  return Array.from(uniqueMap.values());
}

// =====================================================
// 운영관리시스템 의료진 조회 (medical_staff 테이블)
// =====================================================

export async function fetchManageMedicalStaff(): Promise<ManageMedicalStaff[]> {
  const data = await query<any>(`SELECT * FROM medical_staff ORDER BY id ASC`);

  return (data || []).map((staff) => {
    let permissions = { prescription: true, chart: true, payment: true, statistics: true };
    let workPatterns: ManageMedicalStaffWorkPattern[] = [];

    try {
      const parsed = staff.permissions ? JSON.parse(staff.permissions) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        permissions = { ...permissions, ...parsed };
      }
    } catch {}

    try {
      workPatterns = staff.work_patterns ? JSON.parse(staff.work_patterns) : [];
    } catch {}

    return {
      id: staff.id,
      name: staff.name,
      dob: staff.dob || '',
      gender: staff.gender || 'male',
      hireDate: staff.hire_date || '',
      fireDate: staff.fire_date || null,
      status: staff.status || 'working',
      permissions,
      workPatterns,
      consultationRoom: staff.consultation_room || null,
    };
  });
}

// 특정 이름으로 운영관리시스템 의료진 찾기
export async function findManageMedicalStaffByName(name: string): Promise<ManageMedicalStaff | null> {
  const allStaff = await fetchManageMedicalStaff();
  return allStaff.find(s => s.name === name) || null;
}

// 운영관리시스템 의료진 근무패턴을 직원관리시스템 형식으로 변환
export function convertManagePatternToStaffPattern(
  staffId: number,
  pattern: ManageMedicalStaffWorkPattern
): Omit<WorkPattern, 'id' | 'created_at' | 'updated_at'> {
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const result: any = {
    staff_id: staffId,
    pattern_name: `운영관리에서 가져옴 (${pattern.startDate})`,
    start_date: pattern.startDate,
    end_date: pattern.endDate || undefined,
    memo: `[Imported from manage system: ${pattern.id}]`
  };

  // 요일별 시간 설정
  dayKeys.forEach((key, index) => {
    if (pattern.days[index] && pattern.dayWorkHours[index]) {
      result[`${key}_start`] = pattern.dayWorkHours[index]?.startTime;
      result[`${key}_end`] = pattern.dayWorkHours[index]?.endTime;
    }
  });

  return result;
}

// 운영관리시스템의 근무패턴을 직원관리시스템으로 가져오기
export async function importWorkPatternsFromManageSystem(
  staffId: number,
  doctorName: string
): Promise<{ imported: number; skipped: number }> {
  const manageStaff = await findManageMedicalStaffByName(doctorName);
  if (!manageStaff || !manageStaff.workPatterns || manageStaff.workPatterns.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  // 기존 패턴 조회 (중복 방지)
  const existingPatterns = await fetchWorkPatterns(staffId);
  const existingMemos = existingPatterns.map(p => p.memo).filter(Boolean);

  let imported = 0;
  let skipped = 0;

  for (const pattern of manageStaff.workPatterns) {
    // 이미 가져온 패턴인지 확인
    const importKey = `[Imported from manage system: ${pattern.id}]`;
    if (existingMemos.includes(importKey)) {
      skipped++;
      continue;
    }

    const convertedPattern = convertManagePatternToStaffPattern(staffId, pattern);
    await createWorkPattern(convertedPattern);
    imported++;
  }

  return { imported, skipped };
}

// MSSQL 의료진을 StaffMember 형태로 변환 (SQLite 미등록 상태)
export function convertMssqlDoctorToStaff(doc: MssqlDoctor, sqliteRecord?: StaffMember | null): StaffMember {
  // SQLite에 등록된 경우 해당 정보 사용
  if (sqliteRecord) {
    return {
      ...sqliteRecord,
      // MSSQL 정보로 동기화 (이름, 입사일, 퇴사일은 MSSQL 우선)
      name: doc.name,
      hire_date: doc.workStartDate ? doc.workStartDate.split('T')[0] : sqliteRecord.hire_date,
      resign_date: doc.workEndDate ? doc.workEndDate.split('T')[0] : sqliteRecord.resign_date,
      status: doc.resigned ? 'resigned' : 'active',
      isRegisteredInSqlite: true
    };
  }

  // SQLite에 미등록인 경우 MSSQL 정보만으로 구성
  return {
    id: 0, // SQLite에 없으므로 0
    employee_type: 'doctor',
    name: doc.name,
    status: doc.resigned ? 'resigned' : 'active',
    profile_color: doc.color || '#3B82F6',
    hire_date: doc.workStartDate ? doc.workStartDate.split('T')[0] : undefined,
    resign_date: doc.workEndDate ? doc.workEndDate.split('T')[0] : undefined,
    position: '원장',
    mssql_doctor_id: doc.id,
    isRegisteredInSqlite: false
  };
}

// =====================================================
// 의료진 동기화 (MSSQL + SQLite)
// =====================================================

// SQLite에서 의료진(doctor) 목록 조회
export async function fetchDoctorsFromSqlite(): Promise<StaffMember[]> {
  const data = await query<any>(`SELECT * FROM staff WHERE employee_type = 'doctor' ORDER BY name`);

  return (data || []).map((row) => ({
    ...row,
    permissions: row.permissions ? JSON.parse(row.permissions) : DEFAULT_DOCTOR_PERMISSIONS,
    isRegisteredInSqlite: true
  }));
}

// MSSQL 의료진 + SQLite 상태 병합
export async function fetchDoctorsWithSqliteStatus(): Promise<StaffMember[]> {
  // MSSQL에서 활성 의료진 목록
  const mssqlDoctors = await fetchActiveMssqlDoctors();

  // SQLite에서 의료진 목록
  const sqliteDoctors = await fetchDoctorsFromSqlite();

  // mssql_doctor_id로 매핑
  const sqliteByMssqlId = new Map<string, StaffMember>();
  for (const doc of sqliteDoctors) {
    if (doc.mssql_doctor_id) {
      sqliteByMssqlId.set(doc.mssql_doctor_id, doc);
    }
  }

  // 병합
  const result: StaffMember[] = [];

  for (const mssqlDoc of mssqlDoctors) {
    const sqliteRecord = sqliteByMssqlId.get(mssqlDoc.id);
    const merged = convertMssqlDoctorToStaff(mssqlDoc, sqliteRecord);

    // SQLite에 있고 MSSQL 정보가 변경된 경우 자동 동기화
    if (sqliteRecord && needsSync(mssqlDoc, sqliteRecord)) {
      await syncDoctorFromMssql(sqliteRecord.id, mssqlDoc);
      merged.name = mssqlDoc.name;
      merged.hire_date = mssqlDoc.workStartDate ? mssqlDoc.workStartDate.split('T')[0] : merged.hire_date;
      merged.resign_date = mssqlDoc.workEndDate ? mssqlDoc.workEndDate.split('T')[0] : merged.resign_date;
    }

    result.push(merged);
  }

  return result;
}

// MSSQL과 SQLite 간 동기화 필요 여부 확인
function needsSync(mssql: MssqlDoctor, sqlite: StaffMember): boolean {
  const mssqlHireDate = mssql.workStartDate ? mssql.workStartDate.split('T')[0] : null;
  const mssqlResignDate = mssql.workEndDate ? mssql.workEndDate.split('T')[0] : null;

  return (
    mssql.name !== sqlite.name ||
    mssqlHireDate !== (sqlite.hire_date || null) ||
    mssqlResignDate !== (sqlite.resign_date || null)
  );
}

// MSSQL 변경사항을 SQLite에 반영
export async function syncDoctorFromMssql(staffId: number, mssqlDoc: MssqlDoctor): Promise<void> {
  const updates: string[] = [
    `name = '${mssqlDoc.name.replace(/'/g, "''")}'`,
    `hire_date = ${mssqlDoc.workStartDate ? `'${mssqlDoc.workStartDate.split('T')[0]}'` : 'NULL'}`,
    `resign_date = ${mssqlDoc.workEndDate ? `'${mssqlDoc.workEndDate.split('T')[0]}'` : 'NULL'}`,
    `status = '${mssqlDoc.resigned ? 'resigned' : 'active'}'`,
    `updated_at = datetime('now')`
  ];

  await execute(`UPDATE staff SET ${updates.join(', ')} WHERE id = ${staffId}`);
  console.log(`[Sync] Doctor ${staffId} synced from MSSQL: ${mssqlDoc.name}`);
}

// MSSQL 정보 기반으로 SQLite에 의료진 레코드 생성
export async function createDoctorFromMssql(
  mssqlDoc: MssqlDoctor,
  additionalData?: Partial<StaffMember>
): Promise<number> {
  const name = mssqlDoc.name.replace(/'/g, "''");
  const hireDate = mssqlDoc.workStartDate ? mssqlDoc.workStartDate.split('T')[0] : null;
  const resignDate = mssqlDoc.workEndDate ? mssqlDoc.workEndDate.split('T')[0] : null;
  const status = mssqlDoc.resigned ? 'resigned' : 'active';
  const profileColor = additionalData?.profile_color || mssqlDoc.color || '#3B82F6';
  const permissions = JSON.stringify(additionalData?.permissions || DEFAULT_DOCTOR_PERMISSIONS);

  const sql = `
    INSERT INTO staff (
      employee_type, name, phone, email, position, hire_date, resign_date,
      status, profile_color, memo, mssql_doctor_id, dob, gender,
      consultation_room, permissions, alias
    ) VALUES (
      'doctor', '${name}', ${additionalData?.phone ? `'${additionalData.phone}'` : 'NULL'},
      ${additionalData?.email ? `'${additionalData.email}'` : 'NULL'}, '원장',
      ${hireDate ? `'${hireDate}'` : 'NULL'}, ${resignDate ? `'${resignDate}'` : 'NULL'},
      '${status}', '${profileColor}', NULL, '${mssqlDoc.id}',
      ${additionalData?.dob ? `'${additionalData.dob}'` : 'NULL'},
      ${additionalData?.gender ? `'${additionalData.gender}'` : 'NULL'},
      ${additionalData?.consultation_room ? `'${additionalData.consultation_room}'` : 'NULL'},
      '${permissions}',
      ${additionalData?.alias ? `'${additionalData.alias.replace(/'/g, "''")}'` : 'NULL'}
    )
  `;

  const result = await execute(sql);
  console.log(`[Create] Doctor created from MSSQL: ${name} (ID: ${result.lastInsertRowid})`);
  return result.lastInsertRowid || 0;
}

// =====================================================
// 운영관리시스템 데이터 마이그레이션
// =====================================================

export async function migrateMedicalStaffData(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let migrated = 0;
  let skipped = 0;

  try {
    // 1. 운영관리시스템의 medical_staff 데이터 조회
    const manageStaffList = await fetchManageMedicalStaff();
    if (manageStaffList.length === 0) {
      return { migrated: 0, skipped: 0, errors: ['운영관리시스템에 의료진 데이터가 없습니다.'] };
    }

    // 2. MSSQL 의료진 목록 (매칭용)
    const mssqlDoctors = await fetchMssqlDoctors();
    const mssqlByName = new Map<string, MssqlDoctor>();
    for (const doc of mssqlDoctors) {
      mssqlByName.set(doc.name, doc);
    }

    // 3. 기존 SQLite 의료진 확인
    const existingSqlite = await fetchDoctorsFromSqlite();
    const existingByMssqlId = new Map<string, StaffMember>();
    for (const doc of existingSqlite) {
      if (doc.mssql_doctor_id) {
        existingByMssqlId.set(doc.mssql_doctor_id, doc);
      }
    }

    // 4. 각 운영관리 의료진 마이그레이션
    for (const manageStaff of manageStaffList) {
      try {
        // MSSQL에서 매칭되는 의료진 찾기
        const mssqlDoc = mssqlByName.get(manageStaff.name);
        if (!mssqlDoc) {
          errors.push(`${manageStaff.name}: MSSQL에서 매칭되는 의료진을 찾을 수 없습니다.`);
          skipped++;
          continue;
        }

        // 이미 SQLite에 있는지 확인
        if (existingByMssqlId.has(mssqlDoc.id)) {
          console.log(`[Skip] ${manageStaff.name}: 이미 SQLite에 등록됨`);
          skipped++;
          continue;
        }

        // SQLite에 의료진 생성
        const newStaffId = await createDoctorFromMssql(mssqlDoc, {
          dob: manageStaff.dob || undefined,
          gender: manageStaff.gender as Gender,
          consultation_room: manageStaff.consultationRoom as ConsultationRoom || undefined,
          permissions: manageStaff.permissions,
          profile_color: mssqlDoc.color || '#3B82F6'
        });

        // 근무패턴 마이그레이션
        if (manageStaff.workPatterns && manageStaff.workPatterns.length > 0) {
          for (const pattern of manageStaff.workPatterns) {
            const convertedPattern = convertManagePatternToStaffPattern(newStaffId, pattern);
            await createWorkPattern(convertedPattern);
          }
          console.log(`[Migrate] ${manageStaff.name}: ${manageStaff.workPatterns.length}개 근무패턴 마이그레이션`);
        }

        migrated++;
        console.log(`[Migrate] ${manageStaff.name}: 마이그레이션 완료`);

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${manageStaff.name}: ${errMsg}`);
      }
    }

    return { migrated, skipped, errors };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { migrated, skipped, errors: [errMsg] };
  }
}

// =====================================================
// 직원 관리
// =====================================================

export async function fetchStaffList(type?: EmployeeType): Promise<StaffMember[]> {
  let sql = `SELECT * FROM staff WHERE status != 'resigned' ORDER BY employee_type, name`;
  if (type) {
    sql = `SELECT * FROM staff WHERE employee_type = '${type}' AND status != 'resigned' ORDER BY name`;
  }
  return await query<StaffMember>(sql);
}

export async function fetchAllStaff(): Promise<StaffMember[]> {
  return await query<StaffMember>(`SELECT * FROM staff ORDER BY employee_type, status, name`);
}

export async function fetchStaffById(id: number): Promise<StaffMember | null> {
  const results = await query<StaffMember>(`SELECT * FROM staff WHERE id = ${id}`);
  return results[0] || null;
}

export async function createStaff(data: Omit<StaffMember, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const sql = `
    INSERT INTO staff (employee_type, name, phone, email, position, work_part, dob, hire_date, resign_date, status, profile_color, memo)
    VALUES ('${data.employee_type}', '${data.name}', ${data.phone ? `'${data.phone}'` : 'NULL'},
            ${data.email ? `'${data.email}'` : 'NULL'}, ${data.position ? `'${data.position}'` : 'NULL'},
            ${data.work_part ? `'${data.work_part}'` : 'NULL'},
            ${data.dob ? `'${data.dob}'` : 'NULL'},
            ${data.hire_date ? `'${data.hire_date}'` : 'NULL'}, ${data.resign_date ? `'${data.resign_date}'` : 'NULL'},
            '${data.status}', '${data.profile_color}', ${data.memo ? `'${data.memo}'` : 'NULL'})
  `;
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

export async function updateStaff(id: number, data: Partial<StaffMember>): Promise<void> {
  const updates: string[] = [];
  if (data.name !== undefined) updates.push(`name = '${data.name}'`);
  if (data.phone !== undefined) updates.push(`phone = ${data.phone ? `'${data.phone}'` : 'NULL'}`);
  if (data.email !== undefined) updates.push(`email = ${data.email ? `'${data.email}'` : 'NULL'}`);
  if (data.position !== undefined) updates.push(`position = ${data.position ? `'${data.position}'` : 'NULL'}`);
  if (data.work_part !== undefined) updates.push(`work_part = ${data.work_part ? `'${data.work_part}'` : 'NULL'}`);
  if (data.dob !== undefined) updates.push(`dob = ${data.dob ? `'${data.dob}'` : 'NULL'}`);
  if (data.hire_date !== undefined) updates.push(`hire_date = ${data.hire_date ? `'${data.hire_date}'` : 'NULL'}`);
  if (data.resign_date !== undefined) updates.push(`resign_date = ${data.resign_date ? `'${data.resign_date}'` : 'NULL'}`);
  if (data.status !== undefined) updates.push(`status = '${data.status}'`);
  if (data.profile_color !== undefined) updates.push(`profile_color = '${data.profile_color}'`);
  if (data.memo !== undefined) updates.push(`memo = ${data.memo ? `'${data.memo}'` : 'NULL'}`);
  updates.push(`updated_at = datetime('now')`);

  if (updates.length > 0) {
    await execute(`UPDATE staff SET ${updates.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteStaff(id: number): Promise<void> {
  await execute(`DELETE FROM staff WHERE id = ${id}`);
}

// =====================================================
// 근무 패턴 (원장용)
// =====================================================

export async function fetchWorkPatterns(staffId: number): Promise<WorkPattern[]> {
  return await query<WorkPattern>(
    `SELECT * FROM work_patterns WHERE staff_id = ${staffId} ORDER BY start_date DESC`
  );
}

export async function createWorkPattern(data: Omit<WorkPattern, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const sql = `
    INSERT INTO work_patterns (
      staff_id, pattern_name, start_date, end_date,
      mon_start, mon_end, tue_start, tue_end, wed_start, wed_end,
      thu_start, thu_end, fri_start, fri_end, sat_start, sat_end,
      sun_start, sun_end, memo
    ) VALUES (
      ${data.staff_id}, ${data.pattern_name ? `'${data.pattern_name}'` : 'NULL'},
      '${data.start_date}', ${data.end_date ? `'${data.end_date}'` : 'NULL'},
      ${data.mon_start ? `'${data.mon_start}'` : 'NULL'}, ${data.mon_end ? `'${data.mon_end}'` : 'NULL'},
      ${data.tue_start ? `'${data.tue_start}'` : 'NULL'}, ${data.tue_end ? `'${data.tue_end}'` : 'NULL'},
      ${data.wed_start ? `'${data.wed_start}'` : 'NULL'}, ${data.wed_end ? `'${data.wed_end}'` : 'NULL'},
      ${data.thu_start ? `'${data.thu_start}'` : 'NULL'}, ${data.thu_end ? `'${data.thu_end}'` : 'NULL'},
      ${data.fri_start ? `'${data.fri_start}'` : 'NULL'}, ${data.fri_end ? `'${data.fri_end}'` : 'NULL'},
      ${data.sat_start ? `'${data.sat_start}'` : 'NULL'}, ${data.sat_end ? `'${data.sat_end}'` : 'NULL'},
      ${data.sun_start ? `'${data.sun_start}'` : 'NULL'}, ${data.sun_end ? `'${data.sun_end}'` : 'NULL'},
      ${data.memo ? `'${data.memo}'` : 'NULL'}
    )
  `;
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

export async function updateWorkPattern(id: number, data: Partial<WorkPattern>): Promise<void> {
  const updates: string[] = [];
  if (data.pattern_name !== undefined) updates.push(`pattern_name = ${data.pattern_name ? `'${data.pattern_name}'` : 'NULL'}`);
  if (data.start_date !== undefined) updates.push(`start_date = '${data.start_date}'`);
  if (data.end_date !== undefined) updates.push(`end_date = ${data.end_date ? `'${data.end_date}'` : 'NULL'}`);

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  for (const day of days) {
    const startKey = `${day}_start` as keyof WorkPattern;
    const endKey = `${day}_end` as keyof WorkPattern;
    if (data[startKey] !== undefined) updates.push(`${day}_start = ${data[startKey] ? `'${data[startKey]}'` : 'NULL'}`);
    if (data[endKey] !== undefined) updates.push(`${day}_end = ${data[endKey] ? `'${data[endKey]}'` : 'NULL'}`);
  }

  if (data.memo !== undefined) updates.push(`memo = ${data.memo ? `'${data.memo}'` : 'NULL'}`);
  updates.push(`updated_at = datetime('now')`);

  if (updates.length > 0) {
    await execute(`UPDATE work_patterns SET ${updates.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteWorkPattern(id: number): Promise<void> {
  await execute(`DELETE FROM work_patterns WHERE id = ${id}`);
}

// =====================================================
// 근무 일정 (직원용)
// =====================================================

export async function fetchMonthlySchedules(year: number, month: number, staffIds?: number[]): Promise<WorkSchedule[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  let sql = `
    SELECT * FROM work_schedules
    WHERE work_date >= '${startDate}' AND work_date <= '${endDate}'
  `;

  if (staffIds && staffIds.length > 0) {
    sql += ` AND staff_id IN (${staffIds.join(',')})`;
  }

  sql += ` ORDER BY staff_id, work_date`;

  return await query<WorkSchedule>(sql);
}

export async function fetchSchedulesByDateRange(startDate: string, endDate: string, staffId?: number): Promise<WorkSchedule[]> {
  let sql = `
    SELECT * FROM work_schedules
    WHERE work_date >= '${startDate}' AND work_date <= '${endDate}'
  `;

  if (staffId) {
    sql += ` AND staff_id = ${staffId}`;
  }

  sql += ` ORDER BY staff_id, work_date`;

  return await query<WorkSchedule>(sql);
}

export async function upsertSchedule(staffId: number, workDate: string, shiftType: ShiftType, memo?: string): Promise<void> {
  const sql = `
    INSERT INTO work_schedules (staff_id, work_date, shift_type, memo)
    VALUES (${staffId}, '${workDate}', '${shiftType}', ${memo ? `'${memo}'` : 'NULL'})
    ON CONFLICT(staff_id, work_date) DO UPDATE SET
      shift_type = '${shiftType}',
      memo = ${memo ? `'${memo}'` : 'NULL'},
      updated_at = datetime('now')
  `;
  await execute(sql);
}

export async function deleteSchedule(staffId: number, workDate: string): Promise<void> {
  await execute(`DELETE FROM work_schedules WHERE staff_id = ${staffId} AND work_date = '${workDate}'`);
}

export async function batchUpdateSchedules(changes: BatchScheduleChange[]): Promise<void> {
  for (const change of changes) {
    if (change.action === 'delete') {
      await deleteSchedule(change.staff_id, change.work_date);
    } else {
      await upsertSchedule(change.staff_id, change.work_date, change.shift_type);
    }
  }
}

// =====================================================
// 급여/면담 타임라인
// =====================================================

export async function fetchSalaryInterviews(staffId: number): Promise<SalaryInterview[]> {
  return await query<SalaryInterview>(
    `SELECT * FROM salary_interviews WHERE staff_id = ${staffId} ORDER BY event_date DESC`
  );
}

export async function createSalaryInterview(data: Omit<SalaryInterview, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const sql = `
    INSERT INTO salary_interviews (
      staff_id, event_type, event_date, salary_amount, salary_type, previous_amount,
      interview_type, interview_summary, title, description, attachments, created_by
    ) VALUES (
      ${data.staff_id}, '${data.event_type}', '${data.event_date}',
      ${data.salary_amount ?? 'NULL'}, ${data.salary_type ? `'${data.salary_type}'` : 'NULL'},
      ${data.previous_amount ?? 'NULL'}, ${data.interview_type ? `'${data.interview_type}'` : 'NULL'},
      ${data.interview_summary ? `'${data.interview_summary}'` : 'NULL'},
      ${data.title ? `'${data.title}'` : 'NULL'}, ${data.description ? `'${data.description}'` : 'NULL'},
      ${data.attachments ? `'${data.attachments}'` : 'NULL'}, ${data.created_by ? `'${data.created_by}'` : 'NULL'}
    )
  `;
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

export async function updateSalaryInterview(id: number, data: Partial<SalaryInterview>): Promise<void> {
  const updates: string[] = [];
  if (data.event_type !== undefined) updates.push(`event_type = '${data.event_type}'`);
  if (data.event_date !== undefined) updates.push(`event_date = '${data.event_date}'`);
  if (data.salary_amount !== undefined) updates.push(`salary_amount = ${data.salary_amount ?? 'NULL'}`);
  if (data.salary_type !== undefined) updates.push(`salary_type = ${data.salary_type ? `'${data.salary_type}'` : 'NULL'}`);
  if (data.previous_amount !== undefined) updates.push(`previous_amount = ${data.previous_amount ?? 'NULL'}`);
  if (data.interview_type !== undefined) updates.push(`interview_type = ${data.interview_type ? `'${data.interview_type}'` : 'NULL'}`);
  if (data.interview_summary !== undefined) updates.push(`interview_summary = ${data.interview_summary ? `'${data.interview_summary}'` : 'NULL'}`);
  if (data.title !== undefined) updates.push(`title = ${data.title ? `'${data.title}'` : 'NULL'}`);
  if (data.description !== undefined) updates.push(`description = ${data.description ? `'${data.description}'` : 'NULL'}`);
  updates.push(`updated_at = datetime('now')`);

  if (updates.length > 0) {
    await execute(`UPDATE salary_interviews SET ${updates.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteSalaryInterview(id: number): Promise<void> {
  await execute(`DELETE FROM salary_interviews WHERE id = ${id}`);
}

// =====================================================
// 휴가 관리
// =====================================================

export async function fetchLeaveRecords(staffId: number): Promise<LeaveRecord[]> {
  return await query<LeaveRecord>(
    `SELECT * FROM leave_records WHERE staff_id = ${staffId} ORDER BY start_date DESC`
  );
}

export async function fetchLeavesByDateRange(startDate: string, endDate: string): Promise<LeaveRecord[]> {
  return await query<LeaveRecord>(`
    SELECT * FROM leave_records
    WHERE start_date <= '${endDate}' AND end_date >= '${startDate}'
    ORDER BY start_date
  `);
}

export async function createLeaveRecord(data: Omit<LeaveRecord, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const sql = `
    INSERT INTO leave_records (
      staff_id, leave_type, start_date, end_date, days_count, reason, status, approved_by, approved_at, memo
    ) VALUES (
      ${data.staff_id}, '${data.leave_type}', '${data.start_date}', '${data.end_date}',
      ${data.days_count ?? 'NULL'}, ${data.reason ? `'${data.reason}'` : 'NULL'},
      '${data.status}', ${data.approved_by ? `'${data.approved_by}'` : 'NULL'},
      ${data.approved_at ? `'${data.approved_at}'` : 'NULL'}, ${data.memo ? `'${data.memo}'` : 'NULL'}
    )
  `;
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

export async function updateLeaveRecord(id: number, data: Partial<LeaveRecord>): Promise<void> {
  const updates: string[] = [];
  if (data.leave_type !== undefined) updates.push(`leave_type = '${data.leave_type}'`);
  if (data.start_date !== undefined) updates.push(`start_date = '${data.start_date}'`);
  if (data.end_date !== undefined) updates.push(`end_date = '${data.end_date}'`);
  if (data.days_count !== undefined) updates.push(`days_count = ${data.days_count ?? 'NULL'}`);
  if (data.reason !== undefined) updates.push(`reason = ${data.reason ? `'${data.reason}'` : 'NULL'}`);
  if (data.status !== undefined) updates.push(`status = '${data.status}'`);
  if (data.approved_by !== undefined) updates.push(`approved_by = ${data.approved_by ? `'${data.approved_by}'` : 'NULL'}`);
  if (data.approved_at !== undefined) updates.push(`approved_at = ${data.approved_at ? `'${data.approved_at}'` : 'NULL'}`);
  if (data.memo !== undefined) updates.push(`memo = ${data.memo ? `'${data.memo}'` : 'NULL'}`);
  updates.push(`updated_at = datetime('now')`);

  if (updates.length > 0) {
    await execute(`UPDATE leave_records SET ${updates.join(', ')} WHERE id = ${id}`);
  }
}

export async function deleteLeaveRecord(id: number): Promise<void> {
  await execute(`DELETE FROM leave_records WHERE id = ${id}`);
}

// =====================================================
// 스케줄 템플릿
// =====================================================

export async function fetchScheduleTemplates(): Promise<ScheduleTemplate[]> {
  return await query<ScheduleTemplate>(`SELECT * FROM schedule_templates ORDER BY is_default DESC, template_name`);
}

export async function createScheduleTemplate(data: Omit<ScheduleTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const sql = `
    INSERT INTO schedule_templates (
      template_name, description, mon_shift, tue_shift, wed_shift, thu_shift, fri_shift, sat_shift, sun_shift, is_default
    ) VALUES (
      '${data.template_name}', ${data.description ? `'${data.description}'` : 'NULL'},
      '${data.mon_shift}', '${data.tue_shift}', '${data.wed_shift}', '${data.thu_shift}',
      '${data.fri_shift}', '${data.sat_shift}', '${data.sun_shift}', ${data.is_default ? 1 : 0}
    )
  `;
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

export async function applyTemplateToStaff(
  staffId: number,
  template: ScheduleTemplate,
  startDate: string,
  endDate: string
): Promise<void> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dayShifts: ShiftType[] = [
    template.mon_shift,
    template.tue_shift,
    template.wed_shift,
    template.thu_shift,
    template.fri_shift,
    template.sat_shift,
    template.sun_shift
  ];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ...
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6
    const shiftType = dayShifts[adjustedDay];

    const dateStr = current.toISOString().split('T')[0];
    await upsertSchedule(staffId, dateStr, shiftType);

    current.setDate(current.getDate() + 1);
  }
}
