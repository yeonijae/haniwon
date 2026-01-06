/**
 * 의료진 할일 API
 */

import { query, queryOne, execute, insert, escapeString, getCurrentDate, getCurrentTimestamp } from '@shared/lib/postgres';
import type {
  Task,
  TaskTemplate,
  CreateTaskInput,
  TaskStatus,
  TaskPriority,
} from '@shared/types/task';
import type { ServiceType } from '@shared/types/treatmentRecord';

/**
 * 할일 생성
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const now = getCurrentTimestamp();

  const id = await insert(`
    INSERT INTO tasks (title, description, task_type, status, priority, assigned_to, due_date, patient_id, related_id, related_type, created_at, updated_at)
    VALUES (${escapeString(input.title)}, ${escapeString(input.description || '')}, ${escapeString(input.task_type || '')},
            'pending', ${escapeString(input.priority || 'normal')}, ${escapeString(input.assigned_to || '')},
            ${escapeString(input.due_date || '')}, ${input.patient_id || 'NULL'},
            ${input.treatment_record_id || 'NULL'}, ${escapeString(input.trigger_service || '')},
            ${escapeString(now)}, ${escapeString(now)})
  `);

  const data = await queryOne<any>(`SELECT * FROM tasks WHERE id = ${id}`);
  console.log('✅ 할일 생성 완료:', data.title);
  return mapTask(data);
}

/**
 * 서비스 기반 자동 할일 생성
 */
export async function createTasksFromService(
  patientId: number,
  patientName: string,
  service: ServiceType,
  options?: {
    treatmentRecordId?: number;
    assignedTo?: string;
  }
): Promise<Task[]> {
  // 해당 서비스의 템플릿 조회
  const templates = await fetchTaskTemplates(service);

  if (templates.length === 0) {
    console.log(`[할일] ${service}에 대한 템플릿 없음`);
    return [];
  }

  const createdTasks: Task[] = [];

  for (const template of templates) {
    // 템플릿 변수 치환
    const title = template.title_template.replace('{patient_name}', patientName);
    const description = template.description_template?.replace('{patient_name}', patientName);

    // 마감일 계산
    let dueDate: string | undefined;
    if (template.due_days_offset >= 0) {
      const date = new Date();
      date.setDate(date.getDate() + template.due_days_offset);
      dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    const task = await createTask({
      treatment_record_id: options?.treatmentRecordId,
      patient_id: patientId,
      task_type: template.task_type,
      title,
      description,
      assigned_to: options?.assignedTo,
      assigned_role: template.default_assigned_role,
      priority: template.default_priority,
      due_date: dueDate,
      trigger_service: service,
    });

    createdTasks.push(task);
  }

  console.log(`✅ [할일] ${service}로 인해 ${createdTasks.length}개 할일 생성`);
  return createdTasks;
}

/**
 * 할일 템플릿 조회
 */
export async function fetchTaskTemplates(triggerService: string): Promise<TaskTemplate[]> {
  const data = await query<any>(`
    SELECT * FROM task_templates
    WHERE is_active = 1
    ORDER BY name
  `);

  return data.map(mapTaskTemplate);
}

/**
 * 오늘의 할일 조회
 */
export async function fetchTodayTasks(assignedTo?: string): Promise<Task[]> {
  const today = getCurrentDate();

  let sql = `
    SELECT t.*, p.name as patient_name, p.chart_number as patient_chart_number
    FROM tasks t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.status IN ('pending', 'in_progress')
    AND (t.due_date IS NULL OR t.due_date <= ${escapeString(today)})
  `;

  if (assignedTo) {
    sql += ` AND t.assigned_to = ${escapeString(assignedTo)}`;
  }

  sql += ` ORDER BY t.priority ASC, t.created_at ASC`;

  const data = await query<any>(sql);
  return data.map(mapTaskWithRelations);
}

/**
 * 담당자별 할일 조회
 */
export async function fetchTasksByAssignee(assignedTo: string): Promise<Task[]> {
  const data = await query<any>(`
    SELECT t.*, p.name as patient_name, p.chart_number as patient_chart_number
    FROM tasks t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.assigned_to = ${escapeString(assignedTo)}
    AND t.status IN ('pending', 'in_progress')
    ORDER BY t.priority ASC, t.created_at ASC
  `);

  return data.map(mapTaskWithRelations);
}

/**
 * 환자별 할일 조회
 */
export async function fetchTasksByPatient(patientId: number): Promise<Task[]> {
  const data = await query<any>(`
    SELECT t.*, p.name as patient_name, p.chart_number as patient_chart_number
    FROM tasks t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.patient_id = ${patientId}
    ORDER BY t.created_at DESC
  `);

  return data.map(mapTaskWithRelations);
}

/**
 * 진료내역별 할일 조회
 */
export async function fetchTasksByTreatmentRecord(treatmentRecordId: number): Promise<Task[]> {
  const data = await query<any>(`
    SELECT t.*, p.name as patient_name, p.chart_number as patient_chart_number
    FROM tasks t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.related_id = ${treatmentRecordId}
    ORDER BY t.created_at ASC
  `);

  return data.map(mapTaskWithRelations);
}

/**
 * 할일 상태 변경
 */
export async function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  completedBy?: string
): Promise<void> {
  const now = getCurrentTimestamp();
  let sql = `UPDATE tasks SET status = ${escapeString(status)}, updated_at = ${escapeString(now)}`;

  if (status === 'completed') {
    sql += `, completed_at = ${escapeString(now)}`;
  }

  sql += ` WHERE id = ${taskId}`;

  await execute(sql);
}

