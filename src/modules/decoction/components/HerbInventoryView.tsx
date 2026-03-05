import { useEffect, useMemo, useState } from 'react';
import {
  createHerb,
  createHerbOrder,
  getHerbDashboardRows,
  getHerbOrderDetails,
  getHerbOrders,
  receiveHerbOrder,
  updateHerbMeta,
  updateHerbOrderStatus,
  adjustHerbStock,
} from '../lib/api';
import type { HerbDashboardRow, HerbOrderDetail, HerbOrderStatus } from '../types';

interface NewHerbForm {
  name: string;
  unit: string;
  currentStock: string;
  safetyStock: string;
  defaultSupplier: string;
  isActive: boolean;
}

const ORDER_STATUS_LABELS: Record<HerbOrderStatus, string> = {
  draft: '임시저장',
  ordered: '발주완료',
  partial_received: '부분입고',
  received: '입고완료',
  cancelled: '취소',
};

export default function HerbInventoryView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardRows, setDashboardRows] = useState<HerbDashboardRow[]>([]);
  const [orders, setOrders] = useState<HerbOrderDetail[]>([]);

  const [newHerb, setNewHerb] = useState<NewHerbForm>({
    name: '',
    unit: 'g',
    currentStock: '0',
    safetyStock: '0',
    defaultSupplier: '',
    isActive: true,
  });

  const [newOrderSupplier, setNewOrderSupplier] = useState('');
  const [newOrderMemo, setNewOrderMemo] = useState('');
  const [newOrderRows, setNewOrderRows] = useState<Array<{ herbId: number; qty: string; price: string }>>([]);

  const [adjustHerbId, setAdjustHerbId] = useState<number | ''>('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('로스 반영');

  const herbOptions = useMemo(
    () => dashboardRows.filter((row) => row.is_active),
    [dashboardRows]
  );

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [rows, orderHeaders] = await Promise.all([getHerbDashboardRows(), getHerbOrders()]);
      const details = await Promise.all(orderHeaders.map((order) => getHerbOrderDetails(order.id)));
      setDashboardRows(rows.map(normalizeDashboard));
      setOrders(details.filter((item): item is HerbOrderDetail => !!item));
      if (newOrderRows.length === 0 && rows.length > 0) {
        setNewOrderRows([{ herbId: rows[0].herb_id, qty: '', price: '0' }]);
      }
    } finally {
      setLoading(false);
    }
  }

  function normalizeDashboard(row: HerbDashboardRow): HerbDashboardRow {
    return {
      ...row,
      current_stock: Number(row.current_stock || 0),
      expected_stock: Number(row.expected_stock || 0),
      shortage_qty: Number(row.shortage_qty || 0),
      recommended_order_qty: Number(row.recommended_order_qty || 0),
      is_active: !!row.is_active,
    };
  }

  async function handleCreateHerb() {
    if (!newHerb.name.trim()) {
      alert('약재명을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await createHerb({
        name: newHerb.name.trim(),
        unit: newHerb.unit || 'g',
        currentStock: Number(newHerb.currentStock || 0),
        safetyStock: Number(newHerb.safetyStock || 0),
        defaultSupplier: newHerb.defaultSupplier.trim(),
        isActive: newHerb.isActive,
      });
      setNewHerb({ name: '', unit: 'g', currentStock: '0', safetyStock: '0', defaultSupplier: '', isActive: true });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('약재 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(row: HerbDashboardRow, isActive: boolean) {
    try {
      await updateHerbMeta(row.herb_id, { isActive });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('미사용 플래그 변경 실패');
    }
  }

  async function handleChangeSupplier(row: HerbDashboardRow, supplier: string) {
    try {
      await updateHerbMeta(row.herb_id, { defaultSupplier: supplier });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('공급업체 저장 실패');
    }
  }

  async function handleAdjustStock() {
    if (!adjustHerbId) {
      alert('약재를 선택해주세요.');
      return;
    }
    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || qty === 0) {
      alert('조정 수량을 입력해주세요. (음수/양수 가능)');
      return;
    }

    setSaving(true);
    try {
      await adjustHerbStock(adjustHerbId, qty, adjustReason || '재고 조정');
      setAdjustQty('');
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('재고 조정 실패');
    } finally {
      setSaving(false);
    }
  }

  function addOrderRow() {
    const firstId = herbOptions[0]?.herb_id;
    if (!firstId) return;
    setNewOrderRows((prev) => [...prev, { herbId: firstId, qty: '', price: '0' }]);
  }

  async function handleCreateOrder() {
    const validItems = newOrderRows
      .map((row) => ({ herbId: row.herbId, quantity: Number(row.qty), price: Number(row.price || 0) }))
      .filter((row) => Number.isFinite(row.quantity) && row.quantity > 0);

    if (validItems.length === 0) {
      alert('주문 항목을 1개 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await createHerbOrder({
        supplier: newOrderSupplier,
        memo: newOrderMemo,
        items: validItems,
      });
      setNewOrderSupplier('');
      setNewOrderMemo('');
      setNewOrderRows([{ herbId: herbOptions[0]?.herb_id || 0, qty: '', price: '0' }]);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('주문서 생성 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleReceiveOrder(order: HerbOrderDetail) {
    const payload = order.items
      .map((item) => ({ itemId: item.id, receivedQty: Number(item.quantity || 0) - Number(item.received_qty || 0) }))
      .filter((item) => item.receivedQty > 0);

    if (payload.length === 0) {
      alert('입고할 잔량이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      await receiveHerbOrder(order.id, payload);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('입고 처리 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateOrderStatus(orderId: number, status: HerbOrderStatus) {
    try {
      await updateHerbOrderStatus(orderId, status);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('주문 상태 변경 실패');
    }
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <h2 style={{ fontSize: 22 }}>🌿 약재</h2>

      {loading ? (
        <div className="decoction-placeholder"><p>로딩 중...</p></div>
      ) : (
        <>
          <section className="decoction-card">
            <table className="decoction-table" style={{ fontSize: 15 }}>
              <thead>
                <tr>
                  <th>약재명</th>
                  <th>현재재고</th>
                  <th>예상재고</th>
                  <th>부족량</th>
                  <th>추천주문수량</th>
                  <th>공급업체</th>
                  <th>미사용</th>
                </tr>
              </thead>
              <tbody>
                {dashboardRows.map((row) => (
                  <tr key={row.herb_id} className={!row.is_active ? 'decoction-muted-row' : ''}>
                    <td>{row.herb_name}</td>
                    <td>{Math.round(row.current_stock)} {row.unit}</td>
                    <td>{Math.round(row.expected_stock)} {row.unit}</td>
                    <td className={row.shortage_qty > 0 ? 'decoction-shortage' : ''}>{Math.round(row.shortage_qty)} {row.unit}</td>
                    <td>{Math.round(row.recommended_order_qty)} {row.unit}</td>
                    <td>
                      <input
                        value={row.default_supplier || ''}
                        onChange={(e) => {
                          const supplier = e.target.value;
                          setDashboardRows((prev) => prev.map((item) => item.herb_id === row.herb_id ? { ...item, default_supplier: supplier } : item));
                        }}
                        onBlur={(e) => handleChangeSupplier(row, e.target.value)}
                        placeholder="업체명"
                      />
                    </td>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          checked={!row.is_active}
                          onChange={(e) => handleToggleActive(row, !e.target.checked)}
                        />
                        미사용
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="decoction-card">
            <h3 style={{ fontSize: 17 }}>약재 등록</h3>
            <div className="decoction-form-grid">
              <input placeholder="약재명" value={newHerb.name} onChange={(e) => setNewHerb((prev) => ({ ...prev, name: e.target.value }))} />
              <input placeholder="단위(g)" value={newHerb.unit} onChange={(e) => setNewHerb((prev) => ({ ...prev, unit: e.target.value }))} />
              <input placeholder="현재재고" value={newHerb.currentStock} onChange={(e) => setNewHerb((prev) => ({ ...prev, currentStock: e.target.value }))} />
              <input placeholder="안전재고" value={newHerb.safetyStock} onChange={(e) => setNewHerb((prev) => ({ ...prev, safetyStock: e.target.value }))} />
              <input placeholder="기본 공급업체" value={newHerb.defaultSupplier} onChange={(e) => setNewHerb((prev) => ({ ...prev, defaultSupplier: e.target.value }))} />
              <label className="decoction-check-inline">
                <input type="checkbox" checked={!newHerb.isActive} onChange={(e) => setNewHerb((prev) => ({ ...prev, isActive: !e.target.checked }))} />
                미사용으로 등록
              </label>
            </div>
            <button className="decoction-btn" disabled={saving} onClick={handleCreateHerb}>약재 등록</button>
          </section>

          <section className="decoction-card">
            <h3 style={{ fontSize: 17 }}>주문서 생성</h3>
            <div className="decoction-form-grid">
              <input placeholder="공급업체" value={newOrderSupplier} onChange={(e) => setNewOrderSupplier(e.target.value)} />
              <input placeholder="메모" value={newOrderMemo} onChange={(e) => setNewOrderMemo(e.target.value)} />
            </div>
            {newOrderRows.map((item, idx) => (
              <div className="decoction-order-row" key={`new-order-${idx}`}>
                <select
                  value={item.herbId}
                  onChange={(e) => {
                    const herbId = Number(e.target.value);
                    setNewOrderRows((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, herbId } : row));
                  }}
                >
                  {herbOptions.map((option) => (
                    <option key={option.herb_id} value={option.herb_id}>{option.herb_name}</option>
                  ))}
                </select>
                <input
                  placeholder="수량"
                  value={item.qty}
                  onChange={(e) => setNewOrderRows((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, qty: e.target.value } : row))}
                />
                <input
                  placeholder="단가"
                  value={item.price}
                  onChange={(e) => setNewOrderRows((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, price: e.target.value } : row))}
                />
              </div>
            ))}
            <div className="decoction-inline-actions">
              <button className="decoction-btn ghost" onClick={addOrderRow}>+ 항목 추가</button>
              <button className="decoction-btn" disabled={saving} onClick={handleCreateOrder}>주문서 생성</button>
            </div>
          </section>

          <section className="decoction-card">
            <h3 style={{ fontSize: 17 }}>주문서 관리</h3>
            {orders.length === 0 ? (
              <p className="decoction-empty">등록된 주문서가 없습니다.</p>
            ) : (
              orders.map((order) => (
                <div className="decoction-order-card" key={order.id}>
                  <div className="decoction-order-head">
                    <strong>주문 #{order.id}</strong>
                    <span>{order.supplier || '공급업체 미지정'}</span>
                    <span className="decoction-badge">{ORDER_STATUS_LABELS[order.status]}</span>
                    <button className="decoction-btn mini" onClick={() => handleReceiveOrder(order)}>전체 잔량 입고</button>
                    <select value={order.status} onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as HerbOrderStatus)}>
                      <option value="draft">임시저장</option>
                      <option value="ordered">발주완료</option>
                      <option value="partial_received">부분입고</option>
                      <option value="received">입고완료</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>
                  <table className="decoction-table compact">
                    <thead>
                      <tr>
                        <th>약재</th>
                        <th>주문수량</th>
                        <th>입고수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.herb_name}</td>
                          <td>{Math.round(Number(item.quantity))} {item.unit}</td>
                          <td>{Math.round(Number(item.received_qty || 0))} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </section>

          <section className="decoction-card">
            <h3 style={{ fontSize: 17 }}>재고 조정 (로스 반영)</h3>
            <div className="decoction-order-row">
              <select value={adjustHerbId} onChange={(e) => setAdjustHerbId(Number(e.target.value))}>
                <option value="">약재 선택</option>
                {herbOptions.map((option) => (
                  <option key={option.herb_id} value={option.herb_id}>{option.herb_name}</option>
                ))}
              </select>
              <input placeholder="조정 수량 (예: -50)" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              <input placeholder="사유" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              <button className="decoction-btn" disabled={saving} onClick={handleAdjustStock}>조정 반영</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
