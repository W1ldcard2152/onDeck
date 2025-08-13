'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Edit, Trash2, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { KnowledgeBaseForm } from '@/components/KnowledgeBaseForm';
import { KnowledgeBaseEntriesDialog } from '@/components/KnowledgeBaseEntriesDialog';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { KnowledgeBase, Keystone } from '@/lib/types';

interface KnowledgeBasesTableProps {
  knowledgeBases: KnowledgeBase[];
  keystones: Keystone[];
  onKBUpdate?: () => void;
}

export const KnowledgeBasesTable: React.FC<KnowledgeBasesTableProps> = ({
  knowledgeBases,
  keystones,
  onKBUpdate
}) => {
  const { user } = useSupabaseAuth();
  const { deleteKnowledgeBase } = useKnowledgeBases(user?.id);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [deletingKB, setDeletingKB] = useState<KnowledgeBase | null>(null);
  const [viewingKB, setViewingKB] = useState<KnowledgeBase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingKB) return;
    
    setIsDeleting(true);
    try {
      await deleteKnowledgeBase(deletingKB.id);
      if (onKBUpdate) {
        onKBUpdate();
      }
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
    } finally {
      setIsDeleting(false);
      setDeletingKB(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Keystone</TableHead>
            <TableHead>Entries</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {knowledgeBases.map((kb) => (
            <TableRow key={kb.id}>
              <TableCell className="font-medium">
                {kb.name}
              </TableCell>
              <TableCell>
                <div className="max-w-xs truncate">
                  {kb.description || 'No description'}
                </div>
              </TableCell>
              <TableCell>
                {kb.keystone ? (
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: kb.keystone.color }}
                    />
                    {kb.keystone.name}
                  </Badge>
                ) : (
                  <span className="text-gray-400">No keystone</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {kb.entry_count} entries
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(kb.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setViewingKB(kb)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Entries
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setEditingKB(kb)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingKB(kb)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      {editingKB && (
        <KnowledgeBaseForm
          keystones={keystones}
          initialData={editingKB}
          isEditing={true}
          onKBCreated={() => {
            setEditingKB(null);
            if (onKBUpdate) {
              onKBUpdate();
            }
          }}
          onClose={() => setEditingKB(null)}
        />
      )}

      {/* View Entries Dialog */}
      {viewingKB && (
        <KnowledgeBaseEntriesDialog
          knowledgeBase={viewingKB}
          onClose={() => setViewingKB(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingKB} onOpenChange={() => setDeletingKB(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the knowledge base "{deletingKB?.name}" and all its associated entries. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};