import { useState, useEffect, useCallback } from 'react';
import {
  getMedicineInventory,
  getMedicineDecoctions,
  addMedicineStock,
  type MedicineInventory,
  type MedicineDecoction,
} from '../lib/api';

interface DecocionManagementViewProps {
  onClose?: () => void;
}

function DecocionManagementView({ onClose }: DecocionManagementViewProps) {
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
  const LOW_STOCK_THRESHOLD = 10;

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

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 통계
  const stats = {
    totalItems: inventory.length,
    lowStock: lowStockCount,
    totalDecoctions: decoctions.length,
    totalPacks: decoctions.reduce((sum, d) => sum + d.packs, 0),
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>탕전 관리</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            상비약 재고 현황 및 탕전 내역 관리
          </p>
        </div>
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

      {/* 통계 카드 */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div
          style={{
            flex: 1,
            padding: '16px',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
          }}
        >
          <div style={{ fontSize: '13px', color: '#0369a1' }}>등록 상비약</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#0c4a6e' }}>{stats.totalItems}종</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: '16px',
            background: lowStockCount > 0 ? '#fef2f2' : '#f0fdf4',
            borderRadius: '8px',
            border: `1px solid ${lowStockCount > 0 ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          <div style={{ fontSize: '13px', color: lowStockCount > 0 ? '#dc2626' : '#16a34a' }}>
            재고 부족 ({LOW_STOCK_THRESHOLD}팩 이하)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: lowStockCount > 0 ? '#991b1b' : '#14532d' }}>
            {stats.lowStock}종
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: '16px',
            background: '#fefce8',
            borderRadius: '8px',
            border: '1px solid #fef08a',
          }}
        >
          <div style={{ fontSize: '13px', color: '#a16207' }}>최근 30일 탕전</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#713f12' }}>{stats.totalDecoctions}회</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: '16px',
            background: '#f5f3ff',
            borderRadius: '8px',
            border: '1px solid #ddd6fe',
          }}
        >
          <div style={{ fontSize: '13px', color: '#7c3aed' }}>최근 30일 생산</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#4c1d95' }}>{stats.totalPacks}팩</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'stock' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'stock' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          재고 현황
          {lowStockCount > 0 && (
            <span
              style={{
                marginLeft: '6px',
                padding: '2px 6px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                fontSize: '11px',
              }}
            >
              {lowStockCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'history' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'history' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          탕전 내역
        </button>
      </div>

      {/* 재고 현황 탭 */}
      {activeTab === 'stock' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 필터 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
              />
              <span style={{ color: '#ef4444', fontWeight: 500 }}>재고 부족만 표시</span>
            </label>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              총 {filteredInventory.length}종
            </span>
          </div>

          {/* 재고 목록 */}
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>로딩 중...</div>
            ) : filteredInventory.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                {showLowStockOnly ? '재고 부족 상비약이 없습니다.' : '등록된 상비약이 없습니다.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>상비약명</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>분류</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>현재 재고</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>탕전 설정</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500, width: '120px' }}>탕전</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLowStock = item.current_stock <= LOW_STOCK_THRESHOLD;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: isLowStock ? '#fef2f2' : 'white',
                        }}
                      >
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                          {item.alias && (
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#9ca3af' }}>
                              ({item.alias})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              background: '#f3f4f6',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: isLowStock ? '#dc2626' : '#059669',
                            }}
                          >
                            {item.current_stock}
                          </span>
                          <span style={{ color: '#9ca3af', marginLeft: '2px' }}>{item.unit}</span>
                          {isLowStock && (
                            <span
                              style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                background: '#fee2e2',
                                color: '#dc2626',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}
                            >
                              부족
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                          {item.doses_per_batch}첩 / {item.packs_per_batch}{item.unit}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenDecocionModal(item)}
                            style={{
                              padding: '6px 16px',
                              border: 'none',
                              borderRadius: '6px',
                              background: isLowStock ? '#ef4444' : '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '13px',
                            }}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 날짜 필터 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>시작:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>종료:</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
            </label>
            <button
              onClick={loadDecoctions}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              조회
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              총 {decoctions.length}건 / {decoctions.reduce((sum, d) => sum + d.packs, 0)}팩
            </span>
          </div>

          {/* 탕전 내역 목록 */}
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>로딩 중...</div>
            ) : decoctions.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                해당 기간에 탕전 내역이 없습니다.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>탕전일</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>상비약명</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>첩수</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 500 }}>팩수</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 500 }}>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {decoctions.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontWeight: 500 }}>{d.decoction_date}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {d.medicine_name || '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{d.doses}</span>첩
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#059669' }}>{d.packs}</span>팩
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>
                        {d.memo || '-'}
                      </td>
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
              setShowDecocionModal(false);
              setSelectedItem(null);
            }
          }}
        >
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '400px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>탕전 등록</h3>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '14px' }}>
              <strong>{selectedItem.name}</strong>
              <br />
              현재 재고: <span style={{ color: selectedItem.current_stock <= LOW_STOCK_THRESHOLD ? '#dc2626' : '#059669', fontWeight: 600 }}>
                {selectedItem.current_stock}{selectedItem.unit}
              </span>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                첩수
              </label>
              <input
                type="number"
                value={decocForm.doses}
                onChange={(e) => setDecocForm({ ...decocForm, doses: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                생산 팩수
              </label>
              <input
                type="number"
                value={decocForm.packs}
                onChange={(e) => setDecocForm({ ...decocForm, packs: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                탕전 후 재고: {selectedItem.current_stock + decocForm.packs}{selectedItem.unit}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                메모 (선택)
              </label>
              <input
                type="text"
                value={decocForm.memo}
                onChange={(e) => setDecocForm({ ...decocForm, memo: e.target.value })}
                placeholder="예: 외주 탕전"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDecocionModal(false);
                  setSelectedItem(null);
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmitDecocion}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: isSaving ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
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

export default DecocionManagementView;
