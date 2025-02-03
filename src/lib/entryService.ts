'use client'

import { supabase } from '@/lib/supabase'
import type { Entry } from '@/types/database.types'

export class EntryService {
  static async createEntry(entry: Partial<Entry>) {
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

      // Create the item with explicit data structure
      const itemData = {
        title: entry.title.trim(),  // Ensure title is trimmed
        user_id: entry.user_id,
        item_type: entry.type,
        is_archived: false
      };

      console.log('Attempting to create item with data:', itemData);

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
            const { error: noteError } = await supabase
              .from('notes')
              .insert([{
                id: createdItem.id,
                content: entry.content || ''
              }]);

            if (noteError) throw noteError;
            break;
          }
          case 'task': {
            const { error: taskError } = await supabase
              .from('tasks')
              .insert([{
                id: createdItem.id,
                due_date: entry.due_date,
                status: 'active',
                is_project_converted: false
              }]);

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