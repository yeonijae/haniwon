import React, { useState, useCallback, useRef, useEffect } from 'react';
import { searchMedicineInventory } from '../../lib/api';
import type { MedicineInventory } from '../../lib/api';

export interface SelectedMedicine {
  inventoryId: number;
  name: string;
  quantity: number;
  currentStock: number;
  unit: string;
}

interface MedicineSearchSelectProps {
  medicines: SelectedMedicine[];
  onChange: (medicines: SelectedMedicine[]) => void;
  hideLabel?: boolean;
}

export default function MedicineSearchSelect({ medicines, onChange, hideLabel }: MedicineSearchSelectProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<MedicineInventory[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 디바운스 검색
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchMedicineInventory(value.trim());
        // 이미 선택된 항목 제외
        const selectedIds = new Set(medicines.map(m => m.inventoryId));
        setResults(data.filter(d => !selectedIds.has(d.id)));
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [medicines]);

  // 약 선택
  const handleSelect = useCallback((item: MedicineInventory) => {
    onChange([...medicines, {
      inventoryId: item.id,
      name: item.name,
      quantity: 1,
      currentStock: item.current_stock,
      unit: item.unit,
    }]);
    setKeyword('');
    setResults([]);
    setShowDropdown(false);
  }, [medicines, onChange]);

  // 수량 변경
  const handleQuantityChange = useCallback((idx: number, delta: number) => {
    const updated = [...medicines];
    const item = updated[idx];
    const newQty = item.quantity + delta;
    if (newQty < 1 || newQty > item.currentStock) return;
    updated[idx] = { ...item, quantity: newQty };
    onChange(updated);
  }, [medicines, onChange]);

  // 삭제
  const handleRemove = useCallback((idx: number) => {
    onChange(medicines.filter((_, i) => i !== idx));
  }, [medicines, onChange]);

  return (
    <div className="herbal-draft-section" ref={wrapperRef}>
      {!hideLabel && <span className="herbal-draft-section-label">상비약 선택</span>}

      {/* 선택된 약 목록 */}
      {medicines.length > 0 && (
        <div className="med-search-selected-list">
          {medicines.map((med, idx) => (
            <div key={med.inventoryId} className="med-search-selected-item">
              <span className="med-search-item-name">{med.name}</span>
              <div className="med-search-qty-controls">
                <button type="button" className="med-search-qty-btn" onClick={() => handleQuantityChange(idx, -1)}>-</button>
                <span className="med-search-qty-value">{med.quantity}</span>
                <button type="button" className="med-search-qty-btn" onClick={() => handleQuantityChange(idx, 1)}>+</button>
                <span className="med-search-stock-info">
                  ({med.currentStock}{med.unit})
                </span>
              </div>
              <button type="button" className="med-search-remove-btn" onClick={() => handleRemove(idx)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 검색 입력 */}
      <div className="med-search-input-wrapper">
        <i className="fa-solid fa-magnifying-glass med-search-icon" />
        <input
          type="text"
          className="herbal-draft-input med-search-input"
          value={keyword}
          onChange={e => handleKeywordChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          placeholder="약 이름 또는 별명으로 검색"
        />
        {searching && <span className="med-search-spinner">...</span>}
      </div>

      {/* 검색 결과 드롭다운 */}
      {showDropdown && results.length > 0 && (
        <div className="med-search-dropdown">
          {results.map(item => {
            const lowStock = item.current_stock <= 5;
            const noStock = item.current_stock <= 0;
            return (
              <div
                key={item.id}
                className={`med-search-dropdown-item${noStock ? ' disabled' : ''}`}
                onClick={() => !noStock && handleSelect(item)}
              >
                <div className="med-search-dropdown-name">
                  {item.name}
                  {item.alias && <span className="med-search-alias">{item.alias}</span>}
                </div>
                <span className={`med-search-dropdown-stock${lowStock ? ' low' : ''}${noStock ? ' empty' : ''}`}>
                  {noStock ? '재고없음' : `${item.current_stock}${item.unit}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {showDropdown && keyword.trim() && results.length === 0 && !searching && (
        <div className="med-search-dropdown">
          <div className="med-search-dropdown-empty">검색 결과 없음</div>
        </div>
      )}

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .med-search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .med-search-icon {
    position: absolute;
    left: 10px;
    color: #9ca3af;
    font-size: 12px;
    pointer-events: none;
  }
  .med-search-input {
    padding-left: 30px !important;
  }
  .med-search-spinner {
    position: absolute;
    right: 10px;
    color: #9ca3af;
    font-size: 12px;
  }
  .med-search-dropdown {
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .med-search-dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.1s;
  }
  .med-search-dropdown-item:hover {
    background: #f3f4f6;
  }
  .med-search-dropdown-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .med-search-dropdown-item.disabled:hover {
    background: transparent;
  }
  .med-search-dropdown-name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .med-search-alias {
    font-size: 11px;
    color: #9ca3af;
  }
  .med-search-dropdown-stock {
    font-size: 12px;
    font-weight: 600;
    color: #22c55e;
  }
  .med-search-dropdown-stock.low {
    color: #f59e0b;
  }
  .med-search-dropdown-stock.empty {
    color: #ef4444;
  }
  .med-search-dropdown-empty {
    padding: 12px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
  }
  .med-search-selected-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .med-search-selected-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    font-size: 13px;
  }
  .med-search-item-name {
    font-weight: 600;
    color: #166534;
    min-width: 60px;
  }
  .med-search-qty-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  .med-search-qty-btn {
    width: 22px;
    height: 22px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .med-search-qty-btn:hover {
    background: #f3f4f6;
  }
  .med-search-qty-value {
    min-width: 20px;
    text-align: center;
    font-weight: 600;
  }
  .med-search-stock-info {
    font-size: 11px;
    color: #6b7280;
  }
  .med-search-remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 2px;
    font-size: 12px;
  }
  .med-search-remove-btn:hover {
    color: #ef4444;
  }
`;
