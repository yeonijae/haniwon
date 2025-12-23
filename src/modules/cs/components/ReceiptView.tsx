import React, { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/sqlite';

interface ReceiptViewProps {
  user: PortalUser;
}

interface PaymentMemo {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  mssql_receipt_id?: number;
  total_amount?: number;
  insurance_self?: number;
  general_amount?: number;
  unpaid_amount?: number;
  package_info?: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}

function ReceiptView({ user }: ReceiptViewProps) {
  const [memos, setMemos] = useState<PaymentMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPackageInfo, setEditPackageInfo] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // 수납 메모 로드
  const loadMemos = async () => {
    setIsLoading(true);
    try {
      let sql = `
        SELECT * FROM payment_memos
        WHERE 1=1
      `;

      if (searchTerm) {
        sql += ` AND (patient_name LIKE '%${searchTerm}%' OR chart_number LIKE '%${searchTerm}%')`;
      }

      sql += ' ORDER BY updated_at DESC LIMIT 50';

      const results = await query<PaymentMemo>(sql);
      setMemos(results);
    } catch (err) {
      console.error('수납 메모 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemos();
  }, []);

  // 검색 실행
  const handleSearch = () => {
    loadMemos();
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 수정 시작
  const startEdit = (memo: PaymentMemo) => {
    setEditingId(memo.id);
    setEditPackageInfo(memo.package_info || '');
    setEditMemo(memo.memo || '');
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditPackageInfo('');
    setEditMemo('');
  };

  // 수정 저장
  const saveEdit = async (id: number) => {
    try {
      const sql = `
        UPDATE payment_memos
        SET package_info = ${escapeString(editPackageInfo)},
            memo = ${escapeString(editMemo)},
            updated_at = ${escapeString(getCurrentTimestamp())}
        WHERE id = ${id}
      `;
      await execute(sql);
      await loadMemos();
      cancelEdit();
    } catch (err) {
      console.error('수정 실패:', err);
      alert('수정에 실패했습니다.');
    }
  };

  // 금액 포맷
  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return amount.toLocaleString() + '원';
  };

  return (
    <div className="receipt-view">
      {/* 검색 바 */}
      <div className="receipt-search-bar">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="환자명 또는 차트번호로 검색..."
          className="search-input"
        />
        <button onClick={handleSearch} className="search-btn">
          🔍 검색
        </button>
        <button onClick={loadMemos} className="refresh-btn">
          🔄 새로고침
        </button>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="receipt-loading">로딩 중...</div>
      )}

      {/* 메모 목록 */}
      {!isLoading && (
        <div className="receipt-list">
          {memos.length === 0 ? (
            <div className="receipt-empty">
              <p>수납 메모가 없습니다.</p>
            </div>
          ) : (
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>차트번호</th>
                  <th>환자명</th>
                  <th>금액</th>
                  <th>미수금</th>
                  <th>패키지</th>
                  <th>메모</th>
                  <th>수정일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {memos.map((memo) => (
                  <tr key={memo.id}>
                    <td className="chart-number">{memo.chart_number}</td>
                    <td className="patient-name">{memo.patient_name}</td>
                    <td className="amount">{formatAmount(memo.total_amount)}</td>
                    <td className={`unpaid ${memo.unpaid_amount ? 'has-unpaid' : ''}`}>
                      {formatAmount(memo.unpaid_amount)}
                    </td>
                    <td className="package-info">
                      {editingId === memo.id ? (
                        <input
                          type="text"
                          value={editPackageInfo}
                          onChange={(e) => setEditPackageInfo(e.target.value)}
                          className="edit-input"
                        />
                      ) : (
                        memo.package_info || '-'
                      )}
                    </td>
                    <td className="memo-content">
                      {editingId === memo.id ? (
                        <textarea
                          value={editMemo}
                          onChange={(e) => setEditMemo(e.target.value)}
                          className="edit-textarea"
                          rows={2}
                        />
                      ) : (
                        memo.memo || '-'
                      )}
                    </td>
                    <td className="updated-date">
                      {new Date(memo.updated_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="actions">
                      {editingId === memo.id ? (
                        <>
                          <button onClick={() => saveEdit(memo.id)} className="save-btn">저장</button>
                          <button onClick={cancelEdit} className="cancel-btn">취소</button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(memo)} className="edit-btn">수정</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default ReceiptView;
