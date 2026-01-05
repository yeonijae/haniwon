import { useState, useEffect, useCallback } from 'react';
import {
  getMedicineInventory,
  getMedicineDecoctions,
  addMedicineStock,
  type MedicineInventory,
  type MedicineDecoction,
} from '../../cs/lib/api';

const LOW_STOCK_THRESHOLD = 10;

function DecoctionList() {
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [inventory, setInventory] = useState<MedicineInventory[]>([]);
  const [decoctions, setDecoctions] = useState<MedicineDecoction[]>([]);
  const [loading, setLoading] = useState(true);

  // 탕전 등록 모달
  const [showDecocionModal, setShowDecocionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MedicineInventory | null>(null);
  const [decocForm, setDecocForm] = useState({
    doses: 20,
    packs: 30,
    memo: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // 필터
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // 데이터 로드
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMedicineInventory(true);
      setInventory(data);
    } catch (err) {
      console.error('재고 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDecoctions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMedicineDecoctions(undefined, dateRange.start, dateRange.end);
      setDecoctions(data);
    } catch (err) {
      console.error('탕전 내역 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadDecoctions();
    }
  }, [activeTab, loadDecoctions]);

  // 필터링된 재고
  const filteredInventory = showLowStockOnly
    ? inventory.filter((item) => item.current_stock <= LOW_STOCK_THRESHOLD)
    : inventory;

  // 재고 부족 상비약 수
  const lowStockCount = inventory.filter((item) => item.current_stock <= LOW_STOCK_THRESHOLD).length;

  // 탕전 모달 열기
  const handleOpenDecocionModal = (item: MedicineInventory) => {
    setSelectedItem(item);
    setDecocForm({
      doses: item.doses_per_batch,
      packs: item.packs_per_batch,
      memo: '',
    });
    setShowDecocionModal(true);
  };

  // 탕전 등록
  const handleSubmitDecocion = async () => {
    if (!selectedItem) return;

    if (decocForm.doses <= 0 || decocForm.packs <= 0) {
      alert('첩수와 팩수를 올바르게 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await addMedicineStock(
        selectedItem.id,
        decocForm.packs,
        decocForm.doses,
        today,
        undefined,
        decocForm.memo || undefined
      );

      alert(`${selectedItem.name} ${decocForm.packs}${selectedItem.unit} 탕전 완료`);
      setShowDecocionModal(false);
      setSelectedItem(null);
      loadInventory();
      if (activeTab === 'history') {
        loadDecoctions();
      }
    } catch (err: any) {
      alert(err.message || '탕전 등록 실패');
    } finally {
      setIsSaving(false);
    }
  };

  // 통계
  const stats = {
    totalItems: inventory.length,
    lowStock: lowStockCount,
    totalDecoctions: decoctions.length,
    totalPacks: decoctions.reduce((sum, d) => sum + d.packs, 0),
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">탕전 관리</h1>
          <p className="text-sm text-gray-500 mt-1">상비약 재고 현황 및 탕전 내역을 관리합니다</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-sm text-blue-600">등록 상비약</div>
          <div className="text-2xl font-bold text-blue-800">{stats.totalItems}종</div>
        </div>
        <div className={`${lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-xl p-4`}>
          <div className={`text-sm ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            재고 부족 ({LOW_STOCK_THRESHOLD}팩 이하)
          </div>
          <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-800' : 'text-green-800'}`}>
            {stats.lowStock}종
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="text-sm text-yellow-700">최근 30일 탕전</div>
          <div className="text-2xl font-bold text-yellow-800">{stats.totalDecoctions}회</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="text-sm text-purple-600">최근 30일 생산</div>
          <div className="text-2xl font-bold text-purple-800">{stats.totalPacks}팩</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'stock'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          재고 현황
          {lowStockCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {lowStockCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          탕전 내역
        </button>
      </div>

      {/* 재고 현황 탭 */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 필터 */}
          <div className="p-4 border-b border-gray-200 flex gap-3 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-red-600 font-medium">재고 부족만 표시</span>
            </label>
            <div className="flex-1" />
            <span className="text-sm text-gray-500">총 {filteredInventory.length}종</span>
          </div>

          {/* 재고 목록 */}
          <div className="overflow-auto max-h-[calc(100vh-420px)]">
            {loading ? (
              <div className="p-10 text-center text-gray-500">로딩 중...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <div className="text-4xl mb-3">🔥</div>
                {showLowStockOnly ? '재고 부족 상비약이 없습니다.' : '등록된 상비약이 없습니다.'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상비약명</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">분류</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">현재 재고</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">탕전 설정</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-28">탕전</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLowStock = item.current_stock <= LOW_STOCK_THRESHOLD;
                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-gray-100 ${isLowStock ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">{item.name}</span>
                          {item.alias && (
                            <span className="ml-2 text-xs text-gray-400">({item.alias})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.category}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-semibold ${isLowStock ? 'text-red-500' : 'text-green-600'}`}>
                            {item.current_stock}
                          </span>
                          <span className="text-gray-400 ml-1">{item.unit}</span>
                          {isLowStock && (
                            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                              부족
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {item.doses_per_batch}첩 / {item.packs_per_batch}{item.unit}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDecocionModal(item)}
                            className={`px-4 py-2 rounded-lg text-white font-medium text-sm ${
                              isLowStock
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                          >
                            탕전
                          </button>
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

      {/* 탕전 내역 탭 */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 날짜 필터 */}
          <div className="p-4 border-b border-gray-200 flex gap-3 items-center">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">시작:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">종료:</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button
              onClick={loadDecoctions}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              조회
            </button>
            <div className="flex-1" />
            <span className="text-sm text-gray-500">
              총 {decoctions.length}건 / {decoctions.reduce((sum, d) => sum + d.packs, 0)}팩
            </span>
          </div>

          {/* 탕전 내역 목록 */}
          <div className="overflow-auto max-h-[calc(100vh-420px)]">
            {loading ? (
              <div className="p-10 text-center text-gray-500">로딩 중...</div>
            ) : decoctions.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <div className="text-4xl mb-3">📋</div>
                해당 기간에 탕전 내역이 없습니다.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">탕전일</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상비약명</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">첩수</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">팩수</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {decoctions.map((d) => (
                    <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium">{d.decoction_date}</span>
                      </td>
                      <td className="px-4 py-3">{d.medicine_name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium">{d.doses}</span>첩
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-green-600">{d.packs}</span>팩
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{d.memo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 탕전 등록 모달 */}
      {showDecocionModal && selectedItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDecocionModal(false);
              setSelectedItem(null);
            }
          }}
        >
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-2">탕전 등록</h3>
            <p className="text-gray-600 mb-4">
              <strong>{selectedItem.name}</strong><br />
              현재 재고: <span className={`font-semibold ${selectedItem.current_stock <= LOW_STOCK_THRESHOLD ? 'text-red-500' : 'text-green-600'}`}>
                {selectedItem.current_stock}{selectedItem.unit}
              </span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">첩수</label>
              <input
                type="number"
                value={decocForm.doses}
                onChange={(e) => setDecocForm({ ...decocForm, doses: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">생산 팩수</label>
              <input
                type="number"
                value={decocForm.packs}
                onChange={(e) => setDecocForm({ ...decocForm, packs: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                탕전 후 재고: <span className="font-medium text-green-600">
                  {selectedItem.current_stock + decocForm.packs}{selectedItem.unit}
                </span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
              <input
                type="text"
                value={decocForm.memo}
                onChange={(e) => setDecocForm({ ...decocForm, memo: e.target.value })}
                placeholder="예: 외주 탕전"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDecocionModal(false);
                  setSelectedItem(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmitDecocion}
                disabled={isSaving}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isSaving ? '등록 중...' : '탕전 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecoctionList;
