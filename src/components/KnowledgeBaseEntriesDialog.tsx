'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Video, File, Link, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { KnowledgeBase, KnowledgeBaseWithDetails, KnowledgeEntryType } from '@/lib/types';

interface KnowledgeBaseEntriesDialogProps {
  knowledgeBase: KnowledgeBase;
  onClose: () => void;
}

const entryTypeIcons: Record<KnowledgeEntryType, React.ComponentType<{ className?: string }>> = {
  article: FileText,
  video: Video,
  document: File,
  resource: Link,
  note: BookOpen,
  link: ExternalLink
};

const entryTypeColors: Record<KnowledgeEntryType, string> = {
  article: 'bg-blue-100 text-blue-800',
  video: 'bg-red-100 text-red-800',
  document: 'bg-green-100 text-green-800',
  resource: 'bg-purple-100 text-purple-800',
  note: 'bg-yellow-100 text-yellow-800',
  link: 'bg-gray-100 text-gray-800'
};

export const KnowledgeBaseEntriesDialog: React.FC<KnowledgeBaseEntriesDialogProps> = ({
  knowledgeBase,
  onClose
}) => {
  const { user } = useSupabaseAuth();
  const { getKnowledgeBaseWithEntries } = useKnowledgeBases(user?.id);
  const [kbWithEntries, setKbWithEntries] = useState<KnowledgeBaseWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching entries for KB:', knowledgeBase.id);
        const data = await getKnowledgeBaseWithEntries(knowledgeBase.id);
        console.log('Fetched KB with entries:', data);
        setKbWithEntries(data);
      } catch (err) {
        console.error('Error fetching KB entries:', err);
        setError(err instanceof Error ? err.message : 'Failed to load entries');
      } finally {
        setIsLoading(false);
      }
    };

    if (knowledgeBase.id) {
      fetchEntries();
    }
  }, [knowledgeBase.id, getKnowledgeBaseWithEntries]);

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Entries in "{knowledgeBase.name}"</span>
            {knowledgeBase.keystone && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: knowledgeBase.keystone.color }}
                />
                {knowledgeBase.keystone.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

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
            <div className="text-red-600 text-center">{error}</div>
          </div>
        ) : !kbWithEntries?.entries || kbWithEntries.entries.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No entries in this knowledge base yet.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {kbWithEntries.entries.length} entries found
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kbWithEntries.entries.map((entry) => {
                  const Icon = entryTypeIcons[entry.entry_type];
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.item.title}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${entryTypeColors[entry.entry_type]} flex items-center gap-1 w-fit`}
                        >
                          <Icon className="w-3 h-3" />
                          {entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {entry.content || 'No content'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenUrl(entry.url!)}
                            className="h-8 p-0 text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Open
                          </Button>
                        ) : (
                          <span className="text-gray-400">No URL</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.item.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};