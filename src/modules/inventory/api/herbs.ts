/**
 * 한약재 API - Supabase 직접 연결
 */

import { supabase } from '@shared/lib/supabase';

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
    let query = supabase
      .from('herbs')
      .select('*')
      .order('name', { ascending: true });

    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,code.ilike.%${params.search}%`);
    }

    if (params?.isActive !== undefined) {
      query = query.eq('is_active', params.isActive);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
  },

  getById: async (id: number): Promise<Herb> => {
    const { data, error } = await supabase
      .from('herbs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  create: async (herbData: Partial<Herb>): Promise<Herb> => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('herbs')
      .insert({
        code: herbData.code,
        name: herbData.name,
        scientific_name: herbData.scientific_name,
        origin: herbData.origin,
        unit: herbData.unit || 'g',
        current_stock: herbData.current_stock || 0,
        min_stock: herbData.min_stock || 0,
        max_stock: herbData.max_stock,
        unit_cost: herbData.unit_cost || 0,
        selling_price: herbData.selling_price || 0,
        description: herbData.description,
        storage_location: herbData.storage_location,
        is_active: herbData.is_active !== undefined ? herbData.is_active : true,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: number, herbData: Partial<Herb>): Promise<Herb> => {
    const { data, error } = await supabase
      .from('herbs')
      .update({
        code: herbData.code,
        name: herbData.name,
        scientific_name: herbData.scientific_name,
        origin: herbData.origin,
        unit: herbData.unit,
        current_stock: herbData.current_stock,
        min_stock: herbData.min_stock,
        max_stock: herbData.max_stock,
        unit_cost: herbData.unit_cost,
        selling_price: herbData.selling_price,
        description: herbData.description,
        storage_location: herbData.storage_location,
        is_active: herbData.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('herbs')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  stockIn: async (id: number, data: { quantity: number; unitCost?: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    // 현재 재고 조회
    const { data: herb, error: fetchError } = await supabase
      .from('herbs')
      .select('current_stock')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const newStock = (herb.current_stock || 0) + data.quantity;

    // 재고 업데이트
    const updateData: any = {
      current_stock: newStock,
      updated_at: new Date().toISOString()
    };

    if (data.unitCost !== undefined) {
      updateData.unit_cost = data.unitCost;
    }

    const { data: updated, error: updateError } = await supabase
      .from('herbs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return updated;
  },

  stockOut: async (id: number, data: { quantity: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    // 현재 재고 조회
    const { data: herb, error: fetchError } = await supabase
      .from('herbs')
      .select('current_stock')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const newStock = Math.max(0, (herb.current_stock || 0) - data.quantity);

    // 재고 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('herbs')
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return updated;
  },

  stockAdjust: async (id: number, data: { newStock: number; reason?: string; note?: string; createdBy?: string }): Promise<Herb> => {
    const { data: updated, error } = await supabase
      .from('herbs')
      .update({
        current_stock: data.newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  },

  getLowStock: async (): Promise<Herb[]> => {
    const { data, error } = await supabase
      .from('herbs')
      .select('*')
      .eq('is_active', true)
      .filter('current_stock', 'lte', supabase.rpc('get_min_stock'))
      .order('current_stock', { ascending: true });

    // 간단한 방식으로 변경 - 모든 활성 약재 조회 후 필터링
    const { data: allHerbs, error: allError } = await supabase
      .from('herbs')
      .select('*')
      .eq('is_active', true);

    if (allError) throw new Error(allError.message);

    const lowStockHerbs = (allHerbs || []).filter(herb => herb.current_stock <= herb.min_stock);
    return lowStockHerbs;
  },

  getInventoryLogs: async (id: number, params?: { limit?: number; offset?: number }): Promise<any[]> => {
    // 재고 로그 테이블이 있다면 조회, 없으면 빈 배열 반환
    try {
      let query = supabase
        .from('herb_inventory_logs')
        .select('*')
        .eq('herb_id', id)
        .order('created_at', { ascending: false });

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('herb_inventory_logs 테이블이 없거나 접근 불가:', error.message);
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  },

  getPriceHistory: async (id: number, limit: number = 10): Promise<any[]> => {
    // 가격 이력 테이블이 있다면 조회, 없으면 빈 배열 반환
    try {
      const { data, error } = await supabase
        .from('herb_price_history')
        .select('*')
        .eq('herb_id', id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('herb_price_history 테이블이 없거나 접근 불가:', error.message);
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  }
};
