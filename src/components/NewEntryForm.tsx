'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon, Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { EntryService } from '@/lib/entryService';
import type { TaskStatus, Priority } from '@/types/database.types';
import type { TaskWithDetails, NoteWithDetails } from '@/lib/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface NewEntryFormProps {
  onEntryCreated?: (entry: any) => void;
  initialData?: TaskWithDetails | NoteWithDetails;
  isEditing?: boolean;
  onClose?: () => void;
}

type EntryType = 'task' | 'note';

// Custom DatePicker component to avoid hooks issues
const DatePickerField: React.FC<{
  label: string;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}> = ({ label, selectedDate, onDateChange }) => {
  const [open, setOpen] = useState(false);
  
  const handleSelect = (date: Date | undefined) => {
    onDateChange(date);
    setOpen(false);
  };
  
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "PPP") : `Pick ${label.toLowerCase()}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="border rounded-md bg-white p-3">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              showOutsideDays={true}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const NewEntryForm: React.FC<NewEntryFormProps> = ({ 
  onEntryCreated, 
  initialData,
  isEditing = false,
  onClose 
}) => {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();
  const [open, setOpen] = useState(isEditing);
  const [type, setType] = useState<EntryType>('note'); // Default to note
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assignedDate, setAssignedDate] = useState<Date | undefined>();
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<TaskStatus>('active');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're editing a task or a note
  const isEditingTask = isEditing && initialData && 'status' in initialData;
  const isEditingNote = isEditing && initialData && !('status' in initialData);

  // Initialize form with data when editing
  useEffect(() => {
    if (initialData && isEditing) {
      setTitle(initialData.item.title || '');
      
      if (isEditingTask) {
        // It's a task
        setType('task');
        const taskData = initialData as TaskWithDetails;
        setDescription(taskData.description || '');
        setPriority(taskData.priority || 'normal');
        setStatus(taskData.status || 'active');
        
        if (taskData.due_date) {
          setDueDate(new Date(taskData.due_date));
        }
        
        if (taskData.assigned_date) {
          setAssignedDate(new Date(taskData.assigned_date));
        }
      } else if (isEditingNote) {
        // It's a note
        setType('note');
        const noteData = initialData as NoteWithDetails;
        setContent(noteData.content || '');
      }
    }
  }, [initialData, isEditing, isEditingTask, isEditingNote]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setDueDate(undefined);
    setAssignedDate(undefined);
    setPriority('normal');
    setStatus('active');
    setDescription('');
    setType('note');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create entries');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditing && initialData) {
        if (isEditingTask) {
          // Update existing task
          const { error: taskError } = await supabase
            .from('tasks')
            .update({
              due_date: dueDate?.toISOString() || null,
              assigned_date: assignedDate?.toISOString() || null,
              status: status,
              description: description.trim() || null,
              priority: priority
            })
            .eq('id', initialData.id);

          if (taskError) throw taskError;

          const { error: itemError } = await supabase
            .from('items')
            .update({
              title: title.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', initialData.id);

          if (itemError) throw itemError;
        } else if (isEditingNote) {
          // Update existing note
          const { error: noteError } = await supabase
            .from('notes')
            .update({
              content: content.trim() || null
            })
            .eq('id', initialData.id);

          if (noteError) throw noteError;

          const { error: itemError } = await supabase
            .from('items')
            .update({
              title: title.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', initialData.id);

          if (itemError) throw itemError;
        }

        if (onEntryCreated) {
          onEntryCreated({ id: initialData.id });
        }
      } else {
        // Create new entry
        const newEntry = {
          title: title.trim(),
          type,
          user_id: user.id,
          content: type === 'note' ? content.trim() : null,
          due_date: dueDate?.toISOString() || null,
          assigned_date: assignedDate?.toISOString() || null,
          status: type === 'task' ? status : undefined,
          priority: type === 'task' ? priority : undefined,
          description: type === 'task' ? description.trim() : null,
        };

        const data = await EntryService.createEntry(newEntry);
        
        if (data && onEntryCreated) {
          onEntryCreated(data);
        }
      }

      setOpen(false);
      resetForm();
      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (type) {
      case 'task':
        return (
          <>
            <DatePickerField
              label="Assigned Date"
              selectedDate={assignedDate}
              onDateChange={setAssignedDate}
            />
            <DatePickerField
              label="Due Date"
              selectedDate={dueDate}
              onDateChange={setDueDate}
            />
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={status} 
                onValueChange={(value) => {
                  if (value === 'on_deck' || value === 'active' || value === 'completed') {
                    setStatus(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_deck">On Deck</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={priority} 
                onValueChange={(value) => {
                  if (value === 'low' || value === 'normal' || value === 'high') {
                    setPriority(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                className="h-32"
              />
            </div>
          </>
        );
      case 'note':
        return (
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content"
              className="h-32"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          resetForm();
          if (onClose) onClose();
        }
      }}
    >
      <DialogTrigger asChild>
        {!isEditing ? (
          <Button className="bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 
              (isEditingTask ? 'Edit Task' : 'Edit Note') : 
              'Create New Entry'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 
              (isEditingTask ? 'Update task details.' : 'Update note details.') : 
              'Create a new task or note.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          {/* Type selection (only for new entries) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  if (value === 'task' || value === 'note') {
                    setType(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              required
            />
          </div>

          {/* Render fields specific to the selected type */}
          {(type === 'task' || isEditingTask) ? (
            <>
              <DatePickerField
                label="Assigned Date"
                selectedDate={assignedDate}
                onDateChange={setAssignedDate}
              />
              <DatePickerField
                label="Due Date"
                selectedDate={dueDate}
                onDateChange={setDueDate}
              />
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={status} 
                  onValueChange={(value) => {
                    if (value === 'on_deck' || value === 'active' || value === 'completed') {
                      setStatus(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_deck">On Deck</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={priority} 
                  onValueChange={(value) => {
                    if (value === 'low' || value === 'normal' || value === 'high') {
                      setPriority(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  className="h-32"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter content"
                className="h-32"
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Entry")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};