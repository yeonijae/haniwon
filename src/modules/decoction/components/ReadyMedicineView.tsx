import { useCallback, useEffect, useMemo, useState } from 'react';
import { query, getCurrentDate } from '@shared/lib/postgres';
import {
  getMedicineInventory,
  getMedicineDecoctions,
  updateMedicineInventory,
  type MedicineInventory,
  type MedicineDecoction,
} from '../../cs/lib/api';

type ReadyMenuKey = 'dashboard' | 'manage' | 'decoctions' | 'usages' | 'stats';

interface UsageRow {
  id: number;
  usage_date: string;
  medicine_name: string;
  quantity: number;
  patient_name: string | null;
  chart_number: string;
  doctor_nickname: string | null;
  category: string | null;
}

interface StatRow {
  key: string;
  total_quantity: number;
  usage_count: number;
}

const PAGE_SIZE = 30;

const MENUS: Array<{ key: ReadyMenuKey; label: string; icon: string }> = [
  { key: 'dashboard', label: '대시보드', icon: 'fa-solid fa-table-columns' },
  { key: 'manage', label: '관리', icon: 'fa-solid fa-screwdriver-wrench' },
  { key: 'decoctions', label: '탕전내역', icon: 'fa-solid fa-fire-burner' },
  { key: 'usages', label: '사용내역', icon: 'fa-solid fa-pills' },
  { key: 'stats', label: '통계', icon: 'fa-solid fa-chart-column' },
];

const esc = (value: string) => `'${value.replace(/'/g, "''")}'`;

function stockLane(item: MedicineInventory): '부족' | '주의' | '정상' {
  if (item.current_stock <= 5) return '부족';
  if (item.current_stock <= 20) return '주의';
  return '정상';
}

