'use client'

import React, { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewTaskForm } from '@/components/NewTaskForm';
import { NewNoteForm } from '@/components/NewNoteForm';
import { NewEntryForm } from '@/components/NewEntryForm';
import { DoneEntryForm } from '@/components/DoneEntryForm';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckSquare, FileText, ArrowRight, MoreHorizontal, Link } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, isToday, isTomorrow, isPast, isFuture, addDays, isWithinInterval, isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { TaskWithDetails, NoteWithDetails } from '@/lib/types';
import type { TaskStatus, Priority } from '@/types/database.types';
import type { Database } from '@/types/database.types';

const DashboardPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(user?.id);
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);
  const [taskToView, setTaskToView] = useState<TaskWithDetails | null>(null);
  const supabase = createClientComponentClient<Database>();

  // Parse date helper function
  const parseDateForDisplay = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    
    try {
      // For dates stored as YYYY-MM-DD (which we're now using)
      if (dateString.includes('-') && dateString.length <= 10) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      
      // Fallback for ISO format dates
      return new Date(dateString);
    } catch (e) {
      console.error('Error parsing date:', e);
      return null;
    }
  };

  // Helper functions for date checks
  const isDateToday = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isToday(date) : false;
  };

  const isDatePast = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isPast(date) && !isToday(date) : false;
  };

  const isDateInFuture = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isFuture(date) : false;
  };

  const isDateWithinUpcoming = (dateString: string | null, start: Date, end: Date): boolean => {
    const date = parseDateForDisplay(dateString);
    if (!date) return false;
    
    try {
      // For "tomorrow" specifically, we need to ensure it's captured properly
      if (isTomorrow(date)) return true;
      
      return isWithinInterval(date, { start, end });
    } catch (e) {
      console.error('Error checking interval:', e, dateString);
      return false;
    }
  };

  // Format the date for display
  const formatDateDisplay = (dateString: string) => {
    const date = parseDateForDisplay(dateString);
    if (!date) return '';
    
    // Date reference points
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const threeDaysLater = addDays(today, 3);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isTomorrow(date)) {
      return 'Tomorrow';
    } else if (isWithinInterval(date, { start: tomorrow, end: threeDaysLater })) {
      return format(date, 'EEE, MMM d'); // e.g. "Wed, Apr 5"
    } else {
      return format(date, 'MMM d'); // e.g. "Apr 5"
    }
  };

  // Handle updates
  const handleUpdate = () => {
    refetchTasks();
    refetchNotes();
    setRefreshKey(prev => prev + 1);
  };
  
  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));
    
    try {
      // Get the current task data first
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
  
      if (taskError) throw taskError;
  
      // Update item timestamps
      const { error: itemError } = await supabase
        .from('items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);
  
      if (itemError) throw itemError;
      
      // Refresh the data
      handleUpdate();
    } catch (err) {
      console.error('Error updating task status:', err);
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Function to delete a task
  const deleteTask = async (taskId: string): Promise<void> => {
    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));
    
    try {
      // Ask for confirmation
      if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
        setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
        return;
      }
      
      // Delete the task
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
  
      if (taskError) throw taskError;
  
      // Delete the item
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', taskId);
  
      if (itemError) throw itemError;
  
      // Refresh the data
      handleUpdate();
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  if (tasksLoading || notesLoading) {
    return (
      <div className="py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-lg text-gray-500">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  // Date reference points
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const threeDaysLater = addDays(today, 3);
  
  // Get non-completed tasks
  const activeTasks = tasks.filter(task => task.status !== 'completed');
  
  // Tasks for Today (due today or in the past, or assigned today or in the past)
  const todayDueTasks = activeTasks.filter(task => {
    if (!task.due_date) return false;
    return isDateToday(task.due_date) || isDatePast(task.due_date);
  }).sort((a, b) => {
    // First sort by past due (oldest first)
    if (isDatePast(a.due_date) && isDatePast(b.due_date)) {
      const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
      return aDate - bDate; // Oldest past due first
    }
    
    // Then sort by priority (high to low)
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });
  
  const todayAssignedTasks = activeTasks.filter(task => {
    // Skip if already in due today/past list
    if (task.due_date && (isDateToday(task.due_date) || isDatePast(task.due_date))) {
      return false;
    }
    
    // Include if assigned today or in the past
    return task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date));
  }).sort((a, b) => {
    // First sort by past assigned date (oldest first)
    if (isDatePast(a.assigned_date) && isDatePast(b.assigned_date)) {
      const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
      return aDate - bDate; // Oldest first
    }
    
    // Then sort by priority (high to low)
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });
  
  // Tasks for Upcoming (due or assigned in next 3 days, excluding today)
  const upcomingDueTasks = activeTasks.filter(task => {
    if (!task.due_date) return false;
    
    // Skip if due today or in the past (already covered in Today section)
    if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
    
    // Include if due tomorrow or within the next 3 days
    return isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater);
  }).sort((a, b) => {
    // First sort by due date
    const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
    const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
    
    // If same date, sort by priority
    if (aDate === bDate) {
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    }
    
    return aDate - bDate;
  });
  
  const upcomingAssignedTasks = activeTasks.filter(task => {
    // Skip if due in upcoming period, due today, or due in past
    if (task.due_date) {
      if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
      if (isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater)) return false;
    }
    
    // Skip if assigned today or in the past (already covered in Today section)
    if (task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date))) {
      return false;
    }
    
    // Check for tomorrow specifically to ensure those tasks appear
    if (task.assigned_date) {
      const assignedDate = parseDateForDisplay(task.assigned_date);
      if (assignedDate && isTomorrow(assignedDate)) {
        return true;
      }
    }
    
    // Include if assigned within the next 3 days
    return task.assigned_date && isDateWithinUpcoming(task.assigned_date, tomorrow, threeDaysLater);
  }).sort((a, b) => {
    // First sort by assigned date
    const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
    const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
    
    // If same date, sort by priority
    if (aDate === bDate) {
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    }
    
    return aDate - bDate;
  });
  
  // Tasks with no date assigned (limited to 5)
  const tasksWithoutDates = activeTasks
    .filter(task => !task.due_date && !task.assigned_date)
    .sort((a, b) => {
      // Sort by priority (high to low)
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    })
    .slice(0, 5);

  // Get recent notes
  const recentNotes = [...notes]
    .filter(note => {
      const createdDate = new Date(note.item.created_at);
      return isWithinInterval(createdDate, { start: addDays(today, -7), end: today });
    })
    .sort((a, b) => {
      // Sort by newest first
      return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
    })
    .slice(0, 3); // Only show 3 most recent notes

  // Get priority badge color
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Get status badge color
  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'on_deck':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Render a task item with simpler design
  const renderTask = (task: TaskWithDetails, contextLabel?: string) => (
    <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2 mb-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
            <button
              className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50 mt-0.5"
              aria-label="Change task status"
            >
              {loadingTasks[task.id] ? (
                <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckSquare className="h-5 w-5 text-blue-500" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
              Mark as On Deck
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'active')}>
              Mark as Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
              Mark as Completed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="min-w-0 flex-1">
          <h3 
            className="font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => {
              if (task.description || task.item.title.length > 50) {
                setTaskToView(task);
              }
            }}
          >
            {task.item.title}
          </h3>
        </div>
      </div>
      
      <div className="ml-7 mt-1 flex flex-wrap gap-2 text-xs">
        <div className="flex flex-wrap gap-2 items-center">
          {contextLabel && (
            <span className={`font-medium ${contextLabel === "OVERDUE" ? "text-red-600" : "text-orange-500"}`}>{contextLabel}</span>
          )}
          {task.assigned_date && (
            <span className={`flex items-center ${isDatePast(task.assigned_date) ? 'text-orange-500' : 'text-gray-500'}`}>
              <Calendar className="mr-1 h-3 w-3" />
              Assigned: {formatDateDisplay(task.assigned_date)}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center ${isDatePast(task.due_date) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              <Clock className="mr-1 h-3 w-3" />
              Due: {formatDateDisplay(task.due_date)}
            </span>
          )}
        </div>
      </div>

      <div className="ml-7 mt-1 flex justify-between items-center">
        <div className="text-xs">
          {task.project_id && (
            <span className="flex items-center text-blue-500">
              <Link className="mr-1 h-3 w-3" />
              Project
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority || 'normal'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={loadingTasks[task.id]}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setTaskToEdit(task)}
                disabled={loadingTasks[task.id]}
              >
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteTask(task.id)}
                disabled={loadingTasks[task.id]}
                className="text-red-600 hover:text-red-700"
              >
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <DoneEntryForm onEntryCreated={handleUpdate} />
            <NewTaskForm onEntryCreated={handleUpdate} />
            <NewNoteForm onEntryCreated={handleUpdate} />
          </div>
        </div>
        
        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex flex-wrap gap-2">
            <DoneEntryForm onEntryCreated={handleUpdate} />
            <NewTaskForm onEntryCreated={handleUpdate} />
            <NewNoteForm onEntryCreated={handleUpdate} />
          </div>
        </div>
      </div>
      
      {/* Edit task modal */}
      {taskToEdit && (
        <NewEntryForm
          initialData={taskToEdit}
          isEditing={true}
          onEntryCreated={() => {
            handleUpdate();
            setTaskToEdit(null);
          }}
          onClose={() => setTaskToEdit(null)}
        />
      )}
      
      {/* Task detail dialog */}
      {taskToView && (
        <Dialog open={Boolean(taskToView)} onOpenChange={(open) => !open && setTaskToView(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{taskToView.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2 text-sm">
                {taskToView.assigned_date && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>Assigned: {formatDateDisplay(taskToView.assigned_date)}</span>
                  </div>
                )}
                {taskToView.due_date && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="mr-1 h-4 w-4" />
                    <span>Due: {formatDateDisplay(taskToView.due_date)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Badge className={getPriorityColor(taskToView.priority)}>
                  {taskToView.priority || 'normal'}
                </Badge>
                <Badge className={getStatusColor(taskToView.status || 'on_deck')}>
                  {taskToView.status || 'on_deck'}
                </Badge>
                {taskToView.project_id && (
                  <Badge className="bg-blue-100 text-blue-800">
                    Project
                  </Badge>
                )}
              </div>
              
              {taskToView.description ? (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">
                    {taskToView.description}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">No description available</p>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setTaskToView(null);
                    setTaskToEdit(taskToView);
                  }}
                >
                  Edit
                </Button>
                <Button onClick={() => setTaskToView(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Today's Tasks Section */}
      <DashboardCard 
        title={`OnDeck (${todayDueTasks.length + todayAssignedTasks.length})`}
        content={
          <div className="space-y-3">
            {todayDueTasks.length === 0 && todayAssignedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks for today or overdue</div>
            ) : (
              <>
                {todayDueTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Due Today or Overdue</h3>
                    <div className="space-y-2">
                      {todayDueTasks.map(task => {
                        const isPastDue = isDatePast(task.due_date);
                        
                        return renderTask(
                          task, 
                          isPastDue ? "OVERDUE" : undefined
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {todayAssignedTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Today or Earlier</h3>
                    <div className="space-y-2">
                      {todayAssignedTasks.map(task => {
                        const isPastAssigned = isDatePast(task.assigned_date);
                        
                        return renderTask(
                          task, 
                          isPastAssigned ? "PAST ASSIGNED" : undefined
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Upcoming Tasks Section */}
      {/* Add debugging output for tomorrow's tasks */}
      {/* Uncomment this when debugging date issues
      <div className="text-xs text-gray-500 mb-4">
        <div>Tomorrow's date: {tomorrow.toISOString()}</div>
        <div>Three days later: {threeDaysLater.toISOString()}</div>
        <div>Tasks with tomorrow's assigned date: {
          activeTasks.filter(t => t.assigned_date && isTomorrow(parseDateForDisplay(t.assigned_date)!)).length
        }</div>
      </div>
      */}
      
      <DashboardCard 
        title={`Upcoming (${upcomingDueTasks.length + upcomingAssignedTasks.length})`}
        content={
          <div className="space-y-3">
            {upcomingDueTasks.length === 0 && upcomingAssignedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No upcoming tasks</div>
            ) : (
              <>
                {upcomingDueTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Due Soon</h3>
                    <div className="space-y-2">
                      {upcomingDueTasks.map(task => renderTask(task))}
                    </div>
                  </div>
                )}
                
                {upcomingAssignedTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Soon</h3>
                    <div className="space-y-2">
                      {upcomingAssignedTasks.map(task => renderTask(task))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div className="pt-2">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto" asChild>
                <a href="/tasks">
                  View all tasks <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        }
      />

      {/* Quick Access Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <DashboardCard 
          title="Recent Notes"
          content={
            <div className="space-y-3">
              {recentNotes.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No recent notes</div>
              ) : (
                recentNotes.map(note => (
                  <NoteCard key={note.id} note={note} preview={true} />
                ))
              )}
              
              <div className="mt-2">
                <Button variant="outline" className="w-full" onClick={() => {
                  const addNoteBtn = document.querySelector('[class*="NewEntryForm"] button') as HTMLButtonElement;
                  if (addNoteBtn) addNoteBtn.click();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Note
                </Button>
              </div>
            </div>
          }
        />
        
        {/* Tasks Without Dates */}
        <DashboardCard 
          title="Unscheduled Tasks"
          content={
            <div className="space-y-3">
              {tasksWithoutDates.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No unscheduled tasks</div>
              ) : (
                <div className="space-y-2">
                  {tasksWithoutDates.map(task => renderTask(task))}
                </div>
              )}
              
              {activeTasks.filter(task => !task.due_date && !task.assigned_date).length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{activeTasks.filter(task => !task.due_date && !task.assigned_date).length - 5} more unscheduled tasks
                </div>
              )}
              
              <div className="pt-2">
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto" asChild>
                  <a href="/tasks">
                    View all tasks <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default DashboardPage;