import React, { useState, useEffect } from 'react';
import {
  HerbalPackage,
  HerbalPackageRound,
  HerbalPickup,
  NokryongPackage,
  DeliveryMethod,
  DELIVERY_METHOD_LABELS,
  PACKAGE_TYPE_LABELS,
  HERBAL_PACKAGE_ROUNDS,
} from '../types';

interface HerbalPanelProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId?: number;
  receiptDate: string;
  onSave?: (data: HerbalSaveData) => void;
  onClose?: () => void;
}

export interface HerbalSaveData {
  pickups: HerbalPickup[];
  memo?: string;
}

// 오늘 수령 행 타입 (UI용)
interface PickupRow {
  id: string;  // 임시 ID
  package_id?: number;
  round_number: number;
  delivery_method: DeliveryMethod;
  with_nokryong: boolean;
  nokryong_package_id?: number;
}

const DELIVERY_METHODS: DeliveryMethod[] = ['pickup', 'local', 'express'];

// 임시 UUID 생성
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const HerbalPanel: React.FC<HerbalPanelProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  onSave,
  onClose,
}) => {
  // 오늘 수령 내역 (행 목록)
  const [pickupRows, setPickupRows] = useState<PickupRow[]>([]);

  // 한약 패키지 목록
  const [packages, setPackages] = useState<HerbalPackage[]>([]);

  // 녹용 패키지 목록
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);

  // 수령 이력
  const [pickupHistory, setPickupHistory] = useState<HerbalPickup[]>([]);

  // 완료된 패키지 접힘 상태
  const [showCompletedPackages, setShowCompletedPackages] = useState(false);

  // 패키지 상세 이력 펼침
  const [expandedPackageId, setExpandedPackageId] = useState<number | null>(null);
  const [packageRounds, setPackageRounds] = useState<Record<number, HerbalPackageRound[]>>({});

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
      // 1. 해당 환자의 활성/완료 한약 패키지 목록
      // 2. 해당 환자의 활성 녹용 패키지 목록
      // 3. 최근 수령 이력

      // 임시 더미 데이터
      setPackages([
        {
          id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          herbal_name: '시함마농',
          package_type: '3month',
          total_count: 6,
          used_count: 2,
          remaining_count: 4,
          start_date: '2024-12-01',
          status: 'active',
        },
        {
          id: 2,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          herbal_name: '궁귀교애탕',
          package_type: '2month',
          total_count: 4,
          used_count: 4,
          remaining_count: 0,
          start_date: '2024-10-01',
          status: 'completed',
        },
        {
          id: 3,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          herbal_name: '팔진탕',
          package_type: '1month',
          total_count: 2,
          used_count: 2,
          remaining_count: 0,
          start_date: '2024-09-01',
          status: 'completed',
        },
      ]);

      setNokryongPackages([
        {
          id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          package_name: '녹용 3개월권',
          total_months: 3,
          remaining_months: 2,
          start_date: '2024-11-01',
          status: 'active',
        },
      ]);

      setPickupHistory([
        {
          id: 1,
          package_id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          pickup_date: '2024-12-28',
          round_number: 2,
          delivery_method: 'pickup',
          with_nokryong: true,
          nokryong_package_id: 1,
        },
        {
          id: 2,
          package_id: 1,
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          pickup_date: '2024-12-14',
          round_number: 1,
          delivery_method: 'local',
          with_nokryong: false,
        },
      ]);

      // 기존 수령 기록이 없으면 빈 상태
      setPickupRows([]);

    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 활성/완료 패키지 분리
  const activePackages = packages.filter(p => p.status === 'active');
  const completedPackages = packages.filter(p => p.status === 'completed');

  // 활성 녹용 패키지
  const activeNokryongPackages = nokryongPackages.filter(n => n.status === 'active');

  // 행 추가
  const addPickupRow = () => {
    const firstPackage = activePackages[0];
    const nextRound = firstPackage
      ? firstPackage.used_count + 1 + pickupRows.filter(r => r.package_id === firstPackage.id).length
      : 1;

    setPickupRows([...pickupRows, {
      id: generateTempId(),
      package_id: firstPackage?.id,
      round_number: nextRound,
      delivery_method: 'pickup',
      with_nokryong: false,
    }]);
  };

  // 행 삭제
  const removePickupRow = (rowId: string) => {
    setPickupRows(pickupRows.filter(row => row.id !== rowId));
  };

  // 행 업데이트
  const updatePickupRow = (rowId: string, field: keyof PickupRow, value: any) => {
    setPickupRows(pickupRows.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      // 패키지 변경 시 회차 자동 계산
      if (field === 'package_id') {
        const pkg = packages.find(p => p.id === value);
        if (pkg) {
          // 해당 패키지의 다음 회차 계산
          const samePackageRows = pickupRows.filter(r => r.package_id === value && r.id !== rowId);
          updated.round_number = pkg.used_count + 1 + samePackageRows.length;
        }
      }

      // 녹용 추가 해제 시 녹용 패키지 초기화
      if (field === 'with_nokryong' && !value) {
        updated.nokryong_package_id = undefined;
      }

      // 녹용 추가 선택 시 첫 번째 활성 녹용 패키지 자동 선택
      if (field === 'with_nokryong' && value) {
        const firstNokryong = activeNokryongPackages[0];
        if (firstNokryong) {
          updated.nokryong_package_id = firstNokryong.id;
        }
      }

      return updated;
    }));
  };

  // 패키지의 잔여 회차 (오늘 수령 포함)
  const getRemainingCount = (packageId: number): number => {
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return 0;
    const todayPickups = pickupRows.filter(r => r.package_id === packageId).length;
    return pkg.remaining_count - todayPickups;
  };

  // 녹용 패키지 잔여 (오늘 사용 포함)
  const getNokryongRemaining = (nokryongId: number): number => {
    const pkg = nokryongPackages.find(n => n.id === nokryongId);
    if (!pkg) return 0;
    const todayUsed = pickupRows.filter(r => r.nokryong_package_id === nokryongId).length;
    return pkg.remaining_months - todayUsed;
  };

  // 패키지 이력 토글
  const togglePackageHistory = async (packageId: number) => {
    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      return;
    }

    setExpandedPackageId(packageId);

    // 이미 로드된 경우 스킵
    if (packageRounds[packageId]) return;

    // TODO: API에서 회차별 이력 로드
    // 임시 더미 데이터
    const pkg = packages.find(p => p.id === packageId);
    if (pkg) {
      const rounds: HerbalPackageRound[] = [];
      for (let i = 1; i <= pkg.total_count; i++) {
        rounds.push({
          id: i,
          package_id: packageId,
          round_number: i,
          delivery_method: i <= pkg.used_count ? (i % 2 === 0 ? 'local' : 'pickup') : 'pickup',
          scheduled_date: i <= pkg.used_count ? `2024-${12 - (pkg.used_count - i)}월` : undefined,
          delivered_date: i <= pkg.used_count ? `2024-12-${14 - (pkg.used_count - i) * 14}` : undefined,
          status: i <= pkg.used_count ? 'completed' : 'pending',
        });
      }
      setPackageRounds({
        ...packageRounds,
        [packageId]: rounds,
      });
    }
  };

  // 저장
  const handleSave = async () => {
    if (pickupRows.length === 0) {
      onClose?.();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // PickupRow를 HerbalPickup으로 변환
      const pickups: HerbalPickup[] = pickupRows.map(row => ({
        package_id: row.package_id!,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        receipt_id: receiptId,
        pickup_date: receiptDate,
        round_number: row.round_number,
        delivery_method: row.delivery_method,
        with_nokryong: row.with_nokryong,
        nokryong_package_id: row.nokryong_package_id,
      }));

      // TODO: API 호출
      // 1. 수령 기록 저장
      // 2. 패키지 회차 차감
      // 3. 녹용 패키지 차감 (녹용 추가 시)
      // 4. 이력 기록

      onSave?.({ pickups, memo });

    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 전체 날짜 포맷
  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="herbal-panel loading">
        <div className="loading-spinner">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="herbal-panel">
      {error && <div className="error-message">{error}</div>}

      {/* 오늘 수령 */}
      <section className="panel-section">
        <div className="section-header">
          <h3>오늘 수령</h3>
          <button
            className="btn-add"
            onClick={addPickupRow}
            disabled={activePackages.length === 0}
          >
            <i className="fa-solid fa-plus"></i> 수령 추가
          </button>
        </div>

        {pickupRows.length === 0 ? (
          <div className="empty-state light">
            오늘 수령 내역이 없습니다.
            {activePackages.length > 0 && ' 수령 추가 버튼을 눌러 등록하세요.'}
          </div>
        ) : (
          <table className="pickup-table">
            <thead>
              <tr>
                <th>패키지</th>
                <th>회차</th>
                <th>배송</th>
                <th>녹용</th>
                <th>잔여</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pickupRows.map((row) => {
                const selectedPkg = packages.find(p => p.id === row.package_id);
                return (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.package_id || ''}
                        onChange={(e) => updatePickupRow(row.id, 'package_id', parseInt(e.target.value) || undefined)}
                      >
                        <option value="">선택</option>
                        {activePackages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.herbal_name} ({PACKAGE_TYPE_LABELS[pkg.package_type]})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="round-cell">
                      <span className="round-number">{row.round_number}</span>
                      <span className="round-total">/{selectedPkg?.total_count || '-'}</span>
                    </td>
                    <td>
                      <select
                        value={row.delivery_method}
                        onChange={(e) => updatePickupRow(row.id, 'delivery_method', e.target.value as DeliveryMethod)}
                      >
                        {DELIVERY_METHODS.map(method => (
                          <option key={method} value={method}>{DELIVERY_METHOD_LABELS[method]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="nokryong-cell">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={row.with_nokryong}
                          onChange={(e) => updatePickupRow(row.id, 'with_nokryong', e.target.checked)}
                          disabled={activeNokryongPackages.length === 0}
                        />
                        {row.with_nokryong && activeNokryongPackages.length > 1 && (
                          <select
                            value={row.nokryong_package_id || ''}
                            onChange={(e) => updatePickupRow(row.id, 'nokryong_package_id', parseInt(e.target.value) || undefined)}
                          >
                            {activeNokryongPackages.map(n => (
                              <option key={n.id} value={n.id}>
                                {n.package_name} (잔여 {getNokryongRemaining(n.id!)})
                              </option>
                            ))}
                          </select>
                        )}
                        {row.with_nokryong && activeNokryongPackages.length === 1 && (
                          <span className="nokryong-badge">
                            +녹용 (잔여 {getNokryongRemaining(activeNokryongPackages[0].id!)})
                          </span>
                        )}
                      </label>
                    </td>
                    <td className="remaining-cell">
                      {row.package_id ? (
                        <span className={`remaining-count ${getRemainingCount(row.package_id) <= 1 ? 'low' : ''}`}>
                          {getRemainingCount(row.package_id)}회
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <button
                        className="btn-remove"
                        onClick={() => removePickupRow(row.id)}
                        title="삭제"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 활성 패키지 현황 */}
      <section className="panel-section">
        <div className="section-header">
          <h3>선결제 패키지</h3>
          <button className="btn-add-small">
            <i className="fa-solid fa-plus"></i> 새 선결
          </button>
        </div>

        {activePackages.length === 0 ? (
          <div className="empty-state">활성 패키지가 없습니다.</div>
        ) : (
          <div className="package-list">
            {activePackages.map(pkg => {
              const todayPickups = pickupRows.filter(r => r.package_id === pkg.id).length;
              const adjustedRemaining = pkg.remaining_count - todayPickups;
              const adjustedUsed = pkg.used_count + todayPickups;

              return (
                <div key={pkg.id} className="package-item">
                  <div
                    className="package-summary"
                    onClick={() => togglePackageHistory(pkg.id!)}
                  >
                    <div className="package-info">
                      <span className="herbal-name">{pkg.herbal_name}</span>
                      <span className="package-type">{PACKAGE_TYPE_LABELS[pkg.package_type]}</span>
                    </div>
                    <div className="package-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${(adjustedRemaining / pkg.total_count) * 100}%` }}
                        />
                        {todayPickups > 0 && (
                          <div
                            className="progress-today"
                            style={{
                              width: `${(todayPickups / pkg.total_count) * 100}%`,
                              left: `${(adjustedRemaining / pkg.total_count) * 100}%`
                            }}
                          />
                        )}
                      </div>
                      <span className="progress-text">
                        {adjustedRemaining}/{pkg.total_count}회
                        {todayPickups > 0 && <span className="today-pickup">(-{todayPickups})</span>}
                      </span>
                    </div>
                    <span className="package-start">
                      {formatDate(pkg.start_date)}~
                    </span>
                    <i className={`fa-solid fa-chevron-${expandedPackageId === pkg.id ? 'up' : 'down'}`}></i>
                  </div>

                  {expandedPackageId === pkg.id && packageRounds[pkg.id!] && (
                    <div className="package-rounds">
                      <table>
                        <thead>
                          <tr>
                            <th>회차</th>
                            <th>배송</th>
                            <th>수령일</th>
                            <th>상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packageRounds[pkg.id!].map(round => (
                            <tr key={round.id} className={round.status}>
                              <td>{round.round_number}회</td>
                              <td>{DELIVERY_METHOD_LABELS[round.delivery_method]}</td>
                              <td>{round.delivered_date ? formatDate(round.delivered_date) : '-'}</td>
                              <td>
                                <span className={`round-status ${round.status}`}>
                                  {round.status === 'completed' ? '완료' : round.status === 'delivered' ? '배송완료' : round.status === 'preparing' ? '준비중' : '대기'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 녹용 패키지 현황 */}
      {nokryongPackages.length > 0 && (
        <section className="panel-section">
          <div className="section-header">
            <h3>녹용 추가 현황</h3>
            <button className="btn-add-small">
              <i className="fa-solid fa-plus"></i> 새 구매
            </button>
          </div>

          <div className="nokryong-list">
            {activeNokryongPackages.map(n => {
              const todayUsed = pickupRows.filter(r => r.nokryong_package_id === n.id).length;
              const adjustedRemaining = n.remaining_months - todayUsed;

              return (
                <div key={n.id} className="nokryong-item">
                  <div className="nokryong-icon">
                    <i className="fa-solid fa-leaf"></i>
                  </div>
                  <div className="nokryong-info">
                    <span className="nokryong-name">{n.package_name}</span>
                    <span className="nokryong-period">{formatFullDate(n.start_date)}~</span>
                  </div>
                  <div className="nokryong-remaining">
                    <span className={`remaining ${adjustedRemaining <= 1 ? 'low' : ''}`}>
                      잔여 {adjustedRemaining}/{n.total_months}개월
                    </span>
                    {todayUsed > 0 && <span className="today-used">(-{todayUsed})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 완료된 패키지 (접힘) */}
      {completedPackages.length > 0 && (
        <section className="panel-section collapsed-section">
          <div
            className="section-header collapsible"
            onClick={() => setShowCompletedPackages(!showCompletedPackages)}
          >
            <h3>
              <i className={`fa-solid fa-chevron-${showCompletedPackages ? 'up' : 'down'}`}></i>
              {' '}완료된 패키지 ({completedPackages.length})
            </h3>
          </div>

          {showCompletedPackages && (
            <div className="completed-list">
              {completedPackages.map(pkg => (
                <div key={pkg.id} className="completed-item">
                  <span className="herbal-name">{pkg.herbal_name}</span>
                  <span className="package-type">{PACKAGE_TYPE_LABELS[pkg.package_type]}</span>
                  <span className="completed-date">{formatFullDate(pkg.start_date)}</span>
                  <span className="completed-badge">완료</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 최근 수령 이력 */}
      {pickupHistory.length > 0 && (
        <section className="panel-section">
          <div className="section-header">
            <h3>최근 수령 이력</h3>
          </div>

          <div className="history-list">
            {pickupHistory.slice(0, 5).map(h => {
              const pkg = packages.find(p => p.id === h.package_id);
              return (
                <div key={h.id} className="history-item">
                  <span className="history-date">{formatDate(h.pickup_date)}</span>
                  <span className="history-herbal">{pkg?.herbal_name || '-'}</span>
                  <span className="history-round">{h.round_number}회차</span>
                  <span className="history-delivery">{DELIVERY_METHOD_LABELS[h.delivery_method]}</span>
                  {h.with_nokryong && <span className="history-nokryong">+녹용</span>}
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
          placeholder="한약 관련 메모를 입력하세요..."
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

export default HerbalPanel;
