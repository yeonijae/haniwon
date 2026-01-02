import React, { useState, useEffect } from 'react';
import {
  YakchimType,
  YakchimPaymentType,
  YakchimUsage,
  YakchimPackage,
  YakchimMembership,
  YakchimPackageHistory,
  YAKCHIM_TYPE_LABELS,
  YAKCHIM_PAYMENT_TYPE_LABELS,
} from '../types';

interface YakchimPanelProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  onSave?: (data: YakchimSaveData) => void;
  onClose?: () => void;
}

export interface YakchimSaveData {
  usages: YakchimUsage[];
  memo?: string;
}

// 오늘 사용 행 타입 (UI용)
interface UsageRow {
  id: string;  // 임시 ID (신규는 uuid, 기존은 실제 id)
  yakchim_type: YakchimType;
  amount_cc: number;
  payment_type: YakchimPaymentType;
  package_id?: number;
  membership_id?: number;
  service_reason?: string;
}

const YAKCHIM_TYPES: YakchimType[] = ['gyeonggeun', 'nokryong', 'taeban', 'hwata', 'line'];
const PAYMENT_TYPES: YakchimPaymentType[] = ['onetime', 'tongma', 'membership', 'service'];

// 임시 UUID 생성
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const YakchimPanel: React.FC<YakchimPanelProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  onSave,
  onClose,
}) => {
  // 오늘 사용 내역 (행 목록)
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);

  // 패키지 목록
  const [packages, setPackages] = useState<YakchimPackage[]>([]);

  // 멤버십 목록
  const [memberships, setMemberships] = useState<YakchimMembership[]>([]);

  // 패키지 이력 (펼침용)
  const [packageHistories, setPackageHistories] = useState<Record<number, YakchimPackageHistory[]>>({});
  const [expandedPackageId, setExpandedPackageId] = useState<number | null>(null);

  // 메모
  const [memo, setMemo] = useState('');

  // 로딩/에러 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [patientId, receiptDate]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: API 호출로 대체
      // 1. 해당 환자의 활성 패키지 목록
      // 2. 해당 환자의 활성 멤버십 목록
      // 3. 오늘 날짜의 기존 사용 기록 (수정 모드)

      // 임시 더미 데이터
      setPackages([
        {
          id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          yakchim_type: 'gyeonggeun',
          package_name: '경근 10회권',
          total_count: 10,
          used_count: 3,
          remaining_count: 7,
          start_date: '2024-12-01',
          expire_date: '2025-03-01',
          status: 'active',
        },
        {
          id: 2,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          yakchim_type: 'taeban',
          package_name: '태반 5회권',
          total_count: 5,
          used_count: 3,
          remaining_count: 2,
          start_date: '2024-11-15',
          expire_date: '2025-02-15',
          status: 'active',
        },
      ]);

      setMemberships([
        {
          id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          membership_name: '약침 무제한 (월정액)',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          status: 'active',
        },
      ]);

      // 기존 사용 기록이 없으면 빈 행 하나 추가
      setUsageRows([{
        id: generateTempId(),
        yakchim_type: 'gyeonggeun',
        amount_cc: 2.0,
        payment_type: 'onetime',
      }]);

    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 행 추가
  const addUsageRow = () => {
    setUsageRows([...usageRows, {
      id: generateTempId(),
      yakchim_type: 'gyeonggeun',
      amount_cc: 2.0,
      payment_type: 'onetime',
    }]);
  };

  // 행 삭제
  const removeUsageRow = (rowId: string) => {
    if (usageRows.length <= 1) return; // 최소 1개 유지
    setUsageRows(usageRows.filter(row => row.id !== rowId));
  };

  // 행 업데이트
  const updateUsageRow = (rowId: string, field: keyof UsageRow, value: any) => {
    setUsageRows(usageRows.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      // 결제 유형 변경 시 관련 필드 초기화
      if (field === 'payment_type') {
        updated.package_id = undefined;
        updated.membership_id = undefined;
        updated.service_reason = undefined;

        // 통마 선택 시 해당 종류의 첫 번째 패키지 자동 선택
        if (value === 'tongma') {
          const matchingPackage = packages.find(
            p => p.yakchim_type === updated.yakchim_type && p.status === 'active'
          );
          if (matchingPackage) {
            updated.package_id = matchingPackage.id;
          }
        }

        // 멤버십 선택 시 첫 번째 멤버십 자동 선택
        if (value === 'membership') {
          const activeMembership = memberships.find(m => m.status === 'active');
          if (activeMembership) {
            updated.membership_id = activeMembership.id;
          }
        }
      }

      // 약침 종류 변경 시 통마 패키지 재선택
      if (field === 'yakchim_type' && row.payment_type === 'tongma') {
        const matchingPackage = packages.find(
          p => p.yakchim_type === value && p.status === 'active'
        );
        updated.package_id = matchingPackage?.id;
      }

      return updated;
    }));
  };

  // 해당 종류의 사용 가능한 패키지 목록
  const getPackagesForType = (yakchimType: YakchimType): YakchimPackage[] => {
    return packages.filter(p => p.yakchim_type === yakchimType && p.status === 'active');
  };

  // 패키지/상태 표시 텍스트
  const getStatusText = (row: UsageRow): string => {
    switch (row.payment_type) {
      case 'onetime':
        return '-';
      case 'tongma':
        const pkg = packages.find(p => p.id === row.package_id);
        if (pkg) {
          return `${pkg.remaining_count}/${pkg.total_count}회`;
        }
        return '패키지 없음';
      case 'membership':
        const mem = memberships.find(m => m.id === row.membership_id);
        if (mem && mem.status === 'active') {
          return '유효 ✓';
        }
        return '멤버십 없음';
      case 'service':
        return row.service_reason || '(사유 입력)';
      default:
        return '-';
    }
  };

  // 패키지 이력 토글
  const togglePackageHistory = async (packageId: number) => {
    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      return;
    }

    setExpandedPackageId(packageId);

    // 이미 로드된 경우 스킵
    if (packageHistories[packageId]) return;

    // TODO: API에서 이력 로드
    // 임시 더미 데이터
    setPackageHistories({
      ...packageHistories,
      [packageId]: [
        { id: 1, package_id: packageId, action: 'use', count_change: -1, remaining_after: 7, action_date: '2024-12-28' },
        { id: 2, package_id: packageId, action: 'use', count_change: -1, remaining_after: 8, action_date: '2024-12-21' },
        { id: 3, package_id: packageId, action: 'purchase', count_change: 10, remaining_after: 10, action_date: '2024-12-01' },
      ],
    });
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // UsageRow를 YakchimUsage로 변환
      const usages: YakchimUsage[] = usageRows.map(row => ({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        receipt_id: receiptId,
        usage_date: receiptDate,
        yakchim_type: row.yakchim_type,
        amount_cc: row.amount_cc,
        payment_type: row.payment_type,
        package_id: row.package_id,
        membership_id: row.membership_id,
        service_reason: row.service_reason,
      }));

      // TODO: API 호출
      // 1. 사용 기록 저장
      // 2. 통마 패키지 차감 처리
      // 3. 이력 기록

      onSave?.({ usages, memo });

    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="yakchim-panel loading">
        <div className="loading-spinner">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="yakchim-panel">
      {error && <div className="error-message">{error}</div>}

      {/* 오늘 사용 */}
      <section className="panel-section">
        <div className="section-header">
          <h3>오늘 사용</h3>
          <button className="btn-add" onClick={addUsageRow}>
            <i className="fa-solid fa-plus"></i> 약침 추가
          </button>
        </div>

        <table className="usage-table">
          <thead>
            <tr>
              <th>종류</th>
              <th>사용량</th>
              <th>결제유형</th>
              <th>패키지/상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <select
                    value={row.yakchim_type}
                    onChange={(e) => updateUsageRow(row.id, 'yakchim_type', e.target.value as YakchimType)}
                  >
                    {YAKCHIM_TYPES.map(type => (
                      <option key={type} value={type}>{YAKCHIM_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="amount-input">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={row.amount_cc}
                      onChange={(e) => updateUsageRow(row.id, 'amount_cc', parseFloat(e.target.value) || 0)}
                    />
                    <span className="unit">cc</span>
                  </div>
                </td>
                <td>
                  <select
                    value={row.payment_type}
                    onChange={(e) => updateUsageRow(row.id, 'payment_type', e.target.value as YakchimPaymentType)}
                  >
                    {PAYMENT_TYPES.map(type => (
                      <option key={type} value={type}>{YAKCHIM_PAYMENT_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </td>
                <td className="status-cell">
                  {row.payment_type === 'tongma' && (
                    <select
                      value={row.package_id || ''}
                      onChange={(e) => updateUsageRow(row.id, 'package_id', parseInt(e.target.value) || undefined)}
                    >
                      <option value="">패키지 선택</option>
                      {getPackagesForType(row.yakchim_type).map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.package_name} ({pkg.remaining_count}/{pkg.total_count})
                        </option>
                      ))}
                    </select>
                  )}
                  {row.payment_type === 'membership' && (
                    <span className={`status-badge ${memberships.some(m => m.status === 'active') ? 'valid' : 'invalid'}`}>
                      {getStatusText(row)}
                    </span>
                  )}
                  {row.payment_type === 'service' && (
                    <input
                      type="text"
                      className="service-reason"
                      placeholder="사유 입력"
                      value={row.service_reason || ''}
                      onChange={(e) => updateUsageRow(row.id, 'service_reason', e.target.value)}
                    />
                  )}
                  {row.payment_type === 'onetime' && (
                    <span className="status-text">-</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn-remove"
                    onClick={() => removeUsageRow(row.id)}
                    disabled={usageRows.length <= 1}
                    title="삭제"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 패키지 현황 */}
      <section className="panel-section">
        <div className="section-header">
          <h3>패키지 현황</h3>
          <button className="btn-add-small">
            <i className="fa-solid fa-plus"></i> 새 구매
          </button>
        </div>

        {packages.length === 0 ? (
          <div className="empty-state">등록된 패키지가 없습니다.</div>
        ) : (
          <div className="package-list">
            {packages.filter(p => p.status === 'active').map(pkg => (
              <div key={pkg.id} className="package-item">
                <div
                  className="package-summary"
                  onClick={() => togglePackageHistory(pkg.id!)}
                >
                  <span className="package-name">
                    {YAKCHIM_TYPE_LABELS[pkg.yakchim_type]} {pkg.total_count}회권
                  </span>
                  <div className="package-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${(pkg.remaining_count / pkg.total_count) * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {pkg.remaining_count}/{pkg.total_count}회
                    </span>
                  </div>
                  <span className="package-expire">
                    ~{pkg.expire_date ? formatDate(pkg.expire_date) : '무기한'}
                  </span>
                  <i className={`fa-solid fa-chevron-${expandedPackageId === pkg.id ? 'up' : 'down'}`}></i>
                </div>

                {expandedPackageId === pkg.id && packageHistories[pkg.id!] && (
                  <div className="package-history">
                    <table>
                      <tbody>
                        {packageHistories[pkg.id!].map(history => (
                          <tr key={history.id}>
                            <td className="history-date">{formatDate(history.action_date)}</td>
                            <td className={`history-action ${history.action}`}>
                              {history.action === 'purchase' ? '구매' : history.action === 'use' ? '사용' : '조정'}
                            </td>
                            <td className={`history-change ${history.count_change > 0 ? 'plus' : 'minus'}`}>
                              {history.count_change > 0 ? '+' : ''}{history.count_change}
                            </td>
                            <td className="history-remaining">잔여 {history.remaining_after}회</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 멤버십 현황 */}
      {memberships.length > 0 && (
        <section className="panel-section">
          <div className="section-header">
            <h3>멤버십 현황</h3>
          </div>

          <div className="membership-list">
            {memberships.filter(m => m.status === 'active').map(mem => {
              const endDate = new Date(mem.end_date);
              const today = new Date();
              const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div key={mem.id} className="membership-item">
                  <div className="membership-icon">
                    <i className="fa-solid fa-id-card"></i>
                  </div>
                  <div className="membership-info">
                    <span className="membership-name">{mem.membership_name}</span>
                    <span className="membership-period">
                      {mem.start_date} ~ {mem.end_date}
                    </span>
                  </div>
                  <div className={`membership-status ${daysLeft > 30 ? 'valid' : daysLeft > 0 ? 'warning' : 'expired'}`}>
                    {daysLeft > 0 ? `✅유효 (D-${daysLeft})` : '❌만료'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 메모 */}
      <section className="panel-section">
        <div className="section-header">
          <h3>메모</h3>
        </div>
        <textarea
          className="memo-input"
          placeholder="약침 관련 메모를 입력하세요..."
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
        />
      </section>

      {/* 하단 버튼 */}
      <div className="panel-footer">
        <button className="btn-cancel" onClick={onClose}>취소</button>
        <button className="btn-save" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
};

export default YakchimPanel;
