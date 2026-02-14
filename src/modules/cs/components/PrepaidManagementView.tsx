import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import type { PortalUser } from '@shared/types';
import { getCurrentDate } from '@shared/lib/postgres';
import type { HerbalPackage, HerbalPackageRound, DeliveryMethod, RoundStatus } from '../types';
import { DELIVERY_METHOD_LABELS, ROUND_STATUS_LABELS, ROUND_STATUS_COLORS, PACKAGE_TYPE_LABELS } from '../types';
import {
  getAllHerbalPackagesWithRounds,
  createHerbalPackage,
  updateHerbalPackage,
  deleteHerbalPackage,
  initializePackageRounds,
  updatePackageRound,
  completePackageRound,
  ensureReceiptTables,
  type HerbalPackageWithRounds,
} from '../lib/api';

interface PrepaidManagementViewProps {
  user: PortalUser;
}

function PrepaidManagementView({ user }: PrepaidManagementViewProps) {
  const [packages, setPackages] = useState<HerbalPackageWithRounds[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [expandedPackageId, setExpandedPackageId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRound, setEditingRound] = useState<{ packageId: number; round: HerbalPackageRound } | null>(null);

  // 데이터 로드
  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      await ensureReceiptTables();
      const data = await getAllHerbalPackagesWithRounds(includeCompleted);
      setPackages(data);
    } catch (error) {
      console.error('선결 패키지 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [includeCompleted]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  // 패키지 삭제
  async function handleDeletePackage(pkg: HerbalPackageWithRounds) {
    if (!confirm(`${pkg.patient_name}님의 "${pkg.herbal_name}" 패키지를 삭제하시겠습니까?\n(회차 정보도 함께 삭제됩니다)`)) {
      return;
    }
    try {
      await deleteHerbalPackage(pkg.id!);
      loadPackages();
    } catch (error) {
      console.error('패키지 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  }

  // 회차 상태 변경
  async function handleRoundStatusChange(round: HerbalPackageRound, newStatus: RoundStatus) {
    try {
      if (newStatus === 'delivered') {
        await completePackageRound(round.id!);
      } else {
        await updatePackageRound(round.id!, { status: newStatus });
      }
      loadPackages();
    } catch (error) {
      console.error('회차 상태 변경 실패:', error);
      alert('상태 변경에 실패했습니다.');
    }
  }

  // 패키지 완료 처리
  async function handleCompletePackage(pkg: HerbalPackageWithRounds) {
    if (!confirm(`${pkg.patient_name}님의 "${pkg.herbal_name}" 패키지를 완료 처리하시겠습니까?`)) {
      return;
    }
    try {
      await updateHerbalPackage(pkg.id!, { status: 'completed' });
      loadPackages();
    } catch (error) {
      console.error('패키지 완료 처리 실패:', error);
      alert('완료 처리에 실패했습니다.');
    }
  }

  // 진행률 계산
  function getProgress(pkg: HerbalPackageWithRounds): number {
    if (pkg.total_count === 0) return 0;
    return Math.round((pkg.used_count / pkg.total_count) * 100);
  }

  // 다음 배송 예정일 표시
  function getNextDeliveryText(pkg: HerbalPackageWithRounds): string {
    const pendingRound = pkg.rounds.find(r => r.status === 'pending' || r.status === 'preparing');
    if (pendingRound?.scheduled_date) {
      return pendingRound.scheduled_date;
    }
    if (pkg.next_delivery_date) {
      return pkg.next_delivery_date;
    }
    return '-';
  }

  return (
    <div className="prepaid-management">
      {/* Header */}
      <div className="prepaid-header">
        <div className="prepaid-header-left">
          <h2>선결 패키지 관리</h2>
          <span className="prepaid-count">총 {packages.length}건</span>
        </div>
        <div className="prepaid-header-right">
          <label className="prepaid-filter-checkbox">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            완료 포함
          </label>
          <button className="prepaid-refresh-btn" onClick={loadPackages} disabled={loading}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
          <button className="prepaid-add-btn" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> 신규 등록
          </button>
        </div>
      </div>

      {/* 패키지 목록 */}
      <div className="prepaid-list">
        {loading ? (
          <div className="prepaid-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : packages.length === 0 ? (
          <div className="prepaid-empty">
            <i className="fas fa-box-open"></i>
            <p>등록된 선결 패키지가 없습니다</p>
          </div>
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`prepaid-card ${pkg.status === 'completed' ? 'completed' : ''}`}
            >
              {/* 카드 헤더 */}
              <div
                className="prepaid-card-header"
                onClick={() => setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id!)}
              >
                <div className="prepaid-card-info">
                  <div className="prepaid-patient">
                    <span className="prepaid-patient-name">{pkg.patient_name}</span>
                    <span className="prepaid-chart-no">({pkg.chart_number})</span>
                  </div>
                  <div className="prepaid-herbal-name">
                    {pkg.herbal_name || '약명 미지정'}
                    {!pkg.mssql_detail_id && (
                      <span className="prepaid-unlinked-badge">미연결</span>
                    )}
                  </div>
                </div>

                <div className="prepaid-card-meta">
                  <span className="prepaid-type-badge">
                    {PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}
                  </span>
                  <div className="prepaid-progress">
                    <div className="prepaid-progress-bar">
                      <div
                        className="prepaid-progress-fill"
                        style={{ width: `${getProgress(pkg)}%` }}
                      />
                    </div>
                    <span className="prepaid-progress-text">
                      {pkg.used_count}/{pkg.total_count}회
                    </span>
                  </div>
                </div>

                <div className="prepaid-card-dates">
                  <div className="prepaid-date-item">
                    <span className="prepaid-date-label">시작일</span>
                    <span className="prepaid-date-value">{pkg.start_date}</span>
                  </div>
                  <div className="prepaid-date-item">
                    <span className="prepaid-date-label">다음배송</span>
                    <span className="prepaid-date-value">{getNextDeliveryText(pkg)}</span>
                  </div>
                </div>

                <div className="prepaid-card-actions">
                  {pkg.status === 'active' && (
                    <button
                      className="prepaid-action-btn complete"
                      onClick={(e) => { e.stopPropagation(); handleCompletePackage(pkg); }}
                      title="완료 처리"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                  )}
                  <button
                    className="prepaid-action-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDeletePackage(pkg); }}
                    title="삭제"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                  <button className="prepaid-expand-btn">
                    <i className={`fas fa-chevron-${expandedPackageId === pkg.id ? 'up' : 'down'}`}></i>
                  </button>
                </div>
              </div>

              {/* 회차별 상세 */}
              {expandedPackageId === pkg.id && (
                <div className="prepaid-card-detail">
                  {pkg.memo && (
                    <div className="prepaid-memo">
                      <i className="fas fa-sticky-note"></i> {pkg.memo}
                    </div>
                  )}
                  <div className="prepaid-rounds">
                    <div className="prepaid-rounds-header">
                      <span className="round-col round-num">회차</span>
                      <span className="round-col round-method">배송방법</span>
                      <span className="round-col round-scheduled">예정일</span>
                      <span className="round-col round-delivered">배송일</span>
                      <span className="round-col round-status">상태</span>
                      <span className="round-col round-memo">메모</span>
                      <span className="round-col round-actions">작업</span>
                    </div>
                    {pkg.rounds.map((round) => (
                      <div key={round.id} className={`prepaid-round-row ${round.status}`}>
                        <span className="round-col round-num">{round.round_number}회차</span>
                        <span className="round-col round-method">
                          {DELIVERY_METHOD_LABELS[round.delivery_method]}
                        </span>
                        <span className="round-col round-scheduled">
                          {round.scheduled_date || '-'}
                        </span>
                        <span className="round-col round-delivered">
                          {round.delivered_date || '-'}
                        </span>
                        <span className="round-col round-status">
                          <span
                            className="round-status-badge"
                            style={{ backgroundColor: ROUND_STATUS_COLORS[round.status] }}
                          >
                            {ROUND_STATUS_LABELS[round.status]}
                          </span>
                        </span>
                        <span className="round-col round-memo">{round.memo || '-'}</span>
                        <span className="round-col round-actions">
                          {round.status === 'pending' && (
                            <>
                              <button
                                className="round-action-btn"
                                onClick={() => handleRoundStatusChange(round, 'preparing')}
                                title="준비중으로 변경"
                              >
                                <i className="fas fa-box"></i>
                              </button>
                              <button
                                className="round-action-btn"
                                onClick={() => handleRoundStatusChange(round, 'delivered')}
                                title="배송완료"
                              >
                                <i className="fas fa-truck"></i>
                              </button>
                            </>
                          )}
                          {round.status === 'preparing' && (
                            <button
                              className="round-action-btn"
                              onClick={() => handleRoundStatusChange(round, 'delivered')}
                              title="배송완료"
                            >
                              <i className="fas fa-truck"></i>
                            </button>
                          )}
                          {round.status === 'delivered' && (
                            <button
                              className="round-action-btn"
                              onClick={() => handleRoundStatusChange(round, 'completed')}
                              title="복용완료"
                            >
                              <i className="fas fa-check-circle"></i>
                            </button>
                          )}
                          <button
                            className="round-action-btn edit"
                            onClick={() => setEditingRound({ packageId: pkg.id!, round })}
                            title="수정"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 신규 등록 모달 */}
      {showAddModal && (
        <AddPackageModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadPackages();
          }}
        />
      )}

      {/* 회차 수정 모달 */}
      {editingRound && (
        <EditRoundModal
          round={editingRound.round}
          onClose={() => setEditingRound(null)}
          onSuccess={() => {
            setEditingRound(null);
            loadPackages();
          }}
        />
      )}
    </div>
  );
}

// 신규 패키지 등록 모달
interface AddPackageModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddPackageModal({ onClose, onSuccess }: AddPackageModalProps) {
  const [form, setForm] = useState({
    patient_id: '',
    chart_number: '',
    patient_name: '',
    herbal_name: '',
    package_type: '1month' as HerbalPackage['package_type'],
    total_count: 1,
    start_date: getCurrentDate(),
    memo: '',
    decoction_date: '',
    delivery_method: 'pickup' as DeliveryMethod,
  });
  const [saving, setSaving] = useState(false);

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  // 패키지 타입에 따른 기본 회차 설정
  const packageTypeDefaults: Record<string, number> = {
    '1month': 1,
    '2month': 2,
    '3month': 3,
    '6month': 6,
  };

  function handleTypeChange(type: HerbalPackage['package_type']) {
    setForm({
      ...form,
      package_type: type,
      total_count: packageTypeDefaults[type] || 1,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_name || !form.herbal_name) {
      alert('환자명과 약명은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const packageId = await createHerbalPackage({
        patient_id: parseInt(form.patient_id) || 0,
        chart_number: form.chart_number,
        patient_name: form.patient_name,
        herbal_name: form.herbal_name,
        package_type: form.package_type,
        total_count: form.total_count,
        used_count: 0,
        remaining_count: form.total_count,
        start_date: form.start_date,
        memo: form.memo,
        status: 'active',
        decoction_date: form.decoction_date || undefined,
        delivery_method: form.delivery_method,
      });

      // 회차 자동 생성
      await initializePackageRounds(packageId, form.total_count);

      onSuccess();
    } catch (error) {
      console.error('패키지 등록 실패:', error);
      alert('등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content prepaid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>선결 패키지 등록</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>환자명 *</label>
              <input
                type="text"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                placeholder="환자명 입력"
                required
              />
            </div>
            <div className="form-group">
              <label>차트번호</label>
              <input
                type="text"
                value={form.chart_number}
                onChange={(e) => setForm({ ...form, chart_number: e.target.value })}
                placeholder="차트번호"
              />
            </div>
          </div>

          <div className="form-group">
            <label>약명 *</label>
            <input
              type="text"
              value={form.herbal_name}
              onChange={(e) => setForm({ ...form, herbal_name: e.target.value })}
              placeholder="시함마농, 궁귀교애탕 등"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>선결 기간</label>
              <select
                value={form.package_type}
                onChange={(e) => handleTypeChange(e.target.value as HerbalPackage['package_type'])}
              >
                <option value="1month">1개월</option>
                <option value="2month">2개월</option>
                <option value="3month">3개월</option>
                <option value="6month">6개월</option>
              </select>
            </div>
            <div className="form-group">
              <label>총 회차</label>
              <input
                type="number"
                min="1"
                max="12"
                value={form.total_count}
                onChange={(e) => setForm({ ...form, total_count: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>탕전 예정일</label>
              <input
                type="date"
                value={form.decoction_date}
                onChange={(e) => setForm({ ...form, decoction_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>수령방법</label>
              <select
                value={form.delivery_method}
                onChange={(e) => setForm({ ...form, delivery_method: e.target.value as DeliveryMethod })}
              >
                {Object.entries(DELIVERY_METHOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="메모 입력"
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 회차 수정 모달
interface EditRoundModalProps {
  round: HerbalPackageRound;
  onClose: () => void;
  onSuccess: () => void;
}

function EditRoundModal({ round, onClose, onSuccess }: EditRoundModalProps) {
  const [form, setForm] = useState({
    delivery_method: round.delivery_method,
    scheduled_date: round.scheduled_date || '',
    delivered_date: round.delivered_date || '',
    status: round.status,
    memo: round.memo || '',
  });
  const [saving, setSaving] = useState(false);

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePackageRound(round.id!, {
        delivery_method: form.delivery_method,
        scheduled_date: form.scheduled_date || undefined,
        delivered_date: form.delivered_date || undefined,
        status: form.status,
        memo: form.memo || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('회차 수정 실패:', error);
      alert('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content prepaid-modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{round.round_number}회차 수정</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>배송방법</label>
              <select
                value={form.delivery_method}
                onChange={(e) => setForm({ ...form, delivery_method: e.target.value as DeliveryMethod })}
              >
                <option value="pickup">내원</option>
                <option value="local">시내</option>
                <option value="express">시외</option>
              </select>
            </div>
            <div className="form-group">
              <label>상태</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as RoundStatus })}
              >
                <option value="pending">대기</option>
                <option value="preparing">준비중</option>
                <option value="delivered">배송완료</option>
                <option value="completed">복용완료</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>예정일</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>배송완료일</label>
              <input
                type="date"
                value={form.delivered_date}
                onChange={(e) => setForm({ ...form, delivered_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>메모</label>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="회차별 메모"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PrepaidManagementView;
