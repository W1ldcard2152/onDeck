import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskWithDetails, Item } from '@/lib/types'
import { nowISO } from '@/lib/timezone'

// ---- Types ----

export interface CreateTaskInput {
  userId: string
  title: string
  description?: string | null
  due_date?: string | null
  assigned_date?: string | null
  reminder_time?: string | null
  daily_context?: string[] | null
  status?: string
  priority?: string
  habit_id?: string | null
  project_id?: string | null
  checklist_template_id?: string | null
  is_project_converted?: boolean
  sort_order?: number | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  due_date?: string | null
  assigned_date?: string | null
  reminder_time?: string | null
  daily_context?: string[] | null
  status?: string
  priority?: string
  sort_order?: number | null
  checklist_template_id?: string | null
}

export type TaskRow = TaskWithDetails

// ---- Internal helpers ----

function serializeDailyContext(value: string[] | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return JSON.stringify(value)
}

async function fetchTaskWithDetails(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<TaskRow> {
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()
  if (taskErr) throw taskErr
  if (!task) throw new Error(`Task ${taskId} not found after mutation`)

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()
  if (itemErr) throw itemErr
  if (!item) throw new Error(`Item ${taskId} not found after mutation`)

  return {
    id: task.id,
    assigned_date: task.assigned_date,
    due_date: task.due_date,
    reminder_time: task.reminder_time,
    status: task.status || 'on_deck',
    description: task.description,
    is_project_converted: task.is_project_converted || false,
    converted_project_id: task.converted_project_id,
    priority: task.priority || 'normal',
    project_id: task.project_id,
    habit_id: task.habit_id,
    daily_context: task.daily_context,
    sort_order: task.sort_order || 0,
    checklist_template_id: task.checklist_template_id || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    title: item.title,
    type: 'task',
    user_id: item.user_id,
    content: task.description,
    item: item as Item,
  }
}

// ---- Lifecycle ----

export async function createTask(
  supabase: SupabaseClient,
  input: CreateTaskInput
): Promise<TaskRow> {
  const now = nowISO()

  const { data: item, error: itemError } = await supabase
    .from('items')
    .insert({
      user_id: input.userId,
      title: input.title.trim(),
      item_type: 'task',
      is_archived: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (itemError) throw itemError
  if (!item) throw new Error('Failed to create item row for task')

  const taskRow: Record<string, any> = {
    id: item.id,
    status: input.status ?? 'on_deck',
    priority: input.priority ?? 'normal',
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    assigned_date: input.assigned_date ?? null,
    reminder_time: input.reminder_time ?? null,
    daily_context: serializeDailyContext(input.daily_context) ?? null,
    habit_id: input.habit_id ?? null,
    project_id: input.project_id ?? null,
    checklist_template_id: input.checklist_template_id ?? null,
    is_project_converted: input.is_project_converted ?? false,
  }
  if (input.sort_order !== undefined && input.sort_order !== null) {
    taskRow.sort_order = input.sort_order
  }

  const { error: taskError } = await supabase.from('tasks').insert(taskRow)

  if (taskError) {
    const { error: rollbackError } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id)
      .eq('user_id', input.userId)
    if (rollbackError) {
      console.error(
        '[taskService.createTask] rollback of orphaned items row failed — manual intervention needed',
        { itemId: item.id, taskError, rollbackError }
      )
      throw new Error(
        `createTask failed and rollback of items row ${item.id} also failed. Manual intervention needed.`
      )
    }
    throw taskError
  }

  return fetchTaskWithDetails(supabase, input.userId, item.id)
}

export async function deleteTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<void> {
  const { error: taskError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
  if (taskError) throw taskError

  const { error: itemError } = await supabase
    .from('items')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)
  if (itemError) throw itemError
}

export async function deleteTasks(
  supabase: SupabaseClient,
  userId: string,
  taskIds: string[]
): Promise<void> {
  if (taskIds.length === 0) return

  const errors: string[] = []

  // Sequential: tasks first, then items. If tasks → items has any FK, the parent
  // (items) must outlive the child (tasks). Even if tasks delete fails, still
  // attempt items and aggregate errors so the caller sees the full picture.
  const tasksRes = await supabase.from('tasks').delete().in('id', taskIds)
  if (tasksRes.error) {
    errors.push(`tasks delete failed: ${tasksRes.error.message}`)
  }

  const itemsRes = await supabase.from('items').delete().in('id', taskIds).eq('user_id', userId)
  if (itemsRes.error) {
    errors.push(`items delete failed: ${itemsRes.error.message}`)
  }

  if (errors.length > 0) {
    throw new Error(`deleteTasks(${taskIds.length} ids): ${errors.join('; ')}`)
  }
}

// ---- Field updates ----

export async function updateTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  updates: UpdateTaskInput
): Promise<TaskRow> {
  const now = nowISO()

  const taskPatch: Record<string, any> = {}
  if (updates.description !== undefined) taskPatch.description = updates.description
  if (updates.due_date !== undefined) taskPatch.due_date = updates.due_date
  if (updates.assigned_date !== undefined) taskPatch.assigned_date = updates.assigned_date
  if (updates.reminder_time !== undefined) taskPatch.reminder_time = updates.reminder_time
  if (updates.daily_context !== undefined) {
    taskPatch.daily_context = serializeDailyContext(updates.daily_context)
  }
  if (updates.status !== undefined) taskPatch.status = updates.status
  if (updates.priority !== undefined) taskPatch.priority = updates.priority
  if (updates.sort_order !== undefined) taskPatch.sort_order = updates.sort_order
  if (updates.checklist_template_id !== undefined) {
    taskPatch.checklist_template_id = updates.checklist_template_id
  }

  const itemPatch: Record<string, any> = { updated_at: now }
  if (updates.title !== undefined) itemPatch.title = updates.title.trim()

  const noChanges = Object.keys(taskPatch).length === 0 && updates.title === undefined
  if (noChanges) {
    return fetchTaskWithDetails(supabase, userId, taskId)
  }

  if (Object.keys(taskPatch).length > 0) {
    const { error: taskError } = await supabase
      .from('tasks')
      .update(taskPatch)
      .eq('id', taskId)
    if (taskError) throw taskError
  }

  const { error: itemError } = await supabase
    .from('items')
    .update(itemPatch)
    .eq('id', taskId)
    .eq('user_id', userId)
  if (itemError) throw itemError

  return fetchTaskWithDetails(supabase, userId, taskId)
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  status: string
): Promise<TaskRow> {
  return updateTask(supabase, userId, taskId, { status })
}

export async function updateTaskPriority(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  priority: string
): Promise<TaskRow> {
  return updateTask(supabase, userId, taskId, { priority })
}

// ---- Reordering ----

/**
 * Atomic-by-intent swap of sort_order between two tasks. Always operates on a pair.
 * Used for up/down arrow reordering in dashboard and TaskTable.
 *
 * Supabase JS client doesn't expose transactions, so we issue both updates via
 * Promise.all. If one update fails, the other may still have committed, leaving the
 * pair in an inconsistent ordering. Acceptable for now since both touch a single
 * integer column and the worst-case repair is one more user click. If this proves
 * problematic, replace with a Postgres function (RPC) in a follow-up migration.
 */
export async function swapTaskOrder(
  supabase: SupabaseClient,
  userId: string,
  taskA: { id: string; sort_order: number },
  taskB: { id: string; sort_order: number }
): Promise<void> {
  const [resA, resB] = await Promise.all([
    supabase
      .from('tasks')
      .update({ sort_order: taskB.sort_order })
      .eq('id', taskA.id),
    supabase
      .from('tasks')
      .update({ sort_order: taskA.sort_order })
      .eq('id', taskB.id),
  ])

  const errors: string[] = []
  if (resA.error) errors.push(`taskA (${taskA.id}): ${resA.error.message}`)
  if (resB.error) errors.push(`taskB (${taskB.id}): ${resB.error.message}`)
  if (errors.length > 0) {
    throw new Error(`swapTaskOrder failed: ${errors.join('; ')}`)
  }
}

// ---- Specialized bulk operations ----

/**
 * Update a single field across all incomplete tasks for a habit.
 * Used when a habit's checklist_template_id changes — propagates to all open
 * habit-generated tasks. Restricted to checklist_template_id; do not generalize.
 */
export async function updateHabitTasksField(
  supabase: SupabaseClient,
  userId: string,
  habitId: string,
  field: 'checklist_template_id',
  value: string | null
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ [field]: value })
    .eq('habit_id', habitId)
    .neq('status', 'completed')
  if (error) throw error
}

/**
 * Delete all incomplete habit tasks for a habit. Used by habit deletion,
 * habit deactivation, and "regenerate tasks" flows.
 */
export async function deleteIncompleteHabitTasks(
  supabase: SupabaseClient,
  userId: string,
  habitId: string
): Promise<void> {
  const { data: rows, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('habit_id', habitId)
    .neq('status', 'completed')
  if (findError) throw findError
  if (!rows || rows.length === 0) return

  await deleteTasks(supabase, userId, rows.map(r => r.id))
}

/**
 * Delete all non-completed tasks for a project. Used by project deletion
 * cascade and "put project on hold" cleanup.
 */
export async function deleteIncompleteProjectTasks(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  const { data: rows, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('project_id', projectId)
    .neq('status', 'completed')
  if (findError) throw findError
  if (!rows || rows.length === 0) return

  await deleteTasks(supabase, userId, rows.map(r => r.id))
}

// ---- Reads ----

/**
 * Count tasks that reference a given context UUID. Used for context-deletion guard.
 * daily_context is stored as a JSON-encoded string array, so this filters in-process
 * rather than via a SQL JSON operator.
 */
export async function countTasksByContext(
  supabase: SupabaseClient,
  userId: string,
  contextId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, daily_context')
    .not('daily_context', 'is', null)
  if (error) throw error
  if (!data) return 0

  let count = 0
  for (const row of data) {
    if (!row.daily_context) continue
    try {
      const ids = JSON.parse(row.daily_context)
      if (Array.isArray(ids) && ids.includes(contextId)) count++
    } catch {
      // Skip rows with malformed daily_context JSON
    }
  }
  return count
}
