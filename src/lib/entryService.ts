// EntryService.ts
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Entry, Database } from '@/types/database.types'

export class EntryService {
  static async createEntry(entry: Partial<Entry>) {
    const supabase = createClientComponentClient<Database>()
    
    try {
      // Validate required fields
      if (!entry.title) {
        throw new Error('Title is required');
      }

      if (!entry.user_id) {
        throw new Error('User ID is required');
      }

      if (!entry.type) {
        throw new Error('Type is required');
      }

      // Debug: Log user ID comparison
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Auth check:', {
        entry_user_id: entry.user_id,
        auth_user_id: user?.id,
        do_they_match: entry.user_id === user?.id
      });

      // Create the item with explicit data structure
      const itemData = {
        title: entry.title.trim(),
        user_id: entry.user_id,
        item_type: entry.type,
        is_archived: false
      };

      console.log('Creating item with data:', itemData);

      const { data: createdItem, error: itemError } = await supabase
        .from('items')
        .insert([itemData])
        .select('*')
        .single();

      if (itemError) {
        console.error('Error creating item:', itemError);
        throw itemError;
      }

      console.log('Successfully created item:', createdItem);

      // Create type-specific entry if needed
      if (createdItem) {
        switch (entry.type) {
          case 'note': {
            const noteData = {
              id: createdItem.id,
              content: entry.content || ''
              // Remove description as it's not in the notes table schema
            };
            console.log('Creating note with data:', noteData);
            
            const { data: createdNote, error: noteError } = await supabase
              .from('notes')
              .insert([noteData])
              .select('*')
              .single();

            console.log('Note creation result:', { data: createdNote, error: noteError });
            if (noteError) throw noteError;
            break;
          }
          case 'task': {
            const taskData = {
              id: createdItem.id,
              do_date: null,
              due_date: entry.due_date,
              status: 'active',
              is_project_converted: false,
              converted_project_id: null,
              description: entry.description || null
            };
            console.log('Creating task with data:', taskData);
            
            const { data: createdTask, error: taskError } = await supabase
              .from('tasks')
              .insert([taskData])
              .select('*')
              .single();

            console.log('Task creation result:', { data: createdTask, error: taskError });
            if (taskError) throw taskError;
            break;
          }
        }
      }

      return createdItem;
    } catch (error) {
      console.error('EntryService createEntry error:', error);
      throw error;
    }
  }
}