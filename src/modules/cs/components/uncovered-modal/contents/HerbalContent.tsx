import React, { useState, useEffect } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { getActiveHerbalPackages, getActiveNokryongPackages, getUnlinkedHerbalPackages, linkPackageToReceipt, createHerbalPickup, addReceiptMemo } from '../../../lib/api';
import { query, execute } from '@shared/lib/postgres';
import type { HerbalPackage, NokryongPackage, DeliveryMethod } from '../../../types';
import { PACKAGE_TYPE_LABELS, DELIVERY_METHOD_LABELS } from '../../../types';

interface HerbalPickupRecord {
  id: number;
  package_id: number;
  round_number: number;
  delivery_method: DeliveryMethod;
  with_nokryong: boolean;
  nokryong_package_id: number | null;
  pickup_date: string;
  created_at: string;
  herbal_name: string;
}

const HerbalContent: React.FC<ContentComponentProps> = ({
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
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [selectedHerbal, setSelectedHerbal] = useState<HerbalPackage | null>(null);
  const [selectedNokryong, setSelectedNokryong] = useState<NokryongPackage | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [withNokryong, setWithNokryong] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingPickup, setExistingPickup] = useState<HerbalPickupRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // 연결 모드
  const [mode, setMode] = useState<'deduct' | 'link'>('deduct');
  const [unlinkedPackages, setUnlinkedPackages] = useState<HerbalPackage[]>([]);
  const [selectedUnlinked, setSelectedUnlinked] = useState<HerbalPackage | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [herbals, nokryongs, unlinked] = await Promise.all([
          getActiveHerbalPackages(patientId),
          getActiveNokryongPackages(patientId),
          getUnlinkedHerbalPackages(patientId),
        ]);
        setHerbalPackages(herbals);
        if (herbals.length > 0) {
          setSelectedHerbal(herbals[0]);
        }
        setNokryongPackages(nokryongs);
        if (nokryongs.length > 0) {
          setSelectedNokryong(nokryongs[0]);
        }
        setUnlinkedPackages(unlinked);
        if (unlinked.length > 0) {
          setSelectedUnlinked(unlinked[0]);
        }
      } catch (err) {
        console.error('한약 데이터 로딩 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [patientId]);

  // 수정 모드: 기존 픽업 기록 로딩
  useEffect(() => {
    if (!isEditMode || !detailId) return;
    const loadExistingPickup = async () => {
      try {
        const rows = await query<HerbalPickupRecord>(
          `SELECT hp.*, pkg.herbal_name FROM cs_herbal_pickups hp LEFT JOIN cs_herbal_packages pkg ON hp.package_id = pkg.id WHERE hp.receipt_id = ${receiptId} AND hp.patient_id = ${patientId}`
        );
        if (rows.length > 0) {
          setExistingPickup(rows[0]);
        }
      } catch (err) {
        console.error('기존 한약 픽업 기록 로딩 오류:', err);
      }
    };
    loadExistingPickup();
  }, [isEditMode, detailId, receiptId, patientId]);

  // 수정 모드: 삭제 (되돌리기) 처리
  const handleDelete = async () => {
    if (!existingPickup) return;
    if (!confirm('이 기록을 삭제하시겠습니까? 한약 패키지 차감이 복원됩니다.')) return;

    setIsDeleting(true);
    try {
      // 한약 패키지 복원
      await execute(
        `UPDATE cs_herbal_packages SET used_count = used_count - 1, remaining_count = remaining_count + 1, status = 'active' WHERE id = ${existingPickup.package_id}`
      );

      // 녹용 패키지 복원
      if (existingPickup.with_nokryong && existingPickup.nokryong_package_id) {
        await execute(
          `UPDATE cs_nokryong_packages SET used_months = used_months - 1, remaining_months = remaining_months + 1, status = 'active' WHERE id = ${existingPickup.nokryong_package_id}`
        );
      }

      // 픽업 기록 삭제
      await execute(`DELETE FROM cs_herbal_pickups WHERE id = ${existingPickup.id}`);

      // 연관 메모 삭제
      await execute(
        `DELETE FROM cs_receipt_memos WHERE mssql_detail_id = ${detailId} AND mssql_receipt_id = ${receiptId}`
      );

      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('한약 픽업 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 기존 패키지 연결 처리
  const handleLinkPackage = async () => {
    if (!selectedUnlinked || !detailId) return;
    setIsLinking(true);
    try {
      await linkPackageToReceipt(selectedUnlinked.id!, detailId);

      await addReceiptMemo({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        mssql_receipt_id: receiptId,
        mssql_detail_id: detailId,
        receipt_date: receiptDate,
        memo: `선결연결: ${selectedUnlinked.herbal_name} (${PACKAGE_TYPE_LABELS[selectedUnlinked.package_type] || selectedUnlinked.package_type})`,
      });

      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('패키지 연결 오류:', err);
      alert('연결 중 오류가 발생했습니다.');
    } finally {
      setIsLinking(false);
    }
  };

  // 한약 차감 처리
  const handleHerbalDeduct = async () => {
    if (!selectedHerbal || selectedHerbal.remaining_count <= 0) {
      alert('차감 가능한 한약 패키지를 선택해주세요.');
      return;
    }
    if (withNokryong && (!selectedNokryong || selectedNokryong.remaining_months <= 0)) {
      alert('녹용 패키지의 잔여 횟수가 부족합니다.');
      return;
    }
    setIsSaving(true);
    try {
      const nextRound = selectedHerbal.used_count + 1;
      const pickupId = await createHerbalPickup({
        package_id: selectedHerbal.id!,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        pickup_date: receiptDate,
        round_number: nextRound,
        delivery_method: deliveryMethod,
        with_nokryong: withNokryong,
        nokryong_package_id: withNokryong ? selectedNokryong?.id : undefined,
        receipt_id: receiptId,
      });

      let memoText = `선결(${selectedHerbal.total_count}-${nextRound})`;
      if (withNokryong) memoText += '+녹용';

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
      console.error('한약 차감 오류:', err);
      alert('차감 중 오류가 발생했습니다.');
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

  // 수정 모드: 기존 기록 요약 + 삭제 버튼
  if (isEditMode && detailId) {
    if (!existingPickup) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
          연결된 한약 픽업 기록을 찾을 수 없습니다.
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
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', marginBottom: '8px' }}>
            기존 한약 픽업 기록
          </div>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.8' }}>
            <div>한약: {existingPickup.herbal_name || '-'}</div>
            <div>회차: {existingPickup.round_number}회차</div>
            <div>배송방법: {DELIVERY_METHOD_LABELS[existingPickup.delivery_method] || existingPickup.delivery_method}</div>
            <div>녹용 추가: {existingPickup.with_nokryong ? '예' : '아니오'}</div>
            <div>픽업일: {existingPickup.pickup_date}</div>
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

  if (herbalPackages.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
        활성 한약 패키지가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {/* 모드 전환: 차감 / 연결 */}
      {unlinkedPackages.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
          <button
            onClick={() => setMode('deduct')}
            style={{
              flex: 1, padding: '7px', border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: mode === 'deduct' ? '#667eea' : '#fff',
              color: mode === 'deduct' ? '#fff' : '#374151',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            차감
          </button>
          <button
            onClick={() => setMode('link')}
            style={{
              flex: 1, padding: '7px', border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: mode === 'link' ? '#667eea' : '#fff',
              color: mode === 'link' ? '#fff' : '#374151',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            기존 패키지 연결 ({unlinkedPackages.length})
          </button>
        </div>
      )}

      {/* 연결 모드 */}
      {mode === 'link' && unlinkedPackages.length > 0 && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>미연결 패키지</div>
            <select
              value={selectedUnlinked?.id ?? ''}
              onChange={e => {
                const pkg = unlinkedPackages.find(h => h.id === Number(e.target.value));
                setSelectedUnlinked(pkg || null);
              }}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
            >
              {unlinkedPackages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.herbal_name} ({PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type})
                  {pkg.decoction_date ? ` - 탕전: ${pkg.decoction_date}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedUnlinked && (
            <div style={{
              marginBottom: '12px', padding: '10px 12px',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: '6px', fontSize: '12px', color: '#374151', lineHeight: '1.8',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>{selectedUnlinked.herbal_name}</div>
              <div>기간: {PACKAGE_TYPE_LABELS[selectedUnlinked.package_type] || selectedUnlinked.package_type} | 총 {selectedUnlinked.total_count}회 | 잔여 {selectedUnlinked.remaining_count}회</div>
              <div>탕전일: {selectedUnlinked.decoction_date || '-'} | 수령: {selectedUnlinked.delivery_method ? DELIVERY_METHOD_LABELS[selectedUnlinked.delivery_method] : '-'}</div>
            </div>
          )}

          <button
            onClick={handleLinkPackage}
            disabled={isLinking || !selectedUnlinked}
            style={{
              width: '100%', padding: '10px', border: 'none', borderRadius: '6px',
              background: isLinking || !selectedUnlinked ? '#D1D5DB' : '#059669',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: isLinking || !selectedUnlinked ? 'not-allowed' : 'pointer',
            }}
          >
            {isLinking ? '처리 중...' : '이 수납에 연결'}
          </button>
        </>
      )}

      {/* 차감 모드 */}
      {mode === 'deduct' && <>
      {/* 패키지 선택 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>한약 패키지</div>
        <select
          value={selectedHerbal?.id ?? ''}
          onChange={e => {
            const pkg = herbalPackages.find(h => h.id === Number(e.target.value));
            setSelectedHerbal(pkg || null);
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
          {herbalPackages.map(pkg => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.herbal_name} ({PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}) - 잔여 {pkg.remaining_count}회
            </option>
          ))}
        </select>
      </div>

      {/* 선택 패키지 정보 */}
      {selectedHerbal && (
        <div style={{
          marginBottom: '12px',
          padding: '10px 12px',
          background: '#F9FAFB',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#374151',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedHerbal.herbal_name}</div>
          <div>
            타입: {PACKAGE_TYPE_LABELS[selectedHerbal.package_type] || selectedHerbal.package_type}
            {' | '}
            총 {selectedHerbal.total_count}회 | 사용 {selectedHerbal.used_count}회 | 잔여 {selectedHerbal.remaining_count}회
          </div>
        </div>
      )}

      {/* 배송방법 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>배송방법</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(Object.entries(DELIVERY_METHOD_LABELS) as [DeliveryMethod, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDeliveryMethod(key)}
              style={{
                flex: 1,
                padding: '7px 0',
                border: deliveryMethod === key ? '1px solid #667eea' : '1px solid #D1D5DB',
                borderRadius: '6px',
                background: deliveryMethod === key ? '#EEF2FF' : '#fff',
                color: deliveryMethod === key ? '#667eea' : '#374151',
                fontSize: '12px',
                fontWeight: deliveryMethod === key ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 녹용 추가 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: nokryongPackages.length === 0 ? '#9CA3AF' : '#374151',
          cursor: nokryongPackages.length === 0 ? 'not-allowed' : 'pointer',
        }}>
          <input
            type="checkbox"
            checked={withNokryong}
            onChange={e => setWithNokryong(e.target.checked)}
            disabled={nokryongPackages.length === 0}
          />
          녹용 추가
          {nokryongPackages.length === 0 && (
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>(활성 녹용 패키지 없음)</span>
          )}
        </label>
        {withNokryong && nokryongPackages.length > 0 && selectedNokryong && (
          <div style={{ marginTop: '6px', padding: '6px 10px', background: '#FFFBEB', borderRadius: '4px', fontSize: '11px', color: '#92400E' }}>
            {selectedNokryong.package_name} - 잔여 {selectedNokryong.remaining_months}회분
          </div>
        )}
      </div>

      {/* 차감 버튼 */}
      <button
        onClick={handleHerbalDeduct}
        disabled={isSaving || !selectedHerbal}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          background: isSaving || !selectedHerbal ? '#D1D5DB' : '#667eea',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isSaving || !selectedHerbal ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? '처리 중...' : '차감'}
      </button>
      </>}
    </div>
  );
};

export default HerbalContent;
