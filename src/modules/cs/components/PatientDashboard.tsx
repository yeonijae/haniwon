/**
 * 통합 환자 대시보드 (모달)
 * 헤더 퀵검색, 수납 CRM 버튼 등 어디서든 호출 가능
 * 수납, 예약, 인콜, 아웃콜, 패키지를 한 화면에서 조회
 */
import React, { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import type { LocalPatient } from '../lib/patientSync';
import type { StaffRole } from '../types/crm';
import type { HerbalDraft } from '../types';
import { usePatientDashboard } from '../hooks/usePatientDashboard';
import { deleteHerbalDraft } from '../lib/api';

// 연속 줄바꿈을 1회로 축약
const trimMemo = (text: string): string => text.replace(/(\r?\n){2,}/g, '\n');
import PatientNoteInput from './PatientNoteInput';
import PatientReceiptHistory from './patient-dashboard/PatientReceiptHistory';
import PatientReservationSection from './patient-dashboard/PatientReservationSection';
import PatientInquirySection from './patient-dashboard/PatientInquirySection';
import PatientCallQueueSection from './patient-dashboard/PatientCallQueueSection';
import PatientPackageSection from './patient-dashboard/PatientPackageSection';
import PatientPackageTab from './patient-dashboard/PatientPackageTab';
import HerbalDraftModal from './HerbalDraftModal';
import { ReservationStep1Modal, type ReservationDraft, type InitialPatient } from '../../reservation/components/ReservationStep1Modal';
import { QuickReservationModal } from './QuickReservationModal';
import { fetchDoctors } from '../../reservation/lib/api';
import type { Doctor } from '../../reservation/types';

interface PatientDashboardProps {
  isOpen: boolean;
  patient: LocalPatient;
  user: PortalUser;
  onClose: () => void;
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
}) => {
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<HerbalDraft | null>(null);
  const [showStep1Modal, setShowStep1Modal] = useState(false);
  const [showStep2Modal, setShowStep2Modal] = useState(false);
  const [reservationDraft, setReservationDraft] = useState<ReservationDraft | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const {
    mssqlData,
    receipts,
    receiptSummary,
    reservations,
    contactLogs,
    callQueue,
    packages,
    herbalDrafts,
    isLoading,
    error,
    refresh,
  } = usePatientDashboard(patient);

  const staffRole = getStaffRole(user.role);

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
          <span className="dh-name">{patient.name}</span>
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

          <div className="dh-actions">
            <button
              className={`btn-memo-toggle ${showMemoForm ? 'active' : ''}`}
              onClick={() => setShowMemoForm(!showMemoForm)}
            >
              {showMemoForm ? '닫기' : '+ 메모'}
            </button>
<button className="btn-refresh-dashboard" onClick={refresh}>새로고침</button>
            <button className="btn-header-close" onClick={onClose}>&times;</button>
          </div>
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

      {/* 대시보드 레이아웃 */}
      <div className="dashboard-layout">
        {/* 1단: EMR 메모 (전체 폭, 가로 배치) */}
        <div className="emr-memo-grid">
          <div className="emr-memo-card doctor">
            <div className="emr-memo-label">주치의 메모</div>
            <pre className="emr-memo-content">{mssqlData?.doctor_memo ? trimMemo(mssqlData.doctor_memo) : '-'}</pre>
          </div>
          <div className="emr-memo-card nurse">
            <div className="emr-memo-label">간호사 메모</div>
            <pre className="emr-memo-content">{mssqlData?.nurse_memo ? trimMemo(mssqlData.nurse_memo) : '-'}</pre>
          </div>
          <div className="emr-memo-card etc">
            <div className="emr-memo-label">기타 메모</div>
            <pre className="emr-memo-content">{mssqlData?.etc_memo ? trimMemo(mssqlData.etc_memo) : '-'}</pre>
          </div>
        </div>

        {/* 2단: 2x2 그리드 */}
        <div className="dashboard-grid-2x2">
          <div className="dashboard-section">
            <div className="section-header">
              <h4>예약 현황</h4>
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const allPast = reservations.filter(r => r.date <= today || r.canceled);
                const noShow = allPast.filter(r => !r.canceled && !r.visited).length;
                const canceled = allPast.filter(r => r.canceled).length;
                const missed = noShow + canceled;
                const missRate = allPast.length > 0 ? Math.round((missed / allPast.length) * 100) : 0;
                const visitedWithRes = reservations.filter(r => r.visited).length;
                const totalVisits = receiptSummary?.total_count || 0;
                const resVisitRate = totalVisits > 0 ? Math.round((visitedWithRes / totalVisits) * 100) : 0;
                return allPast.length > 0 ? (
                  <span className="reservation-miss-rate-inline">
                    노쇼 {noShow} + 취소 {canceled} / {allPast.length}건
                    <span className={`miss-rate-value ${missRate >= 30 ? 'high' : ''}`}>({missRate}%)</span>
                    {totalVisits > 0 && (
                      <span className="res-visit-rate">
                        {' · '}예약내원 {visitedWithRes}/{totalVisits}건
                        <span className="miss-rate-value">({resVisitRate}%)</span>
                      </span>
                    )}
                  </span>
                ) : null;
              })()}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <span className="section-count">{reservations.length}건</span>
                <button
                  onClick={() => setShowStep1Modal(true)}
                  style={{
                    padding: '3px 10px',
                    border: '1px solid #667eea',
                    borderRadius: '5px',
                    background: 'white',
                    color: '#667eea',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-plus" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                  예약 추가
                </button>
              </div>
            </div>
            <PatientReservationSection
              reservations={reservations}
              isLoading={isLoading}
            />
          </div>

          <div className="dashboard-section">
            <div className="section-header">
              <h4>한약/비급여</h4>
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                <button
                  className="section-action-btn herbal-draft"
                  onClick={() => setShowDraftModal(true)}
                >
                  한약+
                </button>
                <button
                  className="section-action-btn"
                  onClick={() => setShowPackageModal(true)}
                >
                  <i className="fa-solid fa-sliders"></i> 관리
                </button>
              </div>
            </div>
            <PatientPackageSection
              packages={packages}
              herbalDrafts={herbalDrafts}
              isLoading={isLoading}
              onEditDraft={handleEditDraft}
              onDeleteDraft={handleDeleteDraft}
            />
          </div>

          {/* 한약+ 기록 모달 */}
          <HerbalDraftModal
            isOpen={showDraftModal}
            patient={patient}
            user={user}
            editDraft={editingDraft}
            onClose={() => { setShowDraftModal(false); setEditingDraft(null); }}
            onSuccess={() => { setShowDraftModal(false); setEditingDraft(null); refresh(); }}
          />

          {/* 한약/비급여 관리 모달 */}
          {showPackageModal && (
            <div className="pkg-modal-overlay" onClick={() => setShowPackageModal(false)}>
              <div className="pkg-modal-container" onClick={e => e.stopPropagation()}>
                <div className="pkg-modal-header">
                  <h3>한약/비급여 관리 — {patient.name}</h3>
                  <button className="pkg-modal-close-btn" onClick={() => setShowPackageModal(false)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="pkg-modal-body">
                  <PatientPackageTab
                    patientId={patient.id}
                    chartNumber={patient.chart_number || ''}
                    patientName={patient.name}
                    mssqlPatientId={patient.mssql_id}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="dashboard-section">
            <div className="section-header">
              <h4>수납 이력</h4>
              <span className="section-count">{receipts.length}건</span>
              {receiptSummary && receiptSummary.total_count > 0 && (
                <span className="section-summary">
                  총 {receiptSummary.total_count}건 · {receiptSummary.total_amount.toLocaleString()}원
                </span>
              )}
            </div>
            <PatientReceiptHistory
              receipts={receipts}
              isLoading={isLoading}
            />
          </div>

          <div className="dashboard-section">
            <div className="section-header">
              <h4>인콜/아웃콜</h4>
              <span className="section-count">{contactLogs.length + callQueue.length}건</span>
            </div>
            <div className="dashboard-section-content">
              {contactLogs.length > 0 && (
                <div className="call-subsection">
                  <h5 className="group-label">인콜 ({contactLogs.length})</h5>
                  <PatientInquirySection
                    contactLogs={contactLogs}
                    isLoading={isLoading}
                  />
                </div>
              )}
              {callQueue.length > 0 && (
                <div className="call-subsection">
                  <h5 className="group-label">아웃콜 ({callQueue.length})</h5>
                  <PatientCallQueueSection
                    callQueue={callQueue}
                    isLoading={isLoading}
                  />
                </div>
              )}
              {contactLogs.length === 0 && callQueue.length === 0 && !isLoading && (
                <div className="section-empty">기록 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* 예약 Step1: 치료항목/원장 선택 */}
    <ReservationStep1Modal
      isOpen={showStep1Modal}
      onClose={() => setShowStep1Modal(false)}
      onNext={handleReservationNext}
      doctors={doctors}
      initialPatient={{
        id: patient.mssql_id || 0,
        chartNo: patient.chart_number || '',
        name: patient.name,
      }}
    />

    {/* 예약 Step2: 캘린더 시간 선택 + preview */}
    {reservationDraft && (
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
        patientId={reservationDraft.patient.id}
        patientName={reservationDraft.patient.name}
        chartNo={reservationDraft.patient.chartNo}
        defaultDoctor={reservationDraft.doctor}
        selectedItems={reservationDraft.selectedItems}
        requiredSlots={reservationDraft.requiredSlots}
        memo={reservationDraft.memo}
      />
    )}

</div>
  );
};

export default PatientDashboard;
