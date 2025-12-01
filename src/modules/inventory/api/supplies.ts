/**
 * 구입 요청 API - Supabase 직접 연결
 */

import { supabase } from '@shared/lib/supabase';

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
    const { data, error } = await supabase
      .from('supply_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  create: async (data: Partial<SupplyRequest>): Promise<SupplyRequest> => {
    const { data: result, error } = await supabase
      .from('supply_requests')
      .insert({
        item_name: data.item_name,
        quantity: data.quantity,
        requested_by: data.requested_by || '관리자',
        status: 'pending',
        note: data.note,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  },

  update: async (id: number, data: Partial<SupplyRequest>): Promise<SupplyRequest> => {
    const { data: result, error } = await supabase
      .from('supply_requests')
      .update({
        item_name: data.item_name,
        quantity: data.quantity,
        status: data.status,
        note: data.note,
        completed_at: data.completed_at
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  },

  toggleComplete: async (id: number, currentStatus: string): Promise<SupplyRequest> => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    const { data: result, error } = await supabase
      .from('supply_requests')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('supply_requests')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  getStats: async (): Promise<{ pending: number; completed: number }> => {
    const { data, error } = await supabase
      .from('supply_requests')
      .select('status');

    if (error) throw new Error(error.message);

    const pending = data?.filter(item => item.status === 'pending').length || 0;
    const completed = data?.filter(item => item.status === 'completed').length || 0;

    return { pending, completed };
  }
};
