'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, Edit, MessageSquare } from 'lucide-react';
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
import { NewCommunicationForm } from './NewCommunicationForm';
import type { Relationship } from '@/hooks/useRelationships';

interface RelationshipsTableProps {
  relationships: Relationship[];
  onRelationshipUpdate: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const RelationshipsTable = ({ relationships, onRelationshipUpdate, onDelete }: RelationshipsTableProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [relationshipToDelete, setRelationshipToDelete] = useState<string | null>(null);
  const [communicationFormOpen, setCommunicationFormOpen] = useState(false);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | undefined>();

  const handleDeleteClick = (id: string) => {
    setRelationshipToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (relationshipToDelete) {
      await onDelete(relationshipToDelete);
      setRelationshipToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleAddCommunication = (relationshipId: string) => {
    setSelectedRelationshipId(relationshipId);
    setCommunicationFormOpen(true);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relationships.map((relationship) => (
            <TableRow key={relationship.id}>
              <TableCell className="font-medium">{relationship.name}</TableCell>
              <TableCell>{relationship.phone || '-'}</TableCell>
              <TableCell>{relationship.email || '-'}</TableCell>
              <TableCell>{relationship.address || '-'}</TableCell>
              <TableCell>
                {format(new Date(relationship.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleAddCommunication(relationship.id)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Add Communication
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(relationship.id)}
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
              This will permanently delete this relationship and all associated communications.
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

      <NewCommunicationForm
        open={communicationFormOpen}
        setOpen={setCommunicationFormOpen}
        defaultRelationshipId={selectedRelationshipId}
        onCommunicationCreated={onRelationshipUpdate}
      />
    </>
  );
};

export default RelationshipsTable;
