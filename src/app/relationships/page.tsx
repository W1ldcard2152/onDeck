'use client'

import React, { useState } from 'react';
import { RelationshipsTable } from '@/components/RelationshipsTable';
import { NewRelationshipForm } from '@/components/NewRelationshipForm';
import { NewCommunicationForm } from '@/components/NewCommunicationForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useRelationships } from '@/hooks/useRelationships';

export default function RelationshipsPage() {
  const { user } = useSupabaseAuth();
  const { relationships, isLoading, error, refetch, deleteRelationship } = useRelationships(user?.id);

  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [commFormOpen, setCommFormOpen] = useState(false);

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Relationships</h1>
          <div className="flex gap-2">
            <NewRelationshipForm
              onRelationshipCreated={() => refetch()}
              open={contactFormOpen}
              setOpen={setContactFormOpen}
            />
            <NewCommunicationForm
              onCommunicationCreated={() => refetch()}
              open={commFormOpen}
              setOpen={setCommFormOpen}
            />
          </div>
        </div>

        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Relationships</h1>
          <div className="flex flex-wrap gap-2">
            <NewRelationshipForm
              onRelationshipCreated={() => refetch()}
              open={contactFormOpen}
              setOpen={setContactFormOpen}
            />
            <NewCommunicationForm
              onCommunicationCreated={() => refetch()}
              open={commFormOpen}
              setOpen={setCommFormOpen}
            />
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
              {error instanceof Error ? error.message : 'Error loading relationships'}
            </div>
          </div>
        ) : !relationships || relationships.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No contacts yet. Add your first contact to get started!
            </div>
          </div>
        ) : (
          <RelationshipsTable
            relationships={relationships}
            onRelationshipUpdate={refetch}
            onDelete={deleteRelationship}
          />
        )}
      </div>
    </div>
  );
}
