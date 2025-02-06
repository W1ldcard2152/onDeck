import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database.types'
import type { TaskStatus, Priority } from '@/types/database.types'

interface CreateEntryParams {
  title: string;
  type: 'task' | 'note';
  user_id: string;
  content?: string | null;
  due_date?: string | null;
  assigned_date?: string | null;
  status?: TaskStatus;
  priority?: Priority | null;
  description?: string | null;
}

export class EntryService {
  static async createEntry(entry: CreateEntryParams) {
    const supabase = createClientComponentClient<Database>()
    
    try {
      if (!entry.title) throw new Error('Title is required');
      if (!entry.user_id) throw new Error('User ID is required');
      if (!entry.type) throw new Error('Type is required');

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: entry.title.trim(),
          user_id: entry.user_id,
          item_type: entry.type,
          is_archived: false
        }])
        .select()
        .single();

      if (itemError) throw itemError;
      if (!itemData) throw new Error('Failed to create item');

      if (entry.type === 'task') {
        const taskData = {
          id: itemData.id,
          due_date: entry.due_date || null,
          assigned_date: entry.assigned_date || null,
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

      return itemData;

    } catch (error) {
      console.error('EntryService createEntry error:', error);
      throw error;
    }
  }

  static async updateTaskStatus(taskId: string, status: TaskStatus) {
    const supabase = createClientComponentClient<Database>();
    
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
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase
      .from('tasks')
      .update({ priority })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
  }
}