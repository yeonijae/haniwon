import { useEffect, useMemo, useState } from 'react';
import {
  createHerb,
  getHerbDashboardRows,
  updateHerbMeta,
  adjustHerbStock,
} from '../lib/api';
import type { HerbDashboardRow } from '../types';

interface NewHerbForm {
  name: string;
  unit: string;
  currentStock: string;
  safetyStock: string;
  defaultSupplier: string;
  isActive: boolean;
}

export default function HerbInventoryView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardRows, setDashboardRows] = useState<HerbDashboardRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<HerbDashboardRow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newHerb, setNewHerb] = useState<NewHerbForm>({
    name: '',
    unit: 'g',
    currentStock: '0',
    safetyStock: '0',
    defaultSupplier: '',
    isActive: true,
  });

  const dashboardColumns = useMemo(() => {
    const chunkSize = Math.ceil(dashboardRows.length / 5) || 1;
    return Array.from({ length: 5 }, (_, idx) => dashboardRows.slice(idx * chunkSize, (idx + 1) * chunkSize));
  }, [dashboardRows]);

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const rows = await getHerbDashboardRows();
      const normalizedRows = rows.map(normalizeDashboard);
      setDashboardRows(normalizedRows);
      setBaselineRows(normalizedRows);
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
      setShowCreateModal(false);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('약재 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveManageChanges() {
    const baselineMap = new Map(baselineRows.map((r) => [r.herb_id, r]));
    const changedRows = dashboardRows.filter((row) => {
      const prev = baselineMap.get(row.herb_id);
      if (!prev) return false;
      return (
        Number(prev.current_stock || 0) !== Number(row.current_stock || 0) ||
        (prev.default_supplier || '') !== (row.default_supplier || '') ||
        !!prev.is_active !== !!row.is_active
      );
    });

    if (changedRows.length === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      for (const row of changedRows) {
        const prev = baselineMap.get(row.herb_id);
        if (!prev) continue;

        const prevStock = Number(prev.current_stock || 0);
        const nextStock = Number(row.current_stock || 0);
        const diff = nextStock - prevStock;

        if (diff !== 0) {
          await adjustHerbStock(row.herb_id, diff, '관리 화면 일괄 수정');
        }

        if ((prev.default_supplier || '') !== (row.default_supplier || '') || !!prev.is_active !== !!row.is_active) {
          await updateHerbMeta(row.herb_id, {
            defaultSupplier: row.default_supplier || '',
            isActive: !!row.is_active,
          });
        }
      }

      alert(`${changedRows.length}개 항목을 저장했습니다.`);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('일괄 저장 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 22, marginBottom: 0 }}>🌿 약재관리</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="decoction-btn" style={{ fontSize: 16 }} onClick={() => setShowCreateModal(true)}>약재등록</button>
          <button className="decoction-btn" style={{ fontSize: 16 }} disabled={saving} onClick={handleSaveManageChanges}>일괄저장</button>
        </div>
      </div>

      {loading ? (
        <div className="decoction-placeholder"><p>로딩 중...</p></div>
      ) : (
        <section className="decoction-card" style={{ border: 'none' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {dashboardColumns.map((columnRows, colIdx) => (
              <div key={`col-${colIdx}`} style={{ minWidth: 333, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
                <table className="decoction-table" style={{ fontSize: 17 }}>
                  <thead>
                    <tr>
                      <th>약재명</th>
                      <th>현재재고</th>
                      <th>공급업체</th>
                      <th>사용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnRows.map((row) => (
                      <tr key={row.herb_id} className={!row.is_active ? 'decoction-muted-row' : ''}>
                        <td>{row.herb_name}</td>
                        <td>
                          <input
                            value={Math.round(Number(row.current_stock || 0))}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              const stock = Number.isFinite(n) ? n : 0;
                              setDashboardRows((prev) => prev.map((item) => item.herb_id === row.herb_id ? { ...item, current_stock: stock } : item));
                            }}
                            style={{ width: 78, fontSize: 18 }}
                          />
                        </td>
                        <td>
                          <input
                            value={row.default_supplier || ''}
                            onChange={(e) => {
                              const supplier = e.target.value;
                              setDashboardRows((prev) => prev.map((item) => item.herb_id === row.herb_id ? { ...item, default_supplier: supplier } : item));
                            }}
                            placeholder="업체명"
                            style={{ width: 60, fontSize: 18 }}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!row.is_active}
                            onChange={(e) => setDashboardRows((prev) => prev.map((item) => item.herb_id === row.herb_id ? { ...item, is_active: e.target.checked } : item))}
                            style={{ transform: 'scale(1.5)', accentColor: '#d1d5db' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/45 flex items-center justify-center p-4">
          <div className="w-[560px] max-w-[92vw] bg-white rounded-xl border border-slate-200 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 text-lg font-semibold text-slate-800">약재 등록</h3>
              <button className="decoction-btn decoction-btn-ghost" onClick={() => setShowCreateModal(false)}>닫기</button>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 items-center">
              <label className="text-sm text-slate-700">약재명</label>
              <input className="h-9 px-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" value={newHerb.name} onChange={(e) => setNewHerb((prev) => ({ ...prev, name: e.target.value }))} />

              <label className="text-sm text-slate-700">단위</label>
              <input className="h-9 px-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" value={newHerb.unit} onChange={(e) => setNewHerb((prev) => ({ ...prev, unit: e.target.value }))} />

              <label className="text-sm text-slate-700">현재재고</label>
              <input className="h-9 px-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" value={newHerb.currentStock} onChange={(e) => setNewHerb((prev) => ({ ...prev, currentStock: e.target.value }))} />

              <label className="text-sm text-slate-700">안전재고</label>
              <input className="h-9 px-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" value={newHerb.safetyStock} onChange={(e) => setNewHerb((prev) => ({ ...prev, safetyStock: e.target.value }))} />

              <label className="text-sm text-slate-700">기본 공급업체</label>
              <input className="h-9 px-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" value={newHerb.defaultSupplier} onChange={(e) => setNewHerb((prev) => ({ ...prev, defaultSupplier: e.target.value }))} />

              <label className="text-sm text-slate-700">사용여부</label>
              <label className="decoction-check-inline m-0 text-sm text-slate-700">
                <input type="checkbox" checked={!newHerb.isActive} onChange={(e) => setNewHerb((prev) => ({ ...prev, isActive: !e.target.checked }))} />
                미사용으로 등록
              </label>
            </div>
            <div className="flex justify-end mt-3">
              <button className="decoction-btn" disabled={saving} onClick={handleCreateHerb}>약재 등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