/**
 * 할일 완료
 */
export async function completeTask(taskId: number, completedBy?: string): Promise<void> {
  await updateTaskStatus(taskId, 'completed', completedBy);
  console.log(`✅ 할일 완료 (id: ${taskId})`);
}

/**
 * 할일 취소
 */
export async function cancelTask(taskId: number): Promise<void> {
  await updateTaskStatus(taskId, 'canceled');
}

/**
 * 할일 담당자 변경
 */
export async function assignTask(taskId: number, assignedTo: string): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`UPDATE tasks SET assigned_to = ${escapeString(assignedTo)}, updated_at = ${escapeString(now)} WHERE id = ${taskId}`);
}

/**
 * 할일 우선순위 변경
 */
export async function updateTaskPriority(taskId: number, priority: TaskPriority): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`UPDATE tasks SET priority = ${priority}, updated_at = ${escapeString(now)} WHERE id = ${taskId}`);
}

/**
 * 할일 삭제
 */
export async function deleteTask(taskId: number): Promise<void> {
  await execute(`DELETE FROM tasks WHERE id = ${taskId}`);
}

/**
 * 할일 통계
 */
export async function fetchTaskStats(assignedTo?: string): Promise<{
  pending: number;
  in_progress: number;
  completed_today: number;
  overdue: number;
}> {
  const today = getCurrentDate();

  const pendingData = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM tasks WHERE status = 'pending'`);
  const inProgressData = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM tasks WHERE status = 'in_progress'`);
  const completedTodayData = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM tasks WHERE status = 'completed' AND date(completed_at) = ${escapeString(today)}
  `);
  const overdueData = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('pending', 'in_progress') AND due_date < ${escapeString(today)}
  `);

  return {
    pending: pendingData?.cnt || 0,
    in_progress: inProgressData?.cnt || 0,
    completed_today: completedTodayData?.cnt || 0,
    overdue: overdueData?.cnt || 0,
  };
}

// =====================================================
// 매핑 헬퍼 함수
// =====================================================

function mapTask(data: any): Task {
  return {
    id: data.id,
    treatment_record_id: data.related_id,
    patient_id: data.patient_id,
    task_type: data.task_type,
    title: data.title,
    description: data.description,
    assigned_to: data.assigned_to,
    assigned_role: data.assigned_role,
    status: data.status,
    priority: data.priority,
    due_date: data.due_date,
    completed_at: data.completed_at,
    completed_by: data.completed_by,
    trigger_service: data.related_type,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function mapTaskWithRelations(data: any): Task {
  const task = mapTask(data);

  if (data.patient_name) {
    task.patient_name = data.patient_name;
    task.patient_chart_number = data.patient_chart_number;
  }

  return task;
}

function mapTaskTemplate(data: any): TaskTemplate {
  return {
    id: data.id,
    trigger_service: '',
    task_type: data.task_type || '',
    title_template: data.name || '',
    description_template: data.description,
    default_assigned_role: data.default_assigned_to || 'doctor',
    default_priority: data.default_priority || 0,
    due_days_offset: 0,
    display_order: 0,
    is_active: data.is_active === 1,
    created_at: data.created_at,
  };
}
