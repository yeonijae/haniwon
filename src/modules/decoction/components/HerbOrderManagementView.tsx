import { useEffect, useState } from 'react';
import {
  applyHerbOrder,
  deleteHerbOrder,
  getHerbList,
  getHerbOrderDetails,
  getHerbOrders,
  replaceHerbOrderItems,
  rollbackHerbOrderApply,
  updateHerbOrderMeta,
} from '../lib/api';
import type { HerbMaster, HerbOrderDetail, HerbOrderItemDetail, HerbOrderStatus } from '../types';

const STATUS_OPTIONS: HerbOrderStatus[] = ['draft', 'ordered', 'partial_received', 'received', 'cancelled'];

export default function HerbOrderManagementView() {
  const [orders, setOrders] = useState<HerbOrderDetail[]>([]);
  const [herbs, setHerbs] = useState<HerbMaster[]>([]);

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function load() {
    const [headers, herbList] = await Promise.all([getHerbOrders(), getHerbList()]);
    const details = await Promise.all(headers.map((order) => getHerbOrderDetails(order.id)));
    setOrders(details.filter((item): item is HerbOrderDetail => !!item));
    setHerbs(herbList);
  }

  function patchOrder(orderId: number, updater: (order: HerbOrderDetail) => HerbOrderDetail) {
    setOrders((prev) => prev.map((item) => (item.id === orderId ? updater(item) : item)));
  }

  function patchOrderItem(orderId: number, itemId: number, updater: (item: HerbOrderItemDetail) => HerbOrderItemDetail) {
    patchOrder(orderId, (order) => ({
      ...order,
      items: order.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  }

  async function handleSave(order: HerbOrderDetail) {
    try {
      await updateHerbOrderMeta(order.id, {
        supplier: order.supplier || '',
        memo: order.memo || '',
        status: order.status,
      });
      await replaceHerbOrderItems(order.id, order.items.map((item) => ({ herbId: item.herb_id, quantity: Number(item.quantity || 0), price: Number(item.price || 0) })));
      await load();
      alert('저장되었습니다.');
    } catch (error) {
      console.error(error);
      alert('저장 실패');
    }
  }

  async function handleDelete(orderId: number) {
    if (!confirm('주문서를 삭제하시겠습니까?')) return;
    await deleteHerbOrder(orderId);
    await load();
  }

  async function handleApply(orderId: number) {
    await applyHerbOrder(orderId);
    await load();
  }

  async function handleRollback(orderId: number) {
    await rollbackHerbOrderApply(orderId);
    await load();
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <h2>🧾 주문서관리</h2>
      <section className="decoction-card">
        <h3>생성 주문서</h3>
        {orders.length === 0 ? <p className="decoction-empty">주문서가 없습니다.</p> : orders.map((order) => {
          const locked = !!order.is_applied;
          return (
            <div className="decoction-order-card" key={order.id}>
              <div className="decoction-order-head">
                <strong>주문 #{order.id}</strong>
                <span>{locked ? '반영완료' : '미반영'}</span>
                <div className="decoction-inline-actions">
                  {!locked ? <button className="decoction-btn mini" onClick={() => handleApply(order.id)}>반영</button> : <button className="decoction-btn mini ghost" onClick={() => handleRollback(order.id)}>미반영 롤백</button>}
                  {!locked && <button className="decoction-btn mini ghost" onClick={() => handleDelete(order.id)}>삭제</button>}
                </div>
              </div>

              <div className="decoction-form-grid">
                <input disabled={locked} value={order.supplier || ''} onChange={(e) => patchOrder(order.id, (target) => ({ ...target, supplier: e.target.value }))} placeholder="공급업체" />
                <input disabled={locked} value={order.memo || ''} onChange={(e) => patchOrder(order.id, (target) => ({ ...target, memo: e.target.value }))} placeholder="메모" />
                <select disabled={locked} value={order.status} onChange={(e) => patchOrder(order.id, (target) => ({ ...target, status: e.target.value as HerbOrderStatus }))}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>

              <table className="decoction-table compact">
                <thead><tr><th>약재</th><th>수량</th><th>단가</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <select
                          disabled={locked}
                          value={item.herb_id}
                          onChange={(e) => {
                            const nextId = Number(e.target.value);
                            patchOrderItem(order.id, item.id, (target) => ({
                              ...target,
                              herb_id: nextId,
                              herb_name: herbs.find((herb) => herb.id === nextId)?.name || target.herb_name,
                            }));
                          }}
                        >
                          {herbs.map((herb) => <option key={herb.id} value={herb.id}>{herb.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          disabled={locked}
                          value={item.quantity}
                          onChange={(e) => patchOrderItem(order.id, item.id, (target) => ({ ...target, quantity: Number(e.target.value || 0) }))}
                        />
                      </td>
                      <td>
                        <input
                          disabled={locked}
                          value={item.price}
                          onChange={(e) => patchOrderItem(order.id, item.id, (target) => ({ ...target, price: Number(e.target.value || 0) }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!locked && <button className="decoction-btn" onClick={() => handleSave(order)}>수정 저장</button>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
