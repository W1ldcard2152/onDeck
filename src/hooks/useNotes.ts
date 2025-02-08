import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { NoteWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useNotes(userId: string, limit: number = 10) {
  const [notes, setNotes] = useState<NoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchNotes() {
    try {
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

      // Get the note content for each item
      const itemIds = itemsData.map(item => item.id);
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .in('id', itemIds);

      console.log('Notes query response:', { notesData, notesError });

      if (notesError) throw notesError;

      // Combine items and notes
      const combinedNotes = itemsData.map(item => {
        const noteContent = notesData?.find(note => note.id === item.id)?.content || null;
        
        return {
          id: item.id,
          content: noteContent,
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