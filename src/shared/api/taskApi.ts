/**
 * 의료진 할일 API
 */

import { supabase } from '@shared/lib/supabase';
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
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      treatment_record_id: input.treatment_record_id || null,
      patient_id: input.patient_id,
      task_type: input.task_type,
      title: input.title,
      description: input.description || null,
      assigned_to: input.assigned_to || null,
      assigned_role: input.assigned_role || 'doctor',
      status: 'pending',
      priority: input.priority || 'normal',
      due_date: input.due_date || null,
      trigger_service: input.trigger_service || null,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 할일 생성 오류:', error);
    throw error;
  }

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
      dueDate = date.toISOString().split('T')[0];
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
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('trigger_service', triggerService)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('❌ 할일 템플릿 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTaskTemplate);
}

/**
 * 오늘의 할일 조회
 */
export async function fetchTodayTasks(assignedTo?: string): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      patients (name, chart_number),
      treatment_records (treatment_date, doctor_name)
    `)
    .in('status', ['pending', 'in_progress'])
    .or(`due_date.is.null,due_date.lte.${new Date().toISOString().split('T')[0]}`)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ 오늘의 할일 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTaskWithRelations);
}

/**
 * 담당자별 할일 조회
 */
export async function fetchTasksByAssignee(assignedTo: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      patients (name, chart_number),
      treatment_records (treatment_date, doctor_name)
    `)
    .eq('assigned_to', assignedTo)
    .in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ 담당자별 할일 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTaskWithRelations);
}

/**
 * 환자별 할일 조회
 */
export async function fetchTasksByPatient(patientId: number): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      patients (name, chart_number),
      treatment_records (treatment_date, doctor_name)
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 환자별 할일 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTaskWithRelations);
}

/**
 * 진료내역별 할일 조회
 */
export async function fetchTasksByTreatmentRecord(treatmentRecordId: number): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      patients (name, chart_number)
    `)
    .eq('treatment_record_id', treatmentRecordId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ 진료내역별 할일 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapTaskWithRelations);
}

/**
 * 할일 상태 변경
 */
export async function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  completedBy?: string
): Promise<void> {
  const updateData: any = { status };

  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    if (completedBy) {
      updateData.completed_by = completedBy;
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId);

  if (error) {
    console.error('❌ 할일 상태 변경 오류:', error);
    throw error;
  }
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
  const { error } = await supabase
    .from('tasks')
    .update({ assigned_to: assignedTo })
    .eq('id', taskId);

  if (error) {
    console.error('❌ 할일 담당자 변경 오류:', error);
    throw error;
  }
}

/**
 * 할일 우선순위 변경
 */
export async function updateTaskPriority(taskId: number, priority: TaskPriority): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ priority })
    .eq('id', taskId);

  if (error) {
    console.error('❌ 할일 우선순위 변경 오류:', error);
    throw error;
  }
}

/**
 * 할일 삭제
 */
export async function deleteTask(taskId: number): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('❌ 할일 삭제 오류:', error);
    throw error;
  }
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
  const today = new Date().toISOString().split('T')[0];

  let baseQuery = supabase.from('tasks').select('status, due_date, completed_at', { count: 'exact' });

  if (assignedTo) {
    baseQuery = baseQuery.eq('assigned_to', assignedTo);
  }

  // 대기 중
  const { count: pending } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq(assignedTo ? 'assigned_to' : 'id', assignedTo || undefined as any);

  // 진행 중
  const { count: inProgress } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_progress');

  // 오늘 완료
  const { count: completedToday } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`);

  // 기한 초과
  const { count: overdue } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', today);

  return {
    pending: pending || 0,
    in_progress: inProgress || 0,
    completed_today: completedToday || 0,
    overdue: overdue || 0,
  };
}

// =====================================================
// 매핑 헬퍼 함수
// =====================================================

function mapTask(data: any): Task {
  return {
    id: data.id,
    treatment_record_id: data.treatment_record_id,
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
    trigger_service: data.trigger_service,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function mapTaskWithRelations(data: any): Task {
  const task = mapTask(data);

  if (data.patients) {
    task.patient_name = data.patients.name;
    task.patient_chart_number = data.patients.chart_number;
  }

  if (data.treatment_records) {
    task.treatment_date = data.treatment_records.treatment_date;
    task.treatment_doctor = data.treatment_records.doctor_name;
  }

  return task;
}

function mapTaskTemplate(data: any): TaskTemplate {
  return {
    id: data.id,
    trigger_service: data.trigger_service,
    task_type: data.task_type,
    title_template: data.title_template,
    description_template: data.description_template,
    default_assigned_role: data.default_assigned_role,
    default_priority: data.default_priority,
    due_days_offset: data.due_days_offset,
    display_order: data.display_order,
    is_active: data.is_active,
    created_at: data.created_at,
  };
}
