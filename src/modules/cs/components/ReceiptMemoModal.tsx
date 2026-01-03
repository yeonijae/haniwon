import React, { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { useDraggableModal } from '../hooks/useDraggableModal';
import type { TreatmentPackage, Membership, PointTransaction } from '../types';
import {
  // 패키지 API
  getActiveTreatmentPackages,
  createTreatmentPackage,
  updateTreatmentPackage,
  deleteTreatmentPackage,
  useTreatmentPackage,
  // 멤버십 API
  getActiveMembership,
  getMemberships,
  createMembership,
  updateMembership,
  deleteMembership,
  // 포인트 API
  getPointBalance,
  getPointTransactions,
  earnPoints,
  usePoints,
} from '../lib/api';
import {
  // 메모 아이템 API (manage 모듈)
  MEMO_TYPES,
  type MemoType,
  type PaymentMemoItem,
  fetchPaymentMemoItems,
  addPaymentMemoItem,
  updatePaymentMemoItem,
  deletePaymentMemoItem,
} from '../../manage/lib/api';

// 탭 타입
type TabType = 'package' | 'membership' | 'detail' | 'point';

interface ReceiptMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  receiptId: number;
  receiptDate: string;
  onDataChange?: () => void;
}

export function ReceiptMemoModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNo,
  receiptId,
  receiptDate,
  onDataChange,
}: ReceiptMemoModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('package');
  const [isLoading, setIsLoading] = useState(true);

  // 드래그 기능
  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });

  // 패키지 상태
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);

  // 멤버십 상태
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);

  // 수납상세 메모 상태
  const [memoItems, setMemoItems] = useState<PaymentMemoItem[]>([]);

  // 포인트 상태
  const [pointBalance, setPointBalance] = useState(0);
  const [pointTransactions, setPointTransactions] = useState<PointTransaction[]>([]);
  const [todayEarned, setTodayEarned] = useState(0);
  const [todayUsed, setTodayUsed] = useState(0);

  // ESC 키로 닫기
  useEscapeKey(onClose, isOpen);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const [
        pkgData,
        membershipData,
        allMemberships,
        memoData,
        balance,
        transactions,
      ] = await Promise.all([
        getActiveTreatmentPackages(patientId),
        getActiveMembership(patientId),
        getMemberships(patientId),
        fetchPaymentMemoItems(receiptId),
        getPointBalance(patientId),
        getPointTransactions(patientId, 20),
      ]);

      setPackages(pkgData);
      setActiveMembership(membershipData);
      setMemberships(allMemberships);
      setMemoItems(memoData);
      setPointBalance(balance);
      setPointTransactions(transactions);

      // 오늘 포인트 계산
      const todayTx = transactions.filter(t => t.transaction_date === receiptDate);
      setTodayEarned(todayTx.filter(t => t.transaction_type === 'earn').reduce((s, t) => s + t.amount, 0));
      setTodayUsed(todayTx.filter(t => t.transaction_type === 'use').reduce((s, t) => s + t.amount, 0));
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, patientId, receiptId, receiptDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isOpen) return null;

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'package', label: '패키지', icon: '📦' },
    { key: 'membership', label: '멤버십', icon: '🎫' },
    { key: 'detail', label: '수납상세', icon: '📋' },
    { key: 'point', label: '포인트', icon: '💰' },
  ];

  return (
    <div className="receipt-memo-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`receipt-memo-modal ${modalClassName}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="receipt-memo-modal-header draggable" onMouseDown={handleMouseDown}>
          <div className="patient-info">
            <span className="patient-name">{patientName}</span>
            <span className="chart-no">({chartNo})</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="receipt-memo-modal-body">
          {/* 세로 탭 */}
          <div className="memo-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`memo-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="memo-tab-content">
            {isLoading ? (
              <div className="loading-state">
                <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
              </div>
            ) : (
              <>
                {activeTab === 'package' && (
                  <PackageTab
                    packages={packages}
                    patientId={patientId}
                    patientName={patientName}
                    chartNo={chartNo}
                    onRefresh={loadData}
                    onDataChange={onDataChange}
                  />
                )}
                {activeTab === 'membership' && (
                  <MembershipTab
                    memberships={memberships}
                    activeMembership={activeMembership}
                    patientId={patientId}
                    patientName={patientName}
                    chartNo={chartNo}
                    onRefresh={loadData}
                    onDataChange={onDataChange}
                  />
                )}
                {activeTab === 'detail' && (
                  <DetailTab
                    memoItems={memoItems}
                    patientId={patientId}
                    chartNo={chartNo}
                    receiptId={receiptId}
                    receiptDate={receiptDate}
                    onRefresh={loadData}
                    onDataChange={onDataChange}
                  />
                )}
                {activeTab === 'point' && (
                  <PointTab
                    balance={pointBalance}
                    transactions={pointTransactions}
                    todayEarned={todayEarned}
                    todayUsed={todayUsed}
                    patientId={patientId}
                    patientName={patientName}
                    chartNo={chartNo}
                    receiptId={receiptId}
                    receiptDate={receiptDate}
                    onRefresh={loadData}
                    onDataChange={onDataChange}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 패키지 탭
// ============================================
interface PackageTabProps {
  packages: TreatmentPackage[];
  patientId: number;
  patientName: string;
  chartNo: string;
  onRefresh: () => void;
  onDataChange?: () => void;
}

function PackageTab({ packages, patientId, patientName, chartNo, onRefresh, onDataChange }: PackageTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<TreatmentPackage | null>(null);
  const [form, setForm] = useState({
    package_name: '',
    total_count: 10,
    includes: '',
    memo: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setForm({ package_name: '', total_count: 10, includes: '', memo: '' });
    setShowAddForm(false);
    setEditingPkg(null);
  };

  const handleSubmit = async () => {
    if (!form.package_name.trim()) {
      alert('패키지명을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPkg) {
        await updateTreatmentPackage(editingPkg.id!, {
          package_name: form.package_name,
          total_count: form.total_count,
          remaining_count: form.total_count - (editingPkg.used_count || 0),
          includes: form.includes || undefined,
          memo: form.memo || undefined,
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        await createTreatmentPackage({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          package_name: form.package_name,
          total_count: form.total_count,
          used_count: 0,
          remaining_count: form.total_count,
          includes: form.includes || undefined,
          start_date: today,
          memo: form.memo || undefined,
          status: 'active',
        });
      }
      resetForm();
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('패키지 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUse = async (pkg: TreatmentPackage) => {
    if (pkg.remaining_count <= 0) {
      alert('잔여 횟수가 없습니다.');
      return;
    }
    try {
      await useTreatmentPackage(pkg.id!);
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('패키지 사용 실패:', err);
    }
  };

  const handleDelete = async (pkg: TreatmentPackage) => {
    if (!confirm(`"${pkg.package_name}" 패키지를 삭제하시겠습니까?`)) return;
    try {
      await deleteTreatmentPackage(pkg.id!);
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('패키지 삭제 실패:', err);
    }
  };

  const startEdit = (pkg: TreatmentPackage) => {
    setEditingPkg(pkg);
    setForm({
      package_name: pkg.package_name,
      total_count: pkg.total_count,
      includes: pkg.includes || '',
      memo: pkg.memo || '',
    });
    setShowAddForm(true);
  };

  return (
    <div className="package-tab">
      {/* 패키지 카드 목록 */}
      <div className="package-cards">
        {packages.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-box-open"></i>
            <p>등록된 패키지가 없습니다</p>
          </div>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className={`package-card ${pkg.status}`}>
              <div className="card-header">
                <span className="package-name">{pkg.package_name}</span>
                <div className="card-actions">
                  <button className="edit-btn" onClick={() => startEdit(pkg)} title="수정">
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="delete-btn" onClick={() => handleDelete(pkg)} title="삭제">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="progress-info">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(pkg.used_count / pkg.total_count) * 100}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {pkg.remaining_count}/{pkg.total_count} 남음
                  </span>
                </div>
                {pkg.includes && <div className="includes">포함: {pkg.includes}</div>}
                {pkg.memo && <div className="memo">{pkg.memo}</div>}
              </div>
              <div className="card-footer">
                <span className="start-date">시작: {pkg.start_date}</span>
                <button
                  className="use-btn"
                  onClick={() => handleUse(pkg)}
                  disabled={pkg.remaining_count <= 0}
                >
                  <i className="fa-solid fa-minus"></i> 1회 사용
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 추가/수정 폼 */}
      {showAddForm ? (
        <div className="add-form">
          <div className="form-title">{editingPkg ? '패키지 수정' : '새 패키지 추가'}</div>
          <div className="form-row">
            <div className="form-group">
              <label>패키지명 *</label>
              <input
                type="text"
                value={form.package_name}
                onChange={(e) => setForm({ ...form, package_name: e.target.value })}
                placeholder="예: 다이어트 10회"
              />
            </div>
            <div className="form-group">
              <label>총 횟수</label>
              <input
                type="number"
                min="1"
                value={form.total_count}
                onChange={(e) => setForm({ ...form, total_count: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>포함 항목</label>
            <input
              type="text"
              value={form.includes}
              onChange={(e) => setForm({ ...form, includes: e.target.value })}
              placeholder="예: 침+추나+약침"
            />
          </div>
          <div className="form-group">
            <label>메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="패키지 관련 메모"
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button className="cancel-btn" onClick={resetForm}>취소</button>
            <button className="submit-btn" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '저장 중...' : editingPkg ? '수정' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button className="add-btn" onClick={() => setShowAddForm(true)}>
          <i className="fa-solid fa-plus"></i> 패키지 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// 멤버십 탭
// ============================================
interface MembershipTabProps {
  memberships: Membership[];
  activeMembership: Membership | null;
  patientId: number;
  patientName: string;
  chartNo: string;
  onRefresh: () => void;
  onDataChange?: () => void;
}

function MembershipTab({ memberships, activeMembership, patientId, patientName, chartNo, onRefresh, onDataChange }: MembershipTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [form, setForm] = useState({
    membership_type: '',
    remaining_count: 30,
    expire_date: '',
    memo: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    // 기본 만료일: 오늘 + 1개월
    const defaultExpire = new Date();
    defaultExpire.setMonth(defaultExpire.getMonth() + 1);
    setForm({
      membership_type: '',
      remaining_count: 30,
      expire_date: defaultExpire.toISOString().split('T')[0],
      memo: '',
    });
    setShowAddForm(false);
    setEditingMembership(null);
  };

  const handleSubmit = async () => {
    if (!form.membership_type.trim()) {
      alert('멤버십 종류를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (editingMembership) {
        await updateMembership(editingMembership.id!, {
          membership_type: form.membership_type,
          remaining_count: form.remaining_count,
          expire_date: form.expire_date,
          memo: form.memo || undefined,
        });
      } else {
        await createMembership({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          membership_type: form.membership_type,
          remaining_count: form.remaining_count,
          start_date: today,
          expire_date: form.expire_date,
          memo: form.memo || undefined,
          status: 'active',
        });
      }
      resetForm();
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('멤버십 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (m: Membership) => {
    if (!confirm(`"${m.membership_type}" 멤버십을 삭제하시겠습니까?`)) return;
    try {
      await deleteMembership(m.id!);
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('멤버십 삭제 실패:', err);
    }
  };

  const startEdit = (m: Membership) => {
    setEditingMembership(m);
    setForm({
      membership_type: m.membership_type,
      remaining_count: m.remaining_count,
      expire_date: m.expire_date,
      memo: m.memo || '',
    });
    setShowAddForm(true);
  };

  const getDaysLeft = (expireDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expire = new Date(expireDate);
    return Math.ceil((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 활성 멤버십만 표시
  const activeMemberships = memberships.filter(m => m.status === 'active');

  return (
    <div className="membership-tab">
      {/* 멤버십 카드 목록 */}
      <div className="membership-cards">
        {activeMemberships.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-id-card"></i>
            <p>활성 멤버십이 없습니다</p>
          </div>
        ) : (
          activeMemberships.map((m) => {
            const daysLeft = getDaysLeft(m.expire_date);
            const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
            const isExpired = daysLeft <= 0;

            return (
              <div key={m.id} className={`membership-card ${isExpired ? 'expired' : isExpiringSoon ? 'expiring' : ''}`}>
                <div className="card-header">
                  <span className="membership-type">{m.membership_type}</span>
                  <div className="card-actions">
                    <button className="edit-btn" onClick={() => startEdit(m)} title="수정">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(m)} title="삭제">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="expire-info">
                    <i className="fa-solid fa-calendar"></i>
                    <span>만료: {m.expire_date}</span>
                    <span className={`days-left ${isExpired ? 'expired' : isExpiringSoon ? 'warning' : ''}`}>
                      {isExpired ? '만료됨' : `(${daysLeft}일 남음)`}
                    </span>
                  </div>
                  <div className="remaining-info">
                    <i className="fa-solid fa-ticket"></i>
                    <span>잔여: {m.remaining_count}회</span>
                  </div>
                  {m.memo && <div className="memo">{m.memo}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 추가/수정 폼 */}
      {showAddForm ? (
        <div className="add-form">
          <div className="form-title">{editingMembership ? '멤버십 수정' : '새 멤버십 추가'}</div>
          <div className="form-row">
            <div className="form-group">
              <label>멤버십 종류 *</label>
              <input
                type="text"
                value={form.membership_type}
                onChange={(e) => setForm({ ...form, membership_type: e.target.value })}
                placeholder="예: VIP 1개월"
              />
            </div>
            <div className="form-group">
              <label>만료일</label>
              <input
                type="date"
                value={form.expire_date}
                onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>잔여 횟수</label>
              <input
                type="number"
                min="0"
                value={form.remaining_count}
                onChange={(e) => setForm({ ...form, remaining_count: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>오늘의 메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="멤버십 관련 메모"
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button className="cancel-btn" onClick={resetForm}>취소</button>
            <button className="submit-btn" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '저장 중...' : editingMembership ? '수정' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button className="add-btn" onClick={() => { resetForm(); setShowAddForm(true); }}>
          <i className="fa-solid fa-plus"></i> 멤버십 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// 수납상세 탭 (이벤트/할인/환불 메모)
// ============================================
interface DetailTabProps {
  memoItems: PaymentMemoItem[];
  patientId: number;
  chartNo: string;
  receiptId: number;
  receiptDate: string;
  onRefresh: () => void;
  onDataChange?: () => void;
}

function DetailTab({ memoItems, patientId, chartNo, receiptId, receiptDate, onRefresh, onDataChange }: DetailTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentMemoItem | null>(null);
  const [form, setForm] = useState<{ memo_type: MemoType; memo_content: string }>({
    memo_type: 'event',
    memo_content: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // 수납상세에서 사용할 메모 타입 (패키지, 멤버십, 포인트 제외)
  const detailMemoTypes = ['event', 'refund', 'other'] as const;

  const resetForm = () => {
    setForm({ memo_type: 'event', memo_content: '' });
    setShowAddForm(false);
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    if (!form.memo_content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updatePaymentMemoItem(editingItem.id, {
          memo_type: form.memo_type,
          memo_content: form.memo_content,
        });
      } else {
        await addPaymentMemoItem({
          patient_id: patientId,
          chart_number: chartNo,
          receipt_date: receiptDate,
          mssql_receipt_id: receiptId,
          memo_type: form.memo_type,
          memo_content: form.memo_content,
        });
      }
      resetForm();
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('메모 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: PaymentMemoItem) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    try {
      await deletePaymentMemoItem(item.id);
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('메모 삭제 실패:', err);
    }
  };

  const startEdit = (item: PaymentMemoItem) => {
    setEditingItem(item);
    setForm({
      memo_type: item.memo_type,
      memo_content: item.memo_content,
    });
    setShowAddForm(true);
  };

  // 수납상세 관련 메모만 필터링
  const filteredMemos = memoItems.filter(m => detailMemoTypes.includes(m.memo_type as any));

  return (
    <div className="detail-tab">
      {/* 메모 목록 */}
      <div className="memo-list">
        {filteredMemos.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-clipboard"></i>
            <p>등록된 수납상세 메모가 없습니다</p>
          </div>
        ) : (
          filteredMemos.map((item) => {
            const typeInfo = MEMO_TYPES[item.memo_type] || MEMO_TYPES.other;
            return (
              <div key={item.id} className={`memo-item ${item.memo_type}`}>
                <div className="memo-header">
                  <span className="memo-type-badge">
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                  <div className="memo-actions">
                    <button className="edit-btn" onClick={() => startEdit(item)} title="수정">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(item)} title="삭제">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div className="memo-content">{item.memo_content}</div>
                {item.created_at && (
                  <div className="memo-date">{item.created_at.substring(0, 16).replace('T', ' ')}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 추가/수정 폼 */}
      {showAddForm ? (
        <div className="add-form">
          <div className="form-title">{editingItem ? '메모 수정' : '새 메모 추가'}</div>
          <div className="form-group">
            <label>종류</label>
            <div className="type-buttons">
              {detailMemoTypes.map((type) => {
                const info = MEMO_TYPES[type];
                return (
                  <button
                    key={type}
                    className={`type-btn ${form.memo_type === type ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, memo_type: type })}
                  >
                    {info.icon} {info.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label>내용 *</label>
            <textarea
              value={form.memo_content}
              onChange={(e) => setForm({ ...form, memo_content: e.target.value })}
              placeholder="메모 내용을 입력하세요"
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button className="cancel-btn" onClick={resetForm}>취소</button>
            <button className="submit-btn" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '저장 중...' : editingItem ? '수정' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button className="add-btn" onClick={() => setShowAddForm(true)}>
          <i className="fa-solid fa-plus"></i> 메모 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// 포인트 탭
// ============================================
interface PointTabProps {
  balance: number;
  transactions: PointTransaction[];
  todayEarned: number;
  todayUsed: number;
  patientId: number;
  patientName: string;
  chartNo: string;
  receiptId: number;
  receiptDate: string;
  onRefresh: () => void;
  onDataChange?: () => void;
}

function PointTab({
  balance,
  transactions,
  todayEarned,
  todayUsed,
  patientId,
  patientName,
  chartNo,
  receiptId,
  receiptDate,
  onRefresh,
  onDataChange,
}: PointTabProps) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEarn = async () => {
    if (amount <= 0) {
      alert('적립할 금액을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await earnPoints({
        patient_id: patientId,
        chart_number: chartNo,
        patient_name: patientName,
        amount,
        description: description || `${receiptDate} 수납 적립`,
        receipt_id: receiptId,
      });
      setAmount(0);
      setDescription('');
      onRefresh();
      onDataChange?.();
    } catch (err) {
      console.error('포인트 적립 실패:', err);
      alert('적립에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUse = async () => {
    if (amount <= 0) {
      alert('사용할 금액을 입력해주세요.');
      return;
    }
    if (amount > balance) {
      alert(`포인트가 부족합니다. (잔액: ${balance.toLocaleString()}P)`);
      return;
    }

    setIsSaving(true);
    try {
      await usePoints({
        patient_id: patientId,
        chart_number: chartNo,
        patient_name: patientName,
        amount,
        description: description || `${receiptDate} 수납 사용`,
        receipt_id: receiptId,
      });
      setAmount(0);
      setDescription('');
      onRefresh();
      onDataChange?.();
    } catch (err: any) {
      console.error('포인트 사용 실패:', err);
      alert(err.message || '사용에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="point-tab">
      {/* 포인트 요약 */}
      <div className="point-summary">
        <div className="balance-card">
          <div className="label">현재 잔액</div>
          <div className="value">{balance.toLocaleString()}P</div>
        </div>
        <div className="today-stats">
          <div className="stat earned">
            <span className="label">오늘 적립</span>
            <span className="value">+{todayEarned.toLocaleString()}P</span>
          </div>
          <div className="stat used">
            <span className="label">오늘 사용</span>
            <span className="value">-{todayUsed.toLocaleString()}P</span>
          </div>
        </div>
      </div>

      {/* 포인트 입력 */}
      <div className="point-input-section">
        <div className="input-row">
          <input
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            placeholder="금액"
            min="0"
            step="1000"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
          />
        </div>
        <div className="button-row">
          <button className="use-btn" onClick={handleUse} disabled={isSaving || amount <= 0}>
            <i className="fa-solid fa-minus"></i> 사용
          </button>
          <button className="earn-btn" onClick={handleEarn} disabled={isSaving || amount <= 0}>
            <i className="fa-solid fa-plus"></i> 적립
          </button>
        </div>
      </div>

      {/* 거래 내역 */}
      <div className="transaction-history">
        <div className="history-title">최근 거래 내역</div>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>거래 내역이 없습니다</p>
          </div>
        ) : (
          <div className="transaction-list">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className={`transaction-item ${tx.transaction_type}`}>
                <div className="tx-info">
                  <span className="tx-date">{tx.transaction_date}</span>
                  <span className="tx-desc">{tx.description || '-'}</span>
                </div>
                <div className="tx-amount">
                  <span className={tx.transaction_type === 'earn' ? 'earned' : 'used'}>
                    {tx.transaction_type === 'earn' ? '+' : '-'}{tx.amount.toLocaleString()}P
                  </span>
                  <span className="tx-balance">잔액: {tx.balance_after.toLocaleString()}P</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiptMemoModal;
