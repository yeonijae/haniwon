/**
 * 처방전 API - SQLite 연결
 */

import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from '@shared/lib/sqlite';

// 처방 정의 (마스터 데이터)
export interface PrescriptionDefinition {
  id: number;
  name: string;
  alias?: string;
  category?: string;
  source?: string;
  composition: string; // "약재명:용량/약재명:용량/..." 형식
  created_at: string;
  created_by: string;
  is_active: boolean;
}

// 실제 발행된 처방전
export interface Prescription {
  id: number;
  prescription_definition_id?: number;
  patient_name?: string;
  prescription_name: string;
  composition: string;
  issued_date: string;
  issued_by: string;
  notes?: string;
  created_at: string;
}

export const prescriptionDefinitionsApi = {
  // 모든 처방 정의 조회
  getAll: async (params?: { isActive?: boolean }): Promise<PrescriptionDefinition[]> => {
    let sql = `SELECT * FROM prescription_definitions WHERE 1=1`;

    if (params?.isActive !== undefined) {
      sql += ` AND is_active = ${params.isActive ? 1 : 0}`;
    }

    sql += ` ORDER BY name ASC`;

    const data = await query<PrescriptionDefinition>(sql);
    return data.map(p => ({ ...p, is_active: !!p.is_active }));
  },

  // 최근 처방 정의 조회
  getRecent: async (limit: number = 15): Promise<PrescriptionDefinition[]> => {
    const data = await query<PrescriptionDefinition>(`
      SELECT * FROM prescription_definitions
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return data.map(p => ({ ...p, is_active: !!p.is_active }));
  },

  // 처방 정의 생성
  create: async (prescriptionData: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const now = getCurrentTimestamp();
    const id = await insert(`
      INSERT INTO prescription_definitions (
        name, alias, category, source, composition, created_by, is_active, created_at
      ) VALUES (
        ${escapeString(prescriptionData.name || '')},
        ${prescriptionData.alias ? escapeString(prescriptionData.alias) : 'NULL'},
        ${prescriptionData.category ? escapeString(prescriptionData.category) : 'NULL'},
        ${prescriptionData.source ? escapeString(prescriptionData.source) : 'NULL'},
        ${escapeString(prescriptionData.composition || '')},
        ${escapeString(prescriptionData.created_by || '관리자')},
        ${prescriptionData.is_active !== false ? 1 : 0},
        ${escapeString(now)}
      )
    `);

    const result = await queryOne<PrescriptionDefinition>(`SELECT * FROM prescription_definitions WHERE id = ${id}`);
    if (!result) throw new Error('처방 정의 생성 실패');
    return { ...result, is_active: !!result.is_active };
  },

  // 처방 정의 수정
  update: async (id: number, prescriptionData: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const updates: string[] = [];

    if (prescriptionData.name !== undefined) updates.push(`name = ${escapeString(prescriptionData.name)}`);
    if (prescriptionData.alias !== undefined) updates.push(`alias = ${prescriptionData.alias ? escapeString(prescriptionData.alias) : 'NULL'}`);
    if (prescriptionData.category !== undefined) updates.push(`category = ${prescriptionData.category ? escapeString(prescriptionData.category) : 'NULL'}`);
    if (prescriptionData.source !== undefined) updates.push(`source = ${prescriptionData.source ? escapeString(prescriptionData.source) : 'NULL'}`);
    if (prescriptionData.composition !== undefined) updates.push(`composition = ${escapeString(prescriptionData.composition)}`);
    if (prescriptionData.is_active !== undefined) updates.push(`is_active = ${prescriptionData.is_active ? 1 : 0}`);

    if (updates.length > 0) {
      await execute(`UPDATE prescription_definitions SET ${updates.join(', ')} WHERE id = ${id}`);
    }

    const result = await queryOne<PrescriptionDefinition>(`SELECT * FROM prescription_definitions WHERE id = ${id}`);
    if (!result) throw new Error('처방 정의를 찾을 수 없습니다');
    return { ...result, is_active: !!result.is_active };
  },

  // 처방 정의 삭제 (비활성화)
  delete: async (id: number): Promise<void> => {
    await execute(`UPDATE prescription_definitions SET is_active = 0 WHERE id = ${id}`);
  }
};

// 실제 발행된 처방전 API
export const prescriptionsApi = {
  // 모든 처방전 조회
  getAll: async (): Promise<Prescription[]> => {
    return await query<Prescription>(`
      SELECT * FROM prescriptions
      ORDER BY created_at DESC
    `);
  },

  // 최근 처방전 조회
  getRecent: async (limit: number = 15): Promise<Prescription[]> => {
    return await query<Prescription>(`
      SELECT * FROM prescriptions
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
  },

  // 처방전 발행
  create: async (prescriptionData: Partial<Prescription>): Promise<Prescription> => {
    const now = getCurrentTimestamp();
    const issuedDate = prescriptionData.issued_date || new Date().toISOString().split('T')[0];

    const id = await insert(`
      INSERT INTO prescriptions (
        prescription_definition_id, patient_name, prescription_name, composition,
        issued_date, issued_by, notes, created_at
      ) VALUES (
        ${prescriptionData.prescription_definition_id || 'NULL'},
        ${prescriptionData.patient_name ? escapeString(prescriptionData.patient_name) : 'NULL'},
        ${escapeString(prescriptionData.prescription_name || '')},
        ${escapeString(prescriptionData.composition || '')},
        ${escapeString(issuedDate)},
        ${escapeString(prescriptionData.issued_by || '관리자')},
        ${prescriptionData.notes ? escapeString(prescriptionData.notes) : 'NULL'},
        ${escapeString(now)}
      )
    `);

    const result = await queryOne<Prescription>(`SELECT * FROM prescriptions WHERE id = ${id}`);
    if (!result) throw new Error('처방전 발행 실패');
    return result;
  },

  // 처방전 수정
  update: async (id: number, prescriptionData: Partial<Prescription>): Promise<Prescription> => {
    const updates: string[] = [];

    if (prescriptionData.prescription_definition_id !== undefined) {
      updates.push(`prescription_definition_id = ${prescriptionData.prescription_definition_id || 'NULL'}`);
    }
    if (prescriptionData.patient_name !== undefined) {
      updates.push(`patient_name = ${prescriptionData.patient_name ? escapeString(prescriptionData.patient_name) : 'NULL'}`);
    }
    if (prescriptionData.prescription_name !== undefined) {
      updates.push(`prescription_name = ${escapeString(prescriptionData.prescription_name)}`);
    }
    if (prescriptionData.composition !== undefined) {
      updates.push(`composition = ${escapeString(prescriptionData.composition)}`);
    }
    if (prescriptionData.issued_date !== undefined) {
      updates.push(`issued_date = ${escapeString(prescriptionData.issued_date)}`);
    }
    if (prescriptionData.issued_by !== undefined) {
      updates.push(`issued_by = ${escapeString(prescriptionData.issued_by)}`);
    }
    if (prescriptionData.notes !== undefined) {
      updates.push(`notes = ${prescriptionData.notes ? escapeString(prescriptionData.notes) : 'NULL'}`);
    }

    if (updates.length > 0) {
      await execute(`UPDATE prescriptions SET ${updates.join(', ')} WHERE id = ${id}`);
    }

    const result = await queryOne<Prescription>(`SELECT * FROM prescriptions WHERE id = ${id}`);
    if (!result) throw new Error('처방전을 찾을 수 없습니다');
    return result;
  },

  // 처방전 삭제
  delete: async (id: number): Promise<void> => {
    await execute(`DELETE FROM prescriptions WHERE id = ${id}`);
  }
};
