'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database.types'
import type { Keystone } from '@/lib/types'

export function useKeystones(userId: string | undefined) {
  const [keystones, setKeystones] = useState<Keystone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchKeystones() {
    try {
      if (!userId) {
        setKeystones([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching keystones for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient<Database>()

      const { data, error: keystonesError } = await supabase
        .from('keystones')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('Keystones query response:', { data, keystonesError });

      if (keystonesError) throw keystonesError;

      setKeystones(data || []);
      
    } catch (e) {
      console.error('Error in fetchKeystones:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching keystones'))
    } finally {
      setIsLoading(false)
    }
  }

  async function createKeystone(keystone: {
    name: string;
    description?: string;
    color?: string;
  }) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient<Database>();
    
    const { data, error } = await supabase
      .from('keystones')
      .insert({
        user_id: userId,
        name: keystone.name,
        description: keystone.description || null,
        color: keystone.color || '#3B82F6'
      })
      .select()
      .single();

    if (error) throw error;
    
    await fetchKeystones(); // Refresh the list
    return data;
  }

  async function updateKeystone(id: string, updates: {
    name?: string;
    description?: string;
    color?: string;
  }) {
    const supabase = createClientComponentClient<Database>();
    
    const { data, error } = await supabase
      .from('keystones')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    await fetchKeystones(); // Refresh the list
    return data;
  }

  async function deleteKeystone(id: string) {
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase
      .from('keystones')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    await fetchKeystones(); // Refresh the list
  }

  useEffect(() => {
    fetchKeystones()
  }, [userId])

  return { 
    keystones, 
    isLoading, 
    error, 
    refetch: fetchKeystones,
    createKeystone,
    updateKeystone,
    deleteKeystone
  }
}