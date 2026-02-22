/**
 * 통합 환자 대시보드 (모달)
 * 헤더 퀵검색, 수납 CRM 버튼 등 어디서든 호출 가능
 * 수납, 예약, 인콜, 아웃콜, 패키지를 한 화면에서 조회
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type { LocalPatient } from '../lib/patientSync';
import type { StaffRole } from '../types/crm';
import type { HerbalDraft, MedicineUsage } from '../types';
import type { ContactLog } from '../types/crm';
import { usePatientDashboard } from '../hooks/usePatientDashboard';
import { deleteHerbalDraft, deleteMedicineUsage, getConsultationMemos, addConsultationMemo, deleteConsultationMemo, getHerbalConsultations, deletePackageByKind } from '../lib/api';
import type { ConsultationMemo, HerbalConsultation } from '../lib/api';

// 연속 줄바꿈을 1회로 축약
import EmrMemoPanel from './patient-dashboard/EmrMemoPanel';
const trimMemo = (text: string): string => text.replace(/(\r?\n){2,}/g, '\n');
import PatientNoteInput from './PatientNoteInput';
import InlineReceiptHistory from './InlineReceiptHistory';
import PatientReservationSection from './patient-dashboard/PatientReservationSection';
import PatientInquirySection from './patient-dashboard/PatientInquirySection';
import PatientCallQueueSection from './patient-dashboard/PatientCallQueueSection';
import PatientPackageSection from './patient-dashboard/PatientPackageSection';
import PatientPackageTab from './patient-dashboard/PatientPackageTab';
import HerbalDraftModal from './HerbalDraftModal';
import HerbalConsultationModal from './patient-dashboard/HerbalConsultationModal';
import MedicineQuickModal from './patient-dashboard/MedicineQuickModal';
import ContactLogQuickModal from './patient-dashboard/ContactLogQuickModal';
import PackageQuickAddModal from './PackageQuickAddModal';
import PackageManageModal from './patient-dashboard/PackageManageModal';
import PatientEditModal from './patient-dashboard/PatientEditModal';
import { getPatientVipYears } from '../lib/vipApi';
import { ReservationStep1Modal, type ReservationDraft, type InitialPatient } from '../../reservation/components/ReservationStep1Modal';
import { QuickReservationModal } from './QuickReservationModal';
import { fetchDoctors } from '../../reservation/lib/api';
import type { Doctor } from '../../reservation/types';

interface PatientDashboardProps {
  isOpen: boolean;
  patient: LocalPatient;
  user: PortalUser;
  onClose: () => void;
  selectedDate?: string;
  selectedDoctor?: string;
}

// 사용자 역할을 스태프 역할로 변환
const getStaffRole = (userRole: string): StaffRole => {
  if (userRole === 'medical_staff') return 'doctor';
  if (userRole === 'treatment') return 'treatment';
  return 'desk';
};

const PatientDashboard: React.FC<PatientDashboardProps> = ({
  isOpen,
  patient,
  user,
  onClose,
  selectedDate: propSelectedDate,
  selectedDoctor: propSelectedDoctor,
}) => {
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'herbal' | 'nokryong' | 'treatment' | 'membership' | null>(null);
  const [quickAddEditData, setQuickAddEditData] = useState<any>(null);
  const [pkgManageType, setPkgManageType] = useState<'herbal' | 'nokryong' | 'treatment' | 'membership' | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftMode, setDraftMode] = useState<'tangya' | 'jaboyak'>('tangya');
  const [showContactLogModal, setShowContactLogModal] = useState(false);
  const [editingContactLog, setEditingContactLog] = useState<ContactLog | null>(null);
  const [editingMedicine, setEditingMedicine] = useState<MedicineUsage | null>(null);
  const [editingDraft, setEditingDraft] = useState<HerbalDraft | null>(null);
  const [showStep1Modal, setShowStep1Modal] = useState(false);
  const [showStep2Modal, setShowStep2Modal] = useState(false);
  const [reservationDraft, setReservationDraft] = useState<ReservationDraft | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [consultMemos, setConsultMemos] = useState<ConsultationMemo[]>([]);
  const [newMemoText, setNewMemoText] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);
  const [showMemoInput, setShowMemoInput] = useState(false);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'packages' | 'contacts' | 'consults' | null>(null);
  const [contactDirFilter, setContactDirFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [showPatientEdit, setShowPatientEdit] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [vipYears, setVipYears] = useState<{ year: number; grade: string }[]>([]);
  const [herbalConsultations, setHerbalConsultations] = useState<HerbalConsultation[]>([]);
  const [showReferralList, setShowReferralList] = useState(false);
  const [referralList, setReferralList] = useState<{ name: string; chart_no: string; total_revenue: number; reg_date: string | null }[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const {
    mssqlData,
    receipts,
    receiptSummary,
    reservations,
    contactLogs,
    callQueue,
    packages,
    herbalDrafts,
    medicineUsages,
    isLoading,
    error,
    refresh,
  } = usePatientDashboard(patient);

  const decoctionOrders: any[] = []; // TODO: hook에서 가져오기
  const staffRole = getStaffRole(user.role);

  // 약상담 로드
  const loadConsultMemos = useCallback(async () => {
    try {
      const [memos, consults] = await Promise.all([
        getConsultationMemos(patient.id),
        getHerbalConsultations(patient.mssql_id || patient.id),
      ]);
      setConsultMemos(memos);
      setHerbalConsultations(consults);
    } catch { /* ignore */ }
  }, [patient.id, patient.mssql_id]);

  useEffect(() => {
    if (!isOpen) return;
    loadConsultMemos();
  }, [isOpen, loadConsultMemos]);

  useEffect(() => {
    if (!isOpen || !patient.id) return;
    getPatientVipYears(patient.id).then(setVipYears).catch(() => {});
  }, [isOpen, patient.id]);

  // 소개자 목록 로드
  const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
  const loadReferralList = useCallback(async () => {
    if (!patient.chart_number) return;
    setReferralLoading(true);
    try {
      const chartNo = patient.chart_number;
      // suggcustnamesn 필드에 소개자 이름[SN] 형식으로 저장됨
      const sql = `
        SELECT c.sn AS chart_no, c.Name AS name, c.reg_date AS reg_date,
          ISNULL((SELECT SUM(CAST(r.Bonin_Money AS bigint) + CAST(r.General_Money AS bigint)) FROM Receipt r WHERE r.Customer_PK = c.Customer_PK), 0) AS total_revenue
        FROM Customer c
        WHERE c.suggcustnamesn LIKE '%${chartNo}%'
        ORDER BY c.reg_date DESC
      `;
      const res = await fetch(`${MSSQL_API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) throw new Error('MSSQL query failed');
      const data = await res.json();
      const columns: string[] = data.columns || [];
      const rows: any[] = data.rows || data.data || [];
      const parsed = rows.map((row: any) => {
        if (Array.isArray(row)) {
          const obj: any = {};
          columns.forEach((col, i) => obj[col] = row[i]);
          return obj;
        }
        return row;
      });
      setReferralList(parsed);
    } catch (err) {
      console.error('소개자 목록 로드 실패:', err);
      setReferralList([]);
    } finally {
      setReferralLoading(false);
    }
  }, [patient.chart_number]);

  const handleAddConsultMemo = async () => {
    if (!newMemoText.trim()) return;
    setMemoSaving(true);
    try {
      await addConsultationMemo(patient.id, newMemoText.trim(), user.name);
      setNewMemoText('');
      setShowMemoInput(false);
      await loadConsultMemos();
    } catch (err) {
      console.error('약상담 저장 실패:', err);
      alert('약상담 저장 실패');
    } finally {
      setMemoSaving(false);
    }
  };

  const handleDeleteConsultMemo = async (id: number) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    try {
      await deleteConsultationMemo(id);
      await loadConsultMemos();
    } catch (err) {
      console.error('약상담 삭제 실패:', err);
      alert('삭제 실패');
    }
  };

  // 의사 목록 로드 (예약 Step1용 - 현재 근무 중인 원장만)
  useEffect(() => {
    if (!isOpen) return;
    fetchDoctors().then(allDocs => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const active = allDocs.filter(doc => {
        if (doc.isOther || doc.name === 'DOCTOR') return false;
        if (doc.resigned) return false;
        if (doc.workStartDate && new Date(doc.workStartDate) > today) return false;
        if (doc.workEndDate && new Date(doc.workEndDate) < today) return false;
        return true;
      });
      setDoctors(active);
    }).catch(console.error);
  }, [isOpen]);

  const handleEditDraft = (draft: HerbalDraft) => {
    setEditingDraft(draft);
    setShowDraftModal(true);
  };

  const handleDeleteDraft = async (draft: HerbalDraft) => {
    if (!confirm(`한약 기록을 삭제하시겠습니까?\n(${draft.consultation_type} - ${draft.patient_name})`)) return;
    try {
      await deleteHerbalDraft(draft.id!);
      refresh();
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteMedicine = async (usage: MedicineUsage) => {
    if (!confirm(`상비약 기록을 삭제하시겠습니까?\n(${usage.medicine_name} ×${usage.quantity})\n재고가 반환됩니다.`)) return;
    try {
      await deleteMedicineUsage(usage.id!);
      refresh();
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Step1 완료 → Step2 (캘린더 시간 선택)
  const handleReservationNext = (draft: ReservationDraft) => {
    setShowStep1Modal(false);
    setReservationDraft(draft);
    setShowStep2Modal(true);
  };

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 나이 계산
  const age = (() => {
    if (!patient.birth_date) return null;
    const birth = new Date(patient.birth_date);
    const today = new Date();
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return a;
  })();

  if (!isOpen) return null;

  return (
    <div className="patient-dashboard-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
    <div className="patient-dashboard">
      {/* 한 줄 컴팩트 헤더 */}
      <div className="dashboard-header-bar">
        <div className="dashboard-header-inline">
          <span className="dh-name" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}>
            {patient.name}
            {vipYears.length > 0 && (
              <span className="dh-vip-badges" style={{ marginLeft: 6 }}>
                {vipYears.map(v => (
                  <span key={v.year} className={`vip-year-chip ${v.year === new Date().getFullYear() ? 'current' : ''}`} title={`${v.year}년 ${v.grade}`}>
                    {v.grade === 'VVIP' ? '👑' : '⭐'}'{String(v.year).slice(2)}
                  </span>
                ))}
              </span>
            )}
          </span>
          <span className="dh-sep">|</span>
          <span className="dh-chart">{patient.chart_number}</span>
          {patient.gender && (
            <>
              <span className="dh-sep">|</span>
              <span className="dh-gender">{patient.gender}</span>
            </>
          )}
          {age !== null && (
            <>
              <span className="dh-sep">|</span>
              <span className="dh-age">{age}세</span>
            </>
          )}
          {patient.phone && (
            <>
              <span className="dh-sep">|</span>
              <a href={`tel:${patient.phone}`} className="dh-phone">{patient.phone}</a>
            </>
          )}
          {patient.last_visit_date && (
            <>
              <span className="dh-sep">|</span>
              <span className="dh-meta">최근 {patient.last_visit_date}</span>
            </>
          )}
          {mssqlData?.main_doctor && (
            <>
              <span className="dh-sep">|</span>
              <span className="dh-meta">{mssqlData.main_doctor}</span>
            </>
          )}
          {mssqlData?.referral_type && (
            <>
              <span className="dh-sep">|</span>
              <span className="dh-referral">{mssqlData.referral_type}</span>
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* 선결제/패키지 배지 */}
          <div className="dh-badges">
            {packages?.herbal?.active && (
              <span className="dh-badge herbal clickable" onClick={() => setPkgManageType('herbal')}>한약{packages.herbal.remainingCount}회</span>
            )}
            {packages?.nokryong?.active && (
              <span className="dh-badge nokryong clickable" onClick={() => setPkgManageType('nokryong')}>녹용{packages.nokryong.remainingMonths}회</span>
            )}
            {packages?.tongma?.active && (
              <span className="dh-badge tongma clickable" onClick={() => setPkgManageType('treatment')}>통마{packages.tongma.remainingCount}회</span>
            )}
            {packages?.membership?.active && (
              <span className="dh-badge membership clickable" onClick={() => setPkgManageType('membership')}>멤버십</span>
            )}
          </div>

          {/* 추가 버튼 */}
          <div className="dh-add-btns">
            <button className="pkg-add-btn herbal" onClick={() => { setQuickAddEditData(null); setQuickAddType('herbal'); }}>한약+</button>
            <button className="pkg-add-btn nokryong" onClick={() => { setQuickAddEditData(null); setQuickAddType('nokryong'); }}>녹용+</button>
            <button className="pkg-add-btn treatment" onClick={() => { setQuickAddEditData(null); setQuickAddType('treatment'); }}>통마+</button>
            <button className="pkg-add-btn membership" onClick={() => { setQuickAddEditData(null); setQuickAddType('membership'); }}>멤버+</button>
          </div>

          <button className="btn-header-close" onClick={onClose}>&times;</button>
        </div>

        {showMemoForm && (
          <div className="dashboard-memo-form">
            <PatientNoteInput
              patientId={patient.id}
              chartNumber={patient.chart_number || ''}
              patientName={patient.name}
              staffName={user.name}
              staffRole={staffRole}
              onSuccess={() => {
                setShowMemoForm(false);
                refresh();
              }}
              onCancel={() => setShowMemoForm(false)}
            />
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="dashboard-error">
          {error}
          <button onClick={refresh}>다시 시도</button>
        </div>
      )}

      {/* 대시보드 3단 레이아웃 */}
      <div className="dashboard-3col-v2">
        {/* 1단: 기타메모(auto) + 수납이력(fill) */}
        <div className="dashboard-col">
          <div className="dashboard-section auto-height">
            <div className="section-header"><h4>기타 메모</h4></div>
            <div className="dashboard-section-content">
              {mssqlData?.etc_memo ? (
                <pre className="etc-memo-display">{mssqlData.etc_memo.replace(/(\r?\n){2,}/g, '\n').trim()}</pre>
              ) : (
                <div className="section-empty">기타 메모 없음</div>
              )}
            </div>
          </div>
          <div className="dashboard-section fill-height">
            <div className="section-header">
              <h4>수납 이력</h4>
              <span className="section-count">{receipts.length}건</span>
              {receiptSummary && receiptSummary.total_count > 0 && (
                <span className="section-summary">
                  총 {receiptSummary.total_count}건 · {receiptSummary.total_amount.toLocaleString()}원
                </span>
              )}
            </div>
            {patient.mssql_id ? (
              <InlineReceiptHistory
                patientId={patient.mssql_id}
                patientName={patient.name}
                chartNo={patient.chart_number || ''}
              />
            ) : (
              <div className="section-empty">MSSQL 환자 ID 없음</div>
            )}
          </div>
        </div>

        {/* 2단: 약상담(1) + 한약/비급여(1) — 1:1 */}
        <div className="dashboard-col equal-split">
          <div className="dashboard-section">
            <div className="section-header">
              <h4 className="section-title-clickable" onClick={() => setExpandedSection('consults')}>약상담</h4>
              <span className="section-count">{herbalConsultations.length + consultMemos.length}건</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button
                  className="section-action-btn consult-add"
                  onClick={() => setShowConsultModal(true)}
                >
                  상담+
                </button>
                <button
                  className="section-action-btn consult-add memo-btn"
                  onClick={() => setShowMemoInput(!showMemoInput)}
                >
                  {showMemoInput ? '닫기' : '메모+'}
                </button>
              </div>
            </div>
            <div className="dashboard-section-content">
              {showMemoInput && (
                <div className="consult-memo-input-row">
                  <textarea
                    className="consult-memo-textarea"
                    value={newMemoText}
                    onChange={(e) => setNewMemoText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddConsultMemo();
                      }
                    }}
                    placeholder="약상담 입력 (Ctrl+Enter로 저장)"
                    rows={3}
                    autoFocus
                  />
                  <button
                    className="consult-memo-add-btn"
                    onClick={handleAddConsultMemo}
                    disabled={memoSaving || !newMemoText.trim()}
                  >
                    {memoSaving ? '...' : '저장'}
                  </button>
                </div>
              )}
              <div className="consult-memo-list">
                {/* 약상담 기록 */}
                {herbalConsultations.map(c => (
                  <div key={`hc-${c.id}`} className="consult-memo-item herbal-consult-record">
                    <div className="consult-memo-meta">
                      <span className="herbal-consult-type-badge">{c.consult_type}</span>
                      <span className="consult-memo-date">{c.consult_date}</span>
                      <span className="consult-memo-author">{c.doctor}</span>
                    </div>
                    <div className="consult-memo-text">
                      {c.purpose && <span className="hc-tag">{c.purpose}</span>}
                      {(() => { try { return JSON.parse(c.disease_tags || '[]'); } catch { return []; } })().map((t: string) => (
                        <span key={t} className="hc-tag disease">{t}</span>
                      ))}
                      {c.treatment_period && <><span className="hc-tag">{c.treatment_period}</span><span className="hc-label">권유</span></>}
                      {c.visit_pattern && <><span className="hc-tag">{c.visit_pattern}</span><span className="hc-label">내원</span></>}
                      {c.nokryong_recommendation && c.nokryong_recommendation !== '언급없음' && (
                        <span className="hc-tag nokryong">{c.nokryong_recommendation}</span>
                      )}
                    </div>
                    {(c.herbal_payment || c.nokryong_type || c.follow_up_memo || c.follow_up_staff) && (
                      <div className="consult-memo-text" style={{ marginTop: '2px' }}>
                        {c.follow_up_staff && <><span className="hc-tag">{c.follow_up_staff}</span><span className="hc-label">후상담</span></>}
                        {c.herbal_payment && <><span className={`hc-tag ${c.herbal_payment === '결제실패' ? 'fail' : 'payment'}`}>{c.herbal_payment}</span><span className="hc-label">결제</span></>}
                        {c.nokryong_type && <><span className="hc-tag">{c.nokryong_type}</span><span className="hc-label">녹용</span></>}
                        {c.follow_up_memo && <span className="hc-followup-memo">{c.follow_up_memo}</span>}
                      </div>
                    )}
                  </div>
                ))}
                {/* 간단 메모 */}
                {consultMemos.map(m => (
                  <div key={m.id} className="consult-memo-item">
                    <div className="consult-memo-meta">
                      <span className="consult-memo-date">
                        {new Date(m.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                      </span>
                      {m.created_by && <span className="consult-memo-author">{m.created_by}</span>}
                      <button className="consult-memo-del" onClick={() => handleDeleteConsultMemo(m.id)} title="삭제">×</button>
                    </div>
                    <div className="consult-memo-text">{m.memo}</div>
                  </div>
                ))}
                {herbalConsultations.length === 0 && consultMemos.length === 0 && (
                  <div className="section-empty">약상담 없음</div>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="section-header">
              <h4 className="section-title-clickable" onClick={() => setExpandedSection('packages')}>한약/비급여</h4>
              <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                <button
                  className="section-action-btn herbal-draft"
                  onClick={() => { setDraftMode('tangya'); setShowDraftModal(true); }}
                >
                  탕약+
                </button>
                <button
                  className="section-action-btn jaboyak-draft"
                  onClick={() => { setDraftMode('jaboyak'); setShowDraftModal(true); }}
                >
                  자보약+
                </button>
                <button
                  className="section-action-btn medicine-draft"
                  onClick={() => setShowMedicineModal(true)}
                >
                  상비약+
                </button>
              </div>
            </div>
            <PatientPackageSection
              packages={packages}
              herbalDrafts={herbalDrafts}
              medicineUsages={medicineUsages}
              isLoading={isLoading}
              onEditDraft={handleEditDraft}
              onDeleteDraft={handleDeleteDraft}
              onEditMedicine={(usage) => { setEditingMedicine(usage); setShowMedicineModal(true); }}
              onDeleteMedicine={handleDeleteMedicine}
              onEditPackage={(kind) => {
                const pkg = packages?.[kind as keyof typeof packages] as any;
                if (pkg) {
                  setQuickAddEditData({
                    id: pkg.id,
                    herbalName: pkg.herbalName,
                    totalCount: pkg.totalCount,
                    packageName: pkg.packageName,
                    totalMonths: pkg.totalMonths,
                    membershipType: pkg.membershipType,
                    quantity: pkg.quantity,
                    startDate: pkg.startDate,
                    expireDate: pkg.expireDate,
                  });
                }
                setQuickAddType(kind as any);
              }}
              onDeletePackage={async (kind) => {
                if (!confirm(`${kind === 'tongma' ? '통마' : kind === 'membership' ? '멤버십' : kind === 'herbal' ? '한약 선결제' : '녹용'} 패키지를 삭제하시겠습니까?`)) return;
                try {
                    await deletePackageByKind(patient.mssql_id || patient.id, kind);
                  refresh();
                } catch (err) { alert('삭제에 실패했습니다.'); }
              }}
              decoctionOrders={decoctionOrders}
            />
          </div>
        </div>

        {/* 3단: 문의/해피콜(1) + 예약(1) — 1:1 */}
        <div className="dashboard-col equal-split">
          <div className="dashboard-section">
            <div className="section-header">
              <h4 className="section-title-clickable" onClick={() => setExpandedSection('contacts')}>문의/해피콜</h4>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}>
                {(['all', 'inbound', 'outbound'] as const).map(f => (
                  <button key={f} className={`section-filter-btn ${contactDirFilter === f ? 'active' : ''}`}
                    onClick={() => setContactDirFilter(f)}>
                    {f === 'all' ? '전체' : f === 'inbound' ? '문의' : '해피콜'}
                  </button>
                ))}
                <button
                  className="section-action-btn incall-btn"
                  onClick={() => { setEditingContactLog(null); setShowContactLogModal(true); }}
                >문의+</button>
              </div>
            </div>
            <PatientInquirySection
              contactLogs={contactLogs || []}
              patientName={patient.name}
              isLoading={isLoading}
              onRefresh={refresh}
              onEditLog={(log) => { setEditingContactLog(log); setShowContactLogModal(true); }}
              dirFilter={contactDirFilter}
              onDirFilterChange={setContactDirFilter}
            />
          </div>
          <div className="dashboard-section">
            <div className="section-header">
              <h4>예약</h4>
              {(() => {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const allPast = reservations.filter(r => r.date <= todayStr || r.canceled);
                const noShow = allPast.filter(r => !r.canceled && !r.visited).length;
                const canceled = allPast.filter(r => r.canceled).length;
                const missed = noShow + canceled;
                const missRate = allPast.length > 0 ? Math.round((missed / allPast.length) * 100) : 0;
                const visitedWithRes = Math.min(reservations.filter(r => r.visited).length, receiptSummary?.total_count || 0);
                const totalVisits = receiptSummary?.total_count || 0;
                const resVisitRate = totalVisits > 0 ? Math.round((visitedWithRes / totalVisits) * 100) : 0;
                return allPast.length > 0 ? (
                  <span className="reservation-miss-rate-inline">
                    노쇼{noShow}+취소{canceled}/{allPast.length}건
                    <span className={`miss-rate-value ${missRate >= 30 ? 'high' : ''}`}>({missRate}%)</span>
                    {totalVisits > 0 && (
                      <span className="res-visit-rate">
                        {' · '}예약내원{visitedWithRes}/{totalVisits}건
                        <span className="miss-rate-value">({resVisitRate}%)</span>
                      </span>
                    )}
                  </span>
                ) : null;
              })()}
              <button
                className="section-action-btn"
                onClick={() => setShowStep1Modal(true)}
                style={{ marginLeft: 'auto' }}
              >예약+</button>
            </div>
            <PatientReservationSection
              reservations={reservations}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
    {/* 예약 Step1 */}
    <ReservationStep1Modal
      isOpen={showStep1Modal}
      onClose={() => setShowStep1Modal(false)}
      onNext={handleReservationNext}
      doctors={doctors}
      initialPatient={{
        id: patient.mssql_id || 0,
        chartNo: patient.chart_number || '',
        name: patient.name,
      } as InitialPatient}
    />
    {showStep2Modal && reservationDraft && (
      <QuickReservationModal
        isOpen={showStep2Modal}
        onClose={() => {
          setShowStep2Modal(false);
          setReservationDraft(null);
        }}
        onSuccess={() => {
          setShowStep2Modal(false);
          setReservationDraft(null);
          refresh();
        }}
        patientId={patient.mssql_id || 0}
        patientName={patient.name}
        chartNo={patient.chart_number || ''}
        selectedItems={reservationDraft.selectedItems}
        requiredSlots={reservationDraft.requiredSlots}
        memo={reservationDraft.memo}
      />
    )}

    {showMedicineModal && (
      <MedicineQuickModal
        patientId={patient.mssql_id || 0}
        chartNumber={patient.chart_number || ''}
        patientName={patient.name}
        mainDoctor={propSelectedDoctor || mssqlData?.main_doctor || patient.main_doctor || ''}
        editUsage={editingMedicine}
        onClose={() => { setShowMedicineModal(false); setEditingMedicine(null); }}
        onSuccess={() => { refresh(); setEditingMedicine(null); }}
      />
    )}

    {showContactLogModal && (
      <ContactLogQuickModal
        patientId={patient.id}
        patientName={patient.name}
        defaultCreatedBy={user.name}
        editLog={editingContactLog}
        onClose={() => { setShowContactLogModal(false); setEditingContactLog(null); }}
        onSuccess={() => { refresh(); setEditingContactLog(null); }}
      />
    )}

    {showConsultModal && (
      <HerbalConsultationModal
        patientId={patient.mssql_id || 0}
        chartNumber={patient.chart_number || ''}
        patientName={patient.name}
        mainDoctor={propSelectedDoctor || mssqlData?.main_doctor || patient.main_doctor || ''}
        onClose={() => setShowConsultModal(false)}
        onSuccess={() => { loadConsultMemos(); }}
      />
    )}

    <HerbalDraftModal
      isOpen={showDraftModal || !!editingDraft}
      patient={patient}
      user={user}
      editDraft={editingDraft || undefined}
      defaultReceiptDate={propSelectedDate}
      defaultDoctor={propSelectedDoctor || mssqlData?.main_doctor || patient?.main_doctor}
      mode={editingDraft?.herbal_name === '자보약' ? 'jaboyak' : draftMode}
      onClose={() => {
        setShowDraftModal(false);
        setEditingDraft(null);
        setDraftMode('tangya');
      }}
      onSuccess={async () => {
        await refresh();
        setShowDraftModal(false);
        setEditingDraft(null);
      }}
    />

    {pkgManageType && (
      <PackageManageModal
        type={pkgManageType}
        patientId={patient.mssql_id || patient.id}
        chartNumber={patient.chart_number || ''}
        onClose={() => setPkgManageType(null)}
        onSuccess={async () => { await refresh(); }}
      />
    )}

    {/* 우클릭 컨텍스트 메뉴 */}
    {contextMenu && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} onClick={() => setContextMenu(null)}>
        <div
          className="context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', padding: '4px 0', minWidth: 140, zIndex: 10000 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}
            onMouseOver={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseOut={e => (e.currentTarget.style.background = 'none')}
            onClick={() => { setContextMenu(null); setShowPatientEdit(true); }}
          >
            <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8, color: '#6b7280' }} />환자정보 수정
          </button>
          <button
            style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}
            onMouseOver={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseOut={e => (e.currentTarget.style.background = 'none')}
            onClick={() => { setContextMenu(null); setShowReferralList(true); loadReferralList(); }}
          >
            <i className="fa-solid fa-people-arrows" style={{ marginRight: 8, color: '#7c3aed' }} />소개자 목록
          </button>
        </div>
      </div>
    )}

    {/* 환자정보 수정 모달 */}
    {/* 소개자 목록 모달 */}
    {showReferralList && (
      <div className="pkg-modal-overlay" onClick={() => setShowReferralList(false)}>
        <div className="expanded-section-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
          <div className="expanded-section-header">
            <h3>{patient.name}({patient.chart_number})님이 소개한 환자</h3>
            <button className="pkg-modal-close-btn" onClick={() => setShowReferralList(false)}><i className="fa-solid fa-xmark" /></button>
          </div>
          <div className="expanded-section-body" style={{ padding: 16 }}>
            {referralLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                <i className="fa-solid fa-spinner fa-spin" /> 로딩 중...
              </div>
            ) : referralList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>
                소개한 환자가 없습니다
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 15, color: '#6b7280' }}>
                  총 <b>{referralList.length}</b>명 · 총매출 <b>{referralList.reduce((s, r) => s + (r.total_revenue || 0), 0).toLocaleString()}</b>원
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>환자명</th>
                      <th style={{ padding: '6px 8px' }}>등록일</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>총매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralList.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{r.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{r.chart_no}</span></td>
                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{r.reg_date ? new Date(r.reg_date).toLocaleDateString('ko-KR') : '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{(r.total_revenue || 0).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {showPatientEdit && (
      <PatientEditModal
        patient={patient}
        onClose={() => setShowPatientEdit(false)}
        onSuccess={() => refresh()}
      />
    )}

    {/* 확대 모달 */}
    {expandedSection && (
      <div className="pkg-modal-overlay" onClick={() => setExpandedSection(null)}>
        <div className="expanded-section-modal" onClick={e => e.stopPropagation()}>
          <div className="expanded-section-header">
            <h3>{expandedSection === 'packages' ? '한약/비급여' : expandedSection === 'contacts' ? '문의/해피콜' : '약상담'}</h3>
            <button className="pkg-modal-close-btn" onClick={() => setExpandedSection(null)}><i className="fa-solid fa-xmark" /></button>
          </div>
          <div className="expanded-section-body">
            {expandedSection === 'packages' && (
              <PatientPackageSection
                packages={packages}
                herbalDrafts={herbalDrafts}
                medicineUsages={medicineUsages}
                isLoading={isLoading}
                onEditDraft={handleEditDraft}
                onDeleteDraft={handleDeleteDraft}
                onEditMedicine={(usage) => { setEditingMedicine(usage); setShowMedicineModal(true); }}
                onDeleteMedicine={handleDeleteMedicine}
                onEditPackage={(kind) => {
                  const pkg = packages?.[kind as keyof typeof packages] as any;
                  if (pkg) setQuickAddEditData({ id: pkg.id, herbalName: pkg.herbalName, totalCount: pkg.totalCount, packageName: pkg.packageName, totalMonths: pkg.totalMonths, membershipType: pkg.membershipType, quantity: pkg.quantity, startDate: pkg.startDate, expireDate: pkg.expireDate });
                  setQuickAddType(kind as any);
                }}
                onDeletePackage={async (kind) => {
                  if (!confirm(`${kind === 'tongma' ? '통마' : kind === 'membership' ? '멤버십' : kind === 'herbal' ? '한약 선결제' : '녹용'} 패키지를 삭제하시겠습니까?`)) return;
                  try { await deletePackageByKind(patient.mssql_id || patient.id, kind); refresh(); } catch { alert('삭제 실패'); }
                }}
                decoctionOrders={decoctionOrders}
              />
            )}
            {expandedSection === 'contacts' && (
              <PatientInquirySection
                contactLogs={contactLogs || []}
                patientName={patient.name}
                isLoading={isLoading}
                onEditLog={(log) => { setEditingContactLog(log); setShowContactLogModal(true); }}
                onRefresh={refresh}
                onAddInCall={() => { setEditingContactLog(null); setShowContactLogModal(true); }}
                dirFilter={contactDirFilter}
                onDirFilterChange={setContactDirFilter}
              />
            )}
            {expandedSection === 'consults' && (
              <div>
                {herbalConsultations.length === 0 && consultMemos.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>약상담 없음</div>
                ) : (
                  <>
                    {herbalConsultations.map(c => (
                      <div key={c.id} className="herbal-consult-card" style={{ margin: '8px 0' }}>
                        <span className="herbal-consult-type-badge">{c.consult_type}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{c.consult_date}</span>
                        <span style={{ fontSize: 13, marginLeft: 8 }}>{c.disease_names}</span>
                        {c.memo && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{c.memo}</div>}
                      </div>
                    ))}
                    {consultMemos.map(m => (
                      <div key={m.id} className="consult-memo-card" style={{ margin: '8px 0' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{m.created_at?.slice(0, 10)}</span>
                        <span style={{ fontSize: 13, marginLeft: 8 }}>{m.content}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {quickAddType && (
      <PackageQuickAddModal
        packageType={quickAddType}
        patientId={patient.mssql_id || 0}
        patientName={patient.name}
        chartNumber={patient.chart_number || ''}
        receiptId={0}
        receiptDate={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
        uncoveredItems={[]}
        defaultDetailId={null}
        editData={quickAddEditData}
        onClose={() => { setQuickAddType(null); setQuickAddEditData(null); }}
        onSuccess={async () => { await refresh(); setQuickAddType(null); setQuickAddEditData(null); }}
      />
    )}

</div>
  );
};

export default PatientDashboard;