function StockKanban({
  items,
  editable,
  onSave,
}: {
  items: MedicineInventory[];
  editable?: boolean;
  onSave?: (id: number, currentStock: number, category: string) => Promise<void>;
}) {
  const groups = useMemo(() => {
    const map: Record<'부족' | '주의' | '정상', MedicineInventory[]> = { 부족: [], 주의: [], 정상: [] };
    items.forEach((item) => map[stockLane(item)].push(item));
    return map;
  }, [items]);

  const [editing, setEditing] = useState<Record<number, { stock: number; category: string }>>({});

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
      {(['부족', '주의', '정상'] as const).map((lane) => (
        <div key={lane} style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc', minHeight: 300 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
            {lane} ({groups[lane].length})
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groups[lane].map((item) => {
              const form = editing[item.id] || { stock: item.current_stock, category: item.category };
              return (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>최근 탕전일: {item.last_decoction_date || '-'}</div>
                  <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>누적재고: {item.total_stock}{item.unit}</div>
                  {!editable ? (
                    <div style={{ marginTop: 6, fontWeight: 600 }}>현재재고: {item.current_stock}{item.unit}</div>
                  ) : (
                    <>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 12, color: '#6b7280' }}>현재재고</label>
                        <input
                          type="number"
                          value={form.stock}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...form, stock: Number(e.target.value || 0) } }))}
                          style={{ width: 84, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6 }}
                        />
                        <span style={{ fontSize: 12 }}>{item.unit}</span>
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 12, color: '#6b7280' }}>분류</label>
                        <input
                          value={form.category}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...form, category: e.target.value } }))}
                          style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6 }}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onSave?.(item.id, form.stock, form.category)}
                          style={{ padding: '5px 10px', border: 0, background: '#2563eb', color: '#fff', borderRadius: 6, cursor: 'pointer' }}
                        >
                          저장
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReadyMedicineView() {
  const [menu, setMenu] = useState<ReadyMenuKey>('dashboard');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<MedicineInventory[]>([]);
  const [decoctions, setDecoctions] = useState<MedicineDecoction[]>([]);

  const [search, setSearch] = useState('');
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usagePage, setUsagePage] = useState(1);

  const [doctorStats, setDoctorStats] = useState<StatRow[]>([]);
  const [medicineStats, setMedicineStats] = useState<StatRow[]>([]);
  const [categoryStats, setCategoryStats] = useState<StatRow[]>([]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, dec] = await Promise.all([
        getMedicineInventory(true),
        getMedicineDecoctions(undefined, '2000-01-01', getCurrentDate()),
      ]);
      setInventory(inv);
      setDecoctions(dec);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsages = useCallback(async () => {
    const where = search
      ? `WHERE (u.medicine_name ILIKE ${esc(`%${search}%`)} OR u.patient_name ILIKE ${esc(`%${search}%`)} OR u.chart_number ILIKE ${esc(`%${search}%`)} OR COALESCE(u.doctor_nickname,'') ILIKE ${esc(`%${search}%`)})`
      : '';
    const offset = (usagePage - 1) * PAGE_SIZE;

    const [rows, countRows] = await Promise.all([
      query<UsageRow>(`
        SELECT u.id, u.usage_date, u.medicine_name, u.quantity, u.patient_name, u.chart_number,
               u.doctor_nickname, i.category
        FROM cs_medicine_usage u
        LEFT JOIN cs_medicine_inventory i ON i.id = u.inventory_id
        ${where}
        ORDER BY u.usage_date DESC, u.created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `),
      query<{ count: string }>(`SELECT COUNT(*)::text as count FROM cs_medicine_usage u ${where}`),
    ]);
    setUsageRows(rows);
    setUsageTotal(Number(countRows[0]?.count || 0));
  }, [search, usagePage]);

  const loadStats = useCallback(async () => {
    const [byDoctor, byMedicine, byCategory] = await Promise.all([
      query<StatRow>(`
        SELECT COALESCE(NULLIF(TRIM(doctor_nickname), ''), '미입력') as key,
               SUM(quantity)::int as total_quantity,
               COUNT(*)::int as usage_count
        FROM cs_medicine_usage
        GROUP BY 1
        ORDER BY total_quantity DESC
      `),
      query<StatRow>(`
        SELECT medicine_name as key,
               SUM(quantity)::int as total_quantity,
               COUNT(*)::int as usage_count
        FROM cs_medicine_usage
        GROUP BY medicine_name
        ORDER BY total_quantity DESC
      `),
      query<StatRow>(`
        SELECT COALESCE(i.category, '미분류') as key,
               SUM(u.quantity)::int as total_quantity,
               COUNT(*)::int as usage_count
        FROM cs_medicine_usage u
        LEFT JOIN cs_medicine_inventory i ON i.id = u.inventory_id
        GROUP BY 1
        ORDER BY total_quantity DESC
      `),
    ]);

    setDoctorStats(byDoctor);
    setMedicineStats(byMedicine);
    setCategoryStats(byCategory);
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (menu === 'usages') loadUsages();
    if (menu === 'stats') loadStats();
  }, [menu, loadUsages, loadStats]);

  const onSaveManage = async (id: number, currentStock: number, category: string) => {
    const item = inventory.find((v) => v.id === id);
    if (!item) return;
    await updateMedicineInventory(id, {
      name: item.name,
      alias: item.alias,
      category,
      unit: item.unit,
      doses_per_batch: item.doses_per_batch,
      packs_per_batch: item.packs_per_batch,
      memo: item.memo,
      current_stock: currentStock,
    } as any);
    await loadBase();
  };

  const totalUsagePages = Math.max(1, Math.ceil(usageTotal / PAGE_SIZE));

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      <aside style={{ width: 120, border: '1px solid #e5e7eb', borderRadius: 12, padding: 8, background: '#fff' }}>
        {MENUS.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setMenu(m.key);
              if (m.key === 'usages') setUsagePage(1);
            }}
            style={{
              width: '100%',
              border: 0,
              borderRadius: 10,
              padding: '10px 8px',
              marginBottom: 6,
              background: menu === m.key ? '#dbeafe' : 'transparent',
              color: menu === m.key ? '#1d4ed8' : '#334155',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <i className={m.icon} style={{ fontSize: 16 }} />
            {m.label}
          </button>
        ))}
      </aside>

      <section style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 12, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center' }}>로딩 중...</div>
        ) : menu === 'dashboard' ? (
          <StockKanban items={inventory} />
        ) : menu === 'manage' ? (
          <StockKanban items={inventory} editable onSave={onSaveManage} />
        ) : menu === 'decoctions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>탕전일</th>
                <th style={{ padding: 10, textAlign: 'left' }}>약이름</th>
                <th style={{ padding: 10, textAlign: 'center' }}>첩수</th>
                <th style={{ padding: 10, textAlign: 'center' }}>팩수</th>
                <th style={{ padding: 10, textAlign: 'left' }}>메모</th>
              </tr>
            </thead>
            <tbody>
              {decoctions.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: 10 }}>{d.decoction_date}</td>
                  <td style={{ padding: 10 }}>{d.medicine_name || '-'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{d.doses}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{d.packs}</td>
                  <td style={{ padding: 10 }}>{d.memo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : menu === 'usages' ? (
          <div>
            <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="약이름/환자/차트번호/담당의 검색"
                style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
              />
              <button
                onClick={() => {
                  setUsagePage(1);
                  loadUsages();
                }}
                style={{ padding: '8px 12px', border: 0, background: '#2563eb', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
              >
                검색
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 10, textAlign: 'left' }}>사용일</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>약이름</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>사용수량</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>환자(차트번호)</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>담당의 별명</th>
                </tr>
              </thead>
              <tbody>
                {usageRows.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid #eef2f7' }}>
                    <td style={{ padding: 10 }}>{u.usage_date}</td>
                    <td style={{ padding: 10 }}>{u.medicine_name}</td>
                    <td style={{ padding: 10, textAlign: 'center', fontWeight: 700 }}>{u.quantity}</td>
                    <td style={{ padding: 10 }}>{u.patient_name || '-'} ({u.chart_number})</td>
                    <td style={{ padding: 10 }}>{u.doctor_nickname || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>총 {usageTotal}건 (페이지당 30건)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={usagePage <= 1}
                  onClick={() => setUsagePage((p) => Math.max(1, p - 1))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
                >
                  이전
                </button>
                <span style={{ fontSize: 13, padding: '6px 4px' }}>{usagePage} / {totalUsagePages}</span>
                <button
                  disabled={usagePage >= totalUsagePages}
                  onClick={() => setUsagePage((p) => Math.min(totalUsagePages, p + 1))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <StatTable title="원장별 사용통계" rows={doctorStats} />
            <StatTable title="약이름별 사용통계" rows={medicineStats} />
            <StatTable title="약종류별 사용통계" rows={categoryStats} />
          </div>
        )}
      </section>
    </div>
  );
}

function StatTable({ title, rows }: { title: string; rows: StatRow[] }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', fontWeight: 700, background: '#f8fafc' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, textAlign: 'left' }}>항목</th>
            <th style={{ padding: 8, textAlign: 'center' }}>사용량 합계</th>
            <th style={{ padding: 8, textAlign: 'center' }}>사용건수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid #eef2f7' }}>
              <td style={{ padding: 8 }}>{r.key}</td>
              <td style={{ padding: 8, textAlign: 'center' }}>{r.total_quantity}</td>
              <td style={{ padding: 8, textAlign: 'center' }}>{r.usage_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
