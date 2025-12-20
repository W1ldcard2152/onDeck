'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database.types'

export type Relationship = Database['public']['Tables']['relationships']['Row']

export function useRelationships(userId: string | undefined) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchRelationships = useCallback(async () => {
    try {
      if (!userId) {
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching relationships for user:', userId)
      setIsLoading(true)

      const supabase = createClientComponentClient<Database>()

      const { data, error: relationshipsError } = await supabase
        .from('relationships')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      console.log('Relationships query response:', { data, relationshipsError });

      if (relationshipsError) throw relationshipsError;

      setRelationships(data || []);

    } catch (e) {
      console.error('Error in fetchRelationships:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching relationships'))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  async function createRelationship(relationship: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient<Database>();

    const { data, error } = await supabase
      .from('relationships')
      .insert({
        user_id: userId,
        name: relationship.name,
        phone: relationship.phone || null,
        email: relationship.email || null,
        address: relationship.address || null,
        notes: relationship.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    await fetchRelationships();
    return data;
  }

  async function updateRelationship(id: string, updates: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }) {
    const supabase = createClientComponentClient<Database>();

    const { data, error } = await supabase
      .from('relationships')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await fetchRelationships();
    return data;
  }

  async function deleteRelationship(id: string) {
    const supabase = createClientComponentClient<Database>();

    const { error } = await supabase
      .from('relationships')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await fetchRelationships();
  }

  useEffect(() => {
    fetchRelationships()
  }, [fetchRelationships])

  return {
    relationships,
    isLoading,
    error,
    refetch: fetchRelationships,
    createRelationship,
    updateRelationship,
    deleteRelationship
  }
}
