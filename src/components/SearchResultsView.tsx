'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { FileText, CheckSquare, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import type { SectionType } from '@/components/layouts/responsiveNav/types';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchResultsViewProps {
  onClose: () => void;
  onNavigate?: (section: SectionType) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ 
  onClose,
  onNavigate 
}) => {
  const { searchQuery, searchResults, isSearching } = useSearch();
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['exact', 'partial']);

  const toggleGroup = (groupType: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupType) 
        ? prev.filter(t => t !== groupType)
        : [...prev, groupType]
    );
  };

  const handleResultClick = (result: any) => {
    setSelectedResult(result);
    // If onNavigate is provided and the result has a type that maps to a section
    if (onNavigate && (result.type === 'task' || result.type === 'note')) {
      onNavigate(result.type === 'task' ? 'tasks' : 'notes');
      onClose();
    }
  };

  const renderDetailedView = (result: any) => {
    if (result.type === 'task') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(result.status || 'on_deck')}>
              {result.status || 'On Deck'}
            </Badge>
            {result.priority && (
              <Badge variant="outline">
                Priority: {result.priority}
              </Badge>
            )}
          </div>
          
          {result.preview && (
            <div className="mt-2 text-gray-700">
              {result.preview}
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {result.assigned_date && (
              <div>Assigned: {format(new Date(result.assigned_date), 'PP')}</div>
            )}
            {result.due_date && (
              <div>Due: {format(new Date(result.due_date), 'PP')}</div>
            )}
          </div>
        </div>
      );
    }
    
    if (result.type === 'note') {
      return (
        <div className="space-y-4">
          {result.preview && (
            <div className="mt-2 text-gray-700 whitespace-pre-line">
              {result.preview}
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            Created: {format(new Date(result.date), 'PP')}
          </div>
        </div>
      );
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'on_deck': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Group results into exact and partial matches
  const groupedResults = React.useMemo(() => {
    if (!searchQuery || !searchResults.length) return [];

    return searchResults.reduce((acc: any[], result) => {
      const isExactMatch = result.title.toLowerCase().includes(searchQuery.toLowerCase());
      const group = isExactMatch ? 'exact' : 'partial';
      const existingGroup = acc.find(g => g.type === group);
      
      if (existingGroup) {
        existingGroup.results.push(result);
      } else {
        acc.push({
          type: group,
          label: group === 'exact' ? 'Exact Matches' : 'Partial Matches',
          results: [result]
        });
      }
      
      return acc;
    }, []);
  }, [searchResults, searchQuery]);

  if (isSearching) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="text-gray-500 text-center">Searching...</div>
        </div>
      </div>
    );
  }

  if (!searchQuery || searchResults.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="text-gray-500 text-center">
            {searchQuery ? `No results found for "${searchQuery}"` : 'Please enter a search term'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Search Results for "{searchQuery}"
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {groupedResults.map((group) => (
            <Card key={group.type}>
              <CardHeader className="py-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleGroup(group.type)}
                >
                  <CardTitle className="text-base">
                    {group.label} ({group.results.length})
                  </CardTitle>
                  {expandedGroups.includes(group.type) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {expandedGroups.includes(group.type) && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {group.results.map((result: any) => (
                      <div
                        key={result.id}
                        className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-start gap-3">
                          {result.type === 'note' ? (
                            <FileText className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <CheckSquare className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          )}
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-medium text-gray-900">
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
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedResult && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedResult.title}</DialogTitle>
              </DialogHeader>
              {renderDetailedView(selectedResult)}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};