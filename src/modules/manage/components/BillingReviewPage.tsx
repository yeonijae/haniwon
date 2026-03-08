import React, { useState, useCallback } from 'react';
import {
  fetchBillingReviewData,
  BILLING_RULES,
  type BillingReviewRow,
} from '../lib/billingReviewApi';

// --- 날짜 헬퍼 ---
function getToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// --- 규칙 ID → 뱃지 색상 ---
const RULE_COLORS: Record<string, string> = {
  RULE1: 'bg-red-100 text-red-700 border-red-300',
  RULE2: 'bg-orange-100 text-orange-700 border-orange-300',
  RULE3: 'bg-purple-100 text-purple-700 border-purple-300',
  RULE4: 'bg-blue-100 text-blue-700 border-blue-300',
};

const BillingReviewPage: React.FC = () => {
  // 날짜 범위
  const [startDate, setStartDate] = useState(getWeekAgo);
  const [endDate, setEndDate] = useState(getToday);

  // 규칙 선택 (빈 배열이면 전체)
  const [selectedRules, setSelectedRules] = useState<string[]>([]);

  // 데이터
  const [rows, setRows] = useState<BillingReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 조회
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await fetchBillingReviewData(startDate, endDate, selectedRules);
      setRows(data);
    } catch (e: any) {
      console.error('청구검토 조회 오류:', e);
      setError(e.message || '조회 중 오류가 발생했습니다.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedRules]);

  // 규칙 토글
  const toggleRule = useCallback((ruleId: string) => {
    setSelectedRules((prev) =>
      prev.includes(ruleId)
        ? prev.filter((r) => r !== ruleId)
        : [...prev, ruleId]
    );
  }, []);

  // 전체 선택/해제
  const toggleAllRules = useCallback(() => {
    setSelectedRules((prev) =>
      prev.length === BILLING_RULES.length ? [] : BILLING_RULES.map((r) => r.id)
    );
  }, []);

  return (
    <main className="flex-grow flex flex-col h-full bg-clinic-background overflow-hidden">
      {/* 상단 헤더 + 날짜 컨트롤 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-file-invoice-dollar text-2xl text-clinic-primary"></i>
            <h2 className="text-2xl font-bold text-clinic-primary">청구 검토</h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600 font-medium">조회기간</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary outline-none"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2 bg-clinic-primary text-white rounded-lg text-sm font-medium hover:bg-clinic-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>

      {/* 본문: 사이드바 + 메인 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 사이드바: 규칙 목록 */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">검토 규칙</h3>
              <button
                onClick={toggleAllRules}
                className="text-xs text-clinic-primary hover:underline"
              >
                {selectedRules.length === BILLING_RULES.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              선택 없으면 전체 규칙 적용
            </p>
            <div className="space-y-2">
              {BILLING_RULES.map((rule) => {
                const isActive = selectedRules.includes(rule.id);
                const colorClass = RULE_COLORS[rule.id] || 'bg-gray-100 text-gray-700 border-gray-300';
                return (
                  <button
                    key={rule.id}
                    onClick={() => toggleRule(rule.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? `${colorClass} border-opacity-100 shadow-sm`
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                          isActive ? 'bg-white/60' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isActive ? '\u2713' : ''}
                      </span>
                      <span className="text-xs font-bold">{rule.id}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{rule.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* 메인 리스트 영역 */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!hasSearched && !loading && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <i className="fa-solid fa-magnifying-glass text-4xl mb-3 block"></i>
                <p className="text-lg">조회 기간을 선택하고 조회 버튼을 눌러주세요</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <i className="fa-solid fa-spinner fa-spin text-4xl mb-3 block"></i>
                <p className="text-lg">데이터 조회 중...</p>
              </div>
            </div>
          )}

          {hasSearched && !loading && rows.length === 0 && !error && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <i className="fa-solid fa-circle-check text-4xl mb-3 block text-green-300"></i>
                <p className="text-lg">해당 기간에 규칙 위반 항목이 없습니다</p>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  총 <strong className="text-gray-800">{rows.length}</strong>건
                </span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                        날짜
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                        환자이름
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                        차트번호
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                        담당의
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                        해당 규칙
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        급여청구내역
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.customerPk}_${row.txDate}_${idx}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {row.txDate}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {row.patientName}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                          {row.chartNo}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {row.doctor}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.matchedRules.map((ruleId) => (
                              <span
                                key={ruleId}
                                className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
                                  RULE_COLORS[ruleId] || 'bg-gray-100 text-gray-600 border-gray-300'
                                }`}
                              >
                                {ruleId}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed">
                          {row.claimItems}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default BillingReviewPage;
