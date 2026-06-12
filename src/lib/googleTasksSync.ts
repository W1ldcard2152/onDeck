import 'server-only'

// SERVER-ONLY: pulls/pushes against tasks.googleapis.com via the server-only
// googleTasksClient + googleAuth chain. Do not import from 'use client' files.
// Client code should call the /api/sync/* routes instead.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRow } from '@/lib/taskService'
import { getIntegration, updateSyncStatus } from '@/lib/integrations'
import { GoogleAuthError } from '@/lib/googleAuth'
import {
  getDefaultTaskListId,
  insertTask as googleInsertTask,
  updateTask as googleUpdateTask,
  deleteTask as googleDeleteTask,
  listTasks as googleListTasks,
  GoogleTasksApiError,
  type GoogleTask,
  type GoogleTaskInput,
} from '@/lib/googleTasksClient'

/**
 * IMPORTANT — DO NOT REFACTOR TO USE taskService:
 *
 * This module writes to `tasks` and `items` directly via supabase.from(...).
 * That is intentional. taskService.createTask / updateTask / deleteTask now
 * fire push triggers (pushTaskInBackground, pushPendingDeletionsInBackground)
 * after every local write. If pullTasks reconciled changes via taskService,
 * the trigger would push the just-pulled state back to Google, which would
 * then echo back via Google's updated timestamp on the next pull, and so on.
 * The sync layer breaks this loop by managing its own DB writes.
 *
 * The TaskRow type alias is imported only for its type — no runtime dependency
 * on taskService. (Verifiable: this file has zero runtime imports of taskService.)
 */

const MAX_PAGES = 10

// ---- Sync status helpers (Phase 4 A2) ----
//
// The indicator UI is only as honest as user_integrations.sync_status, so
// every sync path (pull, push, deletion drain) must end by writing it:
// success → 'ok', transient failure → 'failed', dead refresh token →
// 'auth_expired'. last_synced_at doubles as the pull watermark, so only
// pullTasks may advance it; push success writes 'ok' with
// touchLastSyncedAt: false.

const MAX_LAST_ERROR_LENGTH = 500

function truncateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.length > MAX_LAST_ERROR_LENGTH ? msg.slice(0, MAX_LAST_ERROR_LENGTH) : msg
}

/**
 * Best-effort status write: a failed status write must never convert a
 * successful sync into a thrown error, nor mask the original failure.
 */
async function writeSyncStatusSafe(
  supabase: SupabaseClient,
  userId: string,
  status: {
    syncStatus: 'ok' | 'failed' | 'auth_expired'
    lastError?: string | null
    lastSyncedAt?: Date
    touchLastSyncedAt?: boolean
  }
): Promise<void> {
  try {
    await updateSyncStatus(supabase, userId, 'google_tasks', status)
  } catch (statusErr) {
    console.error('[googleTasksSync] best-effort sync_status write failed:', statusErr)
  }
}

/**
 * Classify an error from the Google client chain for status purposes.
 *  'auth_expired' — unrecoverable token (refresh rejected / persistent 401).
 *  'failed'       — transient or unknown.
 *  null           — not_connected: integration row is gone; nothing to write to.
 */
function statusForError(err: unknown): 'auth_expired' | 'failed' | null {
  if (err instanceof GoogleAuthError) {
    if (err.code === 'auth_expired') return 'auth_expired'
    if (err.code === 'not_connected') return null
    return 'failed' // 'network'
  }
  if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') {
    return 'auth_expired'
  }
  return 'failed'
}

/** Record an error on the integration row (no-op for not_connected). */
async function recordSyncError(
  supabase: SupabaseClient,
  userId: string,
  err: unknown
): Promise<void> {
  const status = statusForError(err)
  if (!status) return
  await writeSyncStatusSafe(supabase, userId, {
    syncStatus: status,
    lastError: truncateError(err),
  })
}

// ---- Date helpers ----

/** YYYY-MM-DD → RFC 3339 at midnight UTC. Returns null if input null/empty. */
function googleDateFromAssignedDate(date: string | null | undefined): string | null {
  if (!date) return null
  // Assumes input is a YYYY-MM-DD date-only string (consistent with how Praxis
  // stores assigned_date). Google ignores the time portion; midnight UTC is fine.
  const trimmed = date.length > 10 ? date.slice(0, 10) : date
  return `${trimmed}T00:00:00.000Z`
}

/** RFC 3339 → YYYY-MM-DD. Returns null if input is undefined/empty. */
function assignedDateFromGoogleDue(googleDue: string | undefined | null): string | null {
  if (!googleDue) return null
  // Take the date portion of the RFC 3339 string. Google honors only the date.
  return googleDue.slice(0, 10)
}

// ---- Push (single task) ----

/**
 * Push a single task's current state to Google Tasks.
 *
 * If the task has no google_task_id: insert into Google, store the resulting
 *   google_task_id / google_etag / last_synced_at on the local row.
 * If the task has a google_task_id: PATCH the Google task. Update local
 *   google_etag / last_synced_at on success.
 *
 * Returns:
 *   true  — push succeeded.
 *   false — auth-related failure (not_connected / auth_expired) OR Google task
 *           was not found on update (caller decides; pull cycle can pick up the
 *           deletion). Caller should NOT retry; surface UI as appropriate.
 *
 * Throws GoogleTasksApiError on transient failures (network / server_error /
 *   rate_limited / unknown) so the caller can decide whether to retry.
 */
export async function pushTask(
  supabase: SupabaseClient,
  userId: string,
  task: TaskRow
): Promise<boolean> {
  let listId: string
  try {
    listId = await getDefaultTaskListId(supabase, userId)
  } catch (err) {
    await recordSyncError(supabase, userId, err)
    if (err instanceof GoogleAuthError) return false
    if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') return false
    throw err
  }

  const input: GoogleTaskInput = {
    title: task.title,
    notes: task.description && task.description.trim().length > 0 ? task.description : null,
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    due: googleDateFromAssignedDate(task.assigned_date),
  }

  const nowISOString = new Date().toISOString()

  try {
    if (!task.google_task_id) {
      // Insert path
      const created = await googleInsertTask(supabase, userId, listId, input)
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          google_task_id: created.id,
          google_etag: created.etag,
          last_synced_at: nowISOString,
        })
        .eq('id', task.id)
      if (updateError) {
        throw new Error(
          `pushTask: created Google task ${created.id} but failed to write back to local row ${task.id}: ${updateError.message}`
        )
      }
      await writeOkAfterPush(supabase, userId)
      return true
    }

    // Update path
    const updated = await googleUpdateTask(supabase, userId, listId, task.google_task_id, input)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        google_etag: updated.etag,
        last_synced_at: nowISOString,
      })
      .eq('id', task.id)
    if (updateError) {
      throw new Error(
        `pushTask: updated Google task ${task.google_task_id} but failed to write back to local row ${task.id}: ${updateError.message}`
      )
    }
    await writeOkAfterPush(supabase, userId)
    return true
  } catch (err) {
    await recordSyncError(supabase, userId, err)
    if (err instanceof GoogleAuthError) return false
    if (err instanceof GoogleTasksApiError) {
      if (err.code === 'auth_expired' || err.code === 'not_found') return false
      throw err  // rate_limited / server_error / network / unknown
    }
    throw err
  }
}

/**
 * Push-success status write: 'ok' + clear last_error, WITHOUT advancing
 * last_synced_at — that timestamp is the pull watermark (pullTasks sends it
 * to Google as updatedMin). Bumping it on a push would make the next pull
 * skip Google-side changes made since the last actual pull.
 */
async function writeOkAfterPush(supabase: SupabaseClient, userId: string): Promise<void> {
  await writeSyncStatusSafe(supabase, userId, {
    syncStatus: 'ok',
    lastError: null,
    touchLastSyncedAt: false,
  })
}

// ---- Configuration & background helpers (3b.3) ----

/**
 * Quick check whether the user has an active google_tasks integration.
 * Used by mutation hooks to skip push attempts for users who haven't set up
 * sync. Returns true if an integration row exists. Does not validate token
 * freshness — pushTask handles that.
 */
export async function isSyncConfigured(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const integration = await getIntegration(supabase, userId, 'google_tasks')
  return integration !== null
}

/**
 * Fire-and-forget version of pushTask for use from server-side callers.
 * Never throws. Skips silently if sync is not configured.
 *
 * Status writes (ok / failed / auth_expired) happen inside pushTask itself
 * (A2); this wrapper only swallows and logs the thrown transients.
 */
export function pushTaskInBackground(
  supabase: SupabaseClient,
  userId: string,
  task: TaskRow
): void {
  void (async () => {
    try {
      const configured = await isSyncConfigured(supabase, userId)
      if (!configured) return
      await pushTask(supabase, userId, task)
    } catch (err) {
      console.error('[pushTaskInBackground] push failed for task', task.id, err)
    }
  })()
}

/**
 * Fire-and-forget drain of pending deletion tombstones. Never throws.
 * Skips silently if sync is not configured. Status writes happen inside
 * pushPendingDeletions itself (A2).
 */
export function pushPendingDeletionsInBackground(
  supabase: SupabaseClient,
  userId: string
): void {
  void (async () => {
    try {
      const configured = await isSyncConfigured(supabase, userId)
      if (!configured) return
      await pushPendingDeletions(supabase, userId)
    } catch (err) {
      console.error('[pushPendingDeletionsInBackground] drain failed', err)
    }
  })()
}

// ---- Push (drain pending deletions) ----

interface PendingDeletionRow {
  id: string
  google_task_id: string
}

/**
 * Push all unprocessed deletions in task_deletions for this user to Google.
 * Marks each tombstone with pushed_at = now() on success.
 *
 * Returns the count of successfully pushed deletions. On auth failure, stops
 * iterating and returns the count completed so far.
 */
export async function pushPendingDeletions(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: rows, error: queryError } = await supabase
    .from('task_deletions')
    .select('id, google_task_id')
    .eq('user_id', userId)
    .is('pushed_at', null)
  if (queryError) {
    const err = new Error(
      `pushPendingDeletions: failed to read task_deletions: ${queryError.message}`
    )
    await recordSyncError(supabase, userId, err)
    throw err
  }
  // Nothing pending: leave sync_status untouched — an empty drain exercises
  // nothing, so it shouldn't clear a real 'failed'/'auth_expired' state.
  if (!rows || rows.length === 0) return 0

  const pending = rows as PendingDeletionRow[]

  let listId: string
  try {
    listId = await getDefaultTaskListId(supabase, userId)
  } catch (err) {
    await recordSyncError(supabase, userId, err)
    if (err instanceof GoogleAuthError) return 0
    if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') return 0
    throw err
  }

  let pushed = 0
  for (const row of pending) {
    try {
      // googleDeleteTask returns void on success and treats 404 as success.
      await googleDeleteTask(supabase, userId, listId, row.google_task_id)
    } catch (err) {
      await recordSyncError(supabase, userId, err)
      if (err instanceof GoogleAuthError) return pushed
      if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') return pushed
      // Transient (rate_limited / server_error / network / unknown):
      // stop the loop, return what's done. Caller can retry on next sync.
      throw err
    }

    const { error: markError } = await supabase
      .from('task_deletions')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', row.id)
    if (markError) {
      const err = new Error(
        `pushPendingDeletions: deleted Google task ${row.google_task_id} but failed to mark tombstone ${row.id} as pushed: ${markError.message}`
      )
      await recordSyncError(supabase, userId, err)
      throw err
    }
    pushed++
  }

  await writeOkAfterPush(supabase, userId)
  return pushed
}

// ---- Pull (fetch Google changes, reconcile locally) ----

export interface PullResult {
  inserted: number
  updated: number
  deleted: number
  conflicts_resolved: number
}

interface LocalTaskMatchRow {
  id: string
  google_task_id: string | null
  last_synced_at: string | null
  // Fields we need to reconcile or compare
  status: string | null
  description: string | null
  assigned_date: string | null
}

interface LocalItemRow {
  id: string
  title: string
  updated_at: string
  user_id: string
}

/**
 * Pull recent changes from Google Tasks and reconcile with local tasks.
 *
 * For each Google task:
 *   - If marked deleted in Google: hard-delete the local task + items row.
 *   - If matches a local task by google_task_id: last-write-wins by timestamp
 *     (compare google.updated vs local items.updated_at). If Google is newer,
 *     apply Google's state to local. If local was also touched since the last
 *     sync, count it as a conflict.
 *   - If no match: insert as a new local task (title, notes → description,
 *     due → assigned_date, status mapped). daily_context is null — these land
 *     in the All Day bucket; user assigns context later in Praxis.
 *
 * Updates the integration row's last_synced_at = now() at the end.
 *
 * Auth failure causes early return with whatever was completed so far.
 */
export async function pullTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<PullResult> {
  const result: PullResult = { inserted: 0, updated: 0, deleted: 0, conflicts_resolved: 0 }

  const integration = await getIntegration(supabase, userId, 'google_tasks')
  if (!integration) return result

  let listId: string
  try {
    listId = await getDefaultTaskListId(supabase, userId)
  } catch (err) {
    await recordSyncError(supabase, userId, err)
    if (err instanceof GoogleAuthError) return result
    if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') return result
    throw err
  }

  const updatedMin = integration.lastSyncedAt
    ? integration.lastSyncedAt.toISOString()
    : undefined

  let pageToken: string | undefined
  let pages = 0

  try {
    while (pages < MAX_PAGES) {
      const page = await googleListTasks(supabase, userId, listId, {
        showCompleted: true,
        showDeleted: true,
        showHidden: false,
        updatedMin,
        pageToken,
      })

      for (const gt of page.items) {
        await reconcileGoogleTask(supabase, userId, gt, result)
      }

      if (!page.nextPageToken) break
      pageToken = page.nextPageToken
      pages++
    }
  } catch (err) {
    await recordSyncError(supabase, userId, err)
    if (err instanceof GoogleAuthError) return result
    if (err instanceof GoogleTasksApiError && err.code === 'auth_expired') return result
    throw err
  }

  // Pull success: 'ok' + advance the watermark (last_synced_at) so the next
  // pull's updatedMin moves forward. This is the ONLY place last_synced_at
  // may be bumped — push successes write 'ok' with touchLastSyncedAt: false.
  await writeSyncStatusSafe(supabase, userId, {
    syncStatus: 'ok',
    lastError: null,
    lastSyncedAt: new Date(),
  })

  return result
}

/**
 * Apply one Google task to local state. Mutates `result` counters in place.
 */
async function reconcileGoogleTask(
  supabase: SupabaseClient,
  userId: string,
  gt: GoogleTask,
  result: PullResult
): Promise<void> {
  // Look up local task by google_task_id (only one row should match — the column
  // is effectively unique-per-user even without a constraint).
  const { data: localMatchRows, error: lookupError } = await supabase
    .from('tasks')
    .select('id, google_task_id, last_synced_at, status, description, assigned_date')
    .eq('google_task_id', gt.id)
    .limit(1)
  if (lookupError) {
    throw new Error(`pullTasks lookup failed for google_task_id=${gt.id}: ${lookupError.message}`)
  }
  const localMatch = (localMatchRows?.[0] as LocalTaskMatchRow | undefined) ?? null

  // --- Deleted in Google ---
  if (gt.deleted) {
    if (!localMatch) return  // nothing to do
    await deleteLocalTaskAndItem(supabase, userId, localMatch.id)
    result.deleted++
    return
  }

  // --- New in Google (no local row) ---
  if (!localMatch) {
    await insertLocalFromGoogle(supabase, userId, gt)
    result.inserted++
    return
  }

  // --- Both sides exist: last-write-wins ---
  // Compare google.updated vs local items.updated_at. Pull the items row
  // separately because it carries the local timestamp (tasks doesn't).
  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .select('id, title, updated_at, user_id')
    .eq('id', localMatch.id)
    .eq('user_id', userId)
    .limit(1)
  if (itemError) {
    throw new Error(`pullTasks items lookup failed for id=${localMatch.id}: ${itemError.message}`)
  }
  const localItem = (itemRows?.[0] as LocalItemRow | undefined) ?? null
  if (!localItem) {
    // Orphan: tasks row exists but items doesn't. Treat as if local doesn't
    // exist and re-import. (This is an unusual repair path.)
    await insertLocalFromGoogle(supabase, userId, gt)
    result.inserted++
    return
  }

  const googleUpdatedMs = new Date(gt.updated).getTime()
  const localUpdatedMs = new Date(localItem.updated_at).getTime()

  if (googleUpdatedMs <= localUpdatedMs) {
    // Local is newer (or equal). Skip — next push cycle will send local up.
    return
  }

  // Google wins. If local was also changed since last sync, count as conflict.
  const lastSyncedMs = localMatch.last_synced_at
    ? new Date(localMatch.last_synced_at).getTime()
    : 0
  if (localUpdatedMs > lastSyncedMs) {
    result.conflicts_resolved++
  }

  await applyGoogleStateToLocal(supabase, userId, localMatch.id, localMatch.status, gt)
  result.updated++
}

async function insertLocalFromGoogle(
  supabase: SupabaseClient,
  userId: string,
  gt: GoogleTask
): Promise<void> {
  const nowISOString = new Date().toISOString()
  // Items first (parent), then tasks (child). Same id linking the two.
  const { data: item, error: itemError } = await supabase
    .from('items')
    .insert({
      user_id: userId,
      title: gt.title || '',
      item_type: 'task',
      is_archived: false,
      created_at: nowISOString,
      updated_at: nowISOString,
    })
    .select()
    .single()
  if (itemError || !item) {
    throw new Error(
      `pullTasks: failed to insert items row for new Google task ${gt.id}: ${itemError?.message ?? 'no item returned'}`
    )
  }

  const { error: taskError } = await supabase
    .from('tasks')
    .insert({
      id: (item as { id: string }).id,
      // Google-imported tasks default to active since they represent committed
      // work (voice capture, etc.) rather than maybe-someday items. Completed
      // tasks land as completed so they don't reappear on the dashboard.
      status: gt.status === 'completed' ? 'completed' : 'active',
      description: gt.notes ?? null,
      assigned_date: assignedDateFromGoogleDue(gt.due),
      daily_context: null,
      is_project_converted: false,
      google_task_id: gt.id,
      google_etag: gt.etag,
      last_synced_at: nowISOString,
    })
  if (taskError) {
    // Roll back the orphaned items row to stay consistent.
    await supabase.from('items').delete().eq('id', (item as { id: string }).id).eq('user_id', userId)
    throw new Error(
      `pullTasks: failed to insert tasks row for new Google task ${gt.id}: ${taskError.message}`
    )
  }
}

async function applyGoogleStateToLocal(
  supabase: SupabaseClient,
  userId: string,
  localId: string,
  currentLocalStatus: string | null,
  gt: GoogleTask
): Promise<void> {
  const nowISOString = new Date().toISOString()

  // Status sync from Google is completion-only. Praxis has more status nuance
  // (on_deck, future, blocked, etc.) that Google can't represent — we don't
  // want Google-side title edits to clobber Praxis-side status categorization.
  // Only completion transitions cross the boundary in either direction.
  let statusUpdate: string | undefined
  if (gt.status === 'completed' && currentLocalStatus !== 'completed') {
    statusUpdate = 'completed'
  } else if (gt.status === 'needsAction' && currentLocalStatus === 'completed') {
    // Uncomplete-in-Google → bring local back to 'active' (matches the
    // insertLocalFromGoogle default for newly-imported needsAction tasks).
    statusUpdate = 'active'
  }
  // Otherwise: leave local status alone — omit it from the update payload.

  const taskPatch: Record<string, unknown> = {
    description: gt.notes ?? null,
    assigned_date: assignedDateFromGoogleDue(gt.due),
    google_etag: gt.etag,
    last_synced_at: nowISOString,
  }
  if (statusUpdate !== undefined) {
    taskPatch.status = statusUpdate
  }

  const { error: taskError } = await supabase
    .from('tasks')
    .update(taskPatch)
    .eq('id', localId)
  if (taskError) {
    throw new Error(`pullTasks: failed to apply Google state to tasks row ${localId}: ${taskError.message}`)
  }

  const { error: itemError } = await supabase
    .from('items')
    .update({
      title: gt.title || '',
      updated_at: nowISOString,
    })
    .eq('id', localId)
    .eq('user_id', userId)
  if (itemError) {
    throw new Error(`pullTasks: failed to apply Google title to items row ${localId}: ${itemError.message}`)
  }
}

async function deleteLocalTaskAndItem(
  supabase: SupabaseClient,
  userId: string,
  localId: string
): Promise<void> {
  // Tasks first (child), then items (parent) — mirrors the ordering established
  // by taskService.deleteTasks for safety against any FK that may exist.
  const { error: taskError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', localId)
  if (taskError) {
    throw new Error(`pullTasks: failed to delete tasks row ${localId} after Google deletion: ${taskError.message}`)
  }
  const { error: itemError } = await supabase
    .from('items')
    .delete()
    .eq('id', localId)
    .eq('user_id', userId)
  if (itemError) {
    throw new Error(`pullTasks: failed to delete items row ${localId} after Google deletion: ${itemError.message}`)
  }
}
