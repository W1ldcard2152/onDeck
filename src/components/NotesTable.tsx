'use client'

import React, { useState, useEffect, useMemo } from 'react';
import TruncatedCell from './TruncatedCell';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, ChevronRight, MoreHorizontal, Trash2, ExternalLink, FileText, Video, File, Link, BookOpen } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { NewEntryForm } from '@/components/NewEntryForm';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Database } from '@/types/database.types';
import type { KnowledgeEntryType, NoteWithDetails } from '@/lib/types';

type NoteStatus = 'active' | 'archived';
type SortDirection = 'asc' | 'desc' | null;
type SortField = 'status' | 'title' | 'created_at' | 'content' | 'entry_type' | 'knowledge_base' | null;

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

interface SortState {
  field: SortField;
  direction: SortDirection;
  level: number;
}

interface NotesTableProps {
  notes: NoteWithDetails[];
  onNoteUpdate: () => void;
}

interface NotesTableBaseProps {
  notes: NoteWithDetails[];
  onNoteUpdate: () => void;
  sorts: SortState[];
  onSort: (field: SortField) => void;
  tableType: 'active' | 'archived';
  updateNoteStatus: (noteId: string, isArchived: boolean) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
}

const NotesTableBase = ({ 
  notes, 
  onNoteUpdate,
  sorts,
  onSort,
  tableType,
  updateNoteStatus,
  deleteNote
}: NotesTableBaseProps) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<any | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const getStatusColor = (isArchived: boolean): string => {
    return isArchived ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800';
  };

  const getSortIcon = (field: SortField): JSX.Element | null => {
    const sort = sorts.find(s => s.field === field);
    if (!sort) return null;

    const getIconColor = (level: number): string => {
      switch(level) {
        case 1: return "text-blue-600";
        case 2: return "text-blue-400";
        case 3: return "text-blue-300";
        default: return "text-blue-600";
      }
    };

    return (
      <span className="ml-2 inline-flex items-center gap-1" title={`Sort level ${sort.level}`}>
        <div className={`flex items-center ${getIconColor(sort.level)}`}>
          {sort.direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {sort.level > 1 && (
            <span className="text-xs ml-0.5">{sort.level}</span>
          )}
        </div>
      </span>
    );
  };

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (noteToDelete) {
      setLoading(prev => ({ ...prev, [noteToDelete]: true }));
      try {
        await deleteNote(noteToDelete);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete note');
      } finally {
        setLoading(prev => ({ ...prev, [noteToDelete]: false }));
        setNoteToDelete(null);
        setDeleteConfirmOpen(false);
      }
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('status')}
                  className="hover:bg-gray-100"
                >
                  Status {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('title')}
                  className="hover:bg-gray-100"
                >
                  Title {getSortIcon('title')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('created_at')}
                  className="hover:bg-gray-100"
                >
                  Created {getSortIcon('created_at')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('entry_type')}
                  className="hover:bg-gray-100"
                >
                  Type {getSortIcon('entry_type')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('knowledge_base')}
                  className="hover:bg-gray-100"
                >
                  Knowledge Base {getSortIcon('knowledge_base')}
                </Button>
              </TableHead>
              <TableHead>URL</TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => onSort('content')}
                  className="hover:bg-gray-100"
                >
                  Content {getSortIcon('content')}
                </Button>
              </TableHead>
              <TableHead className="w-12 text-right">
                <span className="text-sm font-medium">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((note) => {
              const isLoading = loading[note.id];
              const isArchived = note.item.is_archived;
              
              return (
                <TableRow key={note.id}>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="p-0 h-auto hover:bg-transparent"
                          disabled={isLoading}
                        >
                          <Badge 
                            className={`${getStatusColor(isArchived)} border-0 cursor-pointer hover:opacity-80`}
                          >
                            {isLoading ? 'Updating...' : (isArchived ? 'Archived' : 'Note')}
                          </Badge>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => updateNoteStatus(note.id, !isArchived)}
                          disabled={isLoading}
                        >
                          {isArchived ? 'Restore note' : 'Archive note'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    {note.item.title}
                  </TableCell>
                  <TableCell>
                    {format(new Date(note.item.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {note.entry_type && entryTypeColors[note.entry_type] && entryTypeIcons[note.entry_type] && (
                      <Badge 
                        variant="secondary" 
                        className={`${entryTypeColors[note.entry_type as KnowledgeEntryType]} flex items-center gap-1 w-fit`}
                      >
                        {React.createElement(entryTypeIcons[note.entry_type as KnowledgeEntryType], { className: "w-3 h-3" })}
                        {note.entry_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {note.knowledge_base ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {note.knowledge_base.keystone && (
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: note.knowledge_base.keystone.color }}
                          />
                        )}
                        {note.knowledge_base.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {note.url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => note.url && window.open(note.url, '_blank', 'noopener,noreferrer')}
                        className="h-8 p-0 text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Open
                      </Button>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[24rem]">
                    <TruncatedCell content={note.content} maxLength={100} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setNoteToEdit(note)}
                          disabled={isLoading}
                        >
                          Edit Note
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateNoteStatus(note.id, !isArchived)}
                          disabled={isLoading}
                        >
                          {isArchived ? 'Unarchive Note' : 'Archive Note'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(note.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 focus:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Note
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {noteToEdit && (
          <NewEntryForm
            initialData={noteToEdit}
            isEditing={true}
            onEntryCreated={() => {
              onNoteUpdate();
              setNoteToEdit(null);
            }}
            onClose={() => setNoteToEdit(null)}
          />
        )}

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this note?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the note and all its content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const NotesTable = ({ notes: initialNotes, onNoteUpdate }: NotesTableProps) => {
  const [showArchived, setShowArchived] = useState(false);
  const [sorts, setSorts] = useState<SortState[]>([]);
  const [localNotes, setLocalNotes] = useState(initialNotes);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    setLocalNotes(initialNotes);
  }, [initialNotes]);

  const handleSort = (field: SortField): void => {
    setSorts(prevSorts => {
      const existingIndex = prevSorts.findIndex(sort => sort.field === field);

      if (existingIndex === -1) {
        if (prevSorts.length >= 3) return prevSorts;
        return [...prevSorts, { field, direction: 'asc', level: prevSorts.length + 1 }];
      }

      const existing = prevSorts[existingIndex];
      const newSorts = [...prevSorts];

      if (existing.direction === 'asc') {
        newSorts[existingIndex] = { ...existing, direction: 'desc' };
      } else {
        newSorts.splice(existingIndex, 1);
        return newSorts.map((sort, index) => ({
          ...sort,
          level: index + 1
        }));
      }

      return newSorts;
    });
  };

  const updateNoteStatus = async (noteId: string, isArchived: boolean): Promise<void> => {
    setLocalNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === noteId 
          ? { 
              ...note, 
              item: { 
                ...note.item, 
                is_archived: isArchived,
                archived_at: isArchived ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              } 
            }
          : note
      )
    );
    
    try {
      const { data, error: itemError } = await supabase
        .from('items')
        .update({ 
          is_archived: isArchived,
          archived_at: isArchived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .select();

      if (itemError) throw itemError;
      await onNoteUpdate();
    } catch (err) {
      setLocalNotes(initialNotes);
      console.error('Error updating note status:', err);
    }
  };

  const deleteNote = async (noteId: string): Promise<void> => {
    try {
      // First, delete from the notes table
      const { error: noteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (noteError) throw noteError;

      // Then, delete from the items table
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', noteId);

      if (itemError) throw itemError;

      // Remove from local state
      setLocalNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      
      // Notify parent component
      await onNoteUpdate();

    } catch (err) {
      console.error('Error deleting note:', err);
      throw err;
    }
  };

  const sortedNotes = useMemo(() => {
    const sortNotes = (notesToSort: any[]): any[] => {
      return [...notesToSort].sort((a, b) => {
        for (const sort of sorts) {
          let comparison = 0;
          
          switch (sort.field) {
            case 'status': {
              comparison = Number(a.item.is_archived) - Number(b.item.is_archived);
              break;
            }
            case 'title': {
              comparison = (a.item.title || '').localeCompare(b.item.title || '');
              break;
            }
            case 'created_at': {
              const aDate = new Date(a.item.created_at).getTime();
              const bDate = new Date(b.item.created_at).getTime();
              comparison = aDate - bDate;
              break;
            }
            case 'content': {
              comparison = (a.content || '').localeCompare(b.content || '');
              break;
            }
            case 'entry_type': {
              comparison = (a.entry_type || '').localeCompare(b.entry_type || '');
              break;
            }
            case 'knowledge_base': {
              const aKB = a.knowledge_base?.name || '';
              const bKB = b.knowledge_base?.name || '';
              comparison = aKB.localeCompare(bKB);
              break;
            }
          }

          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    };

    return {
      activeNotes: sortNotes(localNotes.filter(note => !note.item.is_archived)),
      archivedNotes: sortNotes(localNotes.filter(note => note.item.is_archived))
    };
  }, [localNotes, sorts]);

  const { activeNotes, archivedNotes } = sortedNotes;
  const archivedCount = archivedNotes.length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <NotesTableBase 
          notes={activeNotes}
          onNoteUpdate={onNoteUpdate}
          sorts={sorts}
          onSort={handleSort}
          tableType="active"
          updateNoteStatus={updateNoteStatus}
          deleteNote={deleteNote}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowArchived(!showArchived)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChevronRight 
                className={`h-5 w-5 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              />
              <h3 className="text-lg font-medium">Archived Notes</h3>
              <Badge variant="secondary">{archivedCount}</Badge>
            </div>
          </div>
        </div>
        
        {showArchived && (
          <div className="p-6">
            {archivedNotes.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No archived notes</div>
            ) : (
              <NotesTableBase 
                notes={archivedNotes}
                onNoteUpdate={onNoteUpdate}
                sorts={sorts}
                onSort={handleSort}
                tableType="archived"
                updateNoteStatus={updateNoteStatus}
                deleteNote={deleteNote}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { NotesTable };
export default NotesTable;