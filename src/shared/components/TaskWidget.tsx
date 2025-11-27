/**
 * 할일 위젯 컴포넌트
 * 사이드바 또는 대시보드용 작은 할일 목록
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as taskApi from '@shared/api/taskApi';
import type { Task, TaskPriority } from '@shared/types/task';
import { PRIORITY_LABELS } from '@shared/types/task';

interface TaskWidgetProps {
  assignedTo?: string;
  maxItems?: number;
  title?: string;
  onViewAll?: () => void;
}

const TaskWidget: React.FC<TaskWidgetProps> = ({
  assignedTo,
  maxItems = 5,
  title = '오늘의 할일',
  onViewAll,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskApi.fetchTodayTasks(assignedTo);
      setTasks(data.slice(0, maxItems));
      setPendingCount(data.length);
    } catch (error) {
      console.error('할일 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [assignedTo, maxItems]);

  useEffect(() => {
    loadTasks();
    // 30초마다 자동 새로고침
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleComplete = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await taskApi.completeTask(taskId, assignedTo);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('할일 완료 오류:', error);
    }
  };

  const getPriorityDot = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            전체 보기
          </button>
        )}
      </div>

      {/* 할일 목록 */}
      <div className="divide-y">
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <div className="text-2xl mb-1">✓</div>
            <div className="text-sm">완료!</div>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className={`px-4 py-2 flex items-center gap-3 hover:bg-gray-50 ${
                task.priority === 'urgent' ? 'bg-red-50' : ''
              }`}
            >
              {/* 완료 버튼 */}
              <button
                onClick={(e) => handleComplete(task.id, e)}
                className="w-4 h-4 rounded border border-gray-300 hover:border-green-500 hover:bg-green-100 flex-shrink-0"
                title="완료"
              />

              {/* 우선순위 표시 */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {task.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {task.patient_name}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 더 많은 항목 표시 */}
      {pendingCount > maxItems && (
        <div className="px-4 py-2 border-t text-center">
          <button
            onClick={onViewAll}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            +{pendingCount - maxItems}개 더 보기
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskWidget;
