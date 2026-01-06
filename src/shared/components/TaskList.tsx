/**
 * 할일 목록 컴포넌트
 * 의료진용 할일 관리 UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as taskApi from '@shared/api/taskApi';
import { getCurrentDate } from '@shared/lib/postgres';
import type { Task, TaskStatus, TaskPriority } from '@shared/types/task';
import { TASK_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@shared/types/task';

interface TaskListProps {
  assignedTo?: string;  // 특정 담당자 필터
  showCompleted?: boolean;
  onTaskClick?: (task: Task) => void;
  compact?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({
  assignedTo,
  showCompleted = false,
  onTaskClick,
  compact = false,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    pending: number;
    in_progress: number;
    completed_today: number;
    overdue: number;
  } | null>(null);

  // 할일 목록 로드
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskApi.fetchTodayTasks(assignedTo);
      setTasks(data);

      const statsData = await taskApi.fetchTaskStats(assignedTo);
      setStats(statsData);
    } catch (error) {
      console.error('할일 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [assignedTo]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 할일 완료
  const handleComplete = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await taskApi.completeTask(taskId, assignedTo);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (stats) {
        setStats({
          ...stats,
          pending: Math.max(0, stats.pending - 1),
          completed_today: stats.completed_today + 1,
        });
      }
    } catch (error) {
      console.error('할일 완료 오류:', error);
    }
  };

  // 우선순위 색상
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // 우선순위 배지
  const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(priority)}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        할일 로딩 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 통계 헤더 */}
      {!compact && stats && (
        <div className="p-3 bg-gray-50 border-b grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.pending}</div>
            <div className="text-xs text-gray-500">대기</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">{stats.in_progress}</div>
            <div className="text-xs text-gray-500">진행중</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{stats.completed_today}</div>
            <div className="text-xs text-gray-500">오늘 완료</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
            <div className="text-xs text-gray-500">기한초과</div>
          </div>
        </div>
      )}

      {/* 할일 목록 */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">✓</div>
            <div>모든 할일을 완료했습니다!</div>
          </div>
        ) : (
          <ul className="divide-y">
            {tasks.map(task => (
              <li
                key={task.id}
                className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  task.priority === 'urgent' ? 'bg-red-50' : ''
                }`}
                onClick={() => onTaskClick?.(task)}
              >
                <div className="flex items-start gap-3">
                  {/* 완료 체크박스 */}
                  <button
                    onClick={(e) => handleComplete(task.id, e)}
                    className="mt-1 w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors"
                    title="완료"
                  >
                    <span className="text-transparent hover:text-green-500">✓</span>
                  </button>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-xs text-gray-400">
                        {TASK_TYPE_LABELS[task.task_type]}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 truncate">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{task.patient_name}</span>
                      {task.patient_chart_number && (
                        <span className="text-gray-400">({task.patient_chart_number})</span>
                      )}
                      {task.due_date && (
                        <span className={task.due_date < getCurrentDate() ? 'text-red-500' : ''}>
                          마감: {task.due_date}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 시간 */}
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(task.created_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className="p-2 border-t bg-gray-50">
        <button
          onClick={loadTasks}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
          새로고침
        </button>
      </div>
    </div>
  );
};

export default TaskList;
