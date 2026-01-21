import { useState, useEffect, useCallback } from 'react';
import {
  getMedicineInventory,
  createMedicineInventory,
  updateMedicineInventory,
  deleteMedicineInventory,
  addMedicineStock,
  fetchPrescriptionDefinitions,
  importPrescriptionsToInventory,
  getMedicineUsagesByDateRange,
  getMedicineUsageStatsByDateRange,
  type MedicineInventory,
  type MedicineUsage,
  type MedicineUsageStats,
  type MedicineCategory,
  MEDICINE_CATEGORIES,
} from '../../cs/lib/api';
import { getCurrentDate } from '@shared/lib/postgres';

function ReadyMedicineList() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'import' | 'usage'>('inventory');
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

  // 사용내역 탭 상태
  const [usageStartDate, setUsageStartDate] = useState(getCurrentDate());
  const [usageEndDate, setUsageEndDate] = useState(getCurrentDate());
  const [usages, setUsages] = useState<MedicineUsage[]>([]);
  const [usageStats, setUsageStats] = useState<MedicineUsageStats[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [medicineNameFilter, setMedicineNameFilter] = useState('');
  const [patientNameFilter, setPatientNameFilter] = useState('');
  const [usageViewMode, setUsageViewMode] = useState<'list' | 'stats'>('list');

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

  // 사용내역 로드
  const loadUsages = useCallback(async () => {
    try {
      setUsageLoading(true);
      const [usageData, statsData] = await Promise.all([
        getMedicineUsagesByDateRange(
          usageStartDate,
          usageEndDate,
          medicineNameFilter || undefined,
          patientNameFilter || undefined
        ),
        getMedicineUsageStatsByDateRange(usageStartDate, usageEndDate),
      ]);
      setUsages(usageData);
      setUsageStats(statsData);
    } catch (err: any) {
      console.error('사용내역 로드 오류:', err);
    } finally {
      setUsageLoading(false);
    }
  }, [usageStartDate, usageEndDate, medicineNameFilter, patientNameFilter]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (activeTab === 'import') {
      loadPrescriptions();
    }
  }, [activeTab, loadPrescriptions]);

  useEffect(() => {
    if (activeTab === 'usage') {
      loadUsages();
    }
  }, [activeTab, loadUsages]);

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

  // 날짜 빠른 이동
  const handleDateQuickMove = (type: 'today' | 'week' | 'month' | 'prev' | 'next') => {
    const today = getCurrentDate();
    const start = new Date(usageStartDate);
    const end = new Date(usageEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    switch (type) {
      case 'today':
        setUsageStartDate(today);
        setUsageEndDate(today);
        break;
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        setUsageStartDate(weekStart.toISOString().split('T')[0]);
        setUsageEndDate(today);
        break;
      }
      case 'month': {
        const monthStart = new Date(today);
        monthStart.setDate(monthStart.getDate() - 29);
        setUsageStartDate(monthStart.toISOString().split('T')[0]);
        setUsageEndDate(today);
        break;
      }
      case 'prev': {
        start.setDate(start.getDate() - diff - 1);
        end.setDate(end.getDate() - diff - 1);
        setUsageStartDate(start.toISOString().split('T')[0]);
        setUsageEndDate(end.toISOString().split('T')[0]);
        break;
      }
      case 'next': {
        start.setDate(start.getDate() + diff + 1);
        end.setDate(end.getDate() + diff + 1);
        setUsageStartDate(start.toISOString().split('T')[0]);
        setUsageEndDate(end.toISOString().split('T')[0]);
        break;
      }
    }
  };

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
  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`'${name}'을(를) 비활성화하시겠습니까?`)) return;
    try {
      await deleteMedicineInventory(id);
      loadInventory();
    } catch (err: any) {
      alert(err.message || '비활성화 실패');
    }
  };

  // 상비약 완전 삭제
  const handleHardDelete = async (id: number, name: string) => {
    if (!confirm(`'${name}'을(를) 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteMedicineInventory(id, true);
      loadInventory();
      alert(`'${name}'이(가) 삭제되었습니다.`);
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
    <div className="h-full overflow-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">상비약 재고 관리</h1>
          <p className="text-sm text-gray-500 mt-1">처방정의 기반 상비약 재고를 관리합니다</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          재고 목록
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'import'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          처방정의에서 등록
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'usage'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          사용내역
        </button>
      </div>

      {/* 재고 목록 탭 */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 필터 */}
          <div className="p-4 border-b border-gray-200 flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="이름/별명 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 분류</option>
              {MEDICINE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-600">비활성 포함</span>
            </label>
          </div>

          {/* 목록 */}
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            {loading ? (
              <div className="p-10 text-center text-gray-500">로딩 중...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <div className="text-4xl mb-3">💊</div>
                등록된 상비약이 없습니다.<br />
                '처방정의에서 등록' 탭에서 상비약을 추가해주세요.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상비약명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">별명</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">분류</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">현재재고</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">누적</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">탕전설정</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-gray-100 ${!item.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}
                    >
                      {editingId === item.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editForm.alias}
                              onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value as MedicineCategory })}
                              className="px-2 py-1 border border-gray-300 rounded"
                            >
                              {MEDICINE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">{item.current_stock}{item.unit}</td>
                          <td className="px-4 py-2 text-center">{item.total_stock}{item.unit}</td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              value={editForm.doses_per_batch}
                              onChange={(e) => setEditForm({ ...editForm, doses_per_batch: parseInt(e.target.value) || 0 })}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-center"
                            />첩/
                            <input
                              type="number"
                              value={editForm.packs_per_batch}
                              onChange={(e) => setEditForm({ ...editForm, packs_per_batch: parseInt(e.target.value) || 0 })}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-center"
                            />{editForm.unit}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={handleSaveEdit}
                              className="px-2 py-1 mr-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                            >저장</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                            >취소</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <span className="font-medium">{item.name}</span>
                            {!item.is_active && <span className="ml-2 text-xs text-red-500">(비활성)</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.alias || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.category}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${item.current_stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                              {item.current_stock}
                            </span>
                            <span className="text-gray-400 ml-1">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500">
                            {item.total_stock}{item.unit}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-500">
                            {item.doses_per_batch}첩/{item.packs_per_batch}{item.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenStockModal(item)}
                              className="px-2 py-1 mr-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >+입고</button>
                            <button
                              onClick={() => handleEdit(item)}
                              className="px-2 py-1 mr-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                            >수정</button>
                            {item.is_active && (
                              <button
                                onClick={() => handleDeactivate(item.id, item.name)}
                                className="px-2 py-1 mr-1 bg-yellow-50 text-yellow-700 rounded text-xs hover:bg-yellow-100"
                              >비활성</button>
                            )}
                            <button
                              onClick={() => handleHardDelete(item.id, item.name)}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100"
                            >삭제</button>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 필터 */}
          <div className="p-4 border-b border-gray-200 flex gap-3 flex-wrap items-center">
            <input
              type="text"
              placeholder="처방명 검색..."
              value={prescriptionSearch}
              onChange={(e) => setPrescriptionSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="처방 카테고리 필터..."
              value={prescriptionCategory}
              onChange={(e) => setPrescriptionCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={loadPrescriptions}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              검색
            </button>
            <div className="flex-1" />
            <span className="text-sm text-gray-500">
              {selectedPrescriptions.size}개 선택됨
            </span>
            <select
              value={importCategory}
              onChange={(e) => setImportCategory(e.target.value as MedicineCategory)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MEDICINE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}으로 등록</option>
              ))}
            </select>
            <button
              onClick={handleImport}
              disabled={selectedPrescriptions.size === 0 || isImporting}
              className={`px-4 py-2 rounded-lg font-medium text-white ${
                selectedPrescriptions.size > 0 && !isImporting
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isImporting ? '등록 중...' : '선택 항목 등록'}
            </button>
          </div>

          {/* 처방정의 목록 */}
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            {prescriptions.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                처방정의를 검색해주세요.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={selectedPrescriptions.size === prescriptions.length && prescriptions.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">처방명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">별명</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">카테고리</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((p) => {
                    const isRegistered = inventory.some((i) => i.prescription_id === p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-gray-100 ${isRegistered ? 'bg-green-50 opacity-70' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedPrescriptions.has(p.id)}
                            onChange={() => togglePrescriptionSelection(p.id)}
                            disabled={isRegistered}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {p.name}
                          {isRegistered && (
                            <span className="ml-2 text-xs text-green-600">(등록됨)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.alias || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">{p.category || '-'}</span>
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

      {/* 사용내역 탭 */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 검색 필터 */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            {/* 날짜 선택 및 빠른 이동 */}
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => handleDateQuickMove('prev')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                ◀ 이전
              </button>
              <input
                type="date"
                value={usageStartDate}
                onChange={(e) => setUsageStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={usageEndDate}
                onChange={(e) => setUsageEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleDateQuickMove('next')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                다음 ▶
              </button>
              <div className="h-6 w-px bg-gray-300 mx-1" />
              <button
                onClick={() => handleDateQuickMove('today')}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                오늘
              </button>
              <button
                onClick={() => handleDateQuickMove('week')}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                최근 1주
              </button>
              <button
                onClick={() => handleDateQuickMove('month')}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                최근 1달
              </button>
            </div>

            {/* 검색 필터 및 보기 모드 */}
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                placeholder="처방명 검색..."
                value={medicineNameFilter}
                onChange={(e) => setMedicineNameFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="환자명 검색..."
                value={patientNameFilter}
                onChange={(e) => setPatientNameFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={loadUsages}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                검색
              </button>
              <div className="flex-1" />
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setUsageViewMode('list')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    usageViewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  상세내역
                </button>
                <button
                  onClick={() => setUsageViewMode('stats')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    usageViewMode === 'stats' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  사용통계
                </button>
              </div>
            </div>
          </div>

          {/* 상세내역 뷰 */}
          {usageViewMode === 'list' && (
            <>
              <div className="overflow-auto max-h-[calc(100vh-400px)]">
                {usageLoading ? (
                  <div className="p-10 text-center text-gray-500">로딩 중...</div>
                ) : usages.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">
                    <div className="text-4xl mb-3">📋</div>
                    해당 기간의 사용내역이 없습니다.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">사용일</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">환자명</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">차트번호</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상비약명</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">수량</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">용도</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">메모</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usages.map((usage) => (
                        <tr key={usage.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-center text-sm text-gray-500">{usage.usage_date}</td>
                          <td className="px-4 py-3 font-medium">{usage.patient_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{usage.chart_number}</td>
                          <td className="px-4 py-3">{usage.medicine_name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-600">{usage.quantity}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              usage.purpose === '상비약' ? 'bg-green-100 text-green-700' :
                              usage.purpose === '감기약' ? 'bg-blue-100 text-blue-700' :
                              usage.purpose === '치료약' ? 'bg-purple-100 text-purple-700' :
                              usage.purpose === '증정' ? 'bg-yellow-100 text-yellow-700' :
                              usage.purpose === '보완' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {usage.purpose || '상비약'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{usage.memo || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 합계 */}
              {usages.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-6 text-sm">
                    <span>총 {usages.length}건</span>
                    <span>총 사용량: <strong className="text-blue-600">{usages.reduce((sum, u) => sum + u.quantity, 0)}</strong>개</span>
                    <span>환자 수: <strong>{new Set(usages.map(u => u.patient_id)).size}</strong>명</span>
                    <span>상비약 종류: <strong>{new Set(usages.map(u => u.medicine_name)).size}</strong>종</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 사용통계 뷰 */}
          {usageViewMode === 'stats' && (
            <>
              <div className="overflow-auto max-h-[calc(100vh-400px)]">
                {usageLoading ? (
                  <div className="p-10 text-center text-gray-500">로딩 중...</div>
                ) : usageStats.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">
                    <div className="text-4xl mb-3">📊</div>
                    해당 기간의 사용 통계가 없습니다.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-16">순위</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상비약명</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">총 사용량</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">사용 횟수</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">환자 수</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">사용 비율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.map((stat, index) => {
                        const totalQuantity = usageStats.reduce((sum, s) => sum + Number(s.total_quantity), 0);
                        const percentage = totalQuantity > 0 ? (Number(stat.total_quantity) / totalQuantity * 100).toFixed(1) : '0';
                        return (
                          <tr key={stat.medicine_name} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-center">
                              {index < 3 ? (
                                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold text-white ${
                                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                                }`}>
                                  {index + 1}
                                </span>
                              ) : (
                                <span className="text-gray-500">{index + 1}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">{stat.medicine_name}</td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-600">{stat.total_quantity}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{stat.usage_count}회</td>
                            <td className="px-4 py-3 text-center text-gray-600">{stat.patient_count}명</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-500 w-12 text-right">{percentage}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 통계 요약 */}
              {usageStats.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-6 text-sm">
                    <span>상비약 종류: <strong>{usageStats.length}</strong>종</span>
                    <span>총 사용량: <strong className="text-blue-600">{usageStats.reduce((sum, s) => sum + Number(s.total_quantity), 0)}</strong>개</span>
                    <span>총 사용 횟수: <strong>{usageStats.reduce((sum, s) => sum + Number(s.usage_count), 0)}</strong>회</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 입고(탕전) 모달 */}
      {showStockModal && stockItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStockModal(false);
              setStockItem(null);
            }
          }}
        >
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-2">재고 입고 (탕전)</h3>
            <p className="text-gray-600 mb-4">
              <strong>{stockItem.name}</strong><br />
              현재 재고: <span className={`font-semibold ${stockItem.current_stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                {stockItem.current_stock}{stockItem.unit}
              </span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">첩수</label>
              <input
                type="number"
                value={stockForm.doses}
                onChange={(e) => setStockForm({ ...stockForm, doses: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">입고 수량 ({stockItem.unit})</label>
              <input
                type="number"
                value={stockForm.packs}
                onChange={(e) => setStockForm({ ...stockForm, packs: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                탕전 후 재고: {stockItem.current_stock + stockForm.packs}{stockItem.unit}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
              <input
                type="text"
                value={stockForm.memo}
                onChange={(e) => setStockForm({ ...stockForm, memo: e.target.value })}
                placeholder="예: 외주 탕전"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowStockModal(false); setStockItem(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleAddStock}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
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

export default ReadyMedicineList;
