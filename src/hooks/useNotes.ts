'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { NoteWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useNotes(userId: string | undefined, limit: number = 10, includeArchived: boolean = false) {
  const [notes, setNotes] = useState<NoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  const isFetchingRef = useRef(false)

  const fetchNotes = useCallback(async () => {
    if (isFetchingRef.current) return
    
    if (!userId) {
      setNotes([]);
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true
    
    try {
      setIsLoading(true)
      
      const supabase = supabaseRef.current

      // Query items first - conditionally include archived notes
      let query = supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'note')
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data: itemsData, error: itemsError } = await query.limit(includeArchived ? limit * 2 : limit);

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
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

      if (notesError) throw notesError;

      // Combine items and notes - only include items that have corresponding notes
      const combinedNotes = itemsData
        .map(item => {
          const noteData = notesData?.find(note => note.id === item.id);
          
          // Only return if we have note data
          if (!noteData) return null;
          
          return {
            id: item.id,
            content: noteData.content || null,
            url: noteData.url || null,
            file_path: noteData.file_path || null,
            entry_type: noteData.entry_type || 'note',
            knowledge_base_id: noteData.knowledge_base_id || null,
            knowledge_base: noteData.knowledge_bases ? {
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
            item: item
          };
        })
        .filter((note): note is NoteWithDetails => note !== null) as NoteWithDetails[];

      setNotes(combinedNotes);
      
    } catch (e) {
      console.error('Error in fetchNotes:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching notes'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId, limit, includeArchived])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  return { notes, isLoading, error, refetch: fetchNotes }
}