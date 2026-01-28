/**
 * 아웃바운드 콜 센터
 * 조건별 콜 대상자 리스트업 및 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type { CallType, CallQueueItem, CallCenterStats } from '../../types/crm';
import { CALL_TYPE_LABELS } from '../../types/crm';
import {
  getTodayCallQueue,
  getCallCenterStats,
  getAllCallTargets,
  addTargetToQueue,
  completeCall,
  postponeCall,
  updateCallQueueItem,
  type CallTargetPatient,
} from '../../lib/callQueueApi';
import { createContactLog } from '../../lib/contactLogApi';
import { PatientDashboardModal } from '../patient-dashboard';
import { MessageSendModal } from '../messaging';
import CallTargetList from './CallTargetList';
import CallResultModal from './CallResultModal';
import './OutboundCallCenter.css';

interface OutboundCallCenterProps {
  user: PortalUser;
}

type ViewMode = 'queue' | 'targets';

const CALL_TYPES: CallType[] = [
  'delivery_call',
  'visit_call',
  'after_call',
  'unconsumed',
  'vip_care',
  'churn_risk_1',
  'churn_risk_3',
];

const OutboundCallCenter: React.FC<OutboundCallCenterProps> = ({ user }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [selectedType, setSelectedType] = useState<CallType | null>(null);
  const [queueItems, setQueueItems] = useState<CallQueueItem[]>([]);
  const [targetPatients, setTargetPatients] = useState<CallTargetPatient[]>([]);
  const [stats, setStats] = useState<CallCenterStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 모달 상태
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardPatientId, setDashboardPatientId] = useState<number | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<CallQueueItem | null>(null);
  // 메시지 발송 모달
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTarget, setMessageTarget] = useState<{
    patientId?: number;
    patientName?: string;
    phone: string;
  } | null>(null);

  // 통계 로드
  const loadStats = useCallback(async () => {
    try {
      const data = await getCallCenterStats();
      setStats(data);
    } catch (error) {
      console.error('통계 로드 오류:', error);
    }
  }, []);

  // 콜 큐 로드
  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getTodayCallQueue(selectedType || undefined);
      setQueueItems(items);
    } catch (error) {
      console.error('콜 큐 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  // 콜 대상자 로드
  const loadTargets = useCallback(async () => {
    setIsLoading(true);
    try {
      const patients = await getAllCallTargets(selectedType || undefined);
      setTargetPatients(patients);
    } catch (error) {
      console.error('콜 대상자 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  // 초기 로드
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 뷰 모드 또는 유형 변경 시 데이터 로드
  useEffect(() => {
    if (viewMode === 'queue') {
      loadQueue();
    } else {
      loadTargets();
    }
  }, [viewMode, loadQueue, loadTargets]);

  // 새로고침
  const handleRefresh = () => {
    loadStats();
    if (viewMode === 'queue') {
      loadQueue();
    } else {
      loadTargets();
    }
  };

  // 환자 클릭 → 대시보드 열기
  const handlePatientClick = (patientId: number) => {
    setDashboardPatientId(patientId);
    setShowDashboard(true);
  };

  // 콜 완료 버튼 클릭
  const handleCallComplete = (item: CallQueueItem) => {
    setSelectedQueueItem(item);
    setShowResultModal(true);
  };

  // 콜 결과 저장
  const handleSaveResult = async (result: string, content: string) => {
    if (!selectedQueueItem) return;

    try {
      // 응대 기록 생성
      const log = await createContactLog({
        patient_id: selectedQueueItem.patient_id,
        direction: 'outbound',
        channel: 'phone',
        contact_type: selectedQueueItem.call_type as any,
        content,
        result,
        related_type: selectedQueueItem.related_type || undefined,
        related_id: selectedQueueItem.related_id || undefined,
        created_by: user.name,
      });

      // 콜 큐 완료 처리
      await completeCall(selectedQueueItem.id, log.id);

      setShowResultModal(false);
      setSelectedQueueItem(null);
      handleRefresh();
    } catch (error) {
      console.error('콜 결과 저장 오류:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 콜 미루기
  const handlePostpone = async (item: CallQueueItem, days: number) => {
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);
      const dateStr = newDate.toISOString().split('T')[0];

      await postponeCall(item.id, dateStr);
      handleRefresh();
    } catch (error) {
      console.error('콜 미루기 오류:', error);
      alert('미루기에 실패했습니다.');
    }
  };

  // 부재중 처리
  const handleNoAnswer = async (item: CallQueueItem) => {
    try {
      await updateCallQueueItem(item.id, { status: 'no_answer' });
      handleRefresh();
    } catch (error) {
      console.error('부재중 처리 오류:', error);
    }
  };

  // 대상자를 큐에 추가
  const handleAddToQueue = async (target: CallTargetPatient) => {
    try {
      await addTargetToQueue(target);
      handleRefresh();
    } catch (error) {
      console.error('큐 추가 오류:', error);
      alert('큐 추가에 실패했습니다.');
    }
  };

  // 일괄 큐 추가
  const handleBulkAddToQueue = async () => {
    if (targetPatients.length === 0) return;

    const confirmed = confirm(`${targetPatients.length}명을 콜 큐에 추가하시겠습니까?`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      for (const target of targetPatients) {
        await addTargetToQueue(target);
      }
      alert(`${targetPatients.length}명이 콜 큐에 추가되었습니다.`);
      handleRefresh();
    } catch (error) {
      console.error('일괄 추가 오류:', error);
      alert('일부 추가에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지 발송 (콜 큐 아이템)
  const handleSendMessage = (item: CallQueueItem) => {
    if (!item.patient?.phone) {
      alert('연락처 정보가 없습니다.');
      return;
    }
    setMessageTarget({
      patientId: item.patient_id,
      patientName: item.patient.name,
      phone: item.patient.phone,
    });
    setShowMessageModal(true);
  };

  // 메시지 발송 (대상자)
  const handleSendMessageToTarget = (target: CallTargetPatient) => {
    if (!target.phone) {
      alert('연락처 정보가 없습니다.');
      return;
    }
    setMessageTarget({
      patientId: target.patient_id,
      patientName: target.name,
      phone: target.phone,
    });
    setShowMessageModal(true);
  };

  return (
    <div className="outbound-call-center">
      {/* 헤더 */}
      <div className="call-center-header">
        <div className="header-left">
          <h2>아웃바운드 콜 센터</h2>
          {stats && (
            <div className="header-stats">
              <span className="stat-item pending">
                <i className="fa-solid fa-phone-volume"></i>
                대기 {stats.total_pending}건
              </span>
              <span className="stat-item completed">
                <i className="fa-solid fa-check"></i>
                오늘 완료 {stats.completed_today}건
              </span>
            </div>
          )}
        </div>
        <div className="header-right">
          <button className="btn-refresh" onClick={handleRefresh} disabled={isLoading}>
            <i className="fa-solid fa-refresh"></i>
            새로고침
          </button>
        </div>
      </div>

      {/* 뷰 모드 전환 */}
      <div className="view-mode-tabs">
        <button
          className={`view-tab ${viewMode === 'queue' ? 'active' : ''}`}
          onClick={() => setViewMode('queue')}
        >
          <i className="fa-solid fa-list-check"></i>
          콜 큐
          {stats && stats.total_pending > 0 && (
            <span className="tab-badge">{stats.total_pending}</span>
          )}
        </button>
        <button
          className={`view-tab ${viewMode === 'targets' ? 'active' : ''}`}
          onClick={() => setViewMode('targets')}
        >
          <i className="fa-solid fa-users"></i>
          대상자 리스트업
        </button>
      </div>

      {/* 콜 유형 필터 */}
      <div className="call-type-filter">
        <button
          className={`filter-btn ${selectedType === null ? 'active' : ''}`}
          onClick={() => setSelectedType(null)}
        >
          전체
        </button>
        {CALL_TYPES.map(type => (
          <button
            key={type}
            className={`filter-btn ${selectedType === type ? 'active' : ''}`}
            onClick={() => setSelectedType(type)}
          >
            {CALL_TYPE_LABELS[type]}
            {stats?.by_type[type] && viewMode === 'queue' && (
              <span className="filter-count">{stats.by_type[type]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="call-center-content">
        {isLoading ? (
          <div className="loading-state">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span>로딩 중...</span>
          </div>
        ) : viewMode === 'queue' ? (
          /* 콜 큐 목록 */
          <div className="queue-list">
            {queueItems.length === 0 ? (
              <div className="empty-state">
                <i className="fa-solid fa-check-circle"></i>
                <span>대기 중인 콜이 없습니다.</span>
              </div>
            ) : (
              queueItems.map(item => (
                <div key={item.id} className="queue-item">
                  <div className="queue-item-left">
                    <span className={`call-type-badge ${item.call_type}`}>
                      {CALL_TYPE_LABELS[item.call_type]}
                    </span>
                    <div
                      className="patient-info"
                      onClick={() => handlePatientClick(item.patient_id)}
                    >
                      <span className="patient-name">{item.patient?.name || '이름 없음'}</span>
                      <span className="patient-chart">({item.patient?.chart_number})</span>
                    </div>
                    <a
                      href={`tel:${item.patient?.phone}`}
                      className="patient-phone"
                      onClick={e => e.stopPropagation()}
                    >
                      <i className="fa-solid fa-phone"></i>
                      {item.patient?.phone || '-'}
                    </a>
                  </div>
                  <div className="queue-item-right">
                    <div className="queue-actions">
                      <button
                        className="action-btn complete"
                        onClick={() => handleCallComplete(item)}
                        title="통화 완료"
                      >
                        <i className="fa-solid fa-check"></i>
                        완료
                      </button>
                      <button
                        className="action-btn postpone"
                        onClick={() => handlePostpone(item, 1)}
                        title="내일로 미루기"
                      >
                        <i className="fa-solid fa-clock"></i>
                        미룸
                      </button>
                      <button
                        className="action-btn no-answer"
                        onClick={() => handleNoAnswer(item)}
                        title="부재중"
                      >
                        <i className="fa-solid fa-phone-slash"></i>
                      </button>
                      <button
                        className="action-btn message"
                        onClick={() => handleSendMessage(item)}
                        title="문자 발송"
                      >
                        <i className="fa-solid fa-message"></i>
                      </button>
                    </div>
                    <span className="queue-date">
                      {item.due_date === new Date().toISOString().split('T')[0]
                        ? '오늘'
                        : item.due_date}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* 대상자 리스트업 */
          <div className="targets-section">
            {targetPatients.length > 0 && (
              <div className="bulk-actions">
                <span className="target-count">{targetPatients.length}명 대상</span>
                <button
                  className="btn-bulk-add"
                  onClick={handleBulkAddToQueue}
                  disabled={isLoading}
                >
                  <i className="fa-solid fa-plus"></i>
                  전체 큐에 추가
                </button>
              </div>
            )}
            <CallTargetList
              targets={targetPatients}
              onPatientClick={handlePatientClick}
              onAddToQueue={handleAddToQueue}
              onSendMessage={handleSendMessageToTarget}
            />
          </div>
        )}
      </div>

      {/* 환자 대시보드 모달 */}
      {showDashboard && dashboardPatientId && (
        <PatientDashboardModal
          isOpen={showDashboard}
          onClose={() => {
            setShowDashboard(false);
            setDashboardPatientId(null);
          }}
          patientId={dashboardPatientId}
          user={user}
        />
      )}

      {/* 콜 결과 입력 모달 */}
      {showResultModal && selectedQueueItem && (
        <CallResultModal
          queueItem={selectedQueueItem}
          onSave={handleSaveResult}
          onCancel={() => {
            setShowResultModal(false);
            setSelectedQueueItem(null);
          }}
        />
      )}

      {/* 메시지 발송 모달 */}
      {showMessageModal && messageTarget && (
        <MessageSendModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setMessageTarget(null);
          }}
          phone={messageTarget.phone}
          patientName={messageTarget.patientName}
          patientId={messageTarget.patientId}
          createdBy={user.name}
          onSuccess={() => {
            setShowMessageModal(false);
            setMessageTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default OutboundCallCenter;
