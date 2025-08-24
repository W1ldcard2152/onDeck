'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator'

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  start_date: string;
  end_condition?: {
    type: 'end_date' | 'max_occurrences' | 'none';
    value?: string | number;
  };
  interval: number;
  unit: 'day' | 'week' | 'month' | 'year';
  count_per_unit?: number;
  days_of_week?: string[];
  days_of_month?: number[];
  ordinal_weeks?: Array<{ week: number; day: string }>;
  months_of_year?: number[];
  after_completion?: boolean;
  delay_after_completion?: string;
  skip_conditions?: string[];
  time_of_day?: string;
  custom_exclusions?: string[];
  custom_inclusions?: string[];
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high';
  recurrence_rule: RecurrenceRule;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Legacy fields (keeping for compatibility)
  frequency?: string;
  tracking_type?: string;
  tracking_config?: any;
}

export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  const isFetchingRef = useRef(false)

  const fetchHabits = useCallback(async () => {
    if (isFetchingRef.current) return
    
    if (!userId) {
      setHabits([])
      setIsLoading(false)
      return
    }

    isFetchingRef.current = true
    
    try {
      setIsLoading(true)
      
      const supabase = supabaseRef.current

      const { data: habitsData, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setHabits(habitsData || [])
      
    } catch (e) {
      console.error('Error in fetchHabits:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching habits'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId])

  const createHabit = useCallback(async (habitData: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!userId) throw new Error('User ID required')

    const supabase = supabaseRef.current
    
    // First create the item record
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .insert({
        title: habitData.title,
        user_id: userId,
        item_type: 'habit',
        is_archived: false
      })
      .select()
      .single()

    if (itemError) {
      console.error('Error creating item:', itemError)
      throw itemError
    }

    if (!itemData?.id) {
      throw new Error('Item was not created properly - no ID returned')
    }

    // Then create the habit record with the same ID
    const { data, error } = await supabase
      .from('habits')
      .insert({
        id: itemData.id,
        title: habitData.title,
        description: habitData.description,
        priority: habitData.priority,
        recurrence_rule: habitData.recurrence_rule,
        is_active: habitData.is_active,
        frequency: habitData.frequency || 'daily',
        tracking_type: habitData.tracking_type || 'boolean',
        tracking_config: habitData.tracking_config || {},
        user_id: userId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating habit:', error)
      // Clean up the item if habit creation fails
      await supabase.from('items').delete().eq('id', itemData.id)
      throw error
    }

    // Generate tasks if the habit is active
    if (habitData.is_active) {
      console.log('Generating tasks for habit:', data)
      try {
        const taskGenerator = new HabitTaskGenerator(supabase, userId)
        await taskGenerator.generateTasksForHabit(data)
        console.log('Tasks generated successfully')
      } catch (taskGenError) {
        console.error('Error generating tasks:', taskGenError)
        // Don't throw - let the habit creation succeed even if task generation fails
      }
    }

    // Refresh habits list
    await fetchHabits()
    
    return data
  }, [userId, fetchHabits])

  const updateHabit = useCallback(async (habitId: string, updates: Partial<Habit>) => {
    const supabase = supabaseRef.current
    
    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId)
      .select()
      .single()

    if (error) throw error

    // Refresh habits list
    await fetchHabits()
    
    return data
  }, [fetchHabits])

  const deleteHabit = useCallback(async (habitId: string) => {
    const supabase = supabaseRef.current
    
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)

    if (error) throw error

    // Refresh habits list
    await fetchHabits()
  }, [fetchHabits])

  const toggleHabitActive = useCallback(async (habitId: string, isActive: boolean) => {
    await updateHabit(habitId, { is_active: isActive })
  }, [updateHabit])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  return {
    habits,
    isLoading,
    error,
    refetch: fetchHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleHabitActive
  }
}