'use client'

import React from 'react';
import { NotesTable } from '@/components/NotesTable';
import { NewEntryForm } from '@/components/NewEntryForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNotes } from '@/hooks/useNotes';

export default function NotesPage() {
  const { user } = useSupabaseAuth();
  const { notes, isLoading, error, refetch } = useNotes(user?.id || '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <NewEntryForm onEntryCreated={() => refetch()} />
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
              {error instanceof Error ? error.message : 'Error loading notes'}
            </div>
          </div>
        ) : !notes || notes.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No notes yet. Create your first note to get started!
            </div>
          </div>
        ) : (
          <NotesTable 
            notes={notes} 
            onNoteUpdate={refetch}
          />
        )}
      </div>
    </div>
  );
}