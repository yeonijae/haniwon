import { useEffect, useMemo, useState } from 'react';
import { getHerbDashboardRows } from '../lib/api';
import type { HerbDashboardRow } from '../types';

const CHUNK_SIZE = 23;

export default function HerbDashboardView() {
  const [rows, setRows] = useState<HerbDashboardRow[]>([]);

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
      .sort((a, b) => String(a.herb_name || '').localeCompare(String(b.herb_name || ''), 'ko')),
    [rows]
  );

  const chunks = useMemo(() => {
    const arr: HerbDashboardRow[][] = [];
    for (let i = 0; i < displayRows.length; i += CHUNK_SIZE) {
      arr.push(displayRows.slice(i, i + CHUNK_SIZE));
    }
    return arr;
  }, [displayRows]);

  return (
    <div className="decoction-view decoction-herb-view" style={{ height: '100%' }}>
      <section className="decoction-card" style={{ paddingTop: 8, height: '100%' }}>
        {displayRows.length === 0 ? (
          <p className="decoction-empty">표시할 약재가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 0, height: '100%' }}>
            {chunks.map((chunk, idx) => (
              <div
                key={`chunk-${idx}`}
                style={{ minWidth: 285, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', height: '100%', paddingLeft: 4 }}
              >
                <table className="decoction-table" style={{ marginBottom: 0, fontSize: 18 }}>
                  <tbody>
                    {chunk.map((row) => {
                      const shortage = Number(row.shortage_qty || 0) > 0;
                      return (
                        <tr key={row.herb_id} style={shortage ? { background: '#fff7ed' } : undefined}>
                          <td style={{ padding: '4px 1px', whiteSpace: 'nowrap' }}>{row.herb_name}</td>
                          <td style={{ padding: '4px 1px', whiteSpace: 'nowrap' }}>{Math.round(Number(row.current_stock || 0))}</td>
                          <td style={{ padding: '4px 1px', whiteSpace: 'nowrap', color: shortage ? '#c2410c' : '#374151', fontWeight: shortage ? 700 : 500 }}>
                            {Math.round(Number(row.recommended_order_qty || row.shortage_qty || 0))}
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
    </div>
  );
}
