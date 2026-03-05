import { useEffect, useMemo, useState } from 'react';
import { createHerbOrder, getHerbDashboardRows } from '../lib/api';
import type { HerbDashboardRow } from '../types';

const CHUNK_SIZE = 20;

export default function HerbDashboardView() {
  const [rows, setRows] = useState<HerbDashboardRow[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [supplier, setSupplier] = useState('');
  const [memo, setMemo] = useState('재고부족 자동 주문');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function load() {
    const data = await getHerbDashboardRows();
    const normalized = data.map((row) => ({
      ...row,
      shortage_qty: Number(row.shortage_qty || 0),
      recommended_order_qty: Number(row.recommended_order_qty || 0),
    }));
    setRows(normalized);
  }

  const displayRows = useMemo(
    () => rows
      .filter((row) => row.is_active)
      .sort((a, b) => {
        const aShort = Number(a.shortage_qty || 0) > 0 ? 1 : 0;
        const bShort = Number(b.shortage_qty || 0) > 0 ? 1 : 0;
        if (aShort !== bShort) return bShort - aShort;
        return String(a.herb_name || '').localeCompare(String(b.herb_name || ''), 'ko');
      }),
    [rows]
  );

  const chunks = useMemo(() => {
    const arr: HerbDashboardRow[][] = [];
    for (let i = 0; i < displayRows.length; i += CHUNK_SIZE) {
      arr.push(displayRows.slice(i, i + CHUNK_SIZE));
    }
    return arr;
  }, [displayRows]);

  async function handleCreateOrder() {
    const items = displayRows
      .filter((row) => Number(row.shortage_qty || 0) > 0 && selected[row.herb_id])
      .map((row) => ({ herbId: row.herb_id, quantity: Number(row.recommended_order_qty || row.shortage_qty || 0), price: 0 }))
      .filter((row) => row.quantity > 0);

    if (items.length === 0) {
      alert('주문할 약재를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      await createHerbOrder({ supplier, memo, items });
      alert('주문서를 생성했습니다. 주문서관리 탭에서 확인해주세요.');
      setSelected({});
      await load();
    } catch (error) {
      console.error(error);
      alert('주문서 생성 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <h2>📊 대시보드</h2>
      <section className="decoction-card">
        <h3>약재 전체 현황</h3>
        {displayRows.length === 0 ? (
          <p className="decoction-empty">표시할 약재가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {chunks.map((chunk, idx) => (
              <div
                key={`chunk-${idx}`}
                style={{ minWidth: 300, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
              >
                <div style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 12 }}>
                  목록 {idx + 1} ({chunk.length})
                </div>
                <table className="decoction-table" style={{ marginBottom: 0, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, padding: '6px 4px' }}>선</th>
                      <th style={{ padding: '6px 4px' }}>약재명</th>
                      <th style={{ padding: '6px 4px' }}>현재</th>
                      <th style={{ padding: '6px 4px' }}>예상</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((row) => {
                      const shortage = Number(row.shortage_qty || 0) > 0;
                      return (
                        <tr key={row.herb_id} style={shortage ? { background: '#fff7ed' } : undefined}>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="checkbox"
                              checked={!!selected[row.herb_id]}
                              onChange={(e) => setSelected((prev) => ({ ...prev, [row.herb_id]: e.target.checked }))}
                            />
                          </td>
                          <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>{row.herb_name}</td>
                          <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>{Number(row.current_stock || 0).toFixed(1)} {row.unit}</td>
                          <td style={{ padding: '4px', whiteSpace: 'nowrap', color: shortage ? '#c2410c' : '#374151', fontWeight: shortage ? 700 : 500 }}>
                            {Number(row.recommended_order_qty || row.shortage_qty || 0).toFixed(1)} {row.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="decoction-card">
        <h3>선택 항목으로 주문서 작성</h3>
        <div className="decoction-form-grid">
          <input placeholder="공급업체" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <input placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <button className="decoction-btn" disabled={saving} onClick={handleCreateOrder}>주문서 생성</button>
      </section>
    </div>
  );
}
