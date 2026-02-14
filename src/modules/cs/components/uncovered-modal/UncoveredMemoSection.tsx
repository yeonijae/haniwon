import React, { useState, useEffect, useCallback } from 'react';
import { query, escapeString } from '@shared/lib/postgres';
import { getMemoTypes, addReceiptMemo, type MemoType } from '../../lib/api';

interface ReceiptMemo {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  mssql_receipt_id: number;
  mssql_detail_id: number | null;
  receipt_date: string;
  memo: string;
  item_name: string | null;
  item_type: string | null;
  created_by: string | null;
  memo_type_id: number | null;
  created_at: string;
  updated_at: string;
}

interface UncoveredMemoSectionProps {
  patientId: number;
  chartNumber: string;
  patientName: string;
  receiptId: number;
  receiptDate: string;
  detailId?: number;
  refreshTrigger: number;
}

const sectionStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderTop: '1px solid #e5e7eb',
};

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 12,
};

const memoListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 12,
  maxHeight: 200,
  overflowY: 'auto',
};

const memoItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#f3f4f6',
  borderRadius: 6,
  fontSize: 13,
  color: '#374151',
};

const memoMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  marginTop: 4,
};

const inputAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 60,
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'flex-end',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: '#fff',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const saveButtonDisabledStyle: React.CSSProperties = {
  ...saveButtonStyle,
  backgroundColor: '#93c5fd',
  cursor: 'not-allowed',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#9ca3af',
  marginBottom: 12,
};

const UncoveredMemoSection: React.FC<UncoveredMemoSectionProps> = ({
  patientId,
  chartNumber,
  patientName,
  receiptId,
  receiptDate,
  detailId,
  refreshTrigger,
}) => {
  const [memos, setMemos] = useState<ReceiptMemo[]>([]);
  const [memoTypes, setMemoTypes] = useState<MemoType[]>([]);
  const [memoText, setMemoText] = useState('');
  const [selectedMemoTypeId, setSelectedMemoTypeId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 메모 목록 조회
  const loadMemos = useCallback(async () => {
    if (!detailId) {
      setMemos([]);
      return;
    }

    try {
      const rows = await query<ReceiptMemo>(
        `SELECT * FROM cs_receipt_memos
         WHERE mssql_receipt_id = ${receiptId}
           AND mssql_detail_id = ${detailId}
         ORDER BY created_at ASC`
      );
      setMemos(rows);
    } catch (error) {
      console.error('메모 목록 조회 오류:', error);
    }
  }, [receiptId, detailId]);

  // 메모 종류 목록 조회
  const loadMemoTypes = useCallback(async () => {
    try {
      const types = await getMemoTypes();
      setMemoTypes(types);
    } catch (error) {
      console.error('메모 종류 조회 오류:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadMemos();
    loadMemoTypes();
  }, [loadMemos, loadMemoTypes]);

  // refreshTrigger 변경 시 메모 새로고침
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadMemos();
    }
  }, [refreshTrigger, loadMemos]);

  // 메모 저장
  const handleSave = async () => {
    if (!memoText.trim()) return;

    setIsSaving(true);
    try {
      await addReceiptMemo({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        mssql_receipt_id: receiptId,
        mssql_detail_id: detailId,
        receipt_date: receiptDate,
        memo: memoText.trim(),
        memo_type_id: selectedMemoTypeId || undefined,
      });

      setMemoText('');
      setSelectedMemoTypeId(null);
      await loadMemos();
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('메모 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 메모 종류 이름 찾기
  const getMemoTypeName = (typeId: number | null): string | null => {
    if (!typeId) return null;
    const found = memoTypes.find(t => t.id === typeId);
    return found ? found.name : null;
  };

  // 날짜 포맷
  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={headerStyle}>메모</div>

      {/* 기존 메모 목록 */}
      {memos.length > 0 ? (
        <div style={memoListStyle}>
          {memos.map(m => {
            const typeName = getMemoTypeName(m.memo_type_id);
            return (
              <div key={m.id} style={memoItemStyle}>
                <div>{m.memo}</div>
                <div style={memoMetaStyle}>
                  {typeName && <span>[{typeName}] </span>}
                  {m.created_by && <span>{m.created_by} / </span>}
                  <span>{formatDate(m.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : detailId ? (
        <div style={emptyStyle}>등록된 메모가 없습니다.</div>
      ) : null}

      {/* 새 메모 입력 */}
      <div style={inputAreaStyle}>
        <textarea
          style={textareaStyle}
          value={memoText}
          onChange={e => setMemoText(e.target.value)}
          placeholder="메모를 입력하세요..."
        />
        <div style={controlsRowStyle}>
          {memoTypes.length > 0 && (
            <select
              style={selectStyle}
              value={selectedMemoTypeId ?? ''}
              onChange={e => setSelectedMemoTypeId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">메모 종류 선택</option>
              {memoTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            style={!memoText.trim() || isSaving ? saveButtonDisabledStyle : saveButtonStyle}
            onClick={handleSave}
            disabled={!memoText.trim() || isSaving}
          >
            {isSaving ? '저장 중...' : '메모 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UncoveredMemoSection;
