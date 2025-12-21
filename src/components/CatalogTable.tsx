'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, ExternalLink } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { CatalogEntry } from '@/hooks/useCatalog';

interface CatalogTableProps {
  catalogEntries: CatalogEntry[];
  onEntryUpdate: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const CatalogTable = ({ catalogEntries, onEntryUpdate, onDelete }: CatalogTableProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (entryToDelete) {
      await onDelete(entryToDelete);
      setEntryToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getResourceTypeBadge = (type: string | null) => {
    if (!type) return null;

    const colors: Record<string, string> = {
      website: 'bg-blue-100 text-blue-800',
      video: 'bg-red-100 text-red-800',
      article: 'bg-green-100 text-green-800',
      documentation: 'bg-purple-100 text-purple-800',
      tutorial: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={colors[type] || colors.other} variant="secondary">
        {type}
      </Badge>
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Captured</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalogEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                {entry.title || '-'}
                {entry.description && (
                  <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {entry.description}
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-xs">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate block"
                >
                  {entry.url}
                </a>
              </TableCell>
              <TableCell>
                {getResourceTypeBadge(entry.resource_type)}
              </TableCell>
              <TableCell>
                {format(new Date(entry.capture_date), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenUrl(entry.url)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(entry.id)}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this catalog entry.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CatalogTable;
