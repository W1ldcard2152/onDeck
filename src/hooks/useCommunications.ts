'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database, CommunicationMedium, TimeOfDay } from '@/types/database.types'

export type Communication = Database['public']['Tables']['communications']['Row']

export function useCommunications(userId: string | undefined, relationshipId?: string) {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchCommunications() {
    try {
      if (!userId) {
        setCommunications([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching communications for user:', userId, 'relationship:', relationshipId)
      setIsLoading(true)

      const supabase = createClientComponentClient()

      let query = supabase
        .from('communications')
        .select('*')
        .eq('user_id', userId)
        .order('communication_date', { ascending: false });

      if (relationshipId) {
        query = query.eq('relationship_id', relationshipId);
      }

      const { data, error: communicationsError } = await query;

      console.log('Communications query response:', { data, communicationsError });

      if (communicationsError) throw communicationsError;

      setCommunications(data || []);

    } catch (e) {
      console.error('Error in fetchCommunications:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching communications'))
    } finally {
      setIsLoading(false)
    }
  }

  async function createCommunication(communication: {
    relationship_id: string;
    medium: CommunicationMedium;
    medium_other?: string;
    summary: string;
    communication_date?: string;
    time_of_day?: TimeOfDay;
    time_of_day_other?: string;
  }) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient();

    const { data, error } = await supabase
      .from('communications')
      .insert({
        user_id: userId,
        relationship_id: communication.relationship_id,
        medium: communication.medium,
        medium_other: communication.medium_other || null,
        summary: communication.summary,
        communication_date: communication.communication_date || new Date().toISOString(),
        time_of_day: communication.time_of_day || null,
        time_of_day_other: communication.time_of_day_other || null,
        synced: false,
      })
      .select()
      .single();

    if (error) throw error;

    await fetchCommunications();
    return data;
  }

  async function updateCommunication(id: string, updates: {
    relationship_id?: string;
    medium?: CommunicationMedium;
    medium_other?: string;
    summary?: string;
    communication_date?: string;
    time_of_day?: TimeOfDay;
    time_of_day_other?: string;
  }) {
    const supabase = createClientComponentClient();

    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('communications')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await fetchCommunications();
    return data;
  }

  async function deleteCommunication(id: string) {
    if (!userId) throw new Error('User not authenticated');

    const supabase = createClientComponentClient();

    const { error } = await supabase
      .from('communications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await fetchCommunications();
  }

  useEffect(() => {
    fetchCommunications()
  }, [userId, relationshipId])

  return {
    communications,
    isLoading,
    error,
    refetch: fetchCommunications,
    createCommunication,
    updateCommunication,
    deleteCommunication
  }
}
