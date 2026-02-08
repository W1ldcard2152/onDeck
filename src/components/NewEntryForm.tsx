'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon, Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { EntryService } from '@/lib/entryService';
import type { TaskStatus, Priority, EntryType as KnowledgeEntryType } from '@/types/database.types';
import type { TaskWithDetails, NoteWithDetails, DailyContext } from '@/lib/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface NewEntryFormProps {
  onEntryCreated?: (entry: any) => void;
  initialData?: TaskWithDetails | NoteWithDetails;
  isEditing?: boolean;
  onClose?: () => void;
  defaultType?: EntryType;
  hideTypeSelector?: boolean;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

type EntryType = 'task' | 'note';

// Function to preserve local date - storing just the YYYY-MM-DD part
function preserveLocalDate(date: Date | undefined): string | null {
  if (!date) return null;
  
  // Extract year, month, and day components
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  
  // Create a new ISO date string in format YYYY-MM-DD
  // This completely ignores time and timezone
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Custom DatePicker component to avoid hooks issues
const DatePickerField: React.FC<{
  label: string;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  showClearButton?: boolean;
}> = ({ label, selectedDate, onDateChange, showClearButton = false }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    onDateChange(date);
    setOpen(false);
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onDateChange(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        {showClearButton && selectedDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
            onClick={handleButtonClick}
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
  onClose,
  defaultType = 'note',
  hideTypeSelector = false,
  open: externalOpen,
  setOpen: externalSetOpen
}) => {
  const { user } = useSupabaseAuth();
  const { knowledgeBases } = useKnowledgeBases(user?.id);
  const supabase = createClientComponentClient();
  const [internalOpen, setInternalOpen] = useState(isEditing);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalSetOpen || setInternalOpen;
  const [type, setType] = useState<EntryType>(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assignedDate, setAssignedDate] = useState<Date | undefined>(
    // Default to today's date for new tasks only
    !isEditing && defaultType === 'task' ? new Date() : undefined
  );
  const [dailyContexts, setDailyContexts] = useState<DailyContext[]>([]);
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<TaskStatus>('active');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>('');
  const [entryType, setEntryType] = useState<KnowledgeEntryType>('note');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  // Add refs for the text areas
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Determine if we're editing a task or a note
  const isEditingTask = isEditing && initialData && 'status' in initialData;
  const isEditingNote = isEditing && initialData && !('status' in initialData);

  // Parse a date from YYYY-MM-DD format
  const parseStoredDate = (dateString: string | null): Date | undefined => {
    if (!dateString) return undefined;
    
    // Split the date string by hyphens
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create a new date using local components
    return new Date(year, month - 1, day);
  };

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
          setDueDate(parseStoredDate(taskData.due_date));
        }

        if (taskData.assigned_date) {
          setAssignedDate(parseStoredDate(taskData.assigned_date));
        }

        // Parse daily_context from JSON
        if (taskData.daily_context) {
          try {
            const contexts = JSON.parse(taskData.daily_context);
            setDailyContexts(contexts);
          } catch (e) {
            setDailyContexts([]);
          }
        } else {
          // Clear contexts if task has no daily_context
          setDailyContexts([]);
        }
      } else if (isEditingNote) {
        // It's a note
        setType('note');
        const noteData = initialData as NoteWithDetails;
        setContent(noteData.content || '');
        setUrl(noteData.url || '');
        setKnowledgeBaseId(noteData.knowledge_base_id || 'none');
        setEntryType(noteData.entry_type || 'note');
      }
    }
  }, [initialData, isEditing, isEditingTask, isEditingNote]);

  // Add viewport height tracking
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    // Set initial height
    setViewportHeight(window.innerHeight);
    
    // Listen for viewport changes (e.g., when keyboard appears)
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Focus handler to scroll field into view when focused
  const handleTextAreaFocus = (ref: React.RefObject<HTMLTextAreaElement>) => {
    // Wait a bit for the keyboard to appear
    setTimeout(() => {
      if (ref.current) {
        // Scroll the element into view with better mobile handling
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Additional scroll for mobile to ensure visibility above keyboard
        const scrollContainer = ref.current.closest('[role="dialog"]');
        if (scrollContainer) {
          const rect = ref.current.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;

          // Scroll the dialog content if needed
          if (relativeTop > scrollContainer.clientHeight * 0.5) {
            scrollContainer.scrollTop += relativeTop - (scrollContainer.clientHeight * 0.3);
          }
        }
      }
    }, 350);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setDueDate(undefined);
    setAssignedDate(undefined);
    setDailyContexts([]);
    setPriority('normal');
    setStatus('active');
    setDescription('');
    setUrl('');
    setKnowledgeBaseId('none');
    setEntryType('note');
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
              due_date: preserveLocalDate(dueDate),
              assigned_date: preserveLocalDate(assignedDate),
              daily_context: dailyContexts.length > 0 ? JSON.stringify(dailyContexts) : null,
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
              content: content.trim() || null,
              url: url.trim() || null,
              entry_type: entryType
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
          url: type === 'note' ? url.trim() || null : null,
          knowledge_base_id: null,
          entry_type: type === 'note' ? entryType : undefined,
          due_date: preserveLocalDate(dueDate),
          assigned_date: preserveLocalDate(assignedDate),
          daily_context: dailyContexts.length > 0 ? JSON.stringify(dailyContexts) : null,
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
        {!isEditing && externalOpen === undefined ? (
          <Button className="bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        ) : null}
      </DialogTrigger>
      <DialogContent className={type === 'note'
        ? "w-[calc(100vw-400px)] h-[calc(100vh-60px)] max-w-none flex flex-col"
        : "sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
      }>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 
              (isEditingTask ? 'Edit Task' : 'Edit Note') : 
              hideTypeSelector ? 
                (type === 'task' ? 'Create New Task' : 'Create New Note') :
                'Create New Entry'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 
              (isEditingTask ? 'Update task details.' : 'Update note details.') : 
              hideTypeSelector ? 
                (type === 'task' ? 'Create a new task with due dates and priorities.' : 'Create a new note with content and knowledge base linking.') :
                'Create a new task or note.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={type === 'note' ? "flex flex-col gap-4 flex-1 min-h-0" : "space-y-4"}>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          {/* Type selection (only for new entries) */}
          {!isEditing && !hideTypeSelector && (
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

          {/* Show fields based on entry type */}
          {(type === 'task' || isEditingTask) ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePickerField
                  label="Assigned Date"
                  selectedDate={assignedDate}
                  onDateChange={setAssignedDate}
                  showClearButton={true}
                />
                <DatePickerField
                  label="Due Date"
                  selectedDate={dueDate}
                  onDateChange={setDueDate}
                />
              </div>
              
              <div className="space-y-4 border-t pt-4 bg-blue-50 p-4 rounded-lg">
                <div className="text-sm font-semibold text-blue-800">📅 Daily Context (Optional)</div>
                <div className="text-xs text-blue-600">Choose when you'd like to work on this task</div>

                <div className="grid grid-cols-2 gap-4">
                  {(['morning', 'work', 'family', 'evening'] as const).map((context) => (
                    <div key={context} className="flex items-center space-x-2">
                      <Checkbox
                        id={`context-${context}`}
                        checked={dailyContexts.includes(context)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDailyContexts([...dailyContexts, context]);
                          } else {
                            setDailyContexts(dailyContexts.filter(c => c !== context));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`context-${context}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {context.charAt(0).toUpperCase() + context.slice(1)}
                      </Label>
                    </div>
                  ))}
                </div>
                {dailyContexts.length === 0 && (
                  <div className="text-xs text-gray-500 italic">
                    No contexts selected - task will be shown all day
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  className="h-24 min-h-[6rem] resize-none"
                  onFocus={() => handleTextAreaFocus(descriptionRef)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_type">Entry Type</Label>
                  <Select
                    value={entryType}
                    onValueChange={(value) => {
                      if (['article', 'video', 'document', 'resource', 'note', 'link'].includes(value)) {
                        setEntryType(value as KnowledgeEntryType);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entry type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">URL (optional)</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter content"
                  className="flex-1 text-sm resize-none"
                  onFocus={() => handleTextAreaFocus(contentRef)}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Entry")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}