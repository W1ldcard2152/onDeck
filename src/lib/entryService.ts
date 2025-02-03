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

      // First, create the base item
      const itemData = {
        title: entry.title.trim(),
        user_id: entry.user_id,
        type: entry.type,  // This will help with RLS policies
        description: entry.description || null,
      };

      console.log('Attempting to create item with data:', itemData);

      // Create the base item first
      const { data: createdItem, error: itemError } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (itemError) {
        console.error('Error creating item:', itemError);
        throw itemError;
      }

      if (!createdItem) {
        throw new Error('Failed to create item');
      }

      console.log('Successfully created item:', createdItem);

      // Based on the type, create the corresponding type-specific entry
      let typeSpecificData;
      switch (entry.type) {
        case 'task': {
          typeSpecificData = {
            id: createdItem.id,
            due_date: entry.due_date || null,
            status: entry.status || 'active',
            priority: entry.priority || 'medium',
            do_date: entry.do_date || null,
            is_project_converted: false,
            converted_project_id: null
          };
          
          const { error: taskError } = await supabase
            .from('tasks')
            .insert([typeSpecificData]);

          if (taskError) {
            // If type-specific creation fails, we should clean up the item
            await supabase.from('items').delete().match({ id: createdItem.id });
            throw taskError;
          }
          break;
        }
        
        case 'note': {
          typeSpecificData = {
            id: createdItem.id,
            content: entry.content || ''
          };
          
          const { error: noteError } = await supabase
            .from('notes')
            .insert([typeSpecificData]);

          if (noteError) {
            await supabase.from('items').delete().match({ id: createdItem.id });
            throw noteError;
          }
          break;
        }
        
        case 'project': {
          typeSpecificData = {
            id: createdItem.id,
            due_date: entry.due_date || null,
            status: entry.status || 'active',
            priority: entry.priority || 'medium',
            progress: 0
          };
          
          const { error: projectError } = await supabase
            .from('projects')
            .insert([typeSpecificData]);

          if (projectError) {
            await supabase.from('items').delete().match({ id: createdItem.id });
            throw projectError;
          }
          break;
        }
        
        case 'habit': {
          typeSpecificData = {
            id: createdItem.id,
            frequency: entry.frequency || 'daily',
            target_days: entry.target_days || [1,2,3,4,5],
            streak: 0
          };
          
          const { error: habitError } = await supabase
            .from('habits')
            .insert([typeSpecificData]);

          if (habitError) {
            await supabase.from('items').delete().match({ id: createdItem.id });
            throw habitError;
          }
          break;
        }
        
        case 'journal': {
          typeSpecificData = {
            id: createdItem.id,
            content: entry.content || '',
            mood: entry.mood || null
          };
          
          const { error: journalError } = await supabase
            .from('journals')
            .insert([typeSpecificData]);

          if (journalError) {
            await supabase.from('items').delete().match({ id: createdItem.id });
            throw journalError;
          }
          break;
        }
      }

      // Return the created item
      return createdItem;

    } catch (error) {
      console.error('EntryService createEntry error:', error);
      throw error;
    }
  }
}