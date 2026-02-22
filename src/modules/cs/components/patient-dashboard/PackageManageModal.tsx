/**
 * PackageManageModal — 패키지 잔여횟수 관리 모달
 * ReceiptView의 인라인 pkgManageModal을 별도 컴포넌트로 추출
 */
import { useState, useEffect } from 'react';
import {
  getActiveHerbalPackages,
  getActiveTreatmentPackages,
  deleteHerbalPackage,
  deleteNokryongPackage,
  deleteTreatmentPackage,
  deleteMembership,
  updateHerbalPackage,
  updateTreatmentPackage,
  updateMembership,
  getActiveMembership,
  getPackageHistory,
  getHerbalPackageHistory,
  getNokryongPackageHistory,
  getMembershipHistory,
  addPackageAuditLog,
  getPackageAuditLogs,
} from '../../lib/api';
import type { PackageHistoryItem } from '../../lib/api';
// getActiveMembership is in api.ts
import { query, execute, escapeString } from '@shared/lib/postgres';

type PkgType = 'herbal' | 'nokryong' | 'treatment' | 'membership';

interface ManagedPackage {
  id: number;
  name: string;
  total: number;
  remaining: number;
  newRemaining: number;
  deleted?: boolean;
  completed?: boolean;
  status?: string;
  startDate?: string;
  expireDate?: string;
  newStartDate?: string;
  newExpireDate?: string;
  createdAt?: string;
}

interface Props {
  type: PkgType;
  patientId: number;
  chartNumber: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const TITLES: Record<PkgType, string> = {
  herbal: '한약 패키지 관리',
  nokryong: '녹용 패키지 관리',
  treatment: '통마 패키지 관리',
  membership: '멤버십 관리',
};

export default function PackageManageModal({ type, patientId, chartNumber, onClose, onSuccess }: Props) {
  const [packages, setPackages] = useState<ManagedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PackageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadPackages();
  }, [type, patientId]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      switch (type) {
        case 'herbal': {
          const pkgs = await query<any>(`SELECT * FROM cs_herbal_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`);
          setPackages(pkgs.map((p: any) => ({
            id: p.id, name: p.herbal_name || '한약',
            total: p.total_count || 0,
            remaining: (p.total_count || 0) - (p.used_count || 0),
            newRemaining: (p.total_count || 0) - (p.used_count || 0),
            completed: p.status !== 'active',
            status: p.status,
            createdAt: p.created_at,
          })));
          break;
        }
        case 'nokryong': {
          const pkgs = await query<any>(`SELECT * FROM cs_nokryong_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`);
          setPackages(pkgs.map((p: any) => ({
            id: p.id, name: p.package_name || '녹용',
            total: p.total_months || 0,
            remaining: p.remaining_months || 0,
            newRemaining: p.remaining_months || 0,
            completed: p.status !== 'active',
            status: p.status,
            createdAt: p.created_at,
          })));
          break;
        }
        case 'treatment': {
          const pkgs = await query<any>(`SELECT * FROM cs_treatment_packages WHERE patient_id = ${patientId} ORDER BY created_at DESC`);
          setPackages(pkgs.map((p: any) => ({
            id: p.id, name: p.package_name || '통마',
            total: p.total_count || 0,
            remaining: p.remaining_count || 0,
            newRemaining: p.remaining_count || 0,
            completed: p.status !== 'active',
            status: p.status,
            createdAt: p.created_at,
          })));
          break;
        }
        case 'membership': {
          const pkgs = await query<any>(`SELECT * FROM cs_memberships WHERE patient_id = ${patientId} ORDER BY created_at DESC`);
          setPackages(pkgs.map((p: any) => ({
            id: p.id, name: p.membership_type || '멤버십',
            total: p.quantity || 0, remaining: 0, newRemaining: 0,
            completed: p.status !== 'active',
            status: p.status,
            startDate: p.start_date, expireDate: p.expire_date,
            newStartDate: p.start_date, newExpireDate: p.expire_date,
            createdAt: p.created_at,
          })));
          break;
        }
      }
    } catch (err) {
      console.error('패키지 로드 실패:', err);
    }
    setLoading(false);
  };

  // 히스토리 로드
  useEffect(() => {
    if (packages.length === 0) return;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        let allHistories: PackageHistoryItem[][] = [];
        const historyFn = type === 'treatment' ? getPackageHistory
          : type === 'herbal' ? getHerbalPackageHistory
          : type === 'nokryong' ? getNokryongPackageHistory
          : getMembershipHistory;
        const [histories, audits] = await Promise.all([
          Promise.all(packages.map(p => historyFn(p.id))),
          Promise.all(packages.map(p => getPackageAuditLogs(type, p.id))),
        ]);
        const all = [...histories.flat(), ...audits.flat()];
        setHistory(all.sort((a, b) => b.date.localeCompare(a.date)));
      } catch (err) {
        console.error('히스토리 로드 실패:', err);
      }
      setHistoryLoading(false);
    };
    loadHistory();
  }, [packages.length, type]);

  const handleSave = async () => {
    try {
      for (const pkg of packages) {
        if (pkg.deleted) {
          await addPackageAuditLog(type, pkg.id, 'delete', `${pkg.name} 삭제됨`);
          if (type === 'herbal') await deleteHerbalPackage(pkg.id);
          else if (type === 'nokryong') await deleteNokryongPackage(pkg.id);
          else if (type === 'treatment') await deleteTreatmentPackage(pkg.id);
          else if (type === 'membership') await deleteMembership(pkg.id);
          continue;
        }
        if (type === 'membership') {
          if (pkg.newStartDate !== pkg.startDate || pkg.newExpireDate !== pkg.expireDate) {
            await updateMembership(pkg.id, {
              start_date: pkg.newStartDate,
              expire_date: pkg.newExpireDate,
            });
            await addPackageAuditLog(type, pkg.id, 'edit', `기간 ${pkg.startDate}~${pkg.expireDate} → ${pkg.newStartDate}~${pkg.newExpireDate}로 수정됨`);
          }
        } else if (pkg.newRemaining !== pkg.remaining) {
          if (type === 'herbal') {
            await updateHerbalPackage(pkg.id, { used_count: pkg.total - pkg.newRemaining, remaining_count: pkg.newRemaining });
          } else if (type === 'nokryong') {
            await execute(`UPDATE cs_nokryong_packages SET remaining_months = ${pkg.newRemaining} WHERE id = ${pkg.id}`);
          } else if (type === 'treatment') {
            await updateTreatmentPackage(pkg.id, { remaining_count: pkg.newRemaining, used_count: pkg.total - pkg.newRemaining });
          }
          await addPackageAuditLog(type, pkg.id, 'edit', `${pkg.remaining}${unit} → ${pkg.newRemaining}${unit}로 수정됨`);
        }
      }
      await onSuccess();
      onClose();
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장에 실패했습니다.');
    }
  };

  const hasChanges = packages.some(p =>
    p.deleted || p.newRemaining !== p.remaining ||
    p.newStartDate !== p.startDate || p.newExpireDate !== p.expireDate
  );

  const unit = type === 'membership' ? '일' : '회';

  return (
    <div className="pkg-manage-modal-overlay" onClick={onClose}>
      <div className="pkg-manage-modal" onClick={e => e.stopPropagation()}>
        <div className={`pkg-manage-header ${type}`}>
          <h4>{TITLES[type]}</h4>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="pkg-manage-body">
          {loading ? (
            <div className="pkg-manage-empty">로딩 중...</div>
          ) : packages.length === 0 ? (
            <div className="pkg-manage-empty">등록된 패키지가 없습니다.</div>
          ) : (
            packages.map((pkg, idx) => (
              <div key={pkg.id} className={`pkg-manage-item ${pkg.deleted ? 'deleted' : ''} ${pkg.completed ? 'completed' : ''}`}>
                {/* 한줄: 이름 | -[N]+/총 | 삭제 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pkg-manage-item-name">{pkg.name.replace(/(\d+(?:\.\d+)?)M\s*(\d+)회/, '$1개월($2회)')}</span>
                  {pkg.completed && <span style={{ fontSize: 11, color: '#9ca3af' }}>사용완료</span>}
                  {!pkg.deleted && !pkg.completed && type !== 'membership' && (
                    <div className="pkg-manage-item-controls" style={{ margin: 0, marginLeft: 16 }}>
                      <span className="pkg-manage-item-label">잔여</span>
                      <button className="btn-adjust" onClick={() => {
                        const np = [...packages];
                        np[idx] = { ...pkg, newRemaining: Math.max(0, pkg.newRemaining - 1) };
                        setPackages(np);
                      }}>-</button>
                      <input type="number" value={pkg.newRemaining} min={0}
                        onChange={e => {
                          const np = [...packages];
                          np[idx] = { ...pkg, newRemaining: Math.max(0, parseInt(e.target.value) || 0) };
                          setPackages(np);
                        }}
                      />
                      <button className="btn-adjust" onClick={() => {
                        const np = [...packages];
                        np[idx] = { ...pkg, newRemaining: pkg.newRemaining + 1 };
                        setPackages(np);
                      }}>+</button>
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  {!pkg.completed && (
                    <button
                      className={`btn-delete pkg-hover-delete ${pkg.deleted ? 'restore' : ''}`}
                      onClick={() => {
                        const np = [...packages];
                        np[idx] = { ...pkg, deleted: !pkg.deleted };
                        setPackages(np);
                      }}
                      title={pkg.deleted ? '삭제 취소' : '삭제'}
                    >
                      <i className={`fa-solid ${pkg.deleted ? 'fa-rotate-left' : 'fa-trash'}`}></i>
                    </button>
                  )}
                </div>
                {!pkg.deleted && !pkg.completed && type !== 'membership' && pkg.newRemaining !== pkg.remaining && (
                  <div className="pkg-manage-item-change">
                    {pkg.remaining}{unit} → {pkg.newRemaining}{unit}
                    <span className={pkg.newRemaining > pkg.remaining ? 'increase' : 'decrease'}>
                      ({pkg.newRemaining > pkg.remaining ? '+' : ''}{pkg.newRemaining - pkg.remaining})
                    </span>
                  </div>
                )}
                {!pkg.deleted && !pkg.completed && type === 'membership' && (
                  <>
                    <div className="pkg-manage-date-row">
                      <label>시작일</label>
                      <input type="date" value={pkg.newStartDate || ''}
                        onChange={e => {
                          const np = [...packages];
                          np[idx] = { ...pkg, newStartDate: e.target.value };
                          setPackages(np);
                        }}
                      />
                    </div>
                    <div className="pkg-manage-date-row">
                      <label>종료일</label>
                      <input type="date" value={pkg.newExpireDate || ''}
                        onChange={e => {
                          const np = [...packages];
                          np[idx] = { ...pkg, newExpireDate: e.target.value };
                          setPackages(np);
                        }}
                      />
                    </div>
                  </>
                )}
                {pkg.deleted && (
                  <div className="pkg-manage-item-deleted-msg">
                    {type === 'membership' ? '이 멤버십이 삭제됩니다' : '이 패키지가 삭제됩니다'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {/* 히스토리 */}
        <div className="pkg-manage-history-section">
          <div className="pkg-history-section-header">
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>등록 및 사용 히스토리</span>
          </div>
          {historyLoading ? (
            <div className="pkg-history-loading">로딩 중...</div>
          ) : history.length === 0 ? (
            <div className="pkg-history-empty">사용 기록이 없습니다.</div>
          ) : (
            <div className="pkg-history-list">
              {history.map(item => (
                <div key={item.id} className={`pkg-history-item ${item.type}`}>
                  <span className="pkg-history-date">{item.date?.length === 10 && item.date.includes('-') ? item.date.slice(2).replace(/-/g, '/') : item.date}</span>
                  <span className={`pkg-history-badge ${item.type}`}>
                    {item.type === 'add' ? '등록' : item.type === 'edit' ? '수정' : '사용'}
                  </span>
                  <span className="pkg-history-label">{item.label}</span>
                  {item.type === 'usage' && item.deductionPoints !== undefined && (
                    <span className="pkg-history-deduction">-{item.deductionPoints}p</span>
                  )}
                  {item.type === 'usage' && item.remainingAfter !== undefined && (
                    <span className="pkg-history-remaining">잔여 {item.remainingAfter}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pkg-manage-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button className="btn-save" disabled={!hasChanges} onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
