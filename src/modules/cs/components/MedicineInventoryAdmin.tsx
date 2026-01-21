import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentDate } from '@shared/lib/postgres';
import {
  getMedicineInventory,
  createMedicineInventory,
  updateMedicineInventory,
  deleteMedicineInventory,
  addMedicineStock,
  fetchPrescriptionDefinitions,
  importPrescriptionsToInventory,
  bulkUpsertMedicineInventory,
  getMedicineInventoryByNames,
  type MedicineInventory,
  type MedicineCategory,
  type BulkImportItem,
  MEDICINE_CATEGORIES,
} from '../lib/api';
import * as XLSX from 'xlsx';

interface MedicineInventoryAdminProps {
  onClose?: () => void;
}

// 검증된 행 타입
interface ValidatedRow {
  rowIndex: number;
  name: string;
  lastDecoction: string;
  totalStock: string;
  currentStock: string;
  dosesPerBatch: string;
  packsPerBatch: string;
  category: string;
  isActive: string;
  status: 'insert' | 'update' | 'skip' | 'error';
  errors: { field: string; message: string }[];
  existingId?: number;
}

function MedicineInventoryAdmin({ onClose }: MedicineInventoryAdminProps) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'import' | 'bulkImport'>('inventory');
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

  // 파일 일괄등록 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkImportMode, setBulkImportMode] = useState<'overwrite' | 'newOnly'>('overwrite');
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [bulkImportStep, setBulkImportStep] = useState<'upload' | 'validate' | 'saving'>('upload');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

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
      const today = getCurrentDate();
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
        <button
          onClick={() => { setActiveTab('bulkImport'); setBulkImportStep('upload'); setValidatedRows([]); }}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'bulkImport' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'bulkImport' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          파일 일괄등록
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

      {/* 파일 일괄등록 탭 */}
      {activeTab === 'bulkImport' && (
        <BulkImportTab
          bulkImportStep={bulkImportStep}
          setBulkImportStep={setBulkImportStep}
          bulkImportMode={bulkImportMode}
          setBulkImportMode={setBulkImportMode}
          validatedRows={validatedRows}
          setValidatedRows={setValidatedRows}
          showOnlyErrors={showOnlyErrors}
          setShowOnlyErrors={setShowOnlyErrors}
          editingRowIndex={editingRowIndex}
          setEditingRowIndex={setEditingRowIndex}
          fileInputRef={fileInputRef}
          onSuccess={() => {
            loadInventory();
            setBulkImportStep('upload');
            setValidatedRows([]);
          }}
        />
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

// ============================================
// 파일 일괄등록 탭 컴포넌트
// ============================================

interface BulkImportTabProps {
  bulkImportStep: 'upload' | 'validate' | 'saving';
  setBulkImportStep: (step: 'upload' | 'validate' | 'saving') => void;
  bulkImportMode: 'overwrite' | 'newOnly';
  setBulkImportMode: (mode: 'overwrite' | 'newOnly') => void;
  validatedRows: ValidatedRow[];
  setValidatedRows: (rows: ValidatedRow[]) => void;
  showOnlyErrors: boolean;
  setShowOnlyErrors: (show: boolean) => void;
  editingRowIndex: number | null;
  setEditingRowIndex: (index: number | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSuccess: () => void;
}

// 헤더 매핑
const HEADER_MAP: Record<string, keyof ValidatedRow> = {
  '처방명': 'name',
  '최근탕전일': 'lastDecoction',
  '누적': 'totalStock',
  '재고': 'currentStock',
  '첩': 'dosesPerBatch',
  '팩': 'packsPerBatch',
  '분류': 'category',
  '사용': 'isActive',
};

// 날짜 형식 검증 (YYYY-MM-DD 또는 빈값)
const isValidDate = (value: string): boolean => {
  if (!value || value.trim() === '') return true;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

// 사용 여부 파싱
const parseIsActive = (value: string): boolean => {
  const lower = value.toLowerCase().trim();
  return ['o', 'y', '1', 'true', '사용', 'yes'].includes(lower);
};

function BulkImportTab({
  bulkImportStep,
  setBulkImportStep,
  bulkImportMode,
  setBulkImportMode,
  validatedRows,
  setValidatedRows,
  showOnlyErrors,
  setShowOnlyErrors,
  editingRowIndex,
  setEditingRowIndex,
  fileInputRef,
  onSuccess,
}: BulkImportTabProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      if (jsonData.length < 2) {
        alert('데이터가 없습니다.');
        return;
      }

      // 헤더 파싱
      const headers = jsonData[0] as string[];
      const headerIndices: Record<string, number> = {};

      headers.forEach((header, idx) => {
        const trimmed = header?.toString().trim();
        if (trimmed && HEADER_MAP[trimmed]) {
          headerIndices[HEADER_MAP[trimmed]] = idx;
        }
      });

      // 필수 헤더 확인
      if (!('name' in headerIndices)) {
        alert('필수 헤더 "처방명"이 없습니다.');
        return;
      }

      // 데이터 행 파싱
      const rows: ValidatedRow[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as string[];
        if (!row || row.length === 0) continue;

        const name = row[headerIndices['name']]?.toString().trim() || '';
        if (!name) continue;  // 이름 없는 행 스킵

        rows.push({
          rowIndex: i,
          name,
          lastDecoction: row[headerIndices['lastDecoction']]?.toString().trim() || '',
          totalStock: row[headerIndices['totalStock']]?.toString().trim() || '0',
          currentStock: row[headerIndices['currentStock']]?.toString().trim() || '0',
          dosesPerBatch: row[headerIndices['dosesPerBatch']]?.toString().trim() || '20',
          packsPerBatch: row[headerIndices['packsPerBatch']]?.toString().trim() || '30',
          category: row[headerIndices['category']]?.toString().trim() || '상비약',
          isActive: row[headerIndices['isActive']]?.toString().trim() || 'O',
          status: 'insert',
          errors: [],
        });
      }

      if (rows.length === 0) {
        alert('유효한 데이터가 없습니다.');
        return;
      }

      // 기존 데이터 조회 및 검증
      const names = rows.map(r => r.name);
      const existingMap = await getMedicineInventoryByNames(names);

      const validatedRows = rows.map(row => validateRow(row, existingMap, bulkImportMode));
      setValidatedRows(validatedRows);
      setBulkImportStep('validate');

    } catch (err: any) {
      alert(`파일 파싱 오류: ${err.message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 행 검증
  const validateRow = (
    row: ValidatedRow,
    existingMap: Map<string, MedicineInventory>,
    mode: 'overwrite' | 'newOnly'
  ): ValidatedRow => {
    const errors: { field: string; message: string }[] = [];
    const existing = existingMap.get(row.name);

    // 이름 검증
    if (!row.name) {
      errors.push({ field: 'name', message: '처방명 필수' });
    }

    // 날짜 검증
    if (row.lastDecoction && !isValidDate(row.lastDecoction)) {
      errors.push({ field: 'lastDecoction', message: '날짜형식 오류 (YYYY-MM-DD)' });
    }

    // 숫자 검증
    const numFields = [
      { field: 'totalStock', label: '누적' },
      { field: 'currentStock', label: '재고' },
      { field: 'dosesPerBatch', label: '첩' },
      { field: 'packsPerBatch', label: '팩' },
    ] as const;

    numFields.forEach(({ field, label }) => {
      const value = row[field];
      if (value && (isNaN(Number(value)) || Number(value) < 0)) {
        errors.push({ field, message: `${label}: 0 이상 숫자` });
      }
    });

    // 상태 결정
    let status: ValidatedRow['status'] = 'insert';
    if (errors.length > 0) {
      status = 'error';
    } else if (existing) {
      if (mode === 'newOnly') {
        status = 'skip';
      } else {
        status = 'update';
      }
    }

    return {
      ...row,
      status,
      errors,
      existingId: existing?.id,
    };
  };

  // 행 수정
  const handleRowChange = (rowIndex: number, field: keyof ValidatedRow, value: string) => {
    setValidatedRows(validatedRows.map(row => {
      if (row.rowIndex === rowIndex) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // 행 재검증
  const revalidateRow = async (rowIndex: number) => {
    const row = validatedRows.find(r => r.rowIndex === rowIndex);
    if (!row) return;

    const existingMap = await getMedicineInventoryByNames([row.name]);
    const validated = validateRow(row, existingMap, bulkImportMode);

    setValidatedRows(validatedRows.map(r =>
      r.rowIndex === rowIndex ? validated : r
    ));
    setEditingRowIndex(null);
  };

  // 전체 재검증
  const revalidateAll = async () => {
    setIsProcessing(true);
    try {
      const names = validatedRows.map(r => r.name);
      const existingMap = await getMedicineInventoryByNames(names);
      const revalidated = validatedRows.map(row => validateRow(row, existingMap, bulkImportMode));
      setValidatedRows(revalidated);
    } finally {
      setIsProcessing(false);
    }
  };

  // 등록 실행
  const handleSave = async () => {
    const validRows = validatedRows.filter(r => r.status === 'insert' || r.status === 'update');
    if (validRows.length === 0) {
      alert('등록할 항목이 없습니다.');
      return;
    }

    const errorRows = validatedRows.filter(r => r.status === 'error');
    if (errorRows.length > 0) {
      if (!confirm(`${errorRows.length}개 오류 항목이 있습니다. 오류 항목은 건너뛰고 진행할까요?`)) {
        return;
      }
    }

    setBulkImportStep('saving');
    setIsProcessing(true);

    try {
      const items: BulkImportItem[] = validRows.map(row => ({
        name: row.name,
        lastDecoction: row.lastDecoction || undefined,
        totalStock: parseInt(row.totalStock) || 0,
        currentStock: parseInt(row.currentStock) || 0,
        dosesPerBatch: parseInt(row.dosesPerBatch) || 20,
        packsPerBatch: parseInt(row.packsPerBatch) || 30,
        category: row.category || '상비약',
        isActive: parseIsActive(row.isActive),
      }));

      const result = await bulkUpsertMedicineInventory(items, bulkImportMode);

      alert(
        `등록 완료!\n` +
        `- 신규: ${result.inserted}건\n` +
        `- 업데이트: ${result.updated}건\n` +
        `- 건너뜀: ${result.skipped}건\n` +
        `- 실패: ${result.failed}건` +
        (result.errors.length > 0 ? `\n\n오류:\n${result.errors.slice(0, 5).join('\n')}` : '')
      );

      onSuccess();
    } catch (err: any) {
      alert(`저장 오류: ${err.message}`);
      setBulkImportStep('validate');
    } finally {
      setIsProcessing(false);
    }
  };

  // 통계 계산
  const stats = {
    total: validatedRows.length,
    insert: validatedRows.filter(r => r.status === 'insert').length,
    update: validatedRows.filter(r => r.status === 'update').length,
    skip: validatedRows.filter(r => r.status === 'skip').length,
    error: validatedRows.filter(r => r.status === 'error').length,
  };

  const displayRows = showOnlyErrors
    ? validatedRows.filter(r => r.status === 'error')
    : validatedRows;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 업로드 단계 */}
      {bulkImportStep === 'upload' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>엑셀 파일 일괄 등록</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              엑셀 파일(.xlsx, .xls)을 선택하여 상비약을 일괄 등록합니다.
            </p>
          </div>

          <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', maxWidth: '500px' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 500, fontSize: '14px' }}>필수 헤더 (첫 행)</p>
            <code style={{ display: 'block', padding: '12px', background: '#e5e7eb', borderRadius: '4px', fontSize: '13px' }}>
              처방명 | 최근탕전일 | 누적 | 재고 | 첩 | 팩 | 분류 | 사용
            </code>
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#6b7280' }}>
              분류: 자유 입력 (관리 목적에 맞게 분류)<br />
              사용: O/X 또는 사용/미사용
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  checked={bulkImportMode === 'overwrite'}
                  onChange={() => setBulkImportMode('overwrite')}
                />
                <span>덮어쓰기</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>(기존 데이터 업데이트)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  checked={bulkImportMode === 'newOnly'}
                  onChange={() => setBulkImportMode('newOnly')}
                />
                <span>신규만</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>(새 처방만 등록)</span>
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              style={{
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                background: '#3b82f6',
                color: 'white',
                fontSize: '15px',
                fontWeight: 500,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              {isProcessing ? '처리 중...' : '파일 선택'}
            </button>
          </div>
        </div>
      )}

      {/* 검증 단계 */}
      {bulkImportStep === 'validate' && (
        <>
          {/* 통계 및 컨트롤 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px' }}>
                총 <strong>{stats.total}</strong>건
              </span>
              <span style={{ color: '#059669' }}>등록: {stats.insert}</span>
              <span style={{ color: '#3b82f6' }}>업데이트: {stats.update}</span>
              <span style={{ color: '#6b7280' }}>건너뜀: {stats.skip}</span>
              <span style={{ color: '#dc2626' }}>오류: {stats.error}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                />
                오류만 보기
              </label>
              <button
                onClick={revalidateAll}
                disabled={isProcessing}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                전체 재검증
              </button>
              <button
                onClick={() => { setBulkImportStep('upload'); setValidatedRows([]); }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                다시 선택
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessing || (stats.insert === 0 && stats.update === 0)}
                style={{
                  padding: '6px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: (stats.insert > 0 || stats.update > 0) && !isProcessing ? '#3b82f6' : '#d1d5db',
                  color: 'white',
                  cursor: (stats.insert > 0 || stats.update > 0) && !isProcessing ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                등록하기
              </button>
            </div>
          </div>

          {/* 검증 결과 테이블 */}
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px', textAlign: 'center', width: '60px' }}>상태</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>처방명</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>최근탕전일</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '70px' }}>누적</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '70px' }}>재고</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>첩</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>팩</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>분류</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>사용</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>오류</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '60px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const isEditing = editingRowIndex === row.rowIndex;
                  const statusColors = {
                    insert: { bg: '#f0fdf4', color: '#059669', label: '등록' },
                    update: { bg: '#eff6ff', color: '#3b82f6', label: '업데이트' },
                    skip: { bg: '#f9fafb', color: '#6b7280', label: '건너뜀' },
                    error: { bg: '#fef2f2', color: '#dc2626', label: '오류' },
                  };
                  const statusStyle = statusColors[row.status];
                  const errorFields = new Set(row.errors.map(e => e.field));

                  return (
                    <tr
                      key={row.rowIndex}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: statusStyle.bg,
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: statusStyle.color,
                          background: 'white',
                          border: `1px solid ${statusStyle.color}`,
                        }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px', borderLeft: errorFields.has('name') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            value={row.name}
                            onChange={(e) => handleRowChange(row.rowIndex, 'name', e.target.value)}
                            style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                          />
                        ) : row.name}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: errorFields.has('lastDecoction') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            value={row.lastDecoction}
                            onChange={(e) => handleRowChange(row.rowIndex, 'lastDecoction', e.target.value)}
                            placeholder="YYYY-MM-DD"
                            style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : (row.lastDecoction || '-')}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: errorFields.has('totalStock') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={row.totalStock}
                            onChange={(e) => handleRowChange(row.rowIndex, 'totalStock', e.target.value)}
                            style={{ width: '60px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : row.totalStock}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: errorFields.has('currentStock') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={row.currentStock}
                            onChange={(e) => handleRowChange(row.rowIndex, 'currentStock', e.target.value)}
                            style={{ width: '60px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : row.currentStock}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: errorFields.has('dosesPerBatch') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={row.dosesPerBatch}
                            onChange={(e) => handleRowChange(row.rowIndex, 'dosesPerBatch', e.target.value)}
                            style={{ width: '50px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : row.dosesPerBatch}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: errorFields.has('packsPerBatch') ? '3px solid #dc2626' : 'none' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={row.packsPerBatch}
                            onChange={(e) => handleRowChange(row.rowIndex, 'packsPerBatch', e.target.value)}
                            style={{ width: '50px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : row.packsPerBatch}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <input
                            value={row.category}
                            onChange={(e) => handleRowChange(row.rowIndex, 'category', e.target.value)}
                            style={{ width: '80px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                          />
                        ) : (row.category || '-')}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <select
                            value={row.isActive}
                            onChange={(e) => handleRowChange(row.rowIndex, 'isActive', e.target.value)}
                            style={{ padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                          >
                            <option value="O">O</option>
                            <option value="X">X</option>
                          </select>
                        ) : row.isActive}
                      </td>
                      <td style={{ padding: '8px', fontSize: '12px', color: '#dc2626' }}>
                        {row.errors.map(e => e.message).join(', ')}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <button
                            onClick={() => revalidateRow(row.rowIndex)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              borderRadius: '4px',
                              background: '#10b981',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            확인
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingRowIndex(row.rowIndex)}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              background: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 저장 중 */}
      {bulkImportStep === 'saving' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>저장 중...</p>
            <p style={{ color: '#6b7280' }}>잠시만 기다려주세요.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicineInventoryAdmin;
