'use client'

import React, { useState, useEffect, useMemo } from 'react';
import TruncatedCell from './TruncatedCell';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NewQuoteForm } from '@/components/NewQuoteForm';
import type { Database } from '@/types/database.types';
import type { QuoteWithDetails } from '@/lib/types';

type SortDirection = 'asc' | 'desc' | null;
type SortField = 'quote' | 'author' | 'source' | 'created_at' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
  level: number;
}

interface QuotesTableProps {
  quotes: QuoteWithDetails[];
  onQuoteUpdate: () => void;
}

interface QuotesTableBaseProps {
  quotes: QuoteWithDetails[];
  onQuoteUpdate: () => void;
  sorts: SortState[];
  onSort: (field: SortField) => void;
  deleteQuote: (quoteId: string) => Promise<void>;
  onEditQuote: (quote: QuoteWithDetails) => void;
}

const QuotesTableBase = ({
  quotes,
  onQuoteUpdate,
  sorts,
  onSort,
  deleteQuote,
  onEditQuote
}: QuotesTableBaseProps) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const getSortIcon = (field: SortField): JSX.Element | null => {
    const sort = sorts.find(s => s.field === field);
    if (!sort) return null;

    const getIconColor = (level: number): string => {
      switch(level) {
        case 1: return "text-blue-600";
        case 2: return "text-blue-400";
        case 3: return "text-blue-300";
        default: return "text-blue-600";
      }
    };

    return (
      <span className="ml-2 inline-flex items-center gap-1" title={`Sort level ${sort.level}`}>
        <div className={`flex items-center ${getIconColor(sort.level)}`}>
          {sort.direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {sort.level > 1 && (
            <span className="text-xs ml-0.5">{sort.level}</span>
          )}
        </div>
      </span>
    );
  };

  const handleDeleteClick = (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (quoteToDelete) {
      setLoading(prev => ({ ...prev, [quoteToDelete]: true }));
      try {
        await deleteQuote(quoteToDelete);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete quote');
      } finally {
        setLoading(prev => ({ ...prev, [quoteToDelete]: false }));
        setQuoteToDelete(null);
        setDeleteConfirmOpen(false);
      }
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => onSort('quote')}
                  className="hover:bg-gray-100"
                >
                  Quote {getSortIcon('quote')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => onSort('author')}
                  className="hover:bg-gray-100"
                >
                  Author {getSortIcon('author')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => onSort('source')}
                  className="hover:bg-gray-100"
                >
                  Source {getSortIcon('source')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => onSort('created_at')}
                  className="hover:bg-gray-100"
                >
                  Date Added {getSortIcon('created_at')}
                </Button>
              </TableHead>
              <TableHead className="w-12 text-right">
                <span className="text-sm font-medium">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const isLoading = loading[quote.id];

              return (
                <TableRow key={quote.id}>
                  <TableCell className="max-w-[32rem]">
                    <TruncatedCell content={quote.content} maxLength={150} />
                  </TableCell>
                  <TableCell>
                    {quote.author || <span className="text-gray-400">Unknown</span>}
                  </TableCell>
                  <TableCell>
                    {quote.source || <span className="text-gray-400">None</span>}
                  </TableCell>
                  <TableCell>
                    {format(new Date(quote.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEditQuote(quote)}
                          disabled={isLoading}
                        >
                          Edit Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(quote.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 focus:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Quote
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this quote?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the quote and all its content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const QuotesTable = ({ quotes: initialQuotes, onQuoteUpdate }: QuotesTableProps) => {
  const [sorts, setSorts] = useState<SortState[]>([]);
  const [localQuotes, setLocalQuotes] = useState(initialQuotes);
  const [quoteToEdit, setQuoteToEdit] = useState<QuoteWithDetails | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    setLocalQuotes(initialQuotes);
  }, [initialQuotes]);

  const handleSort = (field: SortField): void => {
    setSorts(prevSorts => {
      const existingIndex = prevSorts.findIndex(sort => sort.field === field);

      if (existingIndex === -1) {
        if (prevSorts.length >= 3) return prevSorts;
        return [...prevSorts, { field, direction: 'asc', level: prevSorts.length + 1 }];
      }

      const existing = prevSorts[existingIndex];
      const newSorts = [...prevSorts];

      if (existing.direction === 'asc') {
        newSorts[existingIndex] = { ...existing, direction: 'desc' };
      } else {
        newSorts.splice(existingIndex, 1);
        return newSorts.map((sort, index) => ({
          ...sort,
          level: index + 1
        }));
      }

      return newSorts;
    });
  };

  const deleteQuote = async (quoteId: string): Promise<void> => {
    try {
      // First, delete from the quotes table
      const { error: quoteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      // Then, delete from the items table
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', quoteId);

      if (itemError) throw itemError;

      // Remove from local state
      setLocalQuotes(prevQuotes => prevQuotes.filter(quote => quote.id !== quoteId));

      // Notify parent component
      await onQuoteUpdate();

    } catch (err) {
      console.error('Error deleting quote:', err);
      throw err;
    }
  };

  const sortedQuotes = useMemo(() => {
    return [...localQuotes].sort((a, b) => {
      for (const sort of sorts) {
        let comparison = 0;

        switch (sort.field) {
          case 'quote': {
            comparison = (a.content || '').localeCompare(b.content || '');
            break;
          }
          case 'author': {
            comparison = (a.author || '').localeCompare(b.author || '');
            break;
          }
          case 'source': {
            comparison = (a.source || '').localeCompare(b.source || '');
            break;
          }
          case 'created_at': {
            const aDate = new Date(a.created_at).getTime();
            const bDate = new Date(b.created_at).getTime();
            comparison = aDate - bDate;
            break;
          }
        }

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [localQuotes, sorts]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow">
        <QuotesTableBase
          quotes={sortedQuotes}
          onQuoteUpdate={onQuoteUpdate}
          sorts={sorts}
          onSort={handleSort}
          deleteQuote={deleteQuote}
          onEditQuote={setQuoteToEdit}
        />
      </div>

      {quoteToEdit && (
        <NewQuoteForm
          initialData={quoteToEdit}
          isEditing={true}
          onQuoteCreated={() => {
            onQuoteUpdate();
            setQuoteToEdit(null);
          }}
          onClose={() => setQuoteToEdit(null)}
          open={!!quoteToEdit}
          setOpen={(open) => !open && setQuoteToEdit(null)}
        />
      )}
    </div>
  );
};

export { QuotesTable };
export default QuotesTable;
