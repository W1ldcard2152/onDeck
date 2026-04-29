'use client'

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Context, ContextColor } from '@/lib/types';

export function useContexts() {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContexts = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('contexts')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setContexts((data as Context[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContexts(); }, [fetchContexts]);

  const addContext = useCallback(async (name: string, emoji: string, color: ContextColor) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const maxOrder = contexts.reduce((m, c) => Math.max(m, c.sort_order), 0);

    const { data, error } = await supabase
      .from('contexts')
      .insert({ user_id: user.id, name, emoji, color, sort_order: maxOrder + 1 })
      .select()
      .single();

    if (error) return { error: error.message };
    setContexts(prev => [...prev, data as Context]);
    return { error: null };
  }, [contexts]);

  const updateContext = useCallback(async (
    id: string,
    updates: Partial<Pick<Context, 'name' | 'emoji' | 'color'>>,
  ) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('contexts')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };
    setContexts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    return { error: null };
  }, []);

  const deleteContext = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('contexts').delete().eq('id', id);
    if (error) return { error: error.message };
    setContexts(prev => prev.filter(c => c.id !== id));
    return { error: null };
  }, []);

  const reorderContexts = useCallback(async (reordered: Context[]) => {
    setContexts(reordered);
    const supabase = getSupabaseClient();
    await Promise.all(
      reordered.map((c, i) =>
        supabase.from('contexts').update({ sort_order: i + 1 }).eq('id', c.id)
      )
    );
  }, []);

  /** Returns the count of tasks using the given context ID, for deletion guard. */
  const getTaskCount = useCallback(async (contextId: string): Promise<number> => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('tasks')
      .select('id, daily_context')
      .not('daily_context', 'is', null);

    if (!data) return 0;
    return data.filter(t => {
      try { return (JSON.parse(t.daily_context!) as string[]).includes(contextId); }
      catch { return false; }
    }).length;
  }, []);

  return {
    contexts,
    loading,
    error,
    addContext,
    updateContext,
    deleteContext,
    reorderContexts,
    getTaskCount,
    refetch: fetchContexts,
  };
}
