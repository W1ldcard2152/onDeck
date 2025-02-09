import React from 'react';
import { format } from 'date-fns';
import { FileText, CheckSquare } from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import type { SectionType } from '@/components/layouts/responsiveNav/types';

interface SearchResultsProps {
  onItemClick?: (section: SectionType) => void;
  onClose?: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ 
  onItemClick,
  onClose 
}) => {
  const { isSearching, searchResults, searchQuery } = useSearch();

  if (isSearching) {
    return (
      <div className="p-4 text-center text-gray-500">
        Searching...
      </div>
    );
  }

  if (searchResults.length === 0 && searchQuery) {
    return (
      <div className="p-4 text-center text-gray-500">
        No results found for "{searchQuery}"
      </div>
    );
  }

  if (searchResults.length === 0) {
    return null;
  }

  const handleItemClick = (type: 'task' | 'note') => {
    if (onItemClick) {
      onItemClick(type === 'task' ? 'tasks' : 'notes');
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {searchResults.map((result) => (
        <button
          key={result.id}
          className="w-full px-4 py-3 hover:bg-gray-50 flex items-start gap-3 text-left transition-colors"
          onClick={() => handleItemClick(result.type)}
        >
          {result.type === 'note' ? (
            <FileText className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckSquare className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-medium text-gray-900 truncate">
                {result.title}
              </h3>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {format(new Date(result.date), 'MMM d')}
              </span>
            </div>
            
            {result.preview && (
              <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                {result.preview}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};