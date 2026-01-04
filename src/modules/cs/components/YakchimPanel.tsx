import React, { useState, useEffect, useCallback } from 'react';
import { query, execute, escapeString, insert } from '@shared/lib/postgres';

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

// 멤버십 타입 (기간 기반 무제한 사용)
interface Membership {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  membership_type: string;
  quantity: number; // 등록 개수 (내원 시 무료 이용 개수)
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

  // 멤버십 인라인 폼 상태
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [membershipForm, setMembershipForm] = useState({
    membership_type: '경근멤버십',
    quantity: 1,
    expire_date: '',
  });

  // 패키지 인라인 폼 상태
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [packageForm, setPackageForm] = useState({
    package_name: '통마',
    total_count: 10,
    expire_date: '',
  });

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

  // 데이터 로드 (pending 상태는 건드리지 않음)
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
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

      // 패키지 조회 (시술패키지 - 통증마일리지)
      const packageData = await query<YakchimPackage>(`
        SELECT * FROM cs_treatment_packages
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

      // 처리 대기 항목 초기화 (최초 로드 시에만)
      if (isInitial) {
        setPending(pendingItems.map(item => ({
          ...item,
          processed: false,
        })));
      }

    } catch (err) {
      console.error('데이터 로드 오류:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [getOrCreatePatient, pendingItems]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // 멤버십으로 사용 기록 (차감 없음 - 기간 동안 무제한 사용)
  const handleUseMembership = async (membership: Membership, pendingIndex: number) => {
    setIsSaving(true);
    try {
      const pendingItem = pending[pendingIndex];

      // 사용 기록만 추가 (차감 없음)
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
          ${membership.quantity},
          ${receiptId || 'NULL'}
        )
      `);

      // 처리 완료 표시
      setPending(prev => prev.map((item, idx) =>
        idx === pendingIndex
          ? { ...item, processed: true, processedWith: 'membership', processedId: membership.id }
          : item
      ));

      // 사용 기록 새로고침
      await loadData();

      console.log(`✅ ${pendingItem.name} → ${membership.membership_type} 사용 기록`);

    } catch (err) {
      console.error('멤버십 사용 기록 오류:', err);
      alert('사용 기록 처리 중 오류가 발생했습니다.');
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
        UPDATE cs_treatment_packages
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

  // 사용 기록 취소 (멤버십은 기록만 삭제, 패키지는 복구까지)
  const handleUndoUsage = async (pendingIndex: number) => {
    const pendingItem = pending[pendingIndex];
    if (!pendingItem.processed || !pendingItem.processedId) return;

    setIsSaving(true);
    try {
      // 사용 기록 삭제
      await execute(`
        DELETE FROM cs_yakchim_usage_records
        WHERE patient_id = ${sqlitePatientId}
          AND source_type = ${escapeString(pendingItem.processedWith!)}
          AND source_id = ${pendingItem.processedId}
          AND usage_date = ${escapeString(receiptDate)}
          AND item_name = ${escapeString(pendingItem.name)}
      `);

      // 패키지만 복구 (멤버십은 차감이 없으므로 복구 불필요)
      if (pendingItem.processedWith === 'package') {
        await execute(`
          UPDATE cs_treatment_packages
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

      console.log(`↩️ ${pendingItem.name} 취소`);

    } catch (err) {
      console.error('취소 오류:', err);
      alert('취소 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 처리되지 않은 항목 수
  const unprocessedCount = pending.filter(p => !p.processed).length;

  // 멤버십 폼 초기화
  const resetMembershipForm = () => {
    const defaultExpire = new Date();
    defaultExpire.setFullYear(defaultExpire.getFullYear() + 1);
    setMembershipForm({
      membership_type: '경근멤버십',
      quantity: 1,
      expire_date: defaultExpire.toISOString().split('T')[0],
    });
  };

  // 멤버십 저장
  const handleSaveMembership = async () => {
    console.log('멤버십 저장 시도:', membershipForm);

    if (!membershipForm.membership_type.trim()) {
      alert('멤버십 종류를 선택해주세요.');
      return;
    }
    if (!membershipForm.expire_date) {
      alert('만료일을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      let pid = sqlitePatientId;
      if (!pid) {
        pid = await getOrCreatePatient();
        setSqlitePatientId(pid);
      }

      console.log('patient_id:', pid);

      if (!pid) {
        alert('환자 정보를 찾을 수 없습니다.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const sql = `
        INSERT INTO cs_memberships (
          patient_id, chart_number, patient_name, membership_type, quantity, remaining_count,
          start_date, expire_date, status, created_at, updated_at
        ) VALUES (
          ${pid}, ${escapeString(chartNumber)}, ${escapeString(patientName)},
          ${escapeString(membershipForm.membership_type)}, ${membershipForm.quantity}, ${membershipForm.quantity},
          ${escapeString(today)}, ${escapeString(membershipForm.expire_date)},
          'active', ${escapeString(now)}, ${escapeString(now)}
        )
      `;
      console.log('SQL:', sql);

      const newId = await insert(sql);
      console.log('생성된 멤버십 ID:', newId);

      setShowMembershipForm(false);
      resetMembershipForm();
      await loadData();
    } catch (err) {
      console.error('멤버십 저장 오류:', err);
      alert('저장에 실패했습니다: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // 패키지 폼 초기화
  const resetPackageForm = () => {
    setPackageForm({
      package_name: '통마',
      total_count: 10,
      expire_date: '',
    });
  };

  // 패키지 저장
  const handleSavePackage = async () => {
    if (!packageForm.package_name.trim()) {
      alert('패키지명을 선택해주세요.');
      return;
    }
    if (packageForm.total_count <= 0) {
      alert('총 횟수는 1 이상이어야 합니다.');
      return;
    }

    setIsSaving(true);
    try {
      let pid = sqlitePatientId;
      if (!pid) {
        pid = await getOrCreatePatient();
        setSqlitePatientId(pid);
      }

      const today = new Date().toISOString().split('T')[0];
      await insert(`
        INSERT INTO cs_treatment_packages (
          patient_id, chart_number, patient_name, package_name,
          total_count, used_count, remaining_count,
          start_date, expire_date, status, created_at, updated_at
        ) VALUES (
          ${pid}, ${escapeString(chartNumber)}, ${escapeString(patientName)},
          ${escapeString(packageForm.package_name)},
          ${packageForm.total_count}, 0, ${packageForm.total_count},
          ${escapeString(today)}, ${packageForm.expire_date ? escapeString(packageForm.expire_date) : 'NULL'},
          'active', datetime('now'), datetime('now')
        )
      `);

      setShowPackageForm(false);
      resetPackageForm();
      await loadData();
    } catch (err) {
      console.error('패키지 저장 오류:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* 2단 레이아웃 */}
      <div className="yakchim-columns">
        {/* 왼쪽: 최근 사용 기록 */}
        <div className="left-column">
          <section className="panel-section history-section">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-history"></i>
                최근 사용 기록
              </h3>
            </div>

            {usageRecords.length === 0 ? (
              <div className="empty-state light">사용 기록이 없습니다.</div>
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
                    {record.source_type === 'package' && (
                      <span className="history-remaining">(잔여 {record.remaining_after}회)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 오른쪽: 처리 대기 + 멤버십 + 패키지 */}
        <div className="right-column">
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
                          ✓ {item.processedWith === 'membership' ? '멤버십 사용' : '패키지 차감'}
                        </span>
                        <button
                          className="btn-undo"
                          onClick={() => handleUndoUsage(idx)}
                          disabled={isSaving}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <span className="pending-badge">처리 대기</span>
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
              {!showMembershipForm && (
                <button
                  className="btn-add-small"
                  onClick={() => {
                    resetMembershipForm();
                    setShowMembershipForm(true);
                  }}
                >
                  <i className="fa-solid fa-plus"></i> 등록
                </button>
              )}
            </div>

            {/* 인라인 등록 폼 (한 줄) */}
            {showMembershipForm && (
              <div className="inline-form-single">
                <select
                  value={membershipForm.membership_type}
                  onChange={(e) => setMembershipForm({ ...membershipForm, membership_type: e.target.value })}
                >
                  <option value="경근멤버십">경근멤버십</option>
                  <option value="녹용멤버십">녹용멤버십</option>
                  <option value="VIP멤버십">VIP멤버십</option>
                </select>
                <input
                  type="number"
                  value={membershipForm.quantity}
                  onChange={(e) => setMembershipForm({ ...membershipForm, quantity: Number(e.target.value) })}
                  min={1}
                  className="input-qty"
                />
                <span className="input-suffix">개</span>
                <input
                  type="date"
                  value={membershipForm.expire_date}
                  onChange={(e) => setMembershipForm({ ...membershipForm, expire_date: e.target.value })}
                  className="input-date"
                />
                <button
                  className="btn-cancel-small"
                  onClick={() => setShowMembershipForm(false)}
                  disabled={isSaving}
                >
                  취소
                </button>
                <button
                  className="btn-save-small"
                  onClick={handleSaveMembership}
                  disabled={isSaving}
                >
                  {isSaving ? '...' : '저장'}
                </button>
              </div>
            )}

            {memberships.length === 0 && !showMembershipForm ? (
              <div className="empty-state">등록된 멤버십이 없습니다.</div>
            ) : (
              <div className="item-list">
                {memberships.map(mem => {
                  const daysLeft = getDaysUntilExpire(mem.expire_date);
                  const isExpired = daysLeft <= 0;

                  return (
                    <div key={mem.id} className={`item-row ${isExpired ? 'expired' : ''}`}>
                      <span className="item-type">{mem.membership_type}</span>
                      <span className="item-qty">{mem.quantity}개</span>
                      <span className="item-expire">~{mem.expire_date}</span>
                      {pending.filter(p => !p.processed).length > 0 && !isExpired ? (
                        pending.filter(p => !p.processed).map((item, idx) => (
                          <button
                            key={idx}
                            className="btn-use"
                            onClick={() => handleUseMembership(mem, pending.findIndex(p => p === item))}
                            disabled={isSaving}
                          >
                            사용기록
                          </button>
                        ))
                      ) : (
                        <span className="item-status">{isExpired ? '만료' : ''}</span>
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
              {!showPackageForm && (
                <button
                  className="btn-add-small"
                  onClick={() => {
                    resetPackageForm();
                    setShowPackageForm(true);
                  }}
                >
                  <i className="fa-solid fa-plus"></i> 등록
                </button>
              )}
            </div>

            {/* 인라인 등록 폼 (한 줄) */}
            {showPackageForm && (
              <div className="inline-form-single">
                <select
                  value={packageForm.package_name}
                  onChange={(e) => setPackageForm({ ...packageForm, package_name: e.target.value })}
                >
                  <option value="통마">통마</option>
                  <option value="약침">약침</option>
                  <option value="향기요법">향기요법</option>
                  <option value="스파인엠티">스파인엠티</option>
                </select>
                <input
                  type="number"
                  value={packageForm.total_count}
                  onChange={(e) => setPackageForm({ ...packageForm, total_count: Number(e.target.value) })}
                  min={1}
                  className="input-qty"
                />
                <span className="input-suffix">회</span>
                <input
                  type="date"
                  value={packageForm.expire_date}
                  onChange={(e) => setPackageForm({ ...packageForm, expire_date: e.target.value })}
                  className="input-date"
                />
                <button
                  className="btn-cancel-small"
                  onClick={() => setShowPackageForm(false)}
                  disabled={isSaving}
                >
                  취소
                </button>
                <button
                  className="btn-save-small"
                  onClick={handleSavePackage}
                  disabled={isSaving}
                >
                  {isSaving ? '...' : '저장'}
                </button>
              </div>
            )}

            {packages.length === 0 && !showPackageForm ? (
              <div className="empty-state">등록된 패키지가 없습니다.</div>
            ) : (
              <div className="item-list">
                {packages.map(pkg => (
                  <div key={pkg.id} className={`item-row ${pkg.remaining_count <= 0 ? 'depleted' : ''}`}>
                    <span className="item-type">{pkg.package_name}</span>
                    <span className="item-qty">{pkg.remaining_count}/{pkg.total_count}회</span>
                    {pkg.expire_date && <span className="item-expire">~{pkg.expire_date}</span>}
                    {pending.filter(p => !p.processed).length > 0 && pkg.remaining_count > 0 ? (
                      pending.filter(p => !p.processed).map((item, idx) => (
                        <button
                          key={idx}
                          className="btn-use package"
                          onClick={() => handleDeductPackage(pkg, pending.findIndex(p => p === item))}
                          disabled={isSaving}
                        >
                          차감
                        </button>
                      ))
                    ) : (
                      <span className="item-status">{pkg.remaining_count <= 0 ? '소진' : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

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
    </div>
  );
};

export default YakchimPanel;
