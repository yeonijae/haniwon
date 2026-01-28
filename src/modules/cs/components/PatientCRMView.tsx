import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type {
  PatientNote,
  CRMTabType,
  PackageStatusSummary,
  StaffRole,
} from '../types/crm';
import { CRM_TAB_LABELS } from '../types/crm';
import {
  getPatientNotes,
  getPatientPackageStatus,
  getPatientNoteStats,
} from '../lib/patientCrmApi';
import PatientNoteTimeline from './PatientNoteTimeline';
import PatientNoteInput from './PatientNoteInput';
import PatientPackageStatus from './PatientPackageStatus';
import PatientHappyCallHistory from './PatientHappyCallHistory';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';

interface PatientCRMViewProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  chartNumber: string;
  patientName: string;
  gender?: 'male' | 'female' | 'M' | 'F';
  age?: number;
  user: PortalUser;
}

const PatientCRMView: React.FC<PatientCRMViewProps> = ({
  isOpen,
  onClose,
  patientId,
  chartNumber,
  patientName,
  gender,
  age,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<CRMTabType>('overview');
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [packageStatus, setPackageStatus] = useState<PackageStatusSummary | null>(null);
  const [noteStats, setNoteStats] = useState<{ total: number; activeComplaints: number }>({ total: 0, activeComplaints: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<PatientNote | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);

  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });
  useEscapeKey(onClose, isOpen);

  // 성별 표시 변환
  const genderDisplay = gender === 'M' || gender === 'male' ? '남' : gender === 'F' || gender === 'female' ? '여' : '';

  // 스태프 역할 결정 (user.role 기반)
  const staffRole: StaffRole = user.role === 'medical_staff'
    ? 'doctor'
    : user.role === 'treatment'
    ? 'treatment'
    : 'desk';

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notesData, statusData, statsData] = await Promise.all([
        getPatientNotes(patientId),
        getPatientPackageStatus(patientId),
        getPatientNoteStats(patientId),
      ]);

      setNotes(notesData);
      setPackageStatus(statusData);
      setNoteStats({
        total: statsData.total,
        activeComplaints: statsData.activeComplaints,
      });
    } catch (error) {
      console.error('CRM 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // 메모 새로고침
  const handleRefresh = useCallback(() => {
    loadData();
    setShowNoteInput(false);
    setEditingNote(null);
  }, [loadData]);

  // 메모 수정
  const handleEditNote = useCallback((note: PatientNote) => {
    setEditingNote(note);
    setShowNoteInput(true);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-content crm-modal ${modalClassName}`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* 헤더 */}
        <div className="modal-header crm-header">
          <div className="crm-patient-info">
            <span className="patient-name">{patientName}</span>
            <span className="patient-chart">({chartNumber})</span>
            {genderDisplay && age && (
              <span className="patient-gender-age">{genderDisplay}/{age}세</span>
            )}
            {noteStats.activeComplaints > 0 && (
              <span className="complaint-badge">
                컴플레인 {noteStats.activeComplaints}
              </span>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 탭 */}
        <div className="crm-tabs">
          {(['overview', 'notes', 'history', 'happycall'] as CRMTabType[]).map(tab => (
            <button
              key={tab}
              className={`crm-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {CRM_TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="modal-body crm-body">
          {isLoading ? (
            <div className="crm-loading">
              <span>로딩 중...</span>
            </div>
          ) : (
            <>
              {/* 종합현황 탭 */}
              {activeTab === 'overview' && (
                <div className="crm-overview">
                  <div className="crm-overview-left">
                    <h4>패키지 현황</h4>
                    {packageStatus && (
                      <PatientPackageStatus status={packageStatus} />
                    )}
                  </div>
                  <div className="crm-overview-right">
                    <div className="crm-section-header">
                      <h4>최근 메모</h4>
                      <button
                        className="btn-add-note"
                        onClick={() => setShowNoteInput(!showNoteInput)}
                      >
                        + 메모 추가
                      </button>
                    </div>
                    {showNoteInput && (
                      <PatientNoteInput
                        patientId={patientId}
                        chartNumber={chartNumber}
                        patientName={patientName}
                        staffName={user.name}
                        staffRole={staffRole}
                        editNote={editingNote || undefined}
                        onSuccess={handleRefresh}
                        onCancel={() => {
                          setShowNoteInput(false);
                          setEditingNote(null);
                        }}
                      />
                    )}
                    <PatientNoteTimeline
                      notes={notes.slice(0, 5)}
                      onRefresh={handleRefresh}
                      onEdit={handleEditNote}
                    />
                    {notes.length > 5 && (
                      <button
                        className="btn-view-all"
                        onClick={() => setActiveTab('notes')}
                      >
                        전체 메모 보기 ({notes.length}개)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 메모/문의 탭 */}
              {activeTab === 'notes' && (
                <div className="crm-notes">
                  <div className="crm-section-header">
                    <h4>메모/문의 기록</h4>
                    <button
                      className="btn-add-note"
                      onClick={() => setShowNoteInput(!showNoteInput)}
                    >
                      + 새 메모
                    </button>
                  </div>
                  {showNoteInput && (
                    <PatientNoteInput
                      patientId={patientId}
                      chartNumber={chartNumber}
                      patientName={patientName}
                      staffName={user.name}
                      staffRole={staffRole}
                      editNote={editingNote || undefined}
                      onSuccess={handleRefresh}
                      onCancel={() => {
                        setShowNoteInput(false);
                        setEditingNote(null);
                      }}
                    />
                  )}
                  <PatientNoteTimeline
                    notes={notes}
                    onRefresh={handleRefresh}
                    onEdit={handleEditNote}
                  />
                </div>
              )}

              {/* 수납이력 탭 */}
              {activeTab === 'history' && (
                <div className="crm-history">
                  <p className="crm-placeholder">
                    수납 이력은 ReceiptView에서 확인하세요.
                  </p>
                </div>
              )}

              {/* 해피콜 탭 */}
              {activeTab === 'happycall' && (
                <div className="crm-happycall">
                  <PatientHappyCallHistory
                    patientId={patientId}
                    chartNumber={chartNumber}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 - 메모 입력 (고정) */}
        {activeTab === 'overview' && !showNoteInput && (
          <div className="modal-footer crm-footer">
            <button
              className="btn-quick-memo"
              onClick={() => setShowNoteInput(true)}
            >
              빠른 메모 입력...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientCRMView;
