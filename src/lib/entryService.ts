import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database.types'
import type { TaskStatus } from '@/types/database.types'

export class EntryService {
  static async createEntry(entry: {
    title: string;
    type: 'task' | 'note';
    user_id: string;
    content?: string | null;
    due_date?: string | null;
    assigned_date?: string | null;
    status?: TaskStatus | null;
    priority?: 'low' | 'medium' | 'high' | null;
    description?: string | null;
  }) {
    const supabase = createClientComponentClient<Database>()
    
    try {
      if (!entry.title) throw new Error('Title is required');
      if (!entry.user_id) throw new Error('User ID is required');
      if (!entry.type) throw new Error('Type is required');

      // First create the base item
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

      // If it's a task, create the task record
      if (entry.type === 'task') {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{
            id: itemData.id,  // Use the same ID as the item
            due_date: entry.due_date || null,
            assigned_date: entry.assigned_date || null,
            status: entry.status || 'on_deck',
            description: entry.description || null,
            is_project_converted: false,
            priority: entry.priority || null
          }]);

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
    
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (error) throw error;
  }

  static async updateTaskPriority(taskId: string, priority: 'low' | 'medium' | 'high' | null) {
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase
      .from('tasks')
      .update({ priority })
      .eq('id', taskId);

    if (error) throw error;
  }
}