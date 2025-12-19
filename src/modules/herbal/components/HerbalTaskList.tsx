/**
 * 복약관리 가상과제 목록
 */

import React from 'react';
import type { HerbalTask, HerbalTasksResponse, HerbalPurchase } from '../types';
import { HERBAL_TYPE_LABELS } from '../types';
import type { TabType } from '../HerbalApp';

interface HerbalTaskListProps {
  tasks: HerbalTasksResponse | null;
  loading: boolean;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onFirstVisitClick: (task: HerbalTask) => void;
  onSetupClick: (task: HerbalTask) => void;
  onCallComplete: (task: HerbalTask) => void;
  onEventBenefitSend: (task: HerbalTask) => void;
}

const HerbalTaskList: React.FC<HerbalTaskListProps> = ({
  tasks,
  loading,
  activeTab,
  onTabChange,
  onFirstVisitClick,
  onSetupClick,
  onCallComplete,
  onEventBenefitSend
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!tasks) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; count: number; icon: string; color: string }[] = [
    { key: 'dashboard', label: '대시보드', count: tasks.summary.total, icon: 'fa-th-large', color: 'text-gray-600' },
    { key: 'firstvisit', label: '초진콜', count: tasks.summary.first_visit_count, icon: 'fa-user-plus', color: 'text-pink-500' },
    { key: 'setup', label: '신규 설정', count: tasks.summary.setup_count, icon: 'fa-plus-circle', color: 'text-blue-500' },
    { key: 'active', label: '진행현황', count: tasks.summary.active_count, icon: 'fa-spinner', color: 'text-teal-500' },
    { key: 'calls', label: '복약콜', count: tasks.summary.calls_count, icon: 'fa-phone', color: 'text-green-500' },
    { key: 'events', label: '이벤트', count: tasks.summary.benefits_count, icon: 'fa-gift', color: 'text-purple-500' },
    { key: 'followup', label: '사후관리', count: tasks.summary.followup_count, icon: 'fa-user-clock', color: 'text-orange-500' }
  ];

  const getCurrentTasks = (): HerbalTask[] => {
    switch (activeTab) {
      case 'dashboard': return []; // dashboard uses combined view
      case 'firstvisit': return tasks.first_visits;
      case 'setup': return tasks.herbal_setup;
      case 'active': return []; // active tab uses different data
      case 'calls': return tasks.calls;
      case 'events': return tasks.event_benefits;
      case 'followup': return tasks.followup;
      default: return [];
    }
  };

  const currentTasks = getCurrentTasks();
  const isDashboardTab = activeTab === 'dashboard';
  const isActiveTab = activeTab === 'active';

  // 대시보드용 모든 과제 합치기
  const getAllTasks = (): HerbalTask[] => {
    return [
      ...tasks.first_visits,
      ...tasks.herbal_setup,
      ...tasks.calls,
      ...tasks.event_benefits,
      ...tasks.followup
    ];
  };

  return (
    <div className="h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex border-b bg-white">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-green-600 border-b-2 border-green-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`fas ${tab.icon} mr-2 ${tab.color}`}></i>
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.key
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 과제 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {isDashboardTab ? (
          // 대시보드 탭 - 오늘 해야할 모든 과제
          <DashboardView
            tasks={tasks}
            onFirstVisitClick={onFirstVisitClick}
            onSetupClick={onSetupClick}
            onCallComplete={onCallComplete}
            onEventBenefitSend={onEventBenefitSend}
          />
        ) : isActiveTab ? (
          // 진행현황 탭 - 활성 복약관리 목록
          tasks.active_purchases.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <i className="fas fa-inbox text-4xl mb-3"></i>
                <p>진행 중인 복약관리가 없습니다</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.active_purchases.map((purchase) => (
                <ActivePurchaseCard key={purchase.id} purchase={purchase} />
              ))}
            </div>
          )
        ) : (
          // 기존 과제 탭
          currentTasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <i className="fas fa-check-circle text-4xl mb-3"></i>
                <p>처리할 과제가 없습니다</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentTasks.map((task, index) => (
                <TaskCard
                  key={`${task.task_type}-${index}`}
                  task={task}
                  onFirstVisitClick={onFirstVisitClick}
                  onSetupClick={onSetupClick}
                  onCallComplete={onCallComplete}
                  onEventBenefitSend={onEventBenefitSend}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

/**
 * 대시보드 뷰 - 오늘 해야할 과제를 카테고리별로 표시
 */
interface DashboardViewProps {
  tasks: HerbalTasksResponse;
  onFirstVisitClick: (task: HerbalTask) => void;
  onSetupClick: (task: HerbalTask) => void;
  onCallComplete: (task: HerbalTask) => void;
  onEventBenefitSend: (task: HerbalTask) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  onFirstVisitClick,
  onSetupClick,
  onCallComplete,
  onEventBenefitSend
}) => {
  const totalTasks = tasks.summary.total;

  if (totalTasks === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-check text-3xl text-green-500"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">모든 과제 완료!</h3>
          <p className="text-sm text-gray-500">오늘 처리할 과제가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 모든 과제를 하나의 배열로 합치기 (카테고리 정보 포함)
  const allTasks: { task: HerbalTask; category: string; color: string; icon: string; actionLabel: string; onAction: (task: HerbalTask) => void }[] = [
    ...tasks.first_visits.map(task => ({
      task,
      category: '초진',
      color: 'pink',
      icon: 'fa-user-plus',
      actionLabel: '메시지',
      onAction: onFirstVisitClick
    })),
    ...tasks.herbal_setup.map(task => ({
      task,
      category: '설정',
      color: 'blue',
      icon: 'fa-plus-circle',
      actionLabel: '설정',
      onAction: onSetupClick
    })),
    ...tasks.calls.map(task => ({
      task,
      category: '복약콜',
      color: 'green',
      icon: 'fa-phone',
      actionLabel: '완료',
      onAction: onCallComplete
    })),
    ...tasks.event_benefits.map(task => ({
      task,
      category: '이벤트',
      color: 'purple',
      icon: 'fa-gift',
      actionLabel: '발송',
      onAction: onEventBenefitSend
    })),
    ...tasks.followup.map(task => ({
      task,
      category: '사후',
      color: 'orange',
      icon: 'fa-user-clock',
      actionLabel: '연락',
      onAction: onCallComplete
    }))
  ];

  return (
    <div className="space-y-4">
      {/* 요약 헤더 */}
      <div className="bg-white rounded-lg shadow-sm px-4 py-3 border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <i className="fas fa-tasks text-green-600"></i>
          </div>
          <div>
            <h2 className="font-bold text-gray-800">오늘의 과제</h2>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{totalTasks}</div>
          <div className="text-xs text-gray-500">처리 필요</div>
        </div>
      </div>

      {/* 그리드 카드 배열 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {allTasks.map((item, index) => (
          <DashboardTaskCard
            key={`task-${index}`}
            task={item.task}
            category={item.category}
            color={item.color}
            icon={item.icon}
            actionLabel={item.actionLabel}
            onAction={() => item.onAction(item.task)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * 대시보드용 컴팩트 과제 카드
 */
interface DashboardTaskCardProps {
  task: HerbalTask;
  category: string;
  color: string;
  icon: string;
  actionLabel: string;
  onAction: () => void;
}

const DashboardTaskCard: React.FC<DashboardTaskCardProps> = ({
  task,
  category,
  color,
  icon,
  actionLabel,
  onAction
}) => {
  const colorStyles: Record<string, { bg: string; border: string; badge: string; button: string }> = {
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', badge: 'bg-pink-500', button: 'bg-pink-500 hover:bg-pink-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500', button: 'bg-blue-500 hover:bg-blue-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-500', button: 'bg-green-500 hover:bg-green-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-500', button: 'bg-purple-500 hover:bg-purple-600' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', button: 'bg-orange-500 hover:bg-orange-600' }
  };

  const styles = colorStyles[color] || colorStyles.green;

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-2.5 flex flex-col`}>
      {/* 카테고리 뱃지 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`${styles.badge} text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1`}>
          <i className={`fas ${icon}`}></i>
          {category}
        </span>
        {task.patient.phone && (
          <a
            href={`tel:${task.patient.phone}`}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-white/80 text-gray-500 hover:bg-white transition-colors"
            title="전화걸기"
          >
            <i className="fas fa-phone text-[9px]"></i>
          </a>
        )}
      </div>

      {/* 환자 정보 */}
      <div className="flex-1 min-h-0">
        <div className="font-semibold text-sm text-gray-800 truncate">{task.patient.name}</div>
        <div className="text-[10px] text-gray-500 truncate">{task.patient.chart_number}</div>
      </div>

      {/* 액션 버튼 */}
      <button
        onClick={onAction}
        className={`${styles.button} w-full mt-2 py-1.5 text-white text-xs font-medium rounded transition-colors`}
      >
        {actionLabel}
      </button>
    </div>
  );
};

interface TaskCardProps {
  task: HerbalTask;
  onFirstVisitClick: (task: HerbalTask) => void;
  onSetupClick: (task: HerbalTask) => void;
  onCallComplete: (task: HerbalTask) => void;
  onEventBenefitSend: (task: HerbalTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onFirstVisitClick,
  onSetupClick,
  onCallComplete,
  onEventBenefitSend
}) => {
  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high': return 'border-l-red-500';
      case 'normal': return 'border-l-yellow-500';
      case 'low': return 'border-l-gray-400';
      default: return 'border-l-gray-300';
    }
  };

  const getActionButton = () => {
    if (task.task_type === 'first_visit') {
      return (
        <button
          onClick={() => onFirstVisitClick(task)}
          className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 transition-colors"
        >
          <i className="fas fa-comment mr-1"></i>
          메시지
        </button>
      );
    }

    if (task.task_type === 'herbal_setup') {
      return (
        <button
          onClick={() => onSetupClick(task)}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          <i className="fas fa-cog mr-1"></i>
          설정
        </button>
      );
    }

    if (task.task_type.startsWith('call_')) {
      return (
        <button
          onClick={() => onCallComplete(task)}
          className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          <i className="fas fa-check mr-1"></i>
          완료
        </button>
      );
    }

    if (task.task_type === 'event_benefit') {
      return (
        <button
          onClick={() => onEventBenefitSend(task)}
          className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors"
        >
          <i className="fas fa-paper-plane mr-1"></i>
          발송
        </button>
      );
    }

    if (task.task_type === 'followup') {
      return (
        <button
          onClick={() => onCallComplete(task)}
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          <i className="fas fa-phone mr-1"></i>
          연락
        </button>
      );
    }

    return null;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${getPriorityColor()} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* 환자 정보 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {task.patient.chart_number}
            </span>
            <h3 className="font-semibold text-gray-800 truncate">
              {task.patient.name}
            </h3>
          </div>

          {/* 과제 설명 */}
          <p className="text-sm text-gray-600 mb-2">
            {task.task_description}
          </p>

          {/* 연락처 */}
          {task.patient.phone && (
            <div className="flex items-center text-xs text-gray-500">
              <i className="fas fa-phone mr-1"></i>
              <a
                href={`tel:${task.patient.phone}`}
                className="hover:text-green-600 hover:underline"
              >
                {task.patient.phone}
              </a>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="ml-4 flex-shrink-0">
          {getActionButton()}
        </div>
      </div>
    </div>
  );
};

/**
 * 진행현황 카드 - 활성 복약관리 표시
 */
interface ActivePurchaseCardProps {
  purchase: HerbalPurchase;
}

const ActivePurchaseCard: React.FC<ActivePurchaseCardProps> = ({ purchase }) => {
  const completedCount = purchase.total_count - purchase.remaining_count;
  const progressPercent = Math.round((completedCount / purchase.total_count) * 100);

  // 진행 상태에 따른 색상
  const getProgressColor = () => {
    if (progressPercent >= 80) return 'bg-green-500';
    if (progressPercent >= 50) return 'bg-blue-500';
    if (progressPercent >= 30) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // 한약 종류 뱃지 색상
  const getTypeBadgeColor = () => {
    switch (purchase.herbal_type) {
      case 'tang': return 'bg-amber-100 text-amber-700';
      case 'hwan': return 'bg-red-100 text-red-700';
      case 'go': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 예상 종료일까지 남은 일수
  const getDaysRemaining = () => {
    if (!purchase.expected_end_date) return null;
    const today = new Date();
    const endDate = new Date(purchase.expected_end_date);
    const diff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            {purchase.patient_chart_number}
          </span>
          <h3 className="font-semibold text-gray-800">
            {purchase.patient_name}
          </h3>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor()}`}>
          {HERBAL_TYPE_LABELS[purchase.herbal_type]}
        </span>
      </div>

      {/* 한약 정보 */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 font-medium">
          {purchase.herbal_name || '한약'}
          {purchase.sequence_code && <span className="text-gray-500 ml-1">({purchase.sequence_code})</span>}
        </p>
        {purchase.start_date && (
          <p className="text-xs text-gray-500 mt-1">
            시작일: {purchase.start_date}
            {purchase.expected_end_date && <span> → 종료 예정: {purchase.expected_end_date}</span>}
          </p>
        )}
      </div>

      {/* 진행률 바 */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>복용 진행률</span>
          <span className="font-medium">{completedCount} / {purchase.total_count}회 ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between text-xs">
        <div className="text-gray-500">
          잔여: <span className="font-medium text-gray-700">{purchase.remaining_count}회</span>
          {purchase.dose_per_day && <span className="ml-2">({purchase.dose_per_day}회/일)</span>}
        </div>
        {daysRemaining !== null && (
          <div className={`font-medium ${daysRemaining <= 3 ? 'text-orange-600' : 'text-gray-600'}`}>
            {daysRemaining > 0 ? (
              <>
                <i className="fas fa-calendar-alt mr-1"></i>
                D-{daysRemaining}
              </>
            ) : daysRemaining === 0 ? (
              <>
                <i className="fas fa-flag-checkered mr-1"></i>
                오늘 종료
              </>
            ) : (
              <>
                <i className="fas fa-exclamation-circle mr-1"></i>
                {Math.abs(daysRemaining)}일 초과
              </>
            )}
          </div>
        )}
      </div>

      {/* 연락처 */}
      {purchase.patient_phone && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center text-xs text-gray-500">
          <i className="fas fa-phone mr-1"></i>
          <a
            href={`tel:${purchase.patient_phone}`}
            className="hover:text-green-600 hover:underline"
          >
            {purchase.patient_phone}
          </a>
        </div>
      )}
    </div>
  );
};

export default HerbalTaskList;
