import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getHerbDashboardRows } from '../lib/api';
import type { HerbDashboardRow } from '../types';
import HerbInventoryView from './HerbInventoryView';
import HerbOrderManagementView from './HerbOrderManagementView';
import HerbPriceManagementView from './HerbPriceManagementView';
import HerbUsageStatsView from './HerbUsageStatsView';

const CHUNK_SIZE = 23;

type HerbInnerTab = 'status' | 'manage' | 'orders' | 'usage' | 'prices';

function HerbStatusBoard() {
  const [rows, setRows] = useState<HerbDashboardRow[]>([]);

  useEffect(() => {
    getHerbDashboardRows()
      .then((data) => data.map((row) => ({
        ...row,
        shortage_qty: Number(row.shortage_qty || 0),
        recommended_order_qty: Number(row.recommended_order_qty || 0),
      })))
      .then(setRows)
      .catch(console.error);
  }, []);

  const displayRows = useMemo(
    () => rows
      .filter((row) => row.is_active)
      .sort((a, b) => String(a.herb_name || '').localeCompare(String(b.herb_name || ''), 'ko')),
    [rows]
  );

  const chunks = useMemo(() => {
    const arr: HerbDashboardRow[][] = [];
    for (let i = 0; i < displayRows.length; i += CHUNK_SIZE) arr.push(displayRows.slice(i, i + CHUNK_SIZE));
    return arr;
  }, [displayRows]);

  if (displayRows.length === 0) return <p className="decoction-empty">표시할 약재가 없습니다.</p>;

  return (
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
  );
}

const btnBase: CSSProperties = {
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#6b7280',
  borderRadius: 10,
  padding: '9px 4px',
  fontSize: 14,
  fontWeight: 500,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

export default function HerbDashboardView() {
  const [tab, setTab] = useState<HerbInnerTab>('status');

  function renderContent() {
    switch (tab) {
      case 'status':
        return <HerbStatusBoard />;
      case 'manage':
        return <HerbInventoryView />;
      case 'orders':
        return <HerbOrderManagementView />;
      case 'usage':
        return <HerbUsageStatsView />;
      case 'prices':
        return <HerbPriceManagementView />;
      default:
        return null;
    }
  }

  const active = (key: HerbInnerTab): CSSProperties => (
    tab === key ? { border: '1px solid #d1d5db', color: '#374151', fontWeight: 600, boxShadow: 'inset 0 0 0 1px #e5e7eb' } : {}
  );

  return (
    <div className="decoction-view decoction-herb-view" style={{ height: '100%' }}>
      <section className="decoction-card" style={{ paddingTop: 8, height: '100%' }}>
        <div style={{ display: 'flex', gap: 8, height: '100%' }}>
          <div style={{ width: 78, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button style={{ ...btnBase, ...active('status') }} onClick={() => setTab('status')}>
              <i className="fa-solid fa-table-list" style={{ fontSize: 16 }}></i>
              <span>현황</span>
            </button>
            <button style={{ ...btnBase, ...active('manage') }} onClick={() => setTab('manage')}>
              <i className="fa-solid fa-sliders" style={{ fontSize: 16 }}></i>
              <span>관리</span>
            </button>
            <button style={{ ...btnBase, ...active('orders') }} onClick={() => setTab('orders')}>
              <i className="fa-solid fa-file-invoice" style={{ fontSize: 16 }}></i>
              <span>주문서</span>
            </button>
            <button style={{ ...btnBase, ...active('usage') }} onClick={() => setTab('usage')}>
              <i className="fa-solid fa-chart-column" style={{ fontSize: 16 }}></i>
              <span>통계</span>
            </button>
            <button style={{ ...btnBase, ...active('prices') }} onClick={() => setTab('prices')}>
              <i className="fa-solid fa-won-sign" style={{ fontSize: 16 }}></i>
              <span>단가</span>
            </button>
          </div>

          <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'auto' }}>
            {renderContent()}
          </div>
        </div>
      </section>
    </div>
  );
}
