'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { NoteWithDetails } from '@/lib/types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useTrainOfThought(userId: string | undefined) {
  const [currentThought, setCurrentThought] = useState<NoteWithDetails | null>(null)
  const [thoughtHistory, setThoughtHistory] = useState<NoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch the current active thought and history
  const fetchThoughts = useCallback(async () => {
    if (!userId) {
      setCurrentThought(null)
      setThoughtHistory([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const supabase = supabaseRef.current

      // Get all thoughts (note_type = 'thought')
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'note')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (itemsError) throw itemsError

      if (!itemsData || itemsData.length === 0) {
        setCurrentThought(null)
        setThoughtHistory([])
        return
      }

      const itemIds = itemsData.map(item => item.id)
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .in('id', itemIds)
        .eq('note_type', 'thought')

      if (notesError) throw notesError

      const thoughts = itemsData
        .map(item => {
          const noteData = notesData?.find(note => note.id === item.id)
          if (!noteData) return null

          return {
            id: item.id,
            content: noteData.content || null,
            url: noteData.url || null,
            file_path: noteData.file_path || null,
            entry_type: noteData.entry_type || 'note',
            note_type: noteData.note_type || 'thought',
            knowledge_base_id: noteData.knowledge_base_id || null,
            item: item
          } as NoteWithDetails
        })
        .filter((note): note is NoteWithDetails => note !== null)

      // The most recent thought is the "current" scratchpad
      if (thoughts.length > 0) {
        setCurrentThought(thoughts[0])
        setThoughtHistory(thoughts.slice(1))
      } else {
        setCurrentThought(null)
        setThoughtHistory([])
      }

    } catch (e) {
      console.error('Error fetching thoughts:', e)
      setError(e instanceof Error ? e : new Error('Failed to fetch thoughts'))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Create a new thought (initial scratchpad)
  const createThought = useCallback(async (content: string = '') => {
    if (!userId) return null

    try {
      const supabase = supabaseRef.current

      // Create item first
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert({
          user_id: userId,
          title: 'Train of Thought',
          item_type: 'note',
          is_archived: false
        })
        .select()
        .single()

      if (itemError) throw itemError

      // Create note
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert({
          id: itemData.id,
          content: content,
          note_type: 'thought',
          entry_type: 'note'
        })
        .select()
        .single()

      if (noteError) throw noteError

      const newThought: NoteWithDetails = {
        id: itemData.id,
        content: noteData.content || null,
        url: noteData.url || null,
        file_path: noteData.file_path || null,
        entry_type: noteData.entry_type || 'note',
        note_type: noteData.note_type || 'thought',
        knowledge_base_id: noteData.knowledge_base_id || null,
        item: itemData
      }

      return newThought
    } catch (e) {
      console.error('Error creating thought:', e)
      setError(e instanceof Error ? e : new Error('Failed to create thought'))
      return null
    }
  }, [userId])

  // Save/update the current thought with debounce
  const saveThought = useCallback(async (content: string, thoughtId?: string) => {
    if (!userId) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true)
        const supabase = supabaseRef.current

        let targetId = thoughtId || currentThought?.id

        // If no current thought exists, create a new one
        if (!targetId) {
          const newThought = await createThought(content)
          if (newThought) {
            setCurrentThought(newThought)
            setLastSaved(new Date())
          }
          return
        }

        // Update existing thought
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            content: content
          })
          .eq('id', targetId)

        if (updateError) throw updateError

        // Update local state
        if (currentThought && currentThought.id === targetId) {
          setCurrentThought({
            ...currentThought,
            content: content
          })
        }

        setLastSaved(new Date())
      } catch (e) {
        console.error('Error saving thought:', e)
        setError(e instanceof Error ? e : new Error('Failed to save thought'))
      } finally {
        setIsSaving(false)
      }
    }, 2000) // 2 second debounce
  }, [userId, currentThought, createThought])

  // Manual save (bypasses debounce)
  const saveNow = useCallback(async (content: string, thoughtId?: string) => {
    if (!userId) return

    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    try {
      setIsSaving(true)
      const supabase = supabaseRef.current

      let targetId = thoughtId || currentThought?.id

      if (!targetId) {
        const newThought = await createThought(content)
        if (newThought) {
          setCurrentThought(newThought)
          setLastSaved(new Date())
        }
        return
      }

      const { error: updateError } = await supabase
        .from('notes')
        .update({
          content: content
        })
        .eq('id', targetId)

      if (updateError) throw updateError

      if (currentThought && currentThought.id === targetId) {
        setCurrentThought({
          ...currentThought,
          content: content
        })
      }

      setLastSaved(new Date())
    } catch (e) {
      console.error('Error saving thought:', e)
      setError(e instanceof Error ? e : new Error('Failed to save thought'))
    } finally {
      setIsSaving(false)
    }
  }, [userId, currentThought, createThought])

  // Clear all - archives current thought and creates new blank one
  const clearAll = useCallback(async () => {
    if (!userId || !currentThought) return

    try {
      const supabase = supabaseRef.current

      // Archive the current thought (moves to history)
      // We don't actually archive it, we just create a new one
      // The old one becomes part of history automatically

      const newThought = await createThought('')
      if (newThought) {
        // Move current to history
        setThoughtHistory(prev => [currentThought, ...prev])
        setCurrentThought(newThought)
        setLastSaved(new Date())
      }
    } catch (e) {
      console.error('Error clearing thought:', e)
      setError(e instanceof Error ? e : new Error('Failed to clear thought'))
    }
  }, [userId, currentThought, createThought])

  // Save a text selection as a new formal note (doesn't affect current thought)
  const saveSelectionAsNote = useCallback(async (title: string, selectedContent: string) => {
    if (!userId || !selectedContent.trim()) return

    try {
      const supabase = supabaseRef.current

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert({
          user_id: userId,
          title: title,
          item_type: 'note',
          is_archived: false
        })
        .select()
        .single()

      if (itemError) throw itemError

      const { error: noteError } = await supabase
        .from('notes')
        .insert({
          id: itemData.id,
          content: selectedContent,
          note_type: 'note',
          entry_type: 'note'
        })

      if (noteError) throw noteError
    } catch (e) {
      console.error('Error saving selection as note:', e)
      setError(e instanceof Error ? e : new Error('Failed to save selection as note'))
    }
  }, [userId])

  // Save as formal note - changes note_type to 'note' and updates title and content
  const saveAsNote = useCallback(async (title: string, content: string) => {
    if (!userId || !currentThought) return

    try {
      const supabase = supabaseRef.current

      // Update the note type and content
      const { error: noteError } = await supabase
        .from('notes')
        .update({ note_type: 'note', content })
        .eq('id', currentThought.id)

      if (noteError) throw noteError

      // Update the item title
      const { error: itemError } = await supabase
        .from('items')
        .update({ title: title })
        .eq('id', currentThought.id)

      if (itemError) throw itemError

      // Create a new blank thought
      const newThought = await createThought('')
      if (newThought) {
        setCurrentThought(newThought)
        setLastSaved(new Date())
      }

    } catch (e) {
      console.error('Error saving as note:', e)
      setError(e instanceof Error ? e : new Error('Failed to save as note'))
    }
  }, [userId, currentThought, createThought])

  // Load a thought from history
  const loadFromHistory = useCallback(async (thoughtId: string) => {
    const thought = thoughtHistory.find(t => t.id === thoughtId)
    if (!thought) return

    // Move current thought to history
    if (currentThought) {
      setThoughtHistory(prev => [currentThought, ...prev.filter(t => t.id !== thoughtId)])
    }

    // Set the selected thought as current
    setCurrentThought(thought)
  }, [currentThought, thoughtHistory])

  useEffect(() => {
    fetchThoughts()
  }, [fetchThoughts])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    currentThought,
    thoughtHistory,
    isLoading,
    isSaving,
    lastSaved,
    error,
    saveThought,
    saveNow,
    clearAll,
    saveAsNote,
    saveSelectionAsNote,
    loadFromHistory,
    refetch: fetchThoughts
  }
}
