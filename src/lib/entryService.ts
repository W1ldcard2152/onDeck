import type { Database } from '@/types/database.types'
import type { TaskStatus, Priority, EntryType } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'
import { addToQueue } from '@/lib/offlineSyncQueue'

interface CreateEntryParams {
  title: string;
  type: 'task' | 'note' | 'quote';
  user_id: string;
  content?: string | null;
  url?: string | null;
  knowledge_base_id?: string | null;
  entry_type?: EntryType;
  due_date?: string | null;
  assigned_date?: string | null;
  reminder_time?: string | null;
  daily_context?: string | null;
  status?: TaskStatus;
  priority?: Priority | null;
  description?: string | null;
  author?: string | null;
  source?: string | null;
}

export class EntryService {
  static async createEntry(entry: CreateEntryParams) {
    if (!entry.title) throw new Error('Title is required');
    if (!entry.user_id) throw new Error('User ID is required');
    if (!entry.type) throw new Error('Type is required');

    // Offline path: queue for later sync (tasks and notes only)
    if (typeof navigator !== 'undefined' && !navigator.onLine && entry.type !== 'quote') {
      const tempId = crypto.randomUUID()
      const now = new Date().toISOString()

      const fields: Record<string, any> = {}
      if (entry.type === 'task') {
        fields.due_date = entry.due_date || null
        fields.assigned_date = entry.assigned_date || null
        fields.reminder_time = entry.reminder_time || null
        fields.daily_context = entry.daily_context || null
        fields.status = entry.status || 'on_deck'
        fields.description = entry.description || null
        fields.priority = entry.priority || 'normal'
      } else if (entry.type === 'note') {
        fields.content = entry.content || null
        fields.url = entry.url || null
        fields.knowledge_base_id = entry.knowledge_base_id || null
        fields.entry_type = entry.entry_type || 'note'
      }

      addToQueue({
        id: tempId,
        type: entry.type as 'task' | 'note',
        title: entry.title.trim(),
        fields,
        createdAt: now
      })

      // Return a fabricated response matching the online path shape
      return {
        id: tempId,
        title: entry.title.trim(),
        user_id: entry.user_id,
        item_type: entry.type,
        is_archived: false,
        created_at: now,
        updated_at: now,
        _pending: true
      }
    }

    // Online path: create in Supabase directly
    const supabase = getSupabaseClient()

    try {
      const now = new Date().toISOString();

      // Create the item first
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: entry.title.trim(),
          user_id: entry.user_id,
          item_type: entry.type,
          is_archived: false,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();

      if (itemError) throw itemError;
      if (!itemData) throw new Error('Failed to create item');

      // Handle task-specific data
      if (entry.type === 'task') {
        const taskData = {
          id: itemData.id,
          due_date: entry.due_date || null,
          assigned_date: entry.assigned_date || null,
          reminder_time: entry.reminder_time || null,
          daily_context: entry.daily_context || null,
          status: entry.status || 'on_deck',
          description: entry.description || null,
          is_project_converted: false,
          priority: entry.priority || 'normal'
        };

        const { error: taskError } = await supabase
          .from('tasks')
          .insert([taskData])
          .select()
          .single();

        if (taskError) throw taskError;
      }

      // Handle note-specific data
      if (entry.type === 'note') {
        const noteData = {
          id: itemData.id,
          content: entry.content?.trim() || null,
          url: entry.url?.trim() || null,
          knowledge_base_id: entry.knowledge_base_id || null,
          entry_type: entry.entry_type || 'note'
        };

        const { error: noteError } = await supabase
          .from('notes')
          .insert([noteData])
          .select()
          .single();

        if (noteError) throw noteError;
      }

      // Handle quote-specific data
      if (entry.type === 'quote') {
        const quoteData = {
          id: itemData.id,
          content: entry.content?.trim() || '',
          author: entry.author?.trim() || null,
          source: entry.source?.trim() || null
        };

        const { error: quoteError } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();

        if (quoteError) throw quoteError;
      }

      return itemData;

    } catch (error) {
      console.error('EntryService createEntry error:', error);
      throw error;
    }
  }

  static async updateTaskStatus(taskId: string, status: TaskStatus) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateTaskPriority(taskId: string, priority: Priority) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('tasks')
      .update({ priority })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
  }
}
