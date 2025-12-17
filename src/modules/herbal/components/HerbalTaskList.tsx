/**
 * 복약관리 가상과제 목록
 */

import React from 'react';
import type { HerbalTask, HerbalTasksResponse } from '../types';

interface HerbalTaskListProps {
  tasks: HerbalTasksResponse | null;
  loading: boolean;
  activeTab: 'setup' | 'calls' | 'events' | 'followup';
  onTabChange: (tab: 'setup' | 'calls' | 'events' | 'followup') => void;
  onSetupClick: (task: HerbalTask) => void;
  onCallComplete: (task: HerbalTask) => void;
  onEventBenefitSend: (task: HerbalTask) => void;
}

const HerbalTaskList: React.FC<HerbalTaskListProps> = ({
  tasks,
  loading,
  activeTab,
  onTabChange,
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

  const tabs = [
    { key: 'setup', label: '신규 설정', count: tasks.summary.setup_count, icon: 'fa-plus-circle', color: 'text-blue-500' },
    { key: 'calls', label: '콜 예정', count: tasks.summary.calls_count, icon: 'fa-phone', color: 'text-green-500' },
    { key: 'events', label: '이벤트', count: tasks.summary.benefits_count, icon: 'fa-gift', color: 'text-purple-500' },
    { key: 'followup', label: '사후관리', count: tasks.summary.followup_count, icon: 'fa-user-clock', color: 'text-orange-500' }
  ] as const;

  const getCurrentTasks = (): HerbalTask[] => {
    switch (activeTab) {
      case 'setup': return tasks.herbal_setup;
      case 'calls': return tasks.calls;
      case 'events': return tasks.event_benefits;
      case 'followup': return tasks.followup;
      default: return [];
    }
  };

  const currentTasks = getCurrentTasks();

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
        {currentTasks.length === 0 ? (
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
                onSetupClick={onSetupClick}
                onCallComplete={onCallComplete}
                onEventBenefitSend={onEventBenefitSend}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: HerbalTask;
  onSetupClick: (task: HerbalTask) => void;
  onCallComplete: (task: HerbalTask) => void;
  onEventBenefitSend: (task: HerbalTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
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

export default HerbalTaskList;
