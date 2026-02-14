import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { query, execute, escapeString, insert } from '@shared/lib/postgres';

interface MedicineStock {
  id: number;
  prescription_id: string;
  name: string;
  category: string;
  current_stock: number;
}

interface MedicineUsageRecord {
  id: number;
  inventory_id: number;
  medicine_name: string;
  quantity: number;
  purpose: string;
  usage_date: string;
  created_at: string;
}

const MedicineContent: React.FC<ContentComponentProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  itemName,
  detailId,
  isEditMode,
  onSuccess,
  onClose,
}) => {
  const [medicineStocks, setMedicineStocks] = useState<MedicineStock[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineStock | null>(null);
  const [medicineQty, setMedicineQty] = useState(1);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [medicinePurpose, setMedicinePurpose] = useState('');
  const [purposeOptions, setPurposeOptions] = useState<string[]>(['감기약', '상비약', '보완처방', '증정', '치료약']);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 수정 모드 상태
  const [existingRecords, setExistingRecords] = useState<MedicineUsageRecord[]>([]);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 초기 검색어/목적 설정
  useEffect(() => {
    // 검색어 초기값
    if (itemName.includes('공진단')) {
      setMedicineSearch('공진단');
    } else if (itemName.includes('경옥고')) {
      setMedicineSearch('경옥고');
    } else {
      setMedicineSearch('');
    }

    // 목적 초기값
    if (itemName.includes('감기약')) {
      setMedicinePurpose('감기약');
    } else if (itemName.includes('치료약')) {
      setMedicinePurpose('치료약');
    } else if (itemName.includes('보완처방')) {
      setMedicinePurpose('보완처방');
    } else if (itemName.includes('증정')) {
      setMedicinePurpose('증정');
    } else {
      setMedicinePurpose('상비약');
    }
  }, [itemName]);

  // 목적 설정 로딩
  useEffect(() => {
    const loadPurposes = async () => {
      try {
        const rows = await query<{ value: string }>(
          `SELECT value FROM cs_settings WHERE key = 'medicine_purposes'`
        );
        if (rows.length > 0 && rows[0].value) {
          const parsed = JSON.parse(rows[0].value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPurposeOptions(parsed);
          }
        }
      } catch (err) {
        // 기본값 유지
      }
    };
    loadPurposes();
  }, []);

  // 약품 검색
  const searchMedicines = useCallback(async (searchTerm: string) => {
    setIsLoading(true);
    try {
      const escapedSearch = searchTerm.replace(/'/g, "''");
      const rows = await query<MedicineStock>(
        `SELECT id, prescription_id, name, category, current_stock FROM cs_medicine_inventory WHERE current_stock > 0 AND name ILIKE '%${escapedSearch}%' ORDER BY name ASC LIMIT 30`
      );
      setMedicineStocks(rows);
    } catch (err) {
      console.error('약품 검색 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchMedicines(medicineSearch);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [medicineSearch, searchMedicines]);

  // 수정 모드: 기존 기록 조회
  useEffect(() => {
    if (!isEditMode || !detailId) return;
    const loadExistingRecords = async () => {
      setIsEditLoading(true);
      try {
        const rows = await query<MedicineUsageRecord>(
          `SELECT id, inventory_id, medicine_name, quantity, purpose, usage_date, created_at FROM cs_medicine_usage WHERE mssql_detail_id = ${detailId}`
        );
        setExistingRecords(rows);
      } catch (err) {
        console.error('기존 기록 조회 오류:', err);
      } finally {
        setIsEditLoading(false);
      }
    };
    loadExistingRecords();
  }, [isEditMode, detailId]);

  // 수정 모드: 삭제(되돌리기) 처리
  const handleDeleteRecord = async (record: MedicineUsageRecord) => {
    if (!confirm('이 기록을 삭제하시겠습니까? 재고가 복원됩니다.')) return;
    setIsDeleting(true);
    try {
      await execute(`UPDATE cs_medicine_inventory SET current_stock = current_stock + ${record.quantity} WHERE id = ${record.inventory_id}`);
      await execute(`DELETE FROM cs_medicine_usage WHERE id = ${record.id}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('기록 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 차감 처리
  const handleDeduct = async () => {
    if (!selectedMedicine) {
      alert('약품을 선택해주세요.');
      return;
    }
    if (selectedMedicine.current_stock < medicineQty) {
      alert(`재고가 부족합니다. (현재 재고: ${selectedMedicine.current_stock})`);
      return;
    }
    setIsSaving(true);
    try {
      await execute(`UPDATE cs_medicine_inventory SET current_stock = current_stock - ${medicineQty}, updated_at = NOW() WHERE id = ${selectedMedicine.id}`);
      await insert(`INSERT INTO cs_medicine_usage (patient_id, chart_number, patient_name, inventory_id, medicine_name, quantity, usage_date, receipt_id, mssql_detail_id, purpose, created_at) VALUES (${patientId}, ${escapeString(chartNumber)}, ${escapeString(patientName)}, ${selectedMedicine.id}, ${escapeString(selectedMedicine.name)}, ${medicineQty}, ${escapeString(receiptDate)}, ${receiptId}, ${detailId || 'NULL'}, ${escapeString(medicinePurpose)}, NOW())`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('상비약 차감 오류:', err);
      alert('차감 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 모드 렌더링
  if (isEditMode && detailId) {
    return (
      <div style={{ padding: '0 12px 12px' }}>
        {isEditLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
            <i className="fa-solid fa-spinner fa-spin"></i> 기록 조회 중...
          </div>
        ) : existingRecords.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            연결된 약품 사용 기록이 없습니다.
          </div>
        ) : (
          existingRecords.map(record => (
            <div key={record.id} style={{ marginBottom: '12px' }}>
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '12px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                  {record.medicine_name}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    수량: <span style={{ color: '#1F2937', fontWeight: 500 }}>{record.quantity}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    목적: <span style={{ color: '#1F2937', fontWeight: 500 }}>{record.purpose}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    사용일: {record.usage_date}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    등록일: {record.created_at}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRecord(record)}
                  disabled={isDeleting}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    borderRadius: '6px',
                    background: isDeleting ? '#D1D5DB' : '#DC2626',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isDeleting ? '처리 중...' : '삭제 (되돌리기)'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {/* 검색 */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>약품 검색</div>
        <input
          type="text"
          value={medicineSearch}
          onChange={e => setMedicineSearch(e.target.value)}
          placeholder="약품명 검색..."
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 약품 목록 */}
      <div style={{
        marginBottom: '10px',
        maxHeight: '150px',
        overflowY: 'auto',
        border: '1px solid #E5E7EB',
        borderRadius: '6px',
      }}>
        {isLoading ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
            <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : medicineStocks.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          medicineStocks.map(med => (
            <div
              key={med.id}
              onClick={() => setSelectedMedicine(med)}
              style={{
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: selectedMedicine?.id === med.id ? '#EEF2FF' : '#fff',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              <span style={{ fontSize: '12px', color: '#1F2937' }}>{med.name}</span>
              <span style={{ fontSize: '11px', color: '#6B7280' }}>재고 {med.current_stock}</span>
            </div>
          ))
        )}
      </div>

      {/* 선택된 약품 + 수량 + 목적 */}
      {selectedMedicine && (
        <div style={{
          marginBottom: '12px',
          padding: '10px 12px',
          background: '#F0F4FF',
          borderRadius: '6px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', marginBottom: '8px' }}>
            {selectedMedicine.name} (재고: {selectedMedicine.current_stock})
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>수량</div>
              <input
                type="number"
                min={1}
                max={selectedMedicine.current_stock}
                value={medicineQty}
                onChange={e => setMedicineQty(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>목적</div>
              <select
                value={medicinePurpose}
                onChange={e => setMedicinePurpose(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: '#fff',
                }}
              >
                {purposeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 차감 버튼 */}
      <button
        onClick={handleDeduct}
        disabled={isSaving || !selectedMedicine}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          background: isSaving || !selectedMedicine ? '#D1D5DB' : '#667eea',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isSaving || !selectedMedicine ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? '처리 중...' : '차감'}
      </button>
    </div>
  );
};

export default MedicineContent;
