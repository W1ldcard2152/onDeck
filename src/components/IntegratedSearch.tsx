import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { SearchResults } from '@/components/SearchResults';
import { SearchResultsView } from '@/components/SearchResultsView';
import { useSearch } from '@/contexts/SearchContext';
import type { SectionType } from '@/components/layouts/responsiveNav/types';

interface IntegratedSearchProps {
  className?: string;
  onSectionChange: (section: SectionType) => void;
  activeSection: SectionType;
}

const IntegratedSearch: React.FC<IntegratedSearchProps> = ({ 
  className,
  onSectionChange,
  activeSection
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullResults, setShowFullResults] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    performSearch,
    clearSearch,
    searchResults
  } = useSearch();

  // Watch for section changes and close search if needed
  useEffect(() => {
    if (showFullResults) {
      handleClear();
    }
  }, [activeSection]);

  const handleSearchChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    
    if (newValue.length >= 2) {
      await performSearch(newValue);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    clearSearch();
    setIsOpen(false);
    setShowFullResults(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.length >= 2) {
      await performSearch(searchQuery);
      setShowFullResults(true);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative flex-1">
      <div className="max-w-md relative">
        <form onSubmit={handleSubmit}>
          <Input
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
      </div>

      {/* Dropdown Results */}
      {isOpen && !showFullResults && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 w-full max-w-md bg-white shadow-lg rounded-lg mt-1 z-30">
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
                onClick={() => {
                  setShowFullResults(true);
                  setIsOpen(false);
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 text-center"
              >
                Show all results
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Screen Results */}
      {showFullResults && (
        <div className="fixed md:left-64 right-0 top-0 bottom-0 bg-white z-20">
          <div className="h-16 border-b flex items-center px-4 sticky top-0 bg-white">
            <div className="max-w-md flex-1">
              <form onSubmit={handleSubmit}>
                <Input
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
            </div>
            <button
              onClick={handleClear}
              className="ml-4 text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          <div className="p-4">
            <div className="max-w-5xl mx-auto">
              <SearchResultsView onClose={handleClear} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedSearch;