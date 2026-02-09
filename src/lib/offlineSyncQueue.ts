/**
 * Offline Sync Queue
 * Stores pending entries in localStorage when offline, syncs to Supabase when online.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'sophia_offline_queue'

export interface QueueEntry {
  id: string
  type: 'task' | 'note'
  title: string
  fields: Record<string, any>
  createdAt: string
  status: 'pending' | 'syncing' | 'failed'
}

function getQueue(): QueueEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueueEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function addToQueue(entry: Omit<QueueEntry, 'status'>): void {
  const queue = getQueue()
  queue.push({ ...entry, status: 'pending' })
  saveQueue(queue)
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter(e => e.id !== id)
  saveQueue(queue)
}

export function getPendingItems(type?: 'task' | 'note'): QueueEntry[] {
  const queue = getQueue()
  if (type) return queue.filter(e => e.type === type)
  return queue
}

export function getQueueSize(): number {
  return getQueue().length
}

export function clearQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Process all pending queue entries by creating them in Supabase.
 * Follows the same two-table pattern as EntryService: items first, then tasks/notes.
 * Returns the number of successfully synced entries.
 */
export async function processQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const queue = getQueue()
  if (queue.length === 0) return 0

  // Mark all as syncing
  const updatedQueue = queue.map(e => ({ ...e, status: 'syncing' as const }))
  saveQueue(updatedQueue)

  let syncedCount = 0

  for (const entry of updatedQueue) {
    try {
      const now = new Date().toISOString()

      // Create the item record
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert({
          title: entry.title.trim(),
          user_id: userId,
          item_type: entry.type,
          is_archived: false,
          created_at: entry.createdAt,
          updated_at: now
        })
        .select()
        .single()

      if (itemError) throw itemError
      if (!itemData) throw new Error('Failed to create item')

      // Create the type-specific record
      if (entry.type === 'task') {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert({
            id: itemData.id,
            due_date: entry.fields.due_date || null,
            assigned_date: entry.fields.assigned_date || null,
            reminder_time: entry.fields.reminder_time || null,
            daily_context: entry.fields.daily_context || null,
            status: entry.fields.status || 'on_deck',
            description: entry.fields.description || null,
            is_project_converted: false,
            priority: entry.fields.priority || 'normal'
          })
          .select()
          .single()

        if (taskError) throw taskError
      } else if (entry.type === 'note') {
        const { error: noteError } = await supabase
          .from('notes')
          .insert({
            id: itemData.id,
            content: entry.fields.content?.trim() || null,
            url: entry.fields.url?.trim() || null,
            knowledge_base_id: entry.fields.knowledge_base_id || null,
            entry_type: entry.fields.entry_type || 'note'
          })
          .select()
          .single()

        if (noteError) throw noteError
      }

      // Success — remove from queue
      removeFromQueue(entry.id)
      syncedCount++
    } catch {
      // Mark this entry as failed, leave it in the queue for retry
      const currentQueue = getQueue()
      const idx = currentQueue.findIndex(e => e.id === entry.id)
      if (idx !== -1) {
        currentQueue[idx].status = 'failed'
        saveQueue(currentQueue)
      }
    }
  }

  return syncedCount
}
