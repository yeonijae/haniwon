import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMedicineInventory,
  searchMedicineInventory,
  useMedicineStock,
  updateMedicineUsage,
  deleteMedicineUsage,
  getMedicinePurposes,
  type MedicineInventory,
  type MedicinePurpose,
  MEDICINE_PURPOSES,
} from '../lib/api';
import type { MedicineUsage } from '../types';

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  chartNumber: string;
  patientName: string;
  usageDate: string;
  receiptId?: number;
  onSuccess?: () => void;
  editData?: MedicineUsage;  // 수정 모드용 기존 데이터
  initialSearchKeyword?: string;  // 초기 검색어
}

export function MedicineModal({
  isOpen,
  onClose,
  patientId,
  chartNumber,
  patientName,
  usageDate,
  receiptId,
  onSuccess,
  editData,
  initialSearchKeyword,
}: MedicineModalProps) {
  const isEditMode = !!editData;
  const [searchKeyword, setSearchKeyword] = useState(initialSearchKeyword || '');
  const [inventoryList, setInventoryList] = useState<MedicineInventory[]>([]);
  const [filteredList, setFilteredList] = useState<MedicineInventory[]>([]);
  const [selectedItem, setSelectedItem] = useState<MedicineInventory | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState<string>('상비약');
  const [purposeOptions, setPurposeOptions] = useState<string[]>([...MEDICINE_PURPOSES]);
  const [memo, setMemo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 수정 모드용 - 약 이름 (직접 입력)
  const [editMedicineName, setEditMedicineName] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 초기 검색어 설정
  useEffect(() => {
    if (isOpen && initialSearchKeyword && !isEditMode) {
      setSearchKeyword(initialSearchKeyword);
    }
  }, [isOpen, initialSearchKeyword, isEditMode]);

  // 수정 모드일 때 기존 데이터로 폼 초기화 (재고 목록 로드 후)
  useEffect(() => {
    if (isOpen && isEditMode && editData && inventoryList.length > 0) {
      setEditMedicineName(editData.medicine_name);
      setQuantity(editData.quantity);
      setPurpose((editData.purpose as MedicinePurpose) || '상비약');
      setMemo(editData.memo || '');
      // inventory_id로 현재 선택된 항목 찾기
      if (editData.inventory_id) {
        const currentItem = inventoryList.find(item => item.id === editData.inventory_id);
        if (currentItem) {
          setSelectedItem(currentItem);
        }
      }
    }
  }, [isOpen, isEditMode, editData, inventoryList]);

  // 상비약 재고 목록 + 사용목적 옵션 로드
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, purposes] = await Promise.all([
        getMedicineInventory(true),
        getMedicinePurposes(),
      ]);
      setInventoryList(data);
      setFilteredList(data);
      if (purposes.length > 0) {
        setPurposeOptions(purposes);
        // 기본값이 목록에 없으면 첫 번째 항목으로 설정
        if (!isEditMode && !purposes.includes(purpose)) {
          setPurpose(purposes[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || '상비약 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isEditMode, purpose]);

  // 검색
  const handleSearch = useCallback(async (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      setFilteredList(inventoryList);
      return;
    }

    try {
      const results = await searchMedicineInventory(keyword.trim());
      setFilteredList(results);
    } catch (err) {
      // 로컬 필터링 폴백
      const lowerKeyword = keyword.toLowerCase();
      setFilteredList(
        inventoryList.filter(
          (item) =>
            item.name.toLowerCase().includes(lowerKeyword) ||
            (item.alias && item.alias.toLowerCase().includes(lowerKeyword))
        )
      );
    }
  }, [inventoryList]);

  // 상비약 선택
  const handleSelectItem = (item: MedicineInventory) => {
    setSelectedItem(item);
    setQuantity(1);
    setError(null);
  };

  // 수량 변경
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  // 저장
  const handleSave = async () => {
    if (!selectedItem) {
      setError('상비약을 선택해주세요.');
      return;
    }

    if (quantity < 1) {
      setError('수량은 1 이상이어야 합니다.');
      return;
    }

    if (selectedItem.current_stock < quantity) {
      setError(`재고가 부족합니다. (현재: ${selectedItem.current_stock}${selectedItem.unit})`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await useMedicineStock(
        selectedItem.id,
        patientId,
        chartNumber,
        patientName,
        quantity,
        purpose,
        usageDate,
        memo || undefined,
        receiptId
      );

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 (편집 모드)
  const handleUpdate = async () => {
    if (!editData) return;

    if (!selectedItem) {
      setError('상비약을 선택해주세요.');
      return;
    }

    if (quantity < 1) {
      setError('수량은 1 이상이어야 합니다.');
      return;
    }

    // 약 종류가 변경되었는지 확인
    const isMedicineChanged = selectedItem.id !== editData.inventory_id;

    // 약 종류 변경 시 새 재고 확인
    if (isMedicineChanged && selectedItem.current_stock < quantity) {
      setError(`재고가 부족합니다. (현재: ${selectedItem.current_stock}${selectedItem.unit})`);
      return;
    }

    // 같은 약인데 수량 증가 시 재고 확인
    if (!isMedicineChanged && selectedItem) {
      const quantityDiff = quantity - editData.quantity;
      if (quantityDiff > 0 && selectedItem.current_stock < quantityDiff) {
        setError(`재고가 부족합니다. (추가 필요: ${quantityDiff}, 현재: ${selectedItem.current_stock}${selectedItem.unit})`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateMedicineUsage(editData.id!, {
        quantity,
        purpose,
        memo: memo || undefined,
        newInventoryId: isMedicineChanged ? selectedItem.id : undefined,
      });

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || '수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제 (편집 모드)
  const handleDelete = async () => {
    if (!editData) return;

    if (!window.confirm('이 상비약 사용 기록을 삭제하시겠습니까?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteMedicineUsage(editData.id);

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || '삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 닫기
  const handleClose = () => {
    setSearchKeyword('');
    setSelectedItem(null);
    setQuantity(1);
    setPurpose('상비약');
    setMemo('');
    setError(null);
    setEditMedicineName('');
    onClose();
  };

  // 모달 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadInventory();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, loadInventory]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter' && e.ctrlKey && selectedItem) {
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItem]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal-container"
        style={{
          background: 'white',
          borderRadius: '8px',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              {isEditMode ? '상비약 수정' : '상비약 처방'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {patientName} ({chartNumber})
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* 수정 모드: 현재 선택된 약 표시 + 변경 안내 */}
          {isEditMode && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#1e40af',
              }}
            >
              현재: <strong>{editMedicineName}</strong> ({editData?.quantity}개)
              {selectedItem && selectedItem.id !== editData?.inventory_id && (
                <span style={{ marginLeft: '8px', color: '#dc2626' }}>
                  → <strong>{selectedItem.name}</strong>으로 변경
                </span>
              )}
            </div>
          )}

          {/* 검색 */}
          <div style={{ marginBottom: '16px' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="상비약 이름 또는 별명으로 검색..."
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          {/* 상비약 목록 */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              maxHeight: '200px',
              overflow: 'auto',
            }}
          >
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                로딩 중...
              </div>
            ) : filteredList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                {searchKeyword ? '검색 결과가 없습니다.' : '등록된 상비약이 없습니다.'}
              </div>
            ) : (
              filteredList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: selectedItem?.id === item.id ? '#eff6ff' : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedItem?.id !== item.id) {
                      e.currentTarget.style.background = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedItem?.id !== item.id) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    {item.alias && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#9ca3af' }}>
                        ({item.alias})
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        color: '#6b7280',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span
                      style={{
                        color: item.current_stock <= 5 ? '#ef4444' : '#059669',
                        fontWeight: 500,
                      }}
                    >
                      {item.current_stock}
                    </span>
                    <span style={{ color: '#9ca3af' }}>{item.unit}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 선택된 항목 상세 */}
          {selectedItem && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '6px',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                  선택된 상비약
                </label>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>
                  {selectedItem.name}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                {/* 수량 */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                    수량 ({selectedItem.unit})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      style={{
                        width: '32px',
                        height: '32px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '60px',
                        textAlign: 'center',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                      }}
                    />
                    <button
                      onClick={() => handleQuantityChange(1)}
                      style={{
                        width: '32px',
                        height: '32px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '16px',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 목적 */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                    목적
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  >
                    {purposeOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                  메모 (선택)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="필요시 메모 입력"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: isEditMode ? 'space-between' : 'flex-end',
            gap: '8px',
          }}
        >
          {isEditMode ? (
            <>
              {/* 삭제 버튼 (왼쪽) */}
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleClose}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!selectedItem || isSaving || isDeleting}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    background: selectedItem && !isSaving && !isDeleting ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    cursor: selectedItem && !isSaving && !isDeleting ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  {isSaving ? '수정 중...' : '수정'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedItem || isSaving}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: selectedItem && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  cursor: selectedItem && !isSaving ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {isSaving ? '저장 중...' : '처방 (Ctrl+Enter)'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MedicineModal;
