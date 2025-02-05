'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { NoteWithDetails, Item } from '@/lib/types'
import type { Database } from '@/types/database.types'

interface RawNoteResponse {
  id: string;
  content: string | null;
  items: {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    item_type: 'task' | 'note' | 'project';
    is_archived: boolean;
    archived_at: string | null;
    archive_reason: string | null;
  }[];
}

export function useNotes(userId: string, limit: number = 10) {
  const [notes, setNotes] = useState<NoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchNotes() {
    try {
      console.log('Fetching notes for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient<Database>()

      // Query notes and their associated items
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select(`
          id,
          content,
          items!inner (*)
        `)
        .eq('items.user_id', userId)
        .eq('items.item_type', 'note')
        .eq('items.is_archived', false)
        .order('created_at', { foreignTable: 'items' })
        .limit(limit)

      if (noteError) {
        console.error('Note query error:', noteError)
        throw noteError
      }

      if (!noteData) {
        console.log('No note data returned')
        setNotes([])
        return
      }

      console.log('Raw note data:', noteData)

      // Transform the data into the expected format
      const combinedNotes: NoteWithDetails[] = (noteData as RawNoteResponse[])
        .filter(note => note.items?.length > 0)
        .map(note => ({
          id: note.id,
          content: note.content,
          item: {
            id: note.items[0].id,
            user_id: note.items[0].user_id,
            title: note.items[0].title,
            created_at: note.items[0].created_at,
            updated_at: note.items[0].updated_at,
            item_type: note.items[0].item_type,
            is_archived: note.items[0].is_archived,
            archived_at: note.items[0].archived_at,
            archive_reason: note.items[0].archive_reason
          }
        }))

      setNotes(combinedNotes)
      
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