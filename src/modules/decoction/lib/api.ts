import { query, execute, insert, escapeString, isTableInitialized, markTableInitialized } from '@shared/lib/postgres';
import type { HerbMaster, DecoctionQueue, ReadyMedicine, PurchaseRequest, DecoctionCapacity } from '../types';

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

export async function getHerbList(): Promise<HerbMaster[]> {
  return query<HerbMaster>('SELECT * FROM herb_master ORDER BY name');
}

export async function getDecoctionQueue(): Promise<DecoctionQueue[]> {
  return query<DecoctionQueue>('SELECT * FROM decoction_queue ORDER BY priority DESC, created_at');
}

export async function getReadyMedicines(): Promise<ReadyMedicine[]> {
  return query<ReadyMedicine>('SELECT * FROM ready_medicines ORDER BY name');
}

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  return query<PurchaseRequest>('SELECT * FROM purchase_requests ORDER BY created_at DESC');
}

export async function getDecoctionCapacity(): Promise<DecoctionCapacity[]> {
  return query<DecoctionCapacity>('SELECT * FROM decoction_capacity ORDER BY date');
}

// === 탕전관리 큐 API ===

function esc(val: string): string {
  return val.replace(/'/g, "''");
}

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
