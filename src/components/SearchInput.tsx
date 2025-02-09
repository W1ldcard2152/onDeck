import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSearch } from '@/contexts/SearchContext';
import { SearchResults } from '@/components/SearchResults';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    searchQuery,
    setSearchQuery,
    performSearch,
    clearSearch,
    isSearching
  } = useSearch();

  // Handle search query changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length >= 2) {
      performSearch(query);
      setIsOpen(true);
    } else {
      clearSearch();
      setIsOpen(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length >= 2) {
      performSearch(searchQuery);
      setIsOpen(true);
    }
  };

  // Clear search and close popover
  const handleClear = () => {
    clearSearch();
    setIsOpen(false);
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

  // Mobile expanded view
  if (mobile && expanded) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search tasks, notes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100"
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
          </div>
        </form>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onExpandedChange?.(false)}
        >
          <X className="h-5 w-5 text-gray-600" />
        </Button>
        {isOpen && searchQuery && (
          <div className="absolute left-0 right-0 top-16 bg-white border-t shadow-lg z-50">
            <SearchResults 
              onItemClick={(section) => {
                onSectionChange?.(section);
                onExpandedChange?.(false);
                clearSearch();
              }}
              onClose={() => {
                setIsOpen(false);
                onExpandedChange?.(false);
                clearSearch();
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search tasks, notes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100"
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
      </PopoverTrigger>
      <PopoverContent 
        className="w-[500px] p-0" 
        align="start"
        sideOffset={5}
      >
        <SearchResults 
          onItemClick={(section) => {
            onSectionChange?.(section);
            setIsOpen(false);
            clearSearch();
          }}
          onClose={() => {
            setIsOpen(false);
            clearSearch();
          }}
        />
      </PopoverContent>
    </Popover>
  );
};