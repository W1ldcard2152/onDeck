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

      const { data: { user } } = await supabase.auth.getUser();
      
      const itemData = {
        title: entry.title.trim(),
        user_id: entry.user_id,
        type: entry.type,
        status: entry.status || 'on_deck',
        priority: entry.priority || null,
        description: entry.description || null,
        due_date: entry.due_date || null,
        assigned_date: entry.assigned_date || null,
        content: entry.type === 'note' ? entry.content : null,
      };

      const { data: createdEntry, error } = await supabase
        .from('entries')
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return createdEntry;

    } catch (error) {
      console.error('EntryService createEntry error:', error);
      throw error;
    }
  }

  static async updateTaskStatus(taskId: string, status: TaskStatus) {
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase
      .from('entries')
      .update({ status })
      .eq('id', taskId)
      .eq('type', 'task');

    if (error) throw error;
  }

  static async updateTaskPriority(taskId: string, priority: 'low' | 'medium' | 'high' | null) {
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase
      .from('entries')
      .update({ priority })
      .eq('id', taskId)
      .eq('type', 'task');

    if (error) throw error;
  }
}