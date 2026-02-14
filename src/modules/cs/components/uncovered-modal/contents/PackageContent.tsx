import React, { useState, useEffect } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { getPackageTypes, createTreatmentPackage } from '../../../lib/api';
import type { PackageType } from '../../../lib/api';
import { query, execute } from '@shared/lib/postgres';

interface PackageRecord {
  id: number;
  package_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  start_date: string;
  memo: string | null;
  created_at: string;
}

const PackageContent: React.FC<ContentComponentProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptDate,
  itemName,
  detailId,
  isEditMode,
  onSuccess,
  onClose,
}) => {
  const [packageTypeOptions, setPackageTypeOptions] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [packageCount, setPackageCount] = useState(10);
  const [packageMemo, setPackageMemo] = useState('');
  const isPointPackage = itemName.includes('포인트');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 수정 모드 상태
  const [existingRecords, setExistingRecords] = useState<PackageRecord[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 수정 모드: 기존 패키지 레코드 조회
        if (isEditMode && detailId) {
          const records = await query<PackageRecord>(
            `SELECT id, package_name, total_count, used_count, remaining_count, start_date, memo, created_at
             FROM cs_treatment_packages
             WHERE mssql_detail_id = ${detailId}`
          );
          setExistingRecords(records);
        }

        const types = await getPackageTypes();
        const deductionTypes = types.filter((t: PackageType) => t.type === 'deduction');
        setPackageTypeOptions(deductionTypes.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
        })));
        if (isPointPackage) {
          setSelectedPackageType(itemName);
        } else if (deductionTypes.length > 0) {
          setSelectedPackageType(deductionTypes[0].name);
        }
      } catch (err) {
        console.error('패키지 종류 로딩 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [itemName, isPointPackage, isEditMode, detailId]);

  // 패키지 삭제 처리
  const handleDeletePackage = async (recordId: number) => {
    if (!confirm('이 패키지를 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await execute(`DELETE FROM cs_treatment_packages WHERE id = ${recordId}`);
      setExistingRecords(prev => prev.filter(r => r.id !== recordId));
      onSuccess?.();
      if (existingRecords.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error('패키지 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 등록 처리
  const handleRegister = async () => {
    if (!selectedPackageType) {
      alert('패키지 종류를 선택해주세요.');
      return;
    }
    if (packageCount <= 0) {
      alert('횟수를 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const packageName = isPointPackage ? itemName : selectedPackageType;
      await createTreatmentPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: packageName,
        total_count: packageCount,
        used_count: 0,
        remaining_count: packageCount,
        includes: undefined,
        start_date: receiptDate,
        expire_date: undefined,
        memo: packageMemo || undefined,
        mssql_detail_id: detailId,
        status: 'active',
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('패키지 등록 오류:', err);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
      </div>
    );
  }

  // 수정 모드 렌더링
  if (isEditMode && detailId && existingRecords.length > 0) {
    return (
      <div style={{ padding: '0 12px 12px' }}>
        {existingRecords.map(record => (
          <div key={record.id} style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>패키지명</div>
              <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.package_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>총 횟수</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.total_count}회</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>사용</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.used_count}회</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>잔여</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.remaining_count}회</div>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>시작일</div>
              <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.start_date}</div>
            </div>
            {record.memo && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>메모</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.memo}</div>
              </div>
            )}
            <button
              onClick={() => handleDeletePackage(record.id)}
              disabled={isDeleting}
              style={{
                width: '100%',
                padding: '10px',
                background: isDeleting ? '#D1D5DB' : '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {/* 패키지 종류 선택 */}
      {!isPointPackage && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>패키지 종류</div>
          {packageTypeOptions.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px 0' }}>
              등록된 패키지 종류가 없습니다.
            </div>
          ) : (
            <select
              value={selectedPackageType}
              onChange={e => setSelectedPackageType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              {packageTypeOptions.map(opt => (
                <option key={opt.id} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {isPointPackage && (
        <div style={{
          marginBottom: '12px',
          padding: '10px 12px',
          background: '#F0F4FF',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#4338CA',
          fontWeight: 500,
        }}>
          포인트 패키지: {itemName}
        </div>
      )}

      {/* 횟수 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>횟수</div>
        <input
          type="number"
          min={1}
          value={packageCount}
          onChange={e => setPackageCount(Math.max(1, parseInt(e.target.value) || 1))}
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

      {/* 메모 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>메모</div>
        <input
          type="text"
          value={packageMemo}
          onChange={e => setPackageMemo(e.target.value)}
          placeholder="메모 (선택)"
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

      {/* 등록 버튼 */}
      <button
        onClick={handleRegister}
        disabled={isSaving || !selectedPackageType}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          background: isSaving || !selectedPackageType ? '#D1D5DB' : '#667eea',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isSaving || !selectedPackageType ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? '처리 중...' : '등록'}
      </button>
    </div>
  );
};

export default PackageContent;
