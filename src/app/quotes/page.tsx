'use client'

import React from 'react';
import { QuotesTable } from '@/components/QuotesTable';
import { NewQuoteForm } from '@/components/NewQuoteForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useQuotes } from '@/hooks/useQuotes';

export default function QuotesPage() {
  const { user } = useSupabaseAuth();
  const { quotes, isLoading, error, refetch } = useQuotes(user?.id || '', 100, false);

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Quotes</h1>
          <div className="flex gap-2">
            <NewQuoteForm onQuoteCreated={() => refetch()} />
          </div>
        </div>

        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Quotes</h1>
          <div className="flex flex-wrap gap-2">
            <NewQuoteForm onQuoteCreated={() => refetch()} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-full"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="text-red-600">
              {error instanceof Error ? error.message : 'Error loading quotes'}
            </div>
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No quotes yet. Add your first quote to get started!
            </div>
          </div>
        ) : (
          <QuotesTable
            quotes={quotes}
            onQuoteUpdate={refetch}
          />
        )}
      </div>
    </div>
  );
}
