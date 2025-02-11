import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSearch } from '@/contexts/SearchContext';
import { SearchResults } from '@/components/SearchResults';
import { SearchResultsView } from '@/components/SearchResultsView';
import { Input } from "@/components/ui/input";
import type { SectionType } from '@/components/layouts/responsiveNav/types';

interface SearchInputProps {
  className?: string;
  mobile?: boolean;
  onSectionChange?: (section: SectionType) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  className,
  mobile = false,
  onSectionChange,
  expanded,
  onExpandedChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullResults, setShowFullResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    searchQuery,
    setSearchQuery,
    performSearch,
    clearSearch,
    isSearching,
    searchResults
  } = useSearch();

  // Handle search query changes
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);

    if (newValue.length >= 2) {
      await performSearch(newValue);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length >= 2) {
      await performSearch(searchQuery);
      setShowFullResults(true);
      setIsOpen(false);
    }
  };

  // Clear search
  const handleClear = () => {
    setSearchQuery('');
    clearSearch();
    setIsOpen(false);
    setShowFullResults(false);
    if (mobile && onExpandedChange) {
      onExpandedChange(false);
    }
    inputRef.current?.focus();
  };

  // Focus input when expanded (mobile only)
  useEffect(() => {
    if (mobile && expanded) {
      inputRef.current?.focus();
    }
  }, [mobile, expanded]);

  return (
    <>
      <div className={cn("relative", className)}>
        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tasks, notes..."
            className="w-full pl-10 pr-4 py-2"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </form>
        
        {isOpen && !showFullResults && searchQuery.length >= 2 && (
          <div className="absolute top-full w-full bg-white shadow-lg rounded-lg mt-1 z-50">
            <SearchResults 
              onItemClick={() => {
                setShowFullResults(true);
                setIsOpen(false);
              }}
              onClose={() => setIsOpen(false)}
            />
            {searchResults.length > 0 && (
              <div className="p-2 border-t">
                <button
                  onClick={() => setShowFullResults(true)}
                  className="w-full text-sm text-blue-600 hover:text-blue-700 text-center"
                >
                  Show all results
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showFullResults && (
        <div className="fixed md:pl-64 left-0 right-0 top-16 bottom-0 bg-gray-50 overflow-y-auto z-40">
          <div className="container max-w-[calc(100vw-theme(spacing.64)-theme(spacing.16))] md:pr-4 mx-auto p-4 md:p-6">
            <SearchResultsView 
              onClose={() => {
                setShowFullResults(false);
                handleClear();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};