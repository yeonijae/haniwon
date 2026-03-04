import { useEffect, useMemo, useState } from 'react';
import { createHerbOrder, getHerbDashboardRows } from '../lib/api';
import type { HerbDashboardRow } from '../types';

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
    const normalized = data.map((row) => ({ ...row, shortage_qty: Number(row.shortage_qty || 0), recommended_order_qty: Number(row.recommended_order_qty || 0) }));
    setRows(normalized);
  }

  const lowStockRows = useMemo(
    () => rows.filter((row) => row.is_active && row.shortage_qty > 0),
    [rows]
  );

  async function handleCreateOrder() {
    const items = lowStockRows
      .filter((row) => selected[row.herb_id])
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
        <h3>재고가 넉넉하지 않은 약재</h3>
        {lowStockRows.length === 0 ? (
          <p className="decoction-empty">현재 부족 약재가 없습니다.</p>
        ) : (
          <table className="decoction-table">
            <thead>
              <tr>
                <th>선택</th>
                <th>약재명</th>
                <th>현재재고</th>
                <th>부족량</th>
                <th>추천주문수량</th>
              </tr>
            </thead>
            <tbody>
              {lowStockRows.map((row) => (
                <tr key={row.herb_id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[row.herb_id]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [row.herb_id]: e.target.checked }))}
                    />
                  </td>
                  <td>{row.herb_name}</td>
                  <td>{Number(row.current_stock || 0).toFixed(1)} {row.unit}</td>
                  <td className="decoction-shortage">{Number(row.shortage_qty || 0).toFixed(1)} {row.unit}</td>
                  <td>{Number(row.recommended_order_qty || 0).toFixed(1)} {row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
