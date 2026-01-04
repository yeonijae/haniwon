/**
 * 구입 요청 API - SQLite 연결
 */

import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

export interface SupplyRequest {
  id: number;
  item_name: string;
  quantity?: string;
  requested_by: string;
  status: 'pending' | 'completed';
  note?: string;
  created_at: string;
  completed_at?: string;
}

export const suppliesApi = {
  getAll: async (): Promise<SupplyRequest[]> => {
    return await query<SupplyRequest>(`
      SELECT * FROM supply_requests
      ORDER BY created_at DESC
    `);
  },

  create: async (data: Partial<SupplyRequest>): Promise<SupplyRequest> => {
    const now = getCurrentTimestamp();
    const id = await insert(`
      INSERT INTO supply_requests (
        item_name, quantity, requested_by, status, note, created_at
      ) VALUES (
        ${escapeString(data.item_name || '')},
        ${data.quantity ? escapeString(data.quantity) : 'NULL'},
        ${escapeString(data.requested_by || '관리자')},
        'pending',
        ${data.note ? escapeString(data.note) : 'NULL'},
        ${escapeString(now)}
      )
    `);

    const result = await queryOne<SupplyRequest>(`SELECT * FROM supply_requests WHERE id = ${id}`);
    if (!result) throw new Error('구입 요청 생성 실패');
    return result;
  },

  update: async (id: number, data: Partial<SupplyRequest>): Promise<SupplyRequest> => {
    const updates: string[] = [];

    if (data.item_name !== undefined) updates.push(`item_name = ${escapeString(data.item_name)}`);
    if (data.quantity !== undefined) updates.push(`quantity = ${data.quantity ? escapeString(data.quantity) : 'NULL'}`);
    if (data.status !== undefined) updates.push(`status = ${escapeString(data.status)}`);
    if (data.note !== undefined) updates.push(`note = ${data.note ? escapeString(data.note) : 'NULL'}`);
    if (data.completed_at !== undefined) updates.push(`completed_at = ${data.completed_at ? escapeString(data.completed_at) : 'NULL'}`);

    if (updates.length > 0) {
      await execute(`UPDATE supply_requests SET ${updates.join(', ')} WHERE id = ${id}`);
    }

    const result = await queryOne<SupplyRequest>(`SELECT * FROM supply_requests WHERE id = ${id}`);
    if (!result) throw new Error('구입 요청을 찾을 수 없습니다');
    return result;
  },

  toggleComplete: async (id: number, currentStatus: string): Promise<SupplyRequest> => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    const completedAt = newStatus === 'completed' ? getCurrentTimestamp() : null;

    await execute(`
      UPDATE supply_requests
      SET status = ${escapeString(newStatus)},
          completed_at = ${completedAt ? escapeString(completedAt) : 'NULL'}
      WHERE id = ${id}
    `);

    const result = await queryOne<SupplyRequest>(`SELECT * FROM supply_requests WHERE id = ${id}`);
    if (!result) throw new Error('구입 요청을 찾을 수 없습니다');
    return result;
  },

  delete: async (id: number): Promise<void> => {
    await execute(`DELETE FROM supply_requests WHERE id = ${id}`);
  },

  getStats: async (): Promise<{ pending: number; completed: number }> => {
    const data = await query<{ status: string }>(`SELECT status FROM supply_requests`);

    const pending = data.filter(item => item.status === 'pending').length;
    const completed = data.filter(item => item.status === 'completed').length;

    return { pending, completed };
  }
};
