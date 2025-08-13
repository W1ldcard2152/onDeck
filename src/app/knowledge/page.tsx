'use client'

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useKeystones } from '@/hooks/useKeystones';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { KeystonesTable } from '@/components/KeystonesTable';
import { KnowledgeBasesTable } from '@/components/KnowledgeBasesTable';
import { KeystoneForm } from '@/components/KeystoneForm';
import { KnowledgeBaseForm } from '@/components/KnowledgeBaseForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function KnowledgePage() {
  const { user } = useSupabaseAuth();
  const { keystones, isLoading: keystonesLoading, error: keystonesError, refetch: refetchKeystones } = useKeystones(user?.id || '');
  const { knowledgeBases, isLoading: kbLoading, error: kbError, refetch: refetchKB } = useKnowledgeBases(user?.id || '');
  const [showKeystoneForm, setShowKeystoneForm] = useState(false);
  const [showKBForm, setShowKBForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Knowledge Management</h1>
      </div>

      <Tabs defaultValue="knowledge-bases" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="knowledge-bases">Knowledge Bases</TabsTrigger>
          <TabsTrigger value="keystones">Keystones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="knowledge-bases" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">Manage your knowledge domains and categories</p>
            <KnowledgeBaseForm 
              keystones={keystones}
              onKBCreated={() => refetchKB()}
              onClose={() => setShowKBForm(false)}
            />
          </div>
          
          <div className="bg-white rounded-xl shadow-sm">
            {kbLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ) : kbError ? (
              <div className="p-6">
                <div className="text-red-600">
                  {kbError instanceof Error ? kbError.message : 'Error loading knowledge bases'}
                </div>
              </div>
            ) : !knowledgeBases || knowledgeBases.length === 0 ? (
              <div className="p-6">
                <div className="text-gray-500 text-center py-8">
                  No knowledge bases yet. Create your first knowledge base to organize your entries!
                </div>
              </div>
            ) : (
              <KnowledgeBasesTable 
                knowledgeBases={knowledgeBases}
                keystones={keystones}
                onKBUpdate={refetchKB}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="keystones" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">Manage your keystones (pillars) that organize your knowledge bases</p>
            <KeystoneForm 
              onKeystoneCreated={() => refetchKeystones()}
              onClose={() => setShowKeystoneForm(false)}
            />
          </div>
          
          <div className="bg-white rounded-xl shadow-sm">
            {keystonesLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ) : keystonesError ? (
              <div className="p-6">
                <div className="text-red-600">
                  {keystonesError instanceof Error ? keystonesError.message : 'Error loading keystones'}
                </div>
              </div>
            ) : !keystones || keystones.length === 0 ? (
              <div className="p-6">
                <div className="text-gray-500 text-center py-8">
                  No keystones yet. Create your first keystone to organize your knowledge bases!
                </div>
              </div>
            ) : (
              <KeystonesTable 
                keystones={keystones}
                onKeystoneUpdate={refetchKeystones}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}