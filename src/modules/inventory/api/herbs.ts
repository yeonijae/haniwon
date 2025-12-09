/**
 * 한약재 API - SQLite 연결
 */

import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from '@shared/lib/sqlite';

export interface Herb {
  id: number;
  code: string;
  name: string;
  scientific_name?: string;
  origin?: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  unit_cost: number;
  selling_price: number;
  description?: string;
  storage_location?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const herbsApi = {
  getAll: async (params?: { search?: string; isActive?: boolean }): Promise<Herb[]> => {
    let sql = `SELECT * FROM herbs WHERE 1=1`;

    if (params?.search) {
      const searchEscaped = params.search.replace(/'/g, "''");
      sql += ` AND (name LIKE '%${searchEscaped}%' OR code LIKE '%${searchEscaped}%')`;
    }

    if (params?.isActive !== undefined) {
      sql += ` AND is_active = ${params.isActive ? 1 : 0}`;
    }

    sql += ` ORDER BY name ASC`;

    const data = await query<Herb>(sql);
    return data.map(h => ({ ...h, is_active: !!h.is_active }));
  },

  getById: async (id: number): Promise<Herb> => {
    const data = await queryOne<Herb>(`SELECT * FROM herbs WHERE id = ${id}`);
    if (!data) throw new Error('약재를 찾을 수 없습니다');
    return { ...data, is_active: !!data.is_active };
  },

  create: async (herbData: Partial<Herb>): Promise<Herb> => {
    const now = getCurrentTimestamp();
    const id = await insert(`
      INSERT INTO herbs (
        code, name, scientific_name, origin, unit, current_stock, min_stock, max_stock,
        unit_cost, selling_price, description, storage_location, is_active, created_at, updated_at
      ) VALUES (
        ${escapeString(herbData.code || '')},
        ${escapeString(herbData.name || '')},
        ${herbData.scientific_name ? escapeString(herbData.scientific_name) : 'NULL'},
        ${herbData.origin ? escapeString(herbData.origin) : 'NULL'},
        ${escapeString(herbData.unit || 'g')},
        ${herbData.current_stock || 0},
        ${herbData.min_stock || 0},
        ${herbData.max_stock !== undefined ? herbData.max_stock : 'NULL'},
        ${herbData.unit_cost || 0},
        ${herbData.selling_price || 0},
        ${herbData.description ? escapeString(herbData.description) : 'NULL'},
        ${herbData.storage_location ? escapeString(herbData.storage_location) : 'NULL'},
        ${herbData.is_active !== false ? 1 : 0},
        ${escapeString(now)},
        ${escapeString(now)}
      )
    `);

    return herbsApi.getById(id);
  },

  update: async (id: number, herbData: Partial<Herb>): Promise<Herb> => {
    const updates: string[] = [];

    if (herbData.code !== undefined) updates.push(`code = ${escapeString(herbData.code)}`);
    if (herbData.name !== undefined) updates.push(`name = ${escapeString(herbData.name)}`);
    if (herbData.scientific_name !== undefined) updates.push(`scientific_name = ${herbData.scientific_name ? escapeString(herbData.scientific_name) : 'NULL'}`);
    if (herbData.origin !== undefined) updates.push(`origin = ${herbData.origin ? escapeString(herbData.origin) : 'NULL'}`);
    if (herbData.unit !== undefined) updates.push(`unit = ${escapeString(herbData.unit)}`);
    if (herbData.current_stock !== undefined) updates.push(`current_stock = ${herbData.current_stock}`);
    if (herbData.min_stock !== undefined) updates.push(`min_stock = ${herbData.min_stock}`);
    if (herbData.max_stock !== undefined) updates.push(`max_stock = ${herbData.max_stock}`);
    if (herbData.unit_cost !== undefined) updates.push(`unit_cost = ${herbData.unit_cost}`);
    if (herbData.selling_price !== undefined) updates.push(`selling_price = ${herbData.selling_price}`);
    if (herbData.description !== undefined) updates.push(`description = ${herbData.description ? escapeString(herbData.description) : 'NULL'}`);
    if (herbData.storage_location !== undefined) updates.push(`storage_location = ${herbData.storage_location ? escapeString(herbData.storage_location) : 'NULL'}`);
    if (herbData.is_active !== undefined) updates.push(`is_active = ${herbData.is_active ? 1 : 0}`);

    updates.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

    await execute(`UPDATE herbs SET ${updates.join(', ')} WHERE id = ${id}`);
    return herbsApi.getById(id);
  },

  delete: async (id: number): Promise<void> => {
    await execute(`DELETE FROM herbs WHERE id = ${id}`);
  },

  stockIn: async (id: number, data: { quantity: number; unitCost?: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    const herb = await herbsApi.getById(id);
    const newStock = (herb.current_stock || 0) + data.quantity;

    const updates = [`current_stock = ${newStock}`, `updated_at = ${escapeString(getCurrentTimestamp())}`];
    if (data.unitCost !== undefined) {
      updates.push(`unit_cost = ${data.unitCost}`);
    }

    await execute(`UPDATE herbs SET ${updates.join(', ')} WHERE id = ${id}`);
    return herbsApi.getById(id);
  },

  stockOut: async (id: number, data: { quantity: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    const herb = await herbsApi.getById(id);
    const newStock = Math.max(0, (herb.current_stock || 0) - data.quantity);

    await execute(`
      UPDATE herbs
      SET current_stock = ${newStock}, updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${id}
    `);

    return herbsApi.getById(id);
  },

  stockAdjust: async (id: number, data: { newStock: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    await execute(`
      UPDATE herbs
      SET current_stock = ${data.newStock}, updated_at = ${escapeString(getCurrentTimestamp())}
      WHERE id = ${id}
    `);

    return herbsApi.getById(id);
  },

  getLowStock: async (): Promise<Herb[]> => {
    const allHerbs = await query<Herb>(`SELECT * FROM herbs WHERE is_active = 1`);
    const lowStockHerbs = allHerbs.filter(herb => herb.current_stock <= herb.min_stock);
    return lowStockHerbs.map(h => ({ ...h, is_active: !!h.is_active }));
  },

  getInventoryLogs: async (id: number, params?: { limit?: number; offset?: number }): Promise<any[]> => {
    try {
      let sql = `SELECT * FROM herb_inventory_logs WHERE herb_id = ${id} ORDER BY created_at DESC`;

      if (params?.limit) {
        sql += ` LIMIT ${params.limit}`;
      }

      if (params?.offset) {
        sql += ` OFFSET ${params.offset}`;
      }

      return await query(sql);
    } catch {
      return [];
    }
  },

  getPriceHistory: async (id: number, limit: number = 10): Promise<any[]> => {
    try {
      return await query(`
        SELECT * FROM herb_price_history
        WHERE herb_id = ${id}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
    } catch {
      return [];
    }
  }
};
