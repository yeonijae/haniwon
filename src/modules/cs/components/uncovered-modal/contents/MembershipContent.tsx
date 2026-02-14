import React, { useState, useEffect } from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';
import { getMembershipTypes, createMembership } from '../../../lib/api';
import { query, execute } from '@shared/lib/postgres';

interface MembershipRecord {
  id: number;
  membership_type: string;
  quantity: number;
  start_date: string;
  expire_date: string;
  memo: string | null;
  status: string;
  created_at: string;
}

const PERIOD_OPTIONS = [
  { value: 1, label: '1개월' },
  { value: 3, label: '3개월' },
  { value: 6, label: '6개월' },
  { value: 12, label: '1년' },
];

const MembershipContent: React.FC<ContentComponentProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptDate,
  detailId,
  isEditMode,
  onSuccess,
  onClose,
}) => {
  const [membershipTypeOptions, setMembershipTypeOptions] = useState<string[]>([]);
  const [membershipType, setMembershipType] = useState('');
  const [membershipPeriod, setMembershipPeriod] = useState(1);
  const [membershipMemo, setMembershipMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 수정 모드 상태
  const [existingRecords, setExistingRecords] = useState<MembershipRecord[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 수정 모드: 기존 멤버십 레코드 조회
        if (isEditMode && detailId) {
          const records = await query<MembershipRecord>(
            `SELECT id, membership_type, quantity, start_date, expire_date, memo, status, created_at
             FROM cs_memberships
             WHERE mssql_detail_id = ${detailId}`
          );
          setExistingRecords(records);
        }

        const types = await getMembershipTypes();
        setMembershipTypeOptions(types);
        if (types.length > 0) {
          setMembershipType(types[0]);
        }
      } catch (err) {
        console.error('멤버십 종류 로딩 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isEditMode, detailId]);

  // 멤버십 삭제 처리
  const handleDeleteMembership = async (recordId: number) => {
    if (!confirm('이 멤버십을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await execute(`DELETE FROM cs_memberships WHERE id = ${recordId}`);
      setExistingRecords(prev => prev.filter(r => r.id !== recordId));
      onSuccess?.();
      if (existingRecords.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error('멤버십 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 등록 처리
  const handleRegister = async () => {
    if (!membershipType) {
      alert('멤버십 종류를 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const startDate = receiptDate;
      const expireDate = new Date(startDate);
      expireDate.setMonth(expireDate.getMonth() + membershipPeriod);

      await createMembership({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        membership_type: membershipType,
        quantity: membershipPeriod,
        start_date: startDate,
        expire_date: expireDate.toISOString().split('T')[0],
        status: 'active',
        memo: membershipMemo || undefined,
        mssql_detail_id: detailId,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('멤버십 등록 오류:', err);
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
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>멤버십 종류</div>
              <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.membership_type}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>기간</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.quantity}개월</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>상태</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.status}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>시작일</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.start_date}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>만료일</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.expire_date}</div>
              </div>
            </div>
            {record.memo && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>메모</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{record.memo}</div>
              </div>
            )}
            <button
              onClick={() => handleDeleteMembership(record.id)}
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
      {/* 멤버십 종류 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>멤버십 종류</div>
        {membershipTypeOptions.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px 0' }}>
            등록된 멤버십 종류가 없습니다.
          </div>
        ) : (
          <select
            value={membershipType}
            onChange={e => setMembershipType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#fff',
            }}
          >
            {membershipTypeOptions.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        )}
      </div>

      {/* 기간 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>기간</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMembershipPeriod(opt.value)}
              style={{
                flex: 1,
                padding: '7px 0',
                border: membershipPeriod === opt.value ? '1px solid #667eea' : '1px solid #D1D5DB',
                borderRadius: '6px',
                background: membershipPeriod === opt.value ? '#EEF2FF' : '#fff',
                color: membershipPeriod === opt.value ? '#667eea' : '#374151',
                fontSize: '12px',
                fontWeight: membershipPeriod === opt.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 기간 미리보기 */}
      {membershipType && (
        <div style={{
          marginBottom: '12px',
          padding: '8px 12px',
          background: '#F0F4FF',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4338CA',
        }}>
          {receiptDate} ~ {(() => {
            const expire = new Date(receiptDate);
            expire.setMonth(expire.getMonth() + membershipPeriod);
            return expire.toISOString().split('T')[0];
          })()}
        </div>
      )}

      {/* 메모 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>메모</div>
        <input
          type="text"
          value={membershipMemo}
          onChange={e => setMembershipMemo(e.target.value)}
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
        disabled={isSaving || !membershipType}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          background: isSaving || !membershipType ? '#D1D5DB' : '#667eea',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isSaving || !membershipType ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? '처리 중...' : '등록'}
      </button>
    </div>
  );
};

export default MembershipContent;
