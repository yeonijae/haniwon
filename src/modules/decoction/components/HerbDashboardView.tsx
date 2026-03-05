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
        <div style={{ display: 'flex', gap: 8, height: '100%' }}>
          <div style={{ width: 78, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button style={{ border: '1px solid #1e40af', background: '#1d4ed8', color: '#fff', borderRadius: 10, padding: '9px 4px', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-sliders"></i>
              <span>관리</span>
            </button>
            <button style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: 10, padding: '9px 4px', fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-file-invoice"></i>
              <span>주문서</span>
            </button>
            <button style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: 10, padding: '9px 4px', fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-chart-column"></i>
              <span>통계</span>
            </button>
            <button style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: 10, padding: '9px 4px', fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-won-sign"></i>
              <span>단가</span>
            </button>
          </div>

          {displayRows.length === 0 ? (
            <p className="decoction-empty">표시할 약재가 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 0, height: '100%', flex: 1 }}>
              {chunks.map((chunk, idx) => (
                <div
                  key={`chunk-${idx}`}
                  style={{ minWidth: 275, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', height: '100%', paddingLeft: 4 }}
                >
                  <table className="decoction-table" style={{ marginBottom: 0, fontSize: 16 }}>
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
        </div>
      </section>
    </div>
  );
}
