import { useState, useEffect, useCallback } from 'react';
import {
  getMedicineInventory,
  createMedicineInventory,
  updateMedicineInventory,
  deleteMedicineInventory,
  addMedicineStock,
  fetchPrescriptionDefinitions,
  importPrescriptionsToInventory,
  type MedicineInventory,
  type MedicineCategory,
  MEDICINE_CATEGORIES,
} from '../lib/api';

interface MedicineInventoryAdminProps {
  onClose?: () => void;
}

function MedicineInventoryAdmin({ onClose }: MedicineInventoryAdminProps) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'import'>('inventory');
  const [inventory, setInventory] = useState<MedicineInventory[]>([]);
  const [prescriptions, setPrescriptions] = useState<Array<{id: number; name: string; category: string; alias: string | null; is_active: boolean}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [showInactive, setShowInactive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [prescriptionCategory, setPrescriptionCategory] = useState('');

  // 선택된 처방정의 (일괄 등록용)
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<Set<number>>(new Set());
  const [importCategory, setImportCategory] = useState<MedicineCategory>('상비약');
  const [isImporting, setIsImporting] = useState(false);

  // 편집 모드
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    alias: '',
    category: '상비약' as MedicineCategory,
    unit: '팩',
    doses_per_batch: 20,
    packs_per_batch: 30,
    memo: '',
  });

  // 탕전(입고) 모달
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItem, setStockItem] = useState<MedicineInventory | null>(null);
  const [stockForm, setStockForm] = useState({
    doses: 20,
    packs: 30,
    memo: '',
  });

  // 데이터 로드
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMedicineInventory(!showInactive);
      setInventory(data);
    } catch (err: any) {
      setError(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const loadPrescriptions = useCallback(async () => {
    try {
      const data = await fetchPrescriptionDefinitions(
        prescriptionSearch || undefined,
        prescriptionCategory || undefined
      );
      setPrescriptions(data);
    } catch (err: any) {
      console.error('처방정의 로드 오류:', err);
    }
  }, [prescriptionSearch, prescriptionCategory]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (activeTab === 'import') {
      loadPrescriptions();
    }
  }, [activeTab, loadPrescriptions]);

  // 필터된 목록
  const filteredInventory = inventory.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      if (!item.name.toLowerCase().includes(keyword) &&
          !(item.alias && item.alias.toLowerCase().includes(keyword))) {
        return false;
      }
    }
    return true;
  });

  // 처방정의 일괄 등록
  const handleImport = async () => {
    if (selectedPrescriptions.size === 0) {
      alert('등록할 처방을 선택해주세요.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await importPrescriptionsToInventory(
        Array.from(selectedPrescriptions),
        importCategory
      );

      if (result.success > 0) {
        alert(`${result.success}개 등록 완료${result.failed > 0 ? `, ${result.failed}개 실패` : ''}`);
        setSelectedPrescriptions(new Set());
        loadInventory();
      } else if (result.errors.length > 0) {
        alert(`등록 실패:\n${result.errors.join('\n')}`);
      }
    } catch (err: any) {
      alert(err.message || '등록 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  // 상비약 수정
  const handleEdit = (item: MedicineInventory) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      alias: item.alias || '',
      category: item.category as MedicineCategory,
      unit: item.unit,
      doses_per_batch: item.doses_per_batch,
      packs_per_batch: item.packs_per_batch,
      memo: item.memo || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateMedicineInventory(editingId, {
        name: editForm.name,
        alias: editForm.alias || null,
        category: editForm.category,
        unit: editForm.unit,
        doses_per_batch: editForm.doses_per_batch,
        packs_per_batch: editForm.packs_per_batch,
        memo: editForm.memo || null,
      });
      setEditingId(null);
      loadInventory();
    } catch (err: any) {
      alert(err.message || '수정 실패');
    }
  };

  // 상비약 비활성화
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`'${name}'을(를) 비활성화하시겠습니까?`)) return;
    try {
      await deleteMedicineInventory(id);
      loadInventory();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  // 재고 추가 (탕전)
  const handleOpenStockModal = (item: MedicineInventory) => {
    setStockItem(item);
    setStockForm({
      doses: item.doses_per_batch,
      packs: item.packs_per_batch,
      memo: '',
    });
    setShowStockModal(true);
  };

  const handleAddStock = async () => {
    if (!stockItem) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await addMedicineStock(
        stockItem.id,
        stockForm.packs,
        stockForm.doses,
        today,
        undefined,
        stockForm.memo || undefined
      );
      setShowStockModal(false);
      setStockItem(null);
      loadInventory();
      alert(`${stockItem.name} ${stockForm.packs}${stockItem.unit} 입고 완료`);
    } catch (err: any) {
      alert(err.message || '입고 실패');
    }
  };

  // 선택 토글
  const togglePrescriptionSelection = (id: number) => {
    setSelectedPrescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedPrescriptions.size === prescriptions.length) {
      setSelectedPrescriptions(new Set());
    } else {
      setSelectedPrescriptions(new Set(prescriptions.map((p) => p.id)));
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>상비약 재고 관리</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'inventory' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'inventory' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          재고 목록
        </button>
        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'import' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'import' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          처방정의에서 등록
        </button>
      </div>

      {/* 재고 목록 탭 */}
      {activeTab === 'inventory' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 필터 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="이름/별명 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                width: '200px',
              }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            >
              <option value="">전체 분류</option>
              {MEDICINE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              비활성 포함
            </label>
          </div>

          {/* 목록 */}
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>로딩 중...</div>
            ) : filteredInventory.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                등록된 상비약이 없습니다.<br />
                '처방정의에서 등록' 탭에서 상비약을 추가해주세요.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>상비약명</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>별명</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>분류</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>현재재고</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>누적</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>탕전설정</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: !item.is_active ? '#f9fafb' : 'white',
                        opacity: item.is_active ? 1 : 0.6,
                      }}
                    >
                      {editingId === item.id ? (
                        <>
                          <td style={{ padding: '8px' }}>
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              value={editForm.alias}
                              onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
                              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value as MedicineCategory })}
                              style={{ padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            >
                              {MEDICINE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{item.current_stock}{item.unit}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{item.total_stock}{item.unit}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={editForm.doses_per_batch}
                              onChange={(e) => setEditForm({ ...editForm, doses_per_batch: parseInt(e.target.value) || 0 })}
                              style={{ width: '50px', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                            />첩/
                            <input
                              type="number"
                              value={editForm.packs_per_batch}
                              onChange={(e) => setEditForm({ ...editForm, packs_per_batch: parseInt(e.target.value) || 0 })}
                              style={{ width: '50px', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                            />{editForm.unit}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              onClick={handleSaveEdit}
                              style={{ padding: '4px 8px', marginRight: '4px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >저장</button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ padding: '4px 8px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >취소</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                            {!item.is_active && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#ef4444' }}>(비활성)</span>}
                          </td>
                          <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>{item.alias || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                              {item.category}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ color: item.current_stock <= 5 ? '#ef4444' : '#059669', fontWeight: 600 }}>
                              {item.current_stock}
                            </span>
                            <span style={{ color: '#9ca3af' }}>{item.unit}</span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                            {item.total_stock}{item.unit}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                            {item.doses_per_batch}첩/{item.packs_per_batch}{item.unit}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenStockModal(item)}
                              style={{ padding: '4px 8px', marginRight: '4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >+입고</button>
                            <button
                              onClick={() => handleEdit(item)}
                              style={{ padding: '4px 8px', marginRight: '4px', background: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >수정</button>
                            {item.is_active && (
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                style={{ padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >비활성</button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 처방정의 일괄 등록 탭 */}
      {activeTab === 'import' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 필터 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="처방명 검색..."
              value={prescriptionSearch}
              onChange={(e) => setPrescriptionSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                width: '200px',
              }}
            />
            <input
              type="text"
              placeholder="처방 카테고리 필터..."
              value={prescriptionCategory}
              onChange={(e) => setPrescriptionCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                width: '150px',
              }}
            />
            <button
              onClick={loadPrescriptions}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              검색
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              {selectedPrescriptions.size}개 선택됨
            </span>
            <select
              value={importCategory}
              onChange={(e) => setImportCategory(e.target.value as MedicineCategory)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            >
              {MEDICINE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}으로 등록</option>
              ))}
            </select>
            <button
              onClick={handleImport}
              disabled={selectedPrescriptions.size === 0 || isImporting}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                background: selectedPrescriptions.size > 0 && !isImporting ? '#3b82f6' : '#d1d5db',
                color: 'white',
                cursor: selectedPrescriptions.size > 0 && !isImporting ? 'pointer' : 'not-allowed',
                fontWeight: 500,
              }}
            >
              {isImporting ? '등록 중...' : '선택 항목 등록'}
            </button>
          </div>

          {/* 처방정의 목록 */}
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            {prescriptions.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                처방정의를 검색해주세요.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'center', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedPrescriptions.size === prescriptions.length && prescriptions.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>처방명</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>별명</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>카테고리</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((p) => {
                    const isRegistered = inventory.some((i) => i.prescription_id === p.id);
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: isRegistered ? '#f0fdf4' : 'white',
                          opacity: isRegistered ? 0.7 : 1,
                        }}
                      >
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedPrescriptions.has(p.id)}
                            onChange={() => togglePrescriptionSelection(p.id)}
                            disabled={isRegistered}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {p.name}
                          {isRegistered && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#059669' }}>
                              (등록됨)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>{p.alias || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                            {p.category || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 입고(탕전) 모달 */}
      {showStockModal && stockItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStockModal(false);
              setStockItem(null);
            }
          }}
        >
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '400px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>
              재고 입고 (탕전)
            </h3>
            <p style={{ margin: '0 0 16px', color: '#6b7280' }}>
              <strong>{stockItem.name}</strong> - 현재 재고: {stockItem.current_stock}{stockItem.unit}
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
                첩수
              </label>
              <input
                type="number"
                value={stockForm.doses}
                onChange={(e) => setStockForm({ ...stockForm, doses: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
                입고 수량 ({stockItem.unit})
              </label>
              <input
                type="number"
                value={stockForm.packs}
                onChange={(e) => setStockForm({ ...stockForm, packs: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
                메모
              </label>
              <input
                type="text"
                value={stockForm.memo}
                onChange={(e) => setStockForm({ ...stockForm, memo: e.target.value })}
                placeholder="선택사항"
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowStockModal(false); setStockItem(null); }}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleAddStock}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 500 }}
              >
                입고
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicineInventoryAdmin;
