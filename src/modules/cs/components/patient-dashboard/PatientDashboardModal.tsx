/**
 * 환자 통합 대시보드 모달
 * 전화 응대 시 환자의 모든 정보를 한 화면에서 조회/관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type { LocalPatient, MssqlPatient } from '../../lib/patientSync';
import type { ContactLog, CallQueueItem } from '../../types/crm';
import { syncPatientById, searchPatientsOnly } from '../../lib/patientSync';
import { getContactLogsByPatient } from '../../lib/contactLogApi';
import { getCallQueueByPatient } from '../../lib/callQueueApi';
import { useDraggableModal } from '../../hooks/useDraggableModal';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import PatientInfoHeader from './PatientInfoHeader';
import PatientVisitHistory from './PatientVisitHistory';
import PatientContactHistory from './PatientContactHistory';
import ContactLogForm from './ContactLogForm';
import './PatientDashboardModal.css';

type DashboardTab = 'overview' | 'visits' | 'contacts' | 'packages';

const TAB_LABELS: Record<DashboardTab, string> = {
  overview: '종합현황',
  visits: '진료이력',
  contacts: '응대기록',
  packages: '패키지',
};

interface PatientDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 환자 식별 (둘 중 하나 필수)
  patientId?: number;       // PostgreSQL patients.id
  mssqlPatientId?: number;  // MSSQL Customer_PK
  chartNumber?: string;     // 차트번호로 검색
  // 초기 데이터 (있으면 사용, 없으면 조회)
  initialPatient?: LocalPatient | MssqlPatient;
  // 콜백
  onReservation?: (patient: LocalPatient) => void;
  user: PortalUser;
}

const PatientDashboardModal: React.FC<PatientDashboardModalProps> = ({
  isOpen,
  onClose,
  patientId,
  mssqlPatientId,
  chartNumber,
  initialPatient,
  onReservation,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [patient, setPatient] = useState<LocalPatient | null>(null);
  const [mssqlData, setMssqlData] = useState<MssqlPatient | null>(null);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);

  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });
  useEscapeKey(onClose, isOpen);

  // 환자 데이터 로드
  const loadPatientData = useCallback(async () => {
    setIsLoading(true);
    try {
      let localPatient: LocalPatient | null = null;
      let emrData: MssqlPatient | null = null;

      // 1. 환자 정보 조회
      if (mssqlPatientId) {
        // MSSQL ID로 동기화
        localPatient = await syncPatientById(mssqlPatientId);
        // MSSQL 상세 정보도 조회
        const mssqlResults = await searchPatientsOnly(String(mssqlPatientId));
        emrData = mssqlResults.find(p => p.id === mssqlPatientId) || null;
      } else if (chartNumber) {
        // 차트번호로 검색
        const mssqlResults = await searchPatientsOnly(chartNumber);
        emrData = mssqlResults.find(p => p.chart_no === chartNumber) || null;
        if (emrData) {
          localPatient = await syncPatientById(emrData.id);
        }
      } else if (initialPatient) {
        // 초기 데이터 사용
        if ('mssql_id' in initialPatient) {
          localPatient = initialPatient as LocalPatient;
          if (localPatient.mssql_id) {
            const mssqlResults = await searchPatientsOnly(localPatient.chart_number || '');
            emrData = mssqlResults[0] || null;
          }
        } else {
          emrData = initialPatient as MssqlPatient;
          localPatient = await syncPatientById(emrData.id);
        }
      }

      setPatient(localPatient);
      setMssqlData(emrData);

      // 2. 응대 기록 조회
      if (localPatient) {
        const [logs, queue] = await Promise.all([
          getContactLogsByPatient(localPatient.id, 20),
          getCallQueueByPatient(localPatient.id, 10),
        ]);
        setContactLogs(logs);
        setCallQueue(queue);
      }
    } catch (error) {
      console.error('환자 대시보드 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mssqlPatientId, chartNumber, initialPatient]);

  useEffect(() => {
    if (isOpen) {
      loadPatientData();
    }
  }, [isOpen, loadPatientData]);

  // 새로고침
  const handleRefresh = useCallback(() => {
    loadPatientData();
    setShowContactForm(false);
  }, [loadPatientData]);

  // 예약 버튼 클릭
  const handleReservationClick = () => {
    if (patient && onReservation) {
      onReservation(patient);
    }
  };

  // 응대 기록 추가 완료
  const handleContactLogAdded = () => {
    handleRefresh();
  };

  if (!isOpen) return null;

  return (
    <div className="patient-dashboard-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`patient-dashboard-modal ${modalClassName}`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 - 드래그 가능 */}
        <div className="dashboard-header" onMouseDown={handleMouseDown}>
          {isLoading ? (
            <div className="dashboard-header-loading">환자 정보 로딩 중...</div>
          ) : patient ? (
            <PatientInfoHeader
              patient={patient}
              mssqlData={mssqlData}
              onReservation={onReservation ? handleReservationClick : undefined}
              onClose={onClose}
            />
          ) : (
            <div className="dashboard-header-error">
              <span>환자 정보를 찾을 수 없습니다</span>
              <button onClick={onClose}>닫기</button>
            </div>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="dashboard-tabs">
          {(Object.keys(TAB_LABELS) as DashboardTab[]).map(tab => (
            <button
              key={tab}
              className={`dashboard-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="dashboard-content">
          {isLoading ? (
            <div className="dashboard-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>데이터를 불러오는 중...</span>
            </div>
          ) : !patient ? (
            <div className="dashboard-empty">환자 정보가 없습니다.</div>
          ) : (
            <>
              {/* 종합현황 탭 */}
              {activeTab === 'overview' && (
                <div className="dashboard-overview">
                  {/* 왼쪽: 환자 메모 & 콜 대기 */}
                  <div className="overview-left">
                    {/* EMR 메모 */}
                    {mssqlData?.doctor_memo && (
                      <div className="overview-section">
                        <h4><i className="fa-solid fa-user-doctor"></i> 원장 메모</h4>
                        <pre className="memo-content">{mssqlData.doctor_memo}</pre>
                      </div>
                    )}
                    {mssqlData?.nurse_memo && (
                      <div className="overview-section">
                        <h4><i className="fa-solid fa-notes-medical"></i> 간호 메모</h4>
                        <pre className="memo-content">{mssqlData.nurse_memo}</pre>
                      </div>
                    )}

                    {/* 콜 대기열 */}
                    {callQueue.length > 0 && (
                      <div className="overview-section">
                        <h4><i className="fa-solid fa-phone"></i> 콜 대기</h4>
                        <ul className="call-queue-list">
                          {callQueue.filter(q => q.status === 'pending').slice(0, 3).map(item => (
                            <li key={item.id} className="call-queue-item">
                              <span className="call-type">{item.call_type}</span>
                              <span className="call-date">{item.due_date}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 최근 응대 기록 */}
                  <div className="overview-right">
                    <div className="overview-section">
                      <div className="section-header">
                        <h4><i className="fa-solid fa-comments"></i> 최근 응대</h4>
                        <button
                          className="btn-add-contact"
                          onClick={() => setShowContactForm(true)}
                        >
                          + 기록 추가
                        </button>
                      </div>

                      {showContactForm && (
                        <ContactLogForm
                          patientId={patient.id}
                          userName={user.name}
                          onSuccess={handleContactLogAdded}
                          onCancel={() => setShowContactForm(false)}
                        />
                      )}

                      <PatientContactHistory
                        logs={contactLogs.slice(0, 5)}
                        compact
                      />

                      {contactLogs.length > 5 && (
                        <button
                          className="btn-view-all"
                          onClick={() => setActiveTab('contacts')}
                        >
                          전체 기록 보기 ({contactLogs.length}개)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 진료이력 탭 */}
              {activeTab === 'visits' && (
                <PatientVisitHistory
                  mssqlPatientId={patient.mssql_id || 0}
                  chartNumber={patient.chart_number || ''}
                />
              )}

              {/* 응대기록 탭 */}
              {activeTab === 'contacts' && (
                <div className="dashboard-contacts">
                  <div className="section-header">
                    <h4>응대 기록</h4>
                    <button
                      className="btn-add-contact"
                      onClick={() => setShowContactForm(true)}
                    >
                      + 새 기록
                    </button>
                  </div>

                  {showContactForm && (
                    <ContactLogForm
                      patientId={patient.id}
                      userName={user.name}
                      onSuccess={handleContactLogAdded}
                      onCancel={() => setShowContactForm(false)}
                    />
                  )}

                  <PatientContactHistory logs={contactLogs} />
                </div>
              )}

              {/* 패키지 탭 */}
              {activeTab === 'packages' && (
                <div className="dashboard-packages">
                  <p className="placeholder-text">
                    패키지 현황은 수납 화면에서 확인하세요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 액션 바 */}
        {patient && (
          <div className="dashboard-actions">
            <button className="btn-action secondary" onClick={handleRefresh}>
              <i className="fa-solid fa-refresh"></i> 새로고침
            </button>
            {onReservation && (
              <button className="btn-action primary" onClick={handleReservationClick}>
                <i className="fa-solid fa-calendar-plus"></i> 예약하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboardModal;
