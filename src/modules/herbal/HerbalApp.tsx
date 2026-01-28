/**
 * 복약관리 앱
 * - 초진콜: 초진 환자 감사 메시지
 * - 신규설정: 고액 비급여 결제 → 복약관리 설정
 * - 복약콜/내원콜: 복약 관련 콜
 * - 이벤트: 공진단/경옥고 이벤트 혜택
 * - 사후관리: 복용 완료 후 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import { useFontScale } from '@shared/hooks/useFontScale';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { getCurrentDate } from '@shared/lib/postgres';
import type { HerbalTask, HerbalTasksResponse, FirstVisitTemplateType } from './types';
import { fetchAllHerbalTasks, markEventBenefitSent, markFirstVisitMessageSent } from './api/herbalApi';

import HerbalTaskList from './components/HerbalTaskList';
import HerbalSetupModal from './components/HerbalSetupModal';
import CallCompleteModal from './components/CallCompleteModal';
import FirstVisitModal from './components/FirstVisitModal';

interface HerbalAppProps {
  user: PortalUser;
}

export type TabType = 'dashboard' | 'firstvisit' | 'setup' | 'active' | 'calls' | 'events' | 'followup';

const HerbalApp: React.FC<HerbalAppProps> = ({ user }) => {
  const navigate = useNavigate();

  // 폰트 스케일
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('herbal');
  useDocumentTitle('복약관리');

  // 상태
  const [tasks, setTasks] = useState<HerbalTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [targetDate, setTargetDate] = useState<string>(getCurrentDate());

  // 모달 상태
  const [setupTask, setSetupTask] = useState<HerbalTask | null>(null);
  const [callTask, setCallTask] = useState<HerbalTask | null>(null);
  const [firstVisitTask, setFirstVisitTask] = useState<HerbalTask | null>(null);

  // 데이터 로드
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllHerbalTasks(targetDate);
      setTasks(data);
    } catch (error) {
      console.error('가상과제 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 날짜 변경 핸들러
  function handleDateChange(days: number) {
    const date = new Date(targetDate);
    date.setDate(date.getDate() + days);
    setTargetDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  }

  function handleDateInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTargetDate(e.target.value);
  }

  function handleTodayClick() {
    setTargetDate(getCurrentDate());
  }

  // 오늘 날짜인지 확인
  const isToday = targetDate === getCurrentDate();

  // 핸들러
  function handleFirstVisitClick(task: HerbalTask) {
    setFirstVisitTask(task);
  }

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

  async function handleFirstVisitSend(
    task: HerbalTask,
    templateType: FirstVisitTemplateType,
    notes?: string
  ) {
    try {
      await markFirstVisitMessageSent(
        task.data.customer_pk,
        task.patient.chart_number,
        task.patient.name,
        task.patient.phone,
        task.data.treatment_date,
        task.data.doctor_name,
        templateType,
        user.name || '관리자',
        notes
      );
      handleModalClose();
      loadTasks();
    } catch (error) {
      console.error('초진 메시지 발송 실패:', error);
      alert('처리에 실패했습니다.');
    }
  }

  function handleModalClose() {
    setSetupTask(null);
    setCallTask(null);
    setFirstVisitTask(null);
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

        {/* 날짜 선택 */}
        <div className="flex items-center gap-2 ml-6 px-3 py-1.5 bg-gray-50 rounded-lg border">
          <button
            onClick={() => handleDateChange(-1)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
            title="이전 날짜"
          >
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
          <input
            type="date"
            value={targetDate}
            onChange={handleDateInputChange}
            className="bg-transparent text-sm font-medium text-gray-700 border-none focus:outline-none cursor-pointer"
          />
          <button
            onClick={() => handleDateChange(1)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
            title="다음 날짜"
          >
            <i className="fas fa-chevron-right text-xs"></i>
          </button>
          {!isToday && (
            <button
              onClick={handleTodayClick}
              className="ml-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
              title="오늘로 이동"
            >
              오늘
            </button>
          )}
        </div>

        {/* 중앙 - 요약 정보 */}
        <div className="flex items-center gap-6 ml-6">
          {tasks && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-pink-600">{tasks.summary.first_visit_count}</div>
                <div className="text-xs text-gray-500">초진콜</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tasks.summary.setup_count}</div>
                <div className="text-xs text-gray-500">신규 설정</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-600">{tasks.summary.active_count}</div>
                <div className="text-xs text-gray-500">진행현황</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{tasks.summary.calls_count}</div>
                <div className="text-xs text-gray-500">복약콜</div>
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

        {/* 오른쪽 - 폰트 스케일, 새로고침 및 사용자 정보 */}
        <div className="flex items-center ml-auto gap-4">
          {/* 폰트 스케일 컨트롤 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={decreaseScale}
              disabled={!canDecrease}
              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-600 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              title="글씨 축소"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
            <span
              onClick={resetScale}
              className="min-w-[40px] text-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 rounded px-1 py-1"
              title="기본 크기로 복원"
            >
              {scalePercent}%
            </span>
            <button
              onClick={increaseScale}
              disabled={!canIncrease}
              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-600 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              title="글씨 확대"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

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
      <main className="flex-1 overflow-hidden bg-gray-50" style={{ zoom: scale }}>
        <HerbalTaskList
          tasks={tasks}
          loading={loading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onFirstVisitClick={handleFirstVisitClick}
          onSetupClick={handleSetupClick}
          onCallComplete={handleCallComplete}
          onEventBenefitSend={handleEventBenefitSend}
        />
      </main>

      {/* Modals */}
      {firstVisitTask && (
        <FirstVisitModal
          task={firstVisitTask}
          onClose={handleModalClose}
          onSend={handleFirstVisitSend}
        />
      )}

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
