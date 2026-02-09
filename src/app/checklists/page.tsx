'use client'

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useChecklists } from '@/hooks/useChecklists';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChecklistCard } from '@/components/ChecklistCard';
import { ChecklistWizard } from '@/components/ChecklistWizard';
import { ChecklistCompletion } from '@/components/ChecklistCompletion';
import { ChecklistEditor } from '@/components/ChecklistEditor';
import { Plus } from 'lucide-react';
import type { ChecklistTemplateWithDetails, ChecklistContext } from '@/types/checklist.types';

type ContextTab = ChecklistContext | 'All';

const CONTEXT_TABS: ContextTab[] = ['Morning', 'Work', 'Family', 'Evening', 'Weekend', 'All'];

export default function ChecklistsPage() {
  const { user } = useSupabaseAuth();
  const { templates, isLoading, error, refetch } = useChecklists(user?.id);
  const searchParams = useSearchParams();
  const [selectedContext, setSelectedContext] = useState<ContextTab>('All');
  const [showWizard, setShowWizard] = useState(false);
  const [completingTemplate, setCompletingTemplate] = useState<ChecklistTemplateWithDetails | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplateWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'streak' | 'context'>('name');

  // Auto-open completion modal when navigated with ?complete=<template_id>
  const completeTemplateId = searchParams.get('complete');
  useEffect(() => {
    if (completeTemplateId && templates.length > 0 && !completingTemplate) {
      const template = templates.find(t => t.id === completeTemplateId);
      if (template) {
        setCompletingTemplate(template);
        // Clean up the URL param
        window.history.replaceState({}, '', '/checklists');
      }
    }
  }, [completeTemplateId, templates, completingTemplate]);

  // Filter templates by context
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by context
    if (selectedContext !== 'All') {
      // Show templates that have this specific context
      filtered = filtered.filter(t =>
        t.contexts.some(ctx => ctx.context === selectedContext)
      );
    }
    // If 'All' is selected, show all templates (no filtering)

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'streak':
          return (b.streak || 0) - (a.streak || 0);
        case 'context':
          const aContext = a.contexts[0]?.context || '';
          const bContext = b.contexts[0]?.context || '';
          return aContext.localeCompare(bContext);
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, selectedContext, searchQuery, sortBy]);

  const handleTemplateCreated = () => {
    setShowWizard(false);
    refetch();
  };

  const handleTemplateUpdated = () => {
    setEditingTemplate(null);
    refetch();
  };

  const handleChecklistCompleted = () => {
    setCompletingTemplate(null);
    refetch();
  };

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Checklists</h1>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Checklist Template
        </button>
      </div>

      {/* Search and Sort */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search checklists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
              <option value="streak">Sort by Streak</option>
              <option value="context">Sort by Context</option>
            </select>
          </div>
        </div>
      </div>

      {/* Context Tabs */}
      <Tabs value={selectedContext} onValueChange={(v) => setSelectedContext(v as ContextTab)}>
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap sm:flex-nowrap">
          {CONTEXT_TABS.map(context => (
            <TabsTrigger key={context} value={context} className="flex-shrink-0">
              {context}
            </TabsTrigger>
          ))}
        </TabsList>

        {CONTEXT_TABS.map(context => (
          <TabsContent key={context} value={context} className="mt-6">
            <div className="bg-white rounded-xl shadow-sm">
              {isLoading ? (
                <div className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-gray-200 rounded w-full"></div>
                    <div className="h-24 bg-gray-200 rounded w-full"></div>
                    <div className="h-24 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              ) : error ? (
                <div className="p-6">
                  <div className="text-red-600">
                    {error instanceof Error ? error.message : 'Error loading checklists'}
                  </div>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-6">
                  <div className="text-gray-500 text-center py-8">
                    {searchQuery
                      ? 'No checklists match your search'
                      : context === 'All'
                        ? 'No checklists yet. Create your first checklist!'
                        : `No checklists for ${context} context`
                    }
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {filteredTemplates.map(template => (
                    <ChecklistCard
                      key={template.id}
                      template={template}
                      onComplete={() => setCompletingTemplate(template)}
                      onEdit={() => setEditingTemplate(template)}
                      onDelete={async () => {
                        if (confirm(`Delete checklist "${template.name}"?`)) {
                          // Will implement delete in hook
                          await refetch();
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Modals */}
      {showWizard && (
        <ChecklistWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleTemplateCreated}
        />
      )}

      {completingTemplate && (
        <ChecklistCompletion
          template={completingTemplate}
          onClose={() => setCompletingTemplate(null)}
          onComplete={handleChecklistCompleted}
        />
      )}

      {editingTemplate && (
        <ChecklistEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleTemplateUpdated}
        />
      )}
    </div>
  );
}
