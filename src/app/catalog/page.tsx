'use client'

import React, { useState } from 'react';
import { CatalogTable } from '@/components/CatalogTable';
import { NewCatalogEntryForm } from '@/components/NewCatalogEntryForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCatalog } from '@/hooks/useCatalog';

export default function CatalogPage() {
  const { user } = useSupabaseAuth();
  const { catalogEntries, isLoading, error, refetch, deleteCatalogEntry } = useCatalog(user?.id);

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and button on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Catalog</h1>
          <NewCatalogEntryForm
            onEntryCreated={() => refetch()}
          />
        </div>

        {/* Mobile layout: title on top, button underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Catalog</h1>
          <NewCatalogEntryForm
            onEntryCreated={() => refetch()}
          />
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
              {error instanceof Error ? error.message : 'Error loading catalog entries'}
            </div>
          </div>
        ) : !catalogEntries || catalogEntries.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No catalog entries yet. Capture your first URL to get started!
            </div>
          </div>
        ) : (
          <CatalogTable
            catalogEntries={catalogEntries}
            onEntryUpdate={refetch}
            onDelete={deleteCatalogEntry}
          />
        )}
      </div>
    </div>
  );
}
