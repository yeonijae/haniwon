export interface HerbMaster {
  id: number;
  name: string;
  unit: string;
  category: string | null;
  current_stock: number;
  safety_stock: number;
  safety_stock_auto: boolean;
  created_at: string;
  updated_at: string;
}

export interface HerbPriceHistory {
  id: number;
  herb_id: number;
  price: number;
  supplier: string | null;
  effective_date: string;
  created_at: string;
}

export interface HerbOrder {
  id: number;
  order_date: string;
  supplier: string | null;
  status: string;
  memo: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HerbOrderItem {
  id: number;
  order_id: number;
  herb_id: number;
  quantity: number;
  price: number;
  received_qty: number | null;
}

export interface ReadyMedicine {
  id: number;
  name: string;
  category: string | null;
  recipe: Record<string, any> | null;
  current_stock: number;
  safety_stock: number;
  last_decoction_date: string | null;
  created_at: string;
}

export interface DecoctionQueue {
  id: number;
  source: string;
  source_id: number | null;
  patient_name: string | null;
  chart_number: string | null;
  prescription: Record<string, any> | null;
  status: string;
  assigned_date: string | null;
  assigned_slot: string | null;
  priority: number;
  delivery_method: string | null;
  shipping_date: string | null;
  memo: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DecoctionCapacity {
  id: number;
  date: string;
  staff_names: string[] | null;
  am_capacity: number | null;
  pm_capacity: number | null;
  is_holiday: boolean;
  memo: string | null;
}

export interface PurchaseRequest {
  id: number;
  title: string;
  content: string | null;
  category: string | null;
  status: string;
  requested_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface HerbStockLog {
  id: number;
  herb_id: number;
  change_qty: number;
  reason: string | null;
  reference_id: number | null;
  created_at: string;
}
