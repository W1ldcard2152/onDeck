'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database, ResourceType } from '@/types/database.types'

export type CatalogEntry = Database['public']['Tables']['catalog']['Row']

export function useCatalog(userId: string | undefined) {
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchCatalogEntries = useCallback(async () => {
    try {
      if (!userId) {
        setCatalogEntries([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching catalog entries for user:', userId)
      setIsLoading(true)

      const supabase = createClientComponentClient<Database>()

      const { data, error: catalogError } = await supabase
        .from('catalog')
        .select('*')
        .eq('user_id', userId)
        .order('capture_date', { ascending: false });

      console.log('Catalog query response:', { data, catalogError });

      if (catalogError) throw catalogError;

      setCatalogEntries(data || []);

    } catch (e) {
      console.error('Error in fetchCatalogEntries:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching catalog entries'))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  async function createCatalogEntry(entry: {
    url: string;
    title?: string;
    description?: string;
    resource_type?: ResourceType;
  }) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient<Database>();

    const { data, error } = await supabase
      .from('catalog')
      .insert({
        user_id: userId,
        url: entry.url,
        title: entry.title || null,
        description: entry.description || null,
        resource_type: entry.resource_type || null,
      })
      .select()
      .single();

    if (error) throw error;

    await fetchCatalogEntries();
    return data;
  }

  async function updateCatalogEntry(id: string, updates: {
    url?: string;
    title?: string;
    description?: string;
    resource_type?: ResourceType;
  }) {
    const supabase = createClientComponentClient<Database>();

    const { data, error } = await supabase
      .from('catalog')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await fetchCatalogEntries();
    return data;
  }

  async function deleteCatalogEntry(id: string) {
    const supabase = createClientComponentClient<Database>();

    const { error } = await supabase
      .from('catalog')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await fetchCatalogEntries();
  }

  useEffect(() => {
    fetchCatalogEntries()
  }, [fetchCatalogEntries])

  return {
    catalogEntries,
    isLoading,
    error,
    refetch: fetchCatalogEntries,
    createCatalogEntry,
    updateCatalogEntry,
    deleteCatalogEntry
  }
}
