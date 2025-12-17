/**
 * 한약 복약관리 앱
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import type { HerbalTask, HerbalTasksResponse } from './types';
import { fetchAllHerbalTasks, markEventBenefitSent } from './api/herbalApi';

import HerbalTaskList from './components/HerbalTaskList';
import HerbalSetupModal from './components/HerbalSetupModal';
import CallCompleteModal from './components/CallCompleteModal';

interface HerbalAppProps {
  user: PortalUser;
}

const HerbalApp: React.FC<HerbalAppProps> = ({ user }) => {
  const navigate = useNavigate();

  // 상태
  const [tasks, setTasks] = useState<HerbalTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'setup' | 'calls' | 'events' | 'followup'>('setup');

  // 모달 상태
  const [setupTask, setSetupTask] = useState<HerbalTask | null>(null);
  const [callTask, setCallTask] = useState<HerbalTask | null>(null);

  // 데이터 로드
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllHerbalTasks();
      setTasks(data);
    } catch (error) {
      console.error('가상과제 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 핸들러
  function handleSetupClick(task: HerbalTask) {
    setSetupTask(task);
  }

  function handleCallComplete(task: HerbalTask) {
    setCallTask(task);
  }

  async function handleEventBenefitSend(task: HerbalTask) {
    if (!confirm(`${task.patient.name}님에게 이벤트 혜택 안내를 발송하시겠습니까?`)) {
      return;
    }

    try {
      await markEventBenefitSent(task.data.purchase_id);
      alert('발송 완료 처리되었습니다.');
      loadTasks();
    } catch (error) {
      console.error('이벤트 혜택 발송 실패:', error);
      alert('처리에 실패했습니다.');
    }
  }

  function handleModalClose() {
    setSetupTask(null);
    setCallTask(null);
  }

  function handleModalSuccess() {
    handleModalClose();
    loadTasks();
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-md flex items-center px-4 py-2 flex-shrink-0">
        {/* 왼쪽 - 로고 및 제목 */}
        <div
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-pills text-3xl text-green-500 mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-green-600">복약관리</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 중앙 - 요약 정보 */}
        <div className="flex items-center gap-6 ml-10">
          {tasks && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tasks.summary.setup_count}</div>
                <div className="text-xs text-gray-500">신규 설정</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{tasks.summary.calls_count}</div>
                <div className="text-xs text-gray-500">콜 예정</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{tasks.summary.benefits_count}</div>
                <div className="text-xs text-gray-500">이벤트</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{tasks.summary.followup_count}</div>
                <div className="text-xs text-gray-500">사후관리</div>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽 - 새로고침 및 사용자 정보 */}
        <div className="flex items-center ml-auto gap-4">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
            새로고침
          </button>

          <div className="text-right">
            <p className="font-semibold text-sm text-gray-800">{user?.name || '관리자'}</p>
            <p className="text-xs text-gray-500">
              {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="닫기"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gray-50">
        <HerbalTaskList
          tasks={tasks}
          loading={loading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSetupClick={handleSetupClick}
          onCallComplete={handleCallComplete}
          onEventBenefitSend={handleEventBenefitSend}
        />
      </main>

      {/* Modals */}
      {setupTask && (
        <HerbalSetupModal
          task={setupTask}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {callTask && (
        <CallCompleteModal
          task={callTask}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default HerbalApp;
