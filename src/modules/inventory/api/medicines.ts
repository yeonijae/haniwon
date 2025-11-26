/**
 * 기성약품 API - hani-api-server 통합
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface ReadyMedicine {
  id: number;
  code: string;
  name: string;
  manufacturer?: string;
  category?: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_cost: number;
  selling_price: number;
  expiry_date?: string;
  storage_location?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const medicinesApi = {
  getAll: async (params?: { search?: string; isActive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    const queryStr = query.toString();

    return fetchAPI<ReadyMedicine[]>(`/api/ready-medicines${queryStr ? `?${queryStr}` : ''}`);
  },

  getById: async (id: number) => {
    return fetchAPI<ReadyMedicine>(`/api/ready-medicines/${id}`);
  },

  create: async (data: Partial<ReadyMedicine>) => {
    return fetchAPI<ReadyMedicine>('/api/ready-medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: Partial<ReadyMedicine>) => {
    return fetchAPI<ReadyMedicine>(`/api/ready-medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return fetchAPI(`/api/ready-medicines/${id}`, { method: 'DELETE' });
  },

  stockIn: async (id: number, data: { quantity: number; unitCost?: number; reason?: string; note?: string; createdBy?: string }) => {
    return fetchAPI<ReadyMedicine>(`/api/ready-medicines/${id}/stock-in`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  stockOut: async (id: number, data: { quantity: number; reason?: string; note?: string; createdBy?: string }) => {
    return fetchAPI<ReadyMedicine>(`/api/ready-medicines/${id}/stock-out`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  stockAdjust: async (id: number, data: { newStock: number; reason?: string; note?: string; createdBy?: string }) => {
    return fetchAPI<ReadyMedicine>(`/api/ready-medicines/${id}/stock-adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getLowStock: async () => {
    return fetchAPI<ReadyMedicine[]>('/api/ready-medicines/low-stock');
  },

  getInventoryLogs: async (id: number, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();

    return fetchAPI<any[]>(`/api/ready-medicines/${id}/logs${queryStr ? `?${queryStr}` : ''}`);
  }
};
