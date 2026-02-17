import React, { useState, useEffect, useCallback } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { query, execute, escapeString, insert } from '@shared/lib/postgres';
import { getPackageTypes, getActiveTreatmentPackages, createYakchimUsageRecord } from '../../../lib/api';
import type { PackageType } from '../../../lib/api';

interface SelectedYakchim {
  typeId: number;
  typeName: string;
  deductionCount: number;
  qty: number;
}

interface YakchimUsageRecord {
  id: number;
  source_type: string;
  source_id: number;
  source_name: string;
  item_name: string;
  quantity: number;
  deduction_points: number;
  usage_date: string;
  created_at: string;
}

interface MembershipRow {
  id: number;
  membership_type: string;
  quantity: number;
  expire_date: string;
  status: string;
}

interface PackageRow {
  id: number;
  package_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  expire_date: string;
  status: string;
}

const YakchimContent: React.FC<ContentComponentProps> = ({
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
  const [yakchimTab, setYakchimTab] = useState<'onetime' | 'package' | 'membership'>('package');
  const [yakchimTypeOptions, setYakchimTypeOptions] = useState<Array<{ id: number; name: string; type: string; deduction_count?: number }>>([]);
  const [selectedYakchims, setSelectedYakchims] = useState<SelectedYakchim[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingRecords, setExistingRecords] = useState<YakchimUsageRecord[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 약침/요법 종류 로딩
        const types = await getPackageTypes();
        const isYobup = itemName.includes('요법');
        const filtered = types.filter((t: PackageType) => t.type === (isYobup ? 'yobup' : 'yakchim'));
        const opts = filtered.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          deduction_count: t.deduction_count,
        }));
        setYakchimTypeOptions(opts);

        // 비급여 항목명과 일치하는 약침 종류 자동 선택
        const matched = opts.filter(o => itemName.includes(o.name));
        if (matched.length > 0) {
          setSelectedYakchims(matched.map(m => ({
            typeId: m.id,
            typeName: m.name,
            deductionCount: m.deduction_count ?? 1,
            qty: 1,
          })));
        }

        // 멤버십 로딩
        const membershipRows = await query<MembershipRow>(
          `SELECT id, membership_type, quantity, expire_date, status FROM cs_memberships WHERE patient_id = ${patientId} AND status = 'active' ORDER BY expire_date ASC`
        );
        setMemberships(membershipRows);

        // 패키지 로딩
        const packageRows = await query<PackageRow>(
          `SELECT id, package_name, total_count, used_count, remaining_count, expire_date, status FROM cs_treatment_packages WHERE patient_id = ${patientId} AND status = 'active' AND remaining_count > 0 ORDER BY created_at DESC`
        );
        setPackages(packageRows);
      } catch (err) {
        console.error('약침 데이터 로딩 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [patientId, itemName]);

  // 수정 모드: 기존 기록 로딩
  useEffect(() => {
    if (!isEditMode || !detailId) return;
    const loadExistingRecords = async () => {
      try {
        const records = await query<YakchimUsageRecord>(
          `SELECT id, source_type, source_id, source_name, item_name, quantity, deduction_points, usage_date, created_at FROM cs_yakchim_usage_records WHERE mssql_detail_id = ${detailId} ORDER BY created_at DESC`
        );
        setExistingRecords(records);
      } catch (err) {
        console.error('약침 기존 기록 로딩 오류:', err);
      }
    };
    loadExistingRecords();
  }, [isEditMode, detailId]);

  // 수정 모드: 기록 삭제 (되돌리기)
  const handleDeleteRecord = async (record: YakchimUsageRecord) => {
    if (!confirm('이 기록을 삭제하시겠습니까? 패키지 차감이 복원됩니다.')) return;
    setIsDeleting(true);
    try {
      // 패키지인 경우 차감 복원
      if (record.source_type === 'package' && record.source_id) {
        await execute(
          `UPDATE cs_treatment_packages SET remaining_count = remaining_count + ${record.deduction_points}, used_count = used_count - ${record.deduction_points}, status = 'active', updated_at = NOW() WHERE id = ${record.source_id}`
        );
      }
      // 기록 삭제
      await execute(`DELETE FROM cs_yakchim_usage_records WHERE id = ${record.id}`);
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('약침 기록 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 약침 종류 선택/해제
  const toggleYakchimType = useCallback((opt: { id: number; name: string; deduction_count?: number }) => {
    setSelectedYakchims(prev => {
      const exists = prev.find(y => y.typeId === opt.id);
      if (exists) {
        return prev.filter(y => y.typeId !== opt.id);
      }
      return [...prev, {
        typeId: opt.id,
        typeName: opt.name,
        deductionCount: opt.deduction_count ?? 1,
        qty: 1,
      }];
    });
  }, []);

  // 수량 변경
  const updateQty = useCallback((typeId: number, qty: number) => {
    setSelectedYakchims(prev =>
      prev.map(y => y.typeId === typeId ? { ...y, qty: Math.max(1, qty) } : y)
    );
  }, []);

  // 일회성 저장
  const handleYakchimOnetime = async () => {
    if (selectedYakchims.length === 0) {
      alert('약침 종류를 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const yakchimInfoParts = selectedYakchims.map(y => `${y.typeName} ${y.qty}개`);
      const totalQty = selectedYakchims.reduce((sum, y) => sum + y.qty, 0);
      await createYakchimUsageRecord({
        patient_id: patientId,
        source_type: 'one-time',
        source_id: 0,
        source_name: yakchimInfoParts.join(', '),
        usage_date: receiptDate,
        item_name: selectedYakchims.map(y => y.typeName).join(', '),
        remaining_after: 0,
        receipt_id: receiptId,
        mssql_detail_id: detailId,
        quantity: totalQty,
        deduction_points: 0,
      });
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('약침 일회성 저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 패키지 차감
  const handleYakchimPackage = async (pkg: PackageRow) => {
    if (selectedYakchims.length === 0) {
      alert('약침 종류를 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const totalDeductPoints = selectedYakchims.reduce((sum, y) => sum + (y.deductionCount * y.qty), 0);
      if (pkg.remaining_count < totalDeductPoints) {
        alert(`잔여 횟수(${pkg.remaining_count})가 차감 포인트(${totalDeductPoints})보다 부족합니다.`);
        setIsSaving(false);
        return;
      }
      const newRemaining = pkg.remaining_count - totalDeductPoints;
      const newUsed = pkg.used_count + totalDeductPoints;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';
      await execute(`UPDATE cs_treatment_packages SET remaining_count = ${newRemaining}, used_count = ${newUsed}, status = ${escapeString(newStatus)}, updated_at = NOW() WHERE id = ${pkg.id}`);
      const totalQty = selectedYakchims.reduce((sum, y) => sum + y.qty, 0);
      const itemNames = selectedYakchims.map(y => y.typeName).join(', ');
      await execute(`INSERT INTO cs_yakchim_usage_records (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id, mssql_detail_id, quantity, deduction_points) VALUES (${patientId}, 'package', ${pkg.id}, ${escapeString(pkg.package_name)}, ${escapeString(receiptDate)}, ${escapeString(itemNames || itemName)}, ${newRemaining}, ${receiptId}, ${detailId || 'NULL'}, ${totalQty}, ${totalDeductPoints})`);
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('약침 패키지 차감 오류:', err);
      alert('차감 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 멤버십 사용
  const handleYakchimMembership = async (mem: MembershipRow) => {
    setIsSaving(true);
    try {
      await execute(`INSERT INTO cs_yakchim_usage_records (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id, mssql_detail_id) VALUES (${patientId}, 'membership', ${mem.id}, ${escapeString(mem.membership_type)}, ${escapeString(receiptDate)}, ${escapeString(itemName)}, ${mem.quantity}, ${receiptId}, ${detailId || 'NULL'})`);
      onMemoRefresh?.();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('약침 멤버십 사용 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
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

  // 수정 모드: 기존 기록 표시
  if (isEditMode && detailId && existingRecords.length > 0) {
    const sourceTypeLabel = (type: string) => {
      switch (type) {
        case 'one-time': return '일회성';
        case 'package': return '패키지';
        case 'membership': return '멤버십';
        default: return type;
      }
    };

    return (
      <div style={{ padding: '12px' }}>
        {existingRecords.map(record => (
          <div key={record.id} style={{ marginBottom: '12px' }}>
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '12px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', marginBottom: '8px' }}>
                기존 사용 기록
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#374151' }}>
                <div><span style={{ color: '#6B7280' }}>유형:</span> {sourceTypeLabel(record.source_type)}</div>
                <div><span style={{ color: '#6B7280' }}>약침 종류:</span> {record.item_name}</div>
                <div><span style={{ color: '#6B7280' }}>수량:</span> {record.quantity}개</div>
                <div><span style={{ color: '#6B7280' }}>차감 포인트:</span> {record.deduction_points}p</div>
                {record.source_name && (
                  <div><span style={{ color: '#6B7280' }}>출처:</span> {record.source_name}</div>
                )}
                <div><span style={{ color: '#6B7280' }}>사용일:</span> {record.usage_date}</div>
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
                marginTop: '8px',
              }}
            >
              {isDeleting ? '처리 중...' : '삭제 (되돌리기)'}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* 탭 버튼 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '12px' }}>
        {([
          { key: 'package' as const, label: '패키지차감' },
          { key: 'membership' as const, label: '멤버십' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setYakchimTab(tab.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderBottom: yakchimTab === tab.key ? '2px solid #667eea' : '2px solid transparent',
              background: 'none',
              color: yakchimTab === tab.key ? '#667eea' : '#6B7280',
              fontWeight: yakchimTab === tab.key ? 600 : 400,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 약침 종류 선택 (모든 탭 공통) */}
      <div style={{ padding: '0 12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>약침 종류 선택</div>
        {yakchimTypeOptions.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px 0' }}>
            등록된 약침 종류가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {yakchimTypeOptions.map(opt => {
              const isSelected = selectedYakchims.some(y => y.typeId === opt.id);
              const selected = selectedYakchims.find(y => y.typeId === opt.id);
              return (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => toggleYakchimType(opt)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #667eea' : '1px solid #D1D5DB',
                      background: isSelected ? '#EEF2FF' : '#fff',
                      color: isSelected ? '#667eea' : '#374151',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.name}
                    {yakchimTab === 'package' && opt.deduction_count && opt.deduction_count > 1 ? ` (${opt.deduction_count}p)` : ''}
                  </button>
                  {isSelected && selected && (
                    <input
                      type="number"
                      min={1}
                      value={selected.qty}
                      onChange={e => updateQty(opt.id, parseInt(e.target.value) || 1)}
                      style={{
                        width: '40px',
                        padding: '3px 4px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '3px',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 선택된 약침 요약 */}
      {selectedYakchims.length > 0 && (
        <div style={{ padding: '0 12px', marginBottom: '12px' }}>
          <div style={{
            padding: '8px 10px',
            background: '#F0F4FF',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#4338CA',
          }}>
            선택: {selectedYakchims.map(y => `${y.typeName} ${y.qty}개`).join(', ')}
            {yakchimTab === 'package' && (
              <>{' | '}총 차감포인트: {selectedYakchims.reduce((sum, y) => sum + (y.deductionCount * y.qty), 0)}p</>
            )}
          </div>
        </div>
      )}

      {/* 탭별 콘텐츠 */}
      <div style={{ padding: '0 12px', paddingBottom: '12px' }}>
        {yakchimTab === 'onetime' && (
          <div>
            <button
              onClick={handleYakchimOnetime}
              disabled={isSaving || selectedYakchims.length === 0}
              style={{
                width: '100%',
                padding: '10px',
                border: 'none',
                borderRadius: '6px',
                background: isSaving || selectedYakchims.length === 0 ? '#D1D5DB' : '#667eea',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSaving || selectedYakchims.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? '처리 중...' : '저장'}
            </button>
          </div>
        )}

        {yakchimTab === 'package' && (
          <div>
            {packages.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
                활성 패키지가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => handleYakchimPackage(pkg)}
                    disabled={isSaving || selectedYakchims.length === 0}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: isSaving || selectedYakchims.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.5 : 1,
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{pkg.package_name}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>
                        총 {pkg.total_count}회 | 사용 {pkg.used_count}회 | 잔여 {pkg.remaining_count}회
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#667eea', fontWeight: 500 }}>
                      차감
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {yakchimTab === 'membership' && (
          <div>
            {memberships.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
                활성 멤버십이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {memberships.map(mem => (
                  <button
                    key={mem.id}
                    onClick={() => handleYakchimMembership(mem)}
                    disabled={isSaving}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.5 : 1,
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{mem.membership_type}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>
                        수량 {mem.quantity}개 | 만료 {mem.expire_date}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#667eea', fontWeight: 500 }}>
                      사용
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YakchimContent;
