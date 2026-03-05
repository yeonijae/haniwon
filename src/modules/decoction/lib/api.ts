import { query, execute, insert, escapeString, isTableInitialized, markTableInitialized } from '@shared/lib/postgres';
import type {
  HerbMaster,
  HerbDashboardRow,
  HerbOrder,
  HerbOrderDetail,
  HerbOrderItem,
  DecoctionQueue,
  ReadyMedicine,
  PurchaseRequest,
  DecoctionCapacity,
  HerbOrderStatus,
  HerbUsageStatRow,
  DecoctionDashboardSummary,
} from '../types';

const INIT_KEY = 'decoction_tables';

export async function ensureDecoctionTables(): Promise<void> {
  if (isTableInitialized(INIT_KEY)) return;

  await execute(`
    CREATE TABLE IF NOT EXISTS herb_master (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT DEFAULT 'g',
      category TEXT,
      current_stock DECIMAL(10,2) DEFAULT 0,
      safety_stock DECIMAL(10,2) DEFAULT 0,
      safety_stock_auto BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`ALTER TABLE herb_master ADD COLUMN IF NOT EXISTS default_supplier TEXT`);
  await execute(`ALTER TABLE herb_master ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

  await execute(`
    CREATE TABLE IF NOT EXISTS herb_price_history (
      id SERIAL PRIMARY KEY,
      herb_id INT REFERENCES herb_master(id),
      price DECIMAL(10,2),
      supplier TEXT,
      effective_date DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS herb_orders (
      id SERIAL PRIMARY KEY,
      order_date DATE,
      supplier TEXT,
      status TEXT DEFAULT 'draft',
      memo TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`ALTER TABLE herb_orders ADD COLUMN IF NOT EXISTS expected_arrival_date DATE`);
  await execute(`ALTER TABLE herb_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ`);
  await execute(`ALTER TABLE herb_orders ADD COLUMN IF NOT EXISTS is_applied BOOLEAN DEFAULT false`);
  await execute(`ALTER TABLE herb_orders ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ`);

  await execute(`
    CREATE TABLE IF NOT EXISTS herb_order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES herb_orders(id),
      herb_id INT REFERENCES herb_master(id),
      quantity DECIMAL(10,2),
      price DECIMAL(10,2),
      received_qty DECIMAL(10,2)
    )
  `);

  // ⚠️ ready_medicines 테이블은 탕전실 전용 레거시 스키마.
  // 현재 상비약 탭 UI는 inventory 모듈의 cs_medicine_inventory를 사용함.
  // 이 테이블을 직접 참조하기 전에 데이터 소스 통합 여부를 먼저 확인할 것.
  await execute(`
    CREATE TABLE IF NOT EXISTS ready_medicines (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      recipe JSONB,
      current_stock INT DEFAULT 0,
      safety_stock INT DEFAULT 5,
      last_decoction_date DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS decoction_queue (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id INT,
      patient_name TEXT,
      chart_number TEXT,
      prescription JSONB,
      status TEXT DEFAULT 'waiting',
      assigned_date DATE,
      assigned_slot TEXT,
      priority INT DEFAULT 0,
      delivery_method TEXT,
      shipping_date DATE,
      memo TEXT,
      created_by TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS decoction_capacity (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      staff_names JSONB,
      am_capacity INT,
      pm_capacity INT,
      is_holiday BOOLEAN DEFAULT false,
      memo TEXT
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT,
      status TEXT DEFAULT 'pending',
      requested_by TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS herb_stock_log (
      id SERIAL PRIMARY KEY,
      herb_id INT REFERENCES herb_master(id),
      change_qty DECIMAL(10,2),
      reason TEXT,
      reference_id INT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  markTableInitialized(INIT_KEY);
}

function esc(val: string): string {
  return val.replace(/'/g, "''");
}

export async function getHerbList(): Promise<HerbMaster[]> {
  return query<HerbMaster>('SELECT * FROM herb_master ORDER BY name');
}

export async function getHerbDashboardRows(): Promise<HerbDashboardRow[]> {
  return query<HerbDashboardRow>(`
    SELECT
      h.id AS herb_id,
      h.name AS herb_name,
      COALESCE(h.unit, 'g') AS unit,
      COALESCE(h.current_stock, 0)::float AS current_stock,
      (
        COALESCE(h.current_stock, 0) +
        COALESCE((
          SELECT SUM(COALESCE(i.quantity, 0) - COALESCE(i.received_qty, 0))
          FROM herb_order_items i
          JOIN herb_orders o ON o.id = i.order_id
          WHERE i.herb_id = h.id
            AND o.status IN ('draft', 'ordered', 'partial_received')
        ), 0)
      )::float AS expected_stock,
      GREATEST(COALESCE(h.safety_stock, 0) - (
        COALESCE(h.current_stock, 0) +
        COALESCE((
          SELECT SUM(COALESCE(i.quantity, 0) - COALESCE(i.received_qty, 0))
          FROM herb_order_items i
          JOIN herb_orders o ON o.id = i.order_id
          WHERE i.herb_id = h.id
            AND o.status IN ('draft', 'ordered', 'partial_received')
        ), 0)
      ), 0)::float AS shortage_qty,
      GREATEST(COALESCE(h.safety_stock, 0) * 2 - (
        COALESCE(h.current_stock, 0) +
        COALESCE((
          SELECT SUM(COALESCE(i.quantity, 0) - COALESCE(i.received_qty, 0))
          FROM herb_order_items i
          JOIN herb_orders o ON o.id = i.order_id
          WHERE i.herb_id = h.id
            AND o.status IN ('draft', 'ordered', 'partial_received')
        ), 0)
      ), 0)::float AS recommended_order_qty,
      h.default_supplier,
      COALESCE(h.is_active, true) AS is_active
    FROM herb_master h
    ORDER BY h.name
  `);
}

export async function createHerb(input: {
  name: string;
  unit?: string;
  currentStock?: number;
  safetyStock?: number;
  defaultSupplier?: string;
  isActive?: boolean;
}): Promise<number> {
  return insert(`
    INSERT INTO herb_master (name, unit, current_stock, safety_stock, default_supplier, is_active, updated_at)
    VALUES (
      ${escapeString(input.name)},
      ${escapeString(input.unit || 'g')},
      ${input.currentStock ?? 0},
      ${input.safetyStock ?? 0},
      ${escapeString(input.defaultSupplier || null)},
      ${input.isActive === false ? 'false' : 'true'},
      now()
    )
  `);
}

export async function updateHerbMeta(
  herbId: number,
  input: { defaultSupplier?: string; isActive?: boolean; safetyStock?: number }
): Promise<void> {
  const updates: string[] = ['updated_at = now()'];

  if (input.defaultSupplier !== undefined) {
    updates.push(`default_supplier = ${escapeString(input.defaultSupplier || null)}`);
  }
  if (input.isActive !== undefined) {
    updates.push(`is_active = ${input.isActive ? 'true' : 'false'}`);
  }
  if (input.safetyStock !== undefined) {
    updates.push(`safety_stock = ${input.safetyStock}`);
  }

  await execute(`UPDATE herb_master SET ${updates.join(', ')} WHERE id = ${herbId}`);
}

export async function adjustHerbStock(
  herbId: number,
  qty: number,
  reason: string,
  referenceId?: number
): Promise<void> {
  await execute(`
    UPDATE herb_master
    SET current_stock = COALESCE(current_stock, 0) + (${qty}), updated_at = now()
    WHERE id = ${herbId}
  `);

  await execute(`
    INSERT INTO herb_stock_log (herb_id, change_qty, reason, reference_id)
    VALUES (${herbId}, ${qty}, ${escapeString(reason)}, ${referenceId ?? 'NULL'})
  `);
}

export async function getHerbOrders(): Promise<HerbOrder[]> {
  return query<HerbOrder>(`SELECT * FROM herb_orders ORDER BY created_at DESC`);
}

export async function getHerbOrderDetails(orderId: number): Promise<HerbOrderDetail | null> {
  const orders = await query<HerbOrder>(`SELECT * FROM herb_orders WHERE id = ${orderId}`);
  const order = orders[0];
  if (!order) return null;

  const items = await query<any>(`
    SELECT i.*, h.name AS herb_name, COALESCE(h.unit, 'g') AS unit
    FROM herb_order_items i
    JOIN herb_master h ON h.id = i.herb_id
    WHERE i.order_id = ${orderId}
    ORDER BY h.name
  `);

  return {
    ...order,
    items: items.map((item) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      received_qty: Number(item.received_qty || 0),
    })),
  };
}

export async function createHerbOrder(input: {
  supplier?: string;
  memo?: string;
  createdBy?: string;
  expectedArrivalDate?: string;
  items: Array<{ herbId: number; quantity: number; price?: number }>;
}): Promise<number> {
  const orderId = await insert(`
    INSERT INTO herb_orders (order_date, supplier, status, memo, created_by, expected_arrival_date)
    VALUES (
      CURRENT_DATE,
      ${escapeString(input.supplier || null)},
      'draft',
      ${escapeString(input.memo || null)},
      ${escapeString(input.createdBy || null)},
      ${escapeString(input.expectedArrivalDate || null)}
    )
  `);

  for (const item of input.items) {
    await insert(`
      INSERT INTO herb_order_items (order_id, herb_id, quantity, price, received_qty)
      VALUES (${orderId}, ${item.herbId}, ${item.quantity}, ${item.price ?? 0}, 0)
    `);
  }

  return orderId;
}

export async function updateHerbOrderStatus(orderId: number, status: HerbOrderStatus): Promise<void> {
  await execute(`UPDATE herb_orders SET status = '${esc(status)}' WHERE id = ${orderId}`);
}

export async function receiveHerbOrder(
  orderId: number,
  items: Array<{ itemId: number; receivedQty: number }>
): Promise<void> {
  for (const item of items) {
    await execute(`
      UPDATE herb_order_items
      SET received_qty = COALESCE(received_qty, 0) + ${item.receivedQty}
      WHERE id = ${item.itemId}
    `);

    const target = await query<HerbOrderItem>(`SELECT * FROM herb_order_items WHERE id = ${item.itemId}`);
    const row = target[0];
    if (row) {
      await adjustHerbStock(row.herb_id, item.receivedQty, '입고 처리', orderId);
    }
  }

  const summary = await query<{ total_qty: number; total_received: number }>(`
    SELECT
      COALESCE(SUM(COALESCE(quantity, 0)), 0)::float AS total_qty,
      COALESCE(SUM(COALESCE(received_qty, 0)), 0)::float AS total_received
    FROM herb_order_items
    WHERE order_id = ${orderId}
  `);

  const totalQty = Number(summary[0]?.total_qty || 0);
  const totalReceived = Number(summary[0]?.total_received || 0);
  const nextStatus: HerbOrderStatus = totalReceived >= totalQty ? 'received' : 'partial_received';

  await execute(`
    UPDATE herb_orders
    SET status = '${nextStatus}',
        received_at = CASE WHEN '${nextStatus}' = 'received' THEN now() ELSE received_at END
    WHERE id = ${orderId}
  `);
}

export async function updateHerbOrderMeta(orderId: number, input: { supplier?: string; memo?: string; status?: HerbOrderStatus }): Promise<void> {
  const updates: string[] = [];
  if (input.supplier !== undefined) updates.push(`supplier = ${escapeString(input.supplier || null)}`);
  if (input.memo !== undefined) updates.push(`memo = ${escapeString(input.memo || null)}`);
  if (input.status !== undefined) updates.push(`status = '${esc(input.status)}'`);
  if (updates.length === 0) return;
  await execute(`UPDATE herb_orders SET ${updates.join(', ')} WHERE id = ${orderId} AND COALESCE(is_applied, false) = false`);
}

export async function replaceHerbOrderItems(orderId: number, items: Array<{ herbId: number; quantity: number; price?: number }>): Promise<void> {
  await execute(`DELETE FROM herb_order_items WHERE order_id = ${orderId}`);
  for (const item of items) {
    await insert(`
      INSERT INTO herb_order_items (order_id, herb_id, quantity, price, received_qty)
      VALUES (${orderId}, ${item.herbId}, ${item.quantity}, ${item.price ?? 0}, 0)
    `);
  }
}

export async function deleteHerbOrder(orderId: number): Promise<void> {
  await execute(`DELETE FROM herb_order_items WHERE order_id = ${orderId}`);
  await execute(`DELETE FROM herb_orders WHERE id = ${orderId} AND COALESCE(is_applied, false) = false`);
}

export async function applyHerbOrder(orderId: number): Promise<void> {
  await execute(`UPDATE herb_orders SET is_applied = true, applied_at = now() WHERE id = ${orderId}`);
}

export async function rollbackHerbOrderApply(orderId: number): Promise<void> {
  await execute(`UPDATE herb_orders SET is_applied = false, applied_at = NULL WHERE id = ${orderId}`);
}

export async function createHerbPriceHistory(input: { herbId: number; price: number; supplier?: string; effectiveDate?: string }): Promise<number> {
  return insert(`
    INSERT INTO herb_price_history (herb_id, price, supplier, effective_date)
    VALUES (${input.herbId}, ${input.price}, ${escapeString(input.supplier || null)}, ${escapeString(input.effectiveDate || new Date().toISOString().slice(0, 10))})
  `);
}

export async function getHerbPriceTrend(herbId: number): Promise<Array<{ id: number; price: number; supplier: string | null; effective_date: string }>> {
  const rows = await query<any>(`SELECT id, price, supplier, effective_date FROM herb_price_history WHERE herb_id = ${herbId} ORDER BY effective_date DESC, id DESC LIMIT 20`);
  return rows.map((row) => ({
    ...row,
    price: Number(row.price || 0),
  }));
}

export async function getHerbUsageStats(startDate: string, endDate: string): Promise<HerbUsageStatRow[]> {
  return query<HerbUsageStatRow>(`
    SELECT
      h.id AS herb_id,
      h.name AS herb_name,
      COALESCE(h.unit, 'g') AS unit,
      COALESCE(SUM(CASE WHEN l.change_qty < 0 THEN -l.change_qty ELSE 0 END), 0)::float AS used_qty,
      COALESCE(SUM(CASE WHEN l.change_qty < 0 THEN (-l.change_qty) * COALESCE(p.price, 0) ELSE 0 END), 0)::float AS used_cost
    FROM herb_master h
    LEFT JOIN herb_stock_log l ON l.herb_id = h.id AND l.created_at::date BETWEEN '${esc(startDate)}' AND '${esc(endDate)}'
    LEFT JOIN LATERAL (
      SELECT ph.price
      FROM herb_price_history ph
      WHERE ph.herb_id = h.id
        AND ph.effective_date <= l.created_at::date
      ORDER BY ph.effective_date DESC, ph.id DESC
      LIMIT 1
    ) p ON true
    GROUP BY h.id, h.name, h.unit
    ORDER BY used_cost DESC, used_qty DESC, h.name
  `);
}

export async function getDecoctionQueue(): Promise<DecoctionQueue[]> {
  return query<DecoctionQueue>('SELECT * FROM decoction_queue ORDER BY priority DESC, created_at');
}

// ⚠️ 현재 UI 미사용 — 상비약 탭은 inventory 모듈의 getMedicineInventory()를 사용 중.
// 이 함수 호출 전 데이터 소스 통합 여부를 확인할 것.
export async function getReadyMedicines(): Promise<ReadyMedicine[]> {
  return query<ReadyMedicine>('SELECT * FROM ready_medicines ORDER BY name');
}

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  return query<PurchaseRequest>('SELECT * FROM purchase_requests ORDER BY created_at DESC');
}

export async function getDecoctionCapacity(): Promise<DecoctionCapacity[]> {
  return query<DecoctionCapacity>('SELECT * FROM decoction_capacity ORDER BY date');
}

export async function getDecoctionDashboardSummary(): Promise<DecoctionDashboardSummary> {
  const [waitingDraftRows, dosageRows, lowReadyRows, outboundPendingRows, outboundTodayRows, herbRows] = await Promise.all([
    query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt
      FROM cs_herbal_drafts d
      LEFT JOIN decoction_queue q ON q.source = 'draft' AND q.source_id = d.id
      WHERE q.id IS NULL
    `),
    query<{ cnt: string }>(`
      SELECT COUNT(DISTINCT d.id)::text AS cnt
      FROM cs_herbal_drafts d
      JOIN prescriptions p ON (p.herbal_draft_id = d.id OR d.prescription_id = p.id)
      LEFT JOIN decoction_queue q ON q.source = 'draft' AND q.source_id = d.id
      WHERE COALESCE(p.dosage_instruction_created, false) = false
        AND (q.id IS NULL OR q.status <> 'completed')
    `),
    query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt
      FROM cs_medicine_inventory
      WHERE is_active = true
        AND COALESCE(current_stock, 0) <= 0
    `),
    query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt
      FROM decoction_queue
      WHERE status = 'assigned'
    `),
    query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt
      FROM decoction_queue
      WHERE status = 'completed'
        AND completed_at::date = CURRENT_DATE
    `),
    getHerbDashboardRows(),
  ]);

  return {
    waitingDecoction: parseInt(waitingDraftRows[0]?.cnt || '0', 10),
    pendingDosage: parseInt(dosageRows[0]?.cnt || '0', 10),
    lowHerbCount: herbRows.filter((r) => r.is_active && Number(r.shortage_qty || 0) > 0).length,
    lowReadyMedicineCount: parseInt(lowReadyRows[0]?.cnt || '0', 10),
    outboundPending: parseInt(outboundPendingRows[0]?.cnt || '0', 10),
    outboundToday: parseInt(outboundTodayRows[0]?.cnt || '0', 10),
  };
}

// === 탕전관리 큐 API ===

/** 탕전 대기목록: herbal_drafts에서 아직 decoction_queue에 배정되지 않은 건 조회 */
export interface WaitingDraft {
  id: number;
  patient_id: number;
  patient_name: string | null;
  chart_number: string | null;
  consultation_type: string | null;
  delivery_method: string | null;
  shipping_date: string | null;
  memo: string | null;
  doctor: string | null;
  receipt_date: string | null;
  created_by: string | null;
  created_at: string;
}

export async function getWaitingDrafts(): Promise<WaitingDraft[]> {
  return query<WaitingDraft>(`
    SELECT d.id, d.patient_id, d.patient_name, d.chart_number, d.consultation_type,
           d.delivery_method, d.shipping_date, d.memo, d.doctor, d.receipt_date,
           d.created_by, d.created_at
    FROM cs_herbal_drafts d
    LEFT JOIN decoction_queue q ON q.source = 'draft' AND q.source_id = d.id
    WHERE q.id IS NULL
    ORDER BY d.created_at DESC
  `);
}

/** 대기 draft를 탕전 큐에 등록 (배정 시) */
export async function enqueueDraft(draftId: number, date: string, slot: string): Promise<number> {
  const drafts = await query<WaitingDraft>(
    `SELECT * FROM cs_herbal_drafts WHERE id = ${draftId}`
  );
  const d = drafts[0];
  if (!d) throw new Error('Draft not found');
  return insert(`
    INSERT INTO decoction_queue (source, source_id, patient_name, chart_number, delivery_method, shipping_date, memo, status, assigned_date, assigned_slot, created_by)
    VALUES ('draft', ${draftId}, ${escapeString(d.patient_name)}, ${escapeString(d.chart_number)}, ${escapeString(d.delivery_method)}, ${escapeString(d.shipping_date)}, ${escapeString(d.memo)}, 'assigned', '${esc(date)}', '${esc(slot)}', ${escapeString(d.created_by)})
  `);
}

export async function getQueueByStatus(status: string): Promise<DecoctionQueue[]> {
  return query<DecoctionQueue>(
    `SELECT * FROM decoction_queue WHERE status = '${esc(status)}' ORDER BY priority DESC, created_at`
  );
}

export async function getQueueByDate(date: string): Promise<DecoctionQueue[]> {
  return query<DecoctionQueue>(
    `SELECT * FROM decoction_queue WHERE assigned_date = '${esc(date)}' AND status = 'assigned' ORDER BY assigned_slot, priority DESC, created_at`
  );
}

export async function getCompletedByDate(date: string): Promise<DecoctionQueue[]> {
  return query<DecoctionQueue>(
    `SELECT * FROM decoction_queue WHERE assigned_date = '${esc(date)}' AND status = 'completed' ORDER BY completed_at DESC`
  );
}

export async function assignQueue(id: number, date: string, slot: string): Promise<void> {
  await execute(
    `UPDATE decoction_queue SET status = 'assigned', assigned_date = '${esc(date)}', assigned_slot = '${esc(slot)}' WHERE id = ${id}`
  );
}

export async function completeQueue(id: number): Promise<void> {
  await execute(
    `UPDATE decoction_queue SET status = 'completed', completed_at = now() WHERE id = ${id}`
  );
}

export async function revertToWaiting(id: number): Promise<void> {
  await execute(
    `UPDATE decoction_queue SET status = 'waiting', assigned_date = NULL, assigned_slot = NULL, completed_at = NULL WHERE id = ${id}`
  );
}

export async function getCapacityByDate(date: string): Promise<DecoctionCapacity | null> {
  const rows = await query<DecoctionCapacity>(
    `SELECT * FROM decoction_capacity WHERE date = '${esc(date)}'`
  );
  return rows[0] ?? null;
}

export async function getSlotCounts(date: string): Promise<{ am: number; pm: number }> {
  const rows = await query<{ slot: string; cnt: string }>(
    `SELECT assigned_slot as slot, COUNT(*)::text as cnt FROM decoction_queue WHERE assigned_date = '${esc(date)}' AND status = 'assigned' GROUP BY assigned_slot`
  );
  let am = 0, pm = 0;
  for (const r of rows) {
    if (r.slot === 'am') am = parseInt(r.cnt, 10);
    else if (r.slot === 'pm') pm = parseInt(r.cnt, 10);
    else { am += parseInt(r.cnt, 10); pm += parseInt(r.cnt, 10); }
  }
  return { am, pm };
}
