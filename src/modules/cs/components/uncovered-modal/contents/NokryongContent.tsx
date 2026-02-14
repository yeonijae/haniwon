import React, { useState, useEffect } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { query, execute } from '@shared/lib/postgres';
import { getActiveNokryongPackages, useNokryongPackage, addReceiptMemo } from '../../../lib/api';
import type { NokryongPackage } from '../../../types';

interface MemoRecord {
  id: number;
  memo: string;
  created_at: string;
}

const NokryongContent: React.FC<ContentComponentProps> = ({
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
  onMemoRefresh,
}) => {
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [selectedNokryong, setSelectedNokryong] = useState<NokryongPackage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 수정 모드 상태
  const [existingMemo, setExistingMemo] = useState<MemoRecord | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const packages = await getActiveNokryongPackages(patientId);
        setNokryongPackages(packages);
        if (packages.length > 0) {
          setSelectedNokryong(packages[0]);
        }
      } catch (err) {
        console.error('녹용 데이터 로딩 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [patientId]);

  // 수정 모드: 기존 메모 로딩
  useEffect(() => {
    if (!isEditMode || !detailId) return;
    const loadExistingMemo = async () => {
      setIsEditLoading(true);
      try {
        const memos = await query<MemoRecord>(
          `SELECT id, memo, created_at FROM cs_receipt_memos WHERE mssql_detail_id = ${detailId} AND mssql_receipt_id = ${receiptId} ORDER BY created_at DESC LIMIT 1`
        );
        if (memos.length > 0) {
          setExistingMemo(memos[0]);
        }
      } catch (err) {
        console.error('녹용 메모 로딩 오류:', err);
      } finally {
        setIsEditLoading(false);
      }
    };
    loadExistingMemo();
  }, [isEditMode, detailId, receiptId]);

  // 수정 모드: 삭제 (되돌리기) 처리
  const handleDelete = async () => {
    if (!confirm('이 기록을 삭제하시겠습니까? 녹용 패키지 차감이 복원됩니다.')) return;
    setIsDeleting(true);
    try {
      // 녹용 패키지 복원: 가장 최근 사용된 패키지를 찾아서 복원
      await execute(
        `UPDATE cs_nokryong_packages SET used_months = used_months - 1, remaining_months = remaining_months + 1, status = 'active', updated_at = NOW() WHERE id = (SELECT id FROM cs_nokryong_packages WHERE patient_id = ${patientId} AND status IN ('active', 'completed') ORDER BY updated_at DESC LIMIT 1)`
      );
      // 연관 메모 삭제
      await execute(
        `DELETE FROM cs_receipt_memos WHERE mssql_detail_id = ${detailId} AND mssql_receipt_id = ${receiptId}`
      );
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('녹용 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 녹용 차감 처리
  const handleDeduct = async () => {
    if (!selectedNokryong || selectedNokryong.remaining_months <= 0) {
      alert('차감 가능한 녹용 패키지를 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await useNokryongPackage(selectedNokryong.id!);
      const usedDoses = selectedNokryong.total_months - selectedNokryong.remaining_months + 1;
      const memoText = `녹용차감(${usedDoses}/${selectedNokryong.total_months}회분)`;
      await addReceiptMemo({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        mssql_receipt_id: receiptId,
        mssql_detail_id: detailId,
        receipt_date: receiptDate,
        memo: memoText,
      });
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('녹용 차감 오류:', err);
      alert('차감 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 모드 렌더링
  if (isEditMode && detailId) {
    if (isEditLoading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
          <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
        </div>
      );
    }

    if (!existingMemo) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
          연결된 녹용 기록을 찾을 수 없습니다.
        </div>
      );
    }

    return (
      <div style={{ padding: '0 12px 12px' }}>
        {/* 기존 기록 요약 카드 */}
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, marginBottom: '6px' }}>
            {existingMemo.memo}
          </div>
          <div style={{ fontSize: '11px', color: '#6B7280' }}>
            등록일: {existingMemo.created_at}
          </div>
        </div>

        {/* 삭제 (되돌리기) 버튼 */}
        <button
          onClick={handleDelete}
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
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
      </div>
    );
  }

  if (nokryongPackages.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
        활성 녹용 패키지가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {/* 녹용 패키지 선택 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>녹용 패키지</div>
        {nokryongPackages.length === 1 ? (
          <div style={{
            padding: '10px 12px',
            background: '#F9FAFB',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#374151',
          }}>
            {nokryongPackages[0].package_name}
          </div>
        ) : (
          <select
            value={selectedNokryong?.id ?? ''}
            onChange={e => {
              const pkg = nokryongPackages.find(p => p.id === Number(e.target.value));
              setSelectedNokryong(pkg || null);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#fff',
            }}
          >
            {nokryongPackages.map(pkg => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.package_name} - 잔여 {pkg.remaining_months}회분
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 선택 패키지 정보 */}
      {selectedNokryong && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 12px',
          background: '#FFFBEB',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#92400E',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedNokryong.package_name}</div>
          <div>
            총 {selectedNokryong.total_months}회분 | 잔여 {selectedNokryong.remaining_months}회분
          </div>
          {selectedNokryong.remaining_months <= 0 && (
            <div style={{ color: '#DC2626', marginTop: '4px', fontWeight: 500 }}>
              잔여 횟수가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 차감 버튼 */}
      <button
        onClick={handleDeduct}
        disabled={isSaving || !selectedNokryong || selectedNokryong.remaining_months <= 0}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          background: isSaving || !selectedNokryong || selectedNokryong.remaining_months <= 0 ? '#D1D5DB' : '#667eea',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isSaving || !selectedNokryong || selectedNokryong.remaining_months <= 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? '처리 중...' : '차감'}
      </button>
    </div>
  );
};

export default NokryongContent;
