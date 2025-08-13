'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
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
import { KeystoneForm } from '@/components/KeystoneForm';
import { useKeystones } from '@/hooks/useKeystones';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { Keystone } from '@/lib/types';

interface KeystonesTableProps {
  keystones: Keystone[];
  onKeystoneUpdate?: () => void;
}

export const KeystonesTable: React.FC<KeystonesTableProps> = ({
  keystones,
  onKeystoneUpdate
}) => {
  const { user } = useSupabaseAuth();
  const { deleteKeystone } = useKeystones(user?.id);
  const [editingKeystone, setEditingKeystone] = useState<Keystone | null>(null);
  const [deletingKeystone, setDeletingKeystone] = useState<Keystone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingKeystone) return;
    
    setIsDeleting(true);
    try {
      await deleteKeystone(deletingKeystone.id);
      if (onKeystoneUpdate) {
        onKeystoneUpdate();
      }
    } catch (error) {
      console.error('Error deleting keystone:', error);
    } finally {
      setIsDeleting(false);
      setDeletingKeystone(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keystones.map((keystone) => (
            <TableRow key={keystone.id}>
              <TableCell className="font-medium">
                {keystone.name}
              </TableCell>
              <TableCell>
                <div className="max-w-xs truncate">
                  {keystone.description || 'No description'}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: keystone.color }}
                  />
                  <span className="text-sm text-gray-500">
                    {keystone.color}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {format(new Date(keystone.created_at), 'MMM d, yyyy')}
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
                      onClick={() => setEditingKeystone(keystone)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingKeystone(keystone)}
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
      {editingKeystone && (
        <KeystoneForm
          initialData={editingKeystone}
          isEditing={true}
          onKeystoneCreated={() => {
            setEditingKeystone(null);
            if (onKeystoneUpdate) {
              onKeystoneUpdate();
            }
          }}
          onClose={() => setEditingKeystone(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingKeystone} onOpenChange={() => setDeletingKeystone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the keystone "{deletingKeystone?.name}". 
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