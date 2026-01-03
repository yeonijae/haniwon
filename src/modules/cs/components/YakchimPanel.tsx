import React, { useState, useEffect, useCallback } from 'react';
import { query, execute, escapeString } from '@shared/lib/sqlite';
import { MembershipAddModal } from './MembershipAddModal';

interface YakchimPanelProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  // 오늘 처리 필요한 비급여 항목들 (0원 약침, 약침포인트, 멤버십)
  pendingItems?: { name: string; amount: number }[];
  onSave?: () => void;
  onClose?: () => void;
}

// 멤버십 타입
interface Membership {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  membership_type: string;
  remaining_count: number;
  start_date: string;
  expire_date: string;
  status: 'active' | 'expired' | 'cancelled';
  memo?: string;
}

// 패키지 타입
interface YakchimPackage {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  package_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  start_date: string;
  expire_date?: string;
  status: 'active' | 'completed' | 'expired';
  memo?: string;
}

// 사용 기록 타입
interface UsageRecord {
  id: number;
  patient_id: number;
  source_type: 'membership' | 'package';
  source_id: number;
  source_name: string;
  usage_date: string;
  item_name: string;
  remaining_after: number;
  receipt_id?: number;
  memo?: string;
  created_at: string;
}

// 처리 대기 항목 타입
interface PendingItem {
  name: string;
  amount: number;
  processed?: boolean;
  processedWith?: 'membership' | 'package';
  processedId?: number;
}

const YakchimPanel: React.FC<YakchimPanelProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  pendingItems = [],
  onSave,
  onClose,
}) => {
  // 상태
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [packages, setPackages] = useState<YakchimPackage[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SQLite patient_id 조회
  const [sqlitePatientId, setSqlitePatientId] = useState<number | null>(null);

  // 멤버십 등록 모달 상태
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 만료일까지 남은 일수
  const getDaysUntilExpire = (expireDate: string) => {
    const expire = new Date(expireDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expire.setHours(0, 0, 0, 0);
    return Math.ceil((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 환자 조회/생성
  const getOrCreatePatient = useCallback(async (): Promise<number | null> => {
    try {
      // 차트번호로 조회
      const result = await query<{ id: number }>(`
        SELECT id FROM patients
        WHERE chart_number = ${escapeString(chartNumber)}
           OR mssql_id = ${patientId}
        LIMIT 1
      `);

      if (result[0]) {
        return result[0].id;
      }

      // 없으면 생성
      await execute(`
        INSERT INTO patients (name, chart_number, mssql_id)
        VALUES (${escapeString(patientName)}, ${escapeString(chartNumber)}, ${patientId})
      `);

      const newResult = await query<{ id: number }>(`
        SELECT id FROM patients WHERE chart_number = ${escapeString(chartNumber)}
      `);
      return newResult[0]?.id || null;
    } catch (err) {
      console.error('환자 조회/생성 오류:', err);
      return null;
    }
  }, [patientId, patientName, chartNumber]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pid = await getOrCreatePatient();
      setSqlitePatientId(pid);

      if (!pid) {
        setMemberships([]);
        setPackages([]);
        setUsageRecords([]);
        return;
      }

      // 멤버십 조회
      const membershipData = await query<Membership>(`
        SELECT * FROM cs_memberships
        WHERE patient_id = ${pid} AND status = 'active'
        ORDER BY expire_date ASC
      `);
      setMemberships(membershipData);

      // 패키지 조회
      const packageData = await query<YakchimPackage>(`
        SELECT * FROM cs_yakchim_packages
        WHERE patient_id = ${pid} AND status = 'active'
        ORDER BY created_at DESC
      `);
      setPackages(packageData);

      // 최근 사용 기록 (30일 이내)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const usageData = await query<UsageRecord>(`
        SELECT * FROM cs_yakchim_usage_records
        WHERE patient_id = ${pid}
        AND usage_date >= ${escapeString(thirtyDaysAgo.toISOString().split('T')[0])}
        ORDER BY usage_date DESC, created_at DESC
        LIMIT 20
      `);
      setUsageRecords(usageData);

      // 처리 대기 항목 초기화
      setPending(pendingItems.map(item => ({
        ...item,
        processed: false,
      })));

    } catch (err) {
      console.error('데이터 로드 오류:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [getOrCreatePatient, pendingItems]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 멤버십으로 차감
  const handleDeductMembership = async (membership: Membership, pendingIndex: number) => {
    if (membership.remaining_count <= 0) {
      alert('잔여 횟수가 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const pendingItem = pending[pendingIndex];
      const newRemaining = membership.remaining_count - 1;
      const newStatus = newRemaining <= 0 ? 'expired' : 'active';

      // 멤버십 차감
      await execute(`
        UPDATE cs_memberships
        SET remaining_count = ${newRemaining},
            status = ${escapeString(newStatus)},
            updated_at = datetime('now')
        WHERE id = ${membership.id}
      `);

      // 사용 기록 추가
      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id)
        VALUES (
          ${sqlitePatientId},
          'membership',
          ${membership.id},
          ${escapeString(membership.membership_type)},
          ${escapeString(receiptDate)},
          ${escapeString(pendingItem.name)},
          ${newRemaining},
          ${receiptId || 'NULL'}
        )
      `);

      // 처리 완료 표시
      setPending(prev => prev.map((item, idx) =>
        idx === pendingIndex
          ? { ...item, processed: true, processedWith: 'membership', processedId: membership.id }
          : item
      ));

      // 멤버십 목록 업데이트
      setMemberships(prev => prev.map(m =>
        m.id === membership.id
          ? { ...m, remaining_count: newRemaining, status: newStatus as any }
          : m
      ));

      // 사용 기록 새로고침
      await loadData();

      console.log(`✅ ${pendingItem.name} → ${membership.membership_type} 차감 (잔여 ${newRemaining}회)`);

    } catch (err) {
      console.error('멤버십 차감 오류:', err);
      alert('차감 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 패키지로 차감
  const handleDeductPackage = async (pkg: YakchimPackage, pendingIndex: number) => {
    if (pkg.remaining_count <= 0) {
      alert('잔여 횟수가 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const pendingItem = pending[pendingIndex];
      const newRemaining = pkg.remaining_count - 1;
      const newUsed = pkg.used_count + 1;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';

      // 패키지 차감
      await execute(`
        UPDATE cs_yakchim_packages
        SET remaining_count = ${newRemaining},
            used_count = ${newUsed},
            status = ${escapeString(newStatus)},
            updated_at = datetime('now')
        WHERE id = ${pkg.id}
      `);

      // 사용 기록 추가
      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id)
        VALUES (
          ${sqlitePatientId},
          'package',
          ${pkg.id},
          ${escapeString(pkg.package_name)},
          ${escapeString(receiptDate)},
          ${escapeString(pendingItem.name)},
          ${newRemaining},
          ${receiptId || 'NULL'}
        )
      `);

      // 처리 완료 표시
      setPending(prev => prev.map((item, idx) =>
        idx === pendingIndex
          ? { ...item, processed: true, processedWith: 'package', processedId: pkg.id }
          : item
      ));

      // 패키지 목록 업데이트
      setPackages(prev => prev.map(p =>
        p.id === pkg.id
          ? { ...p, remaining_count: newRemaining, used_count: newUsed, status: newStatus as any }
          : p
      ));

      // 사용 기록 새로고침
      await loadData();

      console.log(`✅ ${pendingItem.name} → ${pkg.package_name} 차감 (잔여 ${newRemaining}회)`);

    } catch (err) {
      console.error('패키지 차감 오류:', err);
      alert('차감 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 차감 취소
  const handleUndoDeduction = async (pendingIndex: number) => {
    const pendingItem = pending[pendingIndex];
    if (!pendingItem.processed || !pendingItem.processedId) return;

    setIsSaving(true);
    try {
      // 마지막 사용 기록 삭제
      await execute(`
        DELETE FROM cs_yakchim_usage_records
        WHERE patient_id = ${sqlitePatientId}
          AND source_type = ${escapeString(pendingItem.processedWith!)}
          AND source_id = ${pendingItem.processedId}
          AND usage_date = ${escapeString(receiptDate)}
          AND item_name = ${escapeString(pendingItem.name)}
      `);

      // 멤버십/패키지 복구
      if (pendingItem.processedWith === 'membership') {
        await execute(`
          UPDATE cs_memberships
          SET remaining_count = remaining_count + 1,
              status = 'active',
              updated_at = datetime('now')
          WHERE id = ${pendingItem.processedId}
        `);
      } else {
        await execute(`
          UPDATE cs_yakchim_packages
          SET remaining_count = remaining_count + 1,
              used_count = used_count - 1,
              status = 'active',
              updated_at = datetime('now')
          WHERE id = ${pendingItem.processedId}
        `);
      }

      // 처리 상태 초기화
      setPending(prev => prev.map((item, idx) =>
        idx === pendingIndex
          ? { ...item, processed: false, processedWith: undefined, processedId: undefined }
          : item
      ));

      // 데이터 새로고침
      await loadData();

      console.log(`↩️ ${pendingItem.name} 차감 취소`);

    } catch (err) {
      console.error('차감 취소 오류:', err);
      alert('차감 취소 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 처리되지 않은 항목 수
  const unprocessedCount = pending.filter(p => !p.processed).length;

  if (isLoading) {
    return (
      <div className="yakchim-panel loading">
        <div className="loading-spinner">
          <i className="fa-solid fa-spinner fa-spin"></i> 데이터 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="yakchim-panel">
      {error && <div className="error-message">{error}</div>}

      {/* 오늘 처리 필요 */}
      {pending.length > 0 && (
        <section className="panel-section pending-section">
          <div className="section-header">
            <h3>
              <i className="fa-solid fa-exclamation-triangle"></i>
              오늘 처리 필요
              {unprocessedCount > 0 && (
                <span className="pending-count">{unprocessedCount}건</span>
              )}
            </h3>
          </div>
          <div className="pending-items">
            {pending.map((item, idx) => (
              <div
                key={idx}
                className={`pending-item ${item.processed ? 'processed' : ''}`}
              >
                <div className="pending-info">
                  <span className="pending-name">{item.name}</span>
                  <span className="pending-amount">({item.amount.toLocaleString()}원)</span>
                </div>
                {item.processed ? (
                  <div className="pending-status">
                    <span className="processed-badge">
                      ✓ {item.processedWith === 'membership' ? '멤버십' : '패키지'} 차감
                    </span>
                    <button
                      className="btn-undo"
                      onClick={() => handleUndoDeduction(idx)}
                      disabled={isSaving}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <span className="pending-badge">차감 대기</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 멤버십 현황 */}
      <section className="panel-section membership-section">
        <div className="section-header">
          <h3>
            <i className="fa-solid fa-id-card"></i>
            멤버십
          </h3>
          <button
            className="btn-add-small"
            onClick={async () => {
              // sqlitePatientId가 없으면 환자 먼저 생성
              if (!sqlitePatientId) {
                const pid = await getOrCreatePatient();
                setSqlitePatientId(pid);
              }
              setShowMembershipModal(true);
            }}
          >
            <i className="fa-solid fa-plus"></i> 등록
          </button>
        </div>

        {memberships.length === 0 ? (
          <div className="empty-state">등록된 멤버십이 없습니다.</div>
        ) : (
          <div className="membership-list">
            {memberships.map(mem => {
              const daysLeft = getDaysUntilExpire(mem.expire_date);
              const isExpiringSoon = daysLeft <= 30 && daysLeft > 0;
              const isExpired = daysLeft <= 0;

              return (
                <div key={mem.id} className="membership-card">
                  <div className="membership-main">
                    <div className="membership-info">
                      <span className="membership-type">{mem.membership_type}</span>
                      <span className="membership-remaining">
                        잔여 <strong>{mem.remaining_count}</strong>회
                      </span>
                    </div>
                    <div className={`membership-expire ${isExpired ? 'expired' : isExpiringSoon ? 'warning' : ''}`}>
                      만료 {mem.expire_date}
                      {isExpired ? ' (만료됨)' : isExpiringSoon ? ` (D-${daysLeft})` : ''}
                    </div>
                  </div>

                  {/* 처리 대기 항목에 대한 차감 버튼들 */}
                  {pending.filter(p => !p.processed).length > 0 && mem.remaining_count > 0 && (
                    <div className="deduct-buttons">
                      {pending.map((item, idx) => !item.processed && (
                        <button
                          key={idx}
                          className="btn-deduct"
                          onClick={() => handleDeductMembership(mem, idx)}
                          disabled={isSaving || mem.remaining_count <= 0}
                        >
                          {item.name} → 여기서 차감
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 패키지 현황 */}
      <section className="panel-section package-section">
        <div className="section-header">
          <h3>
            <i className="fa-solid fa-box"></i>
            패키지 (통증마일리지)
          </h3>
          <button className="btn-add-small">
            <i className="fa-solid fa-plus"></i> 등록
          </button>
        </div>

        {packages.length === 0 ? (
          <div className="empty-state">등록된 패키지가 없습니다.</div>
        ) : (
          <div className="package-list">
            {packages.map(pkg => (
              <div key={pkg.id} className="package-card">
                <div className="package-main">
                  <div className="package-info">
                    <span className="package-name">{pkg.package_name}</span>
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
                  </div>
                  {pkg.expire_date && (
                    <div className="package-expire">
                      만료 {formatDate(pkg.expire_date)}
                    </div>
                  )}
                </div>

                {/* 처리 대기 항목에 대한 차감 버튼들 */}
                {pending.filter(p => !p.processed).length > 0 && pkg.remaining_count > 0 && (
                  <div className="deduct-buttons">
                    {pending.map((item, idx) => !item.processed && (
                      <button
                        key={idx}
                        className="btn-deduct"
                        onClick={() => handleDeductPackage(pkg, idx)}
                        disabled={isSaving || pkg.remaining_count <= 0}
                      >
                        {item.name} → 여기서 차감
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 차감 기록 */}
      <section className="panel-section history-section">
        <div className="section-header">
          <h3>
            <i className="fa-solid fa-history"></i>
            최근 차감 기록
          </h3>
        </div>

        {usageRecords.length === 0 ? (
          <div className="empty-state light">차감 기록이 없습니다.</div>
        ) : (
          <div className="usage-history">
            {usageRecords.map(record => (
              <div key={record.id} className="history-item">
                <span className="history-date">{formatDate(record.usage_date)}</span>
                <span className="history-item-name">{record.item_name}</span>
                <span className="history-arrow">→</span>
                <span className={`history-source ${record.source_type}`}>
                  {record.source_type === 'membership' ? '멤버십' : '패키지'}
                </span>
                <span className="history-remaining">(잔여 {record.remaining_after}회)</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 하단 버튼 */}
      <div className="panel-footer">
        <button className="btn-cancel" onClick={onClose}>닫기</button>
        {pending.some(p => !p.processed) && (
          <span className="footer-warning">
            <i className="fa-solid fa-exclamation-circle"></i>
            처리되지 않은 항목이 있습니다
          </span>
        )}
      </div>

      {/* 멤버십 등록 모달 */}
      {showMembershipModal && sqlitePatientId && (
        <MembershipAddModal
          isOpen={showMembershipModal}
          onClose={() => setShowMembershipModal(false)}
          onSuccess={() => {
            setShowMembershipModal(false);
            loadData(); // 데이터 새로고침
          }}
          patientId={sqlitePatientId}
          patientName={patientName}
          chartNo={chartNumber}
        />
      )}
    </div>
  );
};

export default YakchimPanel;
