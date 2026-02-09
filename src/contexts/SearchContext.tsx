import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { validateSearchQuery } from '@/lib/validate';

interface SearchResult {
  id: string;
  title: string;
  type: 'task' | 'note';
  preview: string;
  date: string;
}

interface SearchContextType {
  isSearching: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  showResults: boolean;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  setShowResults: (show: boolean) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const supabaseRef = useRef(getSupabaseClient());

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const sanitizedQuery = validateSearchQuery(query);
    if (!sanitizedQuery) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = supabaseRef.current;
    try {
      // Search in items table first to get all matching items
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .or(`title.ilike.%${sanitizedQuery}%`)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      if (!items?.length) {
        setSearchResults([]);
        return;
      }

      // Get additional details for tasks
      const taskIds = items.filter(item => item.item_type === 'task').map(item => item.id);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .in('id', taskIds);

      // Get additional details for notes
      const noteIds = items.filter(item => item.item_type === 'note').map(item => item.id);
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .in('id', noteIds);

      // Combine and format results
      const results: SearchResult[] = items.map(item => {
        const task = tasks?.find(t => t.id === item.id);
        const note = notes?.find(n => n.id === item.id);

        return {
          id: item.id,
          title: item.title,
          type: item.item_type as 'task' | 'note',
          preview: task?.description || note?.content || '',
          date: item.created_at
        };
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  }, []);

  const value = {
    isSearching,
    searchQuery,
    searchResults,
    showResults,
    setSearchQuery: handleSetSearchQuery,
    performSearch,
    clearSearch,
    setShowResults
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
