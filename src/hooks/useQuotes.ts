'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { QuoteWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useQuotes(userId: string | undefined, limit: number = 100, includeArchived: boolean = false) {
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  const isFetchingRef = useRef(false)

  const fetchQuotes = useCallback(async () => {
    if (isFetchingRef.current) return

    if (!userId) {
      setQuotes([]);
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true

    try {
      setIsLoading(true)

      const supabase = supabaseRef.current

      // Query items first - conditionally include archived quotes
      let query = supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'quote')
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data: itemsData, error: itemsError } = await query.limit(includeArchived ? limit * 2 : limit);

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        setQuotes([]);
        return;
      }

      // Get the quote content for each item
      const itemIds = itemsData.map(item => item.id);
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .in('id', itemIds);

      if (quotesError) throw quotesError;

      // Combine items and quotes - only include items that have corresponding quotes
      const combinedQuotes = itemsData
        .map(item => {
          const quoteData = quotesData?.find(quote => quote.id === item.id);

          // Only return if we have quote data
          if (!quoteData) return null;

          return {
            id: item.id,
            content: quoteData.content,
            author: quoteData.author || null,
            source: quoteData.source || null,
            created_at: quoteData.created_at,
            updated_at: quoteData.updated_at,
            item: item
          };
        })
        .filter((quote): quote is QuoteWithDetails => quote !== null) as QuoteWithDetails[];

      setQuotes(combinedQuotes);

    } catch (e) {
      console.error('Error in fetchQuotes:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching quotes'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId, limit, includeArchived])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  return { quotes, isLoading, error, refetch: fetchQuotes }
}
