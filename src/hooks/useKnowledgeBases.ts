'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database.types'
import type { KnowledgeBase, KnowledgeBaseWithDetails, NoteWithDetails } from '@/lib/types'

export function useKnowledgeBases(userId: string | undefined) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchKnowledgeBases() {
    try {
      if (!userId) {
        setKnowledgeBases([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching knowledge bases for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient()

      const { data, error: kbError } = await supabase
        .from('knowledge_bases')
        .select(`
          *,
          keystones (
            id,
            name,
            description,
            color
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('Knowledge bases query response:', { data, kbError });

      if (kbError) throw kbError;

      const formattedData = data?.map(kb => ({
        id: kb.id,
        user_id: kb.user_id,
        name: kb.name,
        description: kb.description,
        keystone_id: kb.keystone_id,
        entry_count: kb.entry_count,
        created_at: kb.created_at,
        updated_at: kb.updated_at,
        keystone: kb.keystones ? {
          id: kb.keystones.id,
          name: kb.keystones.name,
          description: kb.keystones.description,
          color: kb.keystones.color,
          user_id: '', // Will be filled if needed
          created_at: '', // Will be filled if needed
          updated_at: '' // Will be filled if needed
        } : undefined
      })) || [];

      setKnowledgeBases(formattedData);
      
    } catch (e) {
      console.error('Error in fetchKnowledgeBases:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching knowledge bases'))
    } finally {
      setIsLoading(false)
    }
  }

  async function createKnowledgeBase(kb: {
    name: string;
    description?: string;
    keystone_id?: string;
  }) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        name: kb.name,
        description: kb.description || null,
        keystone_id: kb.keystone_id || null,
        entry_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    
    await fetchKnowledgeBases(); // Refresh the list
    return data;
  }

  async function updateKnowledgeBase(id: string, updates: {
    name?: string;
    description?: string;
    keystone_id?: string;
  }) {
    const supabase = createClientComponentClient();
    
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('knowledge_bases')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await fetchKnowledgeBases(); // Refresh the list
    return data;
  }

  async function deleteKnowledgeBase(id: string) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient();

    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    
    await fetchKnowledgeBases(); // Refresh the list
  }

  async function getKnowledgeBaseWithEntries(id: string): Promise<KnowledgeBaseWithDetails | null> {
    if (!userId) return null;

    const supabase = createClientComponentClient();

    // Get the knowledge base
    const { data: kbData, error: kbError } = await supabase
      .from('knowledge_bases')
      .select(`
        *,
        keystones (
          id,
          name,
          description,
          color
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (kbError) throw kbError;

    // Get notes that belong to this knowledge base
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select(`
        *,
        items!inner (
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
      .eq('knowledge_base_id', id)
      .eq('items.user_id', userId)
      .eq('items.item_type', 'note')
      .order('items.created_at', { ascending: false });

    if (notesError) throw notesError;

    // Transform the data
    const entries: NoteWithDetails[] = notesData?.map(note => ({
      id: note.id,
      content: note.content,
      url: note.url,
      file_path: note.file_path,
      entry_type: note.entry_type,
      note_type: note.note_type || 'note',
      knowledge_base_id: note.knowledge_base_id,
      item: {
        id: note.items.id,
        user_id: note.items.user_id,
        title: note.items.title,
        created_at: note.items.created_at,
        updated_at: note.items.updated_at,
        item_type: note.items.item_type,
        is_archived: note.items.is_archived,
        archived_at: note.items.archived_at,
        archive_reason: note.items.archive_reason
      }
    })) || [];

    return {
      ...kbData,
      keystone: kbData.keystones ? {
        id: kbData.keystones.id,
        name: kbData.keystones.name,
        description: kbData.keystones.description,
        color: kbData.keystones.color,
        user_id: '', created_at: '', updated_at: ''
      } : undefined,
      entries
    };
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [userId])

  return { 
    knowledgeBases, 
    isLoading, 
    error, 
    refetch: fetchKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBaseWithEntries
  }
}