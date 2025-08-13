'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { NoteWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useNotes(userId: string | undefined, limit: number = 10) {
  const [notes, setNotes] = useState<NoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchNotes() {
    try {
      // Return early if no userId is provided
      if (!userId) {
        setNotes([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching notes for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient<Database>()

      // Query items first, then notes
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'note')
        .order('created_at', { ascending: false })
        .limit(limit);

      console.log('Items query response:', { itemsData, itemsError });

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        console.log('No items found');
        setNotes([]);
        return;
      }

      // Get the note content for each item with knowledge base relationships
      const itemIds = itemsData.map(item => item.id);
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          *,
          knowledge_bases (
            id,
            name,
            description,
            keystones (
              id,
              name,
              color
            )
          )
        `)
        .in('id', itemIds);

      console.log('Notes query response:', { notesData, notesError });

      if (notesError) throw notesError;

      // Combine items and notes
      const combinedNotes = itemsData.map(item => {
        const noteData = notesData?.find(note => note.id === item.id);
        
        return {
          id: item.id,
          content: noteData?.content || null,
          url: noteData?.url || null,
          file_path: noteData?.file_path || null,
          entry_type: noteData?.entry_type || 'note',
          knowledge_base_id: noteData?.knowledge_base_id || null,
          knowledge_base: noteData?.knowledge_bases ? {
            id: noteData.knowledge_bases.id,
            name: noteData.knowledge_bases.name,
            description: noteData.knowledge_bases.description,
            keystone: noteData.knowledge_bases.keystones ? {
              id: noteData.knowledge_bases.keystones.id,
              name: noteData.knowledge_bases.keystones.name,
              color: noteData.knowledge_bases.keystones.color,
              user_id: '', created_at: '', updated_at: '', description: ''
            } : undefined,
            user_id: '', keystone_id: '', entry_count: 0, created_at: '', updated_at: ''
          } : undefined,
          item: {
            id: item.id,
            user_id: item.user_id,
            title: item.title,
            created_at: item.created_at,
            updated_at: item.updated_at,
            item_type: item.item_type,
            is_archived: item.is_archived,
            archived_at: item.archived_at,
            archive_reason: item.archive_reason
          }
        };
      });

      console.log('Combined notes:', combinedNotes);
      setNotes(combinedNotes);
      
    } catch (e) {
      console.error('Error in fetchNotes:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching notes'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [userId, limit])

  return { notes, isLoading, error, refetch: fetchNotes }
}