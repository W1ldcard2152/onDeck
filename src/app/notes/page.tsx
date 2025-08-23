'use client'

import React from 'react';
import { NotesTable } from '@/components/NotesTable';
import { NewTaskForm } from '@/components/NewTaskForm';
import { NewNoteForm } from '@/components/NewNoteForm';
import { NewEntryForm } from '@/components/NewEntryForm';
import { DoneEntryForm } from '@/components/DoneEntryForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNotes } from '@/hooks/useNotes';

export default function NotesPage() {
  const { user } = useSupabaseAuth();
  const { notes, isLoading, error, refetch } = useNotes(user?.id || '', 50, true); // Include archived notes

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Notes</h1>
          <div className="flex gap-2">
            <DoneEntryForm onEntryCreated={() => refetch()} />
            <NewTaskForm onEntryCreated={() => refetch()} />
            <NewNoteForm onEntryCreated={() => refetch()} />
          </div>
        </div>
        
        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Notes</h1>
          <div className="flex flex-wrap gap-2">
            <DoneEntryForm onEntryCreated={() => refetch()} />
            <NewTaskForm onEntryCreated={() => refetch()} />
            <NewNoteForm onEntryCreated={() => refetch()} />
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