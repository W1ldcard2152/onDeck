'use client'

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

      // Query notes and join with items
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select(`
          *,
          item:items!inner (
            id,
            user_id,
            title,
            created_at,
            updated_at,
            item_type,
            is_archived,
            archived_at,
            archive_reason
          )
        `)
        .eq('items.user_id', userId)
        .eq('items.item_type', 'note')
        .eq('items.is_archived', false)
        .order('created_at', { foreignTable: 'items', ascending: false })
        .limit(limit)

      console.log('Notes query result:', {
        success: !noteError,
        count: noteData?.length,
        data: noteData
      })

      if (noteError) {
        console.error('Note query error:', noteError)
        throw noteError
      }

      if (!noteData) {
        console.log('No note data returned')
        setNotes([])
        return
      }

      // Transform the data into the expected format
      const combinedNotes = noteData.map(note => ({
        id: note.id,
        content: note.content,
        item: note.item
      })) as NoteWithDetails[]

      console.log('Processed notes:', combinedNotes)
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