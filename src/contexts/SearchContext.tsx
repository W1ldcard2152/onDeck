import React, { createContext, useContext, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';

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
  
  const supabase = createClientComponentClient<Database>();

  const handleSetSearchQuery = useCallback((query: string) => {
    console.log('Setting search query:', query);
    setSearchQuery(query);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    console.log('Performing search for:', query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search in items table first to get all matching items
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .or(`title.ilike.%${query}%`)
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

      console.log('Search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [supabase]);

  const clearSearch = useCallback(() => {
    console.log('Clearing search');
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