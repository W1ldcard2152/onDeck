'use client'

import React, { useState, useEffect } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckSquare, FileText, ArrowRight, MoreHorizontal } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, isToday, isPast, isFuture, addDays, isWithinInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskWithDetails, NoteWithDetails } from '@/lib/types';
import type { TaskStatus, Priority } from '@/types/database.types';
import type { Database } from '@/types/database.types';

const DashboardPage: React.FC = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      console.log('Service Worker is supported');
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully', reg);
        })
        .catch(err => {
          console.error('Service Worker registration failed', err);
        });
    } else {
      console.error('Service Worker is NOT supported');
    }
  }, []);

  const { user } = useSupabaseAuth();
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(user?.id);
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const supabase = createClientComponentClient<Database>();

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

  // Get all active tasks sorted by assigned date (soonest first)
  const activeTasks = tasks
    .filter(task => task.status === 'active')
    .sort((a, b) => {
      // First sort by assigned date
      const aDate = a.assigned_date ? new Date(a.assigned_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.assigned_date ? new Date(b.assigned_date).getTime() : Number.MAX_SAFE_INTEGER;
      
      return aDate - bDate;
    });
    
  // Get tasks with no assigned date that are not completed
  const tasksWithoutDates = tasks
    .filter(task => {
      // Only include non-completed tasks with no assigned date
      return task.status !== 'completed' && !task.assigned_date;
    })
    .sort((a, b) => {
      // Sort by priority (high to low)
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });

  // Get tasks with due dates in the next 3 days (not completed)
  const today = new Date();
  const threeDaysLater = addDays(today, 3);
  
  const upcomingDueTasks = tasks
    .filter(task => {
      // Only include non-completed tasks
      if (task.status === 'completed') return false;
      
      // Only include tasks with a due date in the next 3 days
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      return dueDate && isWithinInterval(dueDate, { start: today, end: threeDaysLater });
    })
    .sort((a, b) => {
      // Sort by due date (soonest first)
      const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
      return aDate - bDate;
    });

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

  // Format the date for display
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    if (isToday(date)) {
      return 'Today';
    } else if (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    } else {
      return format(date, 'EEE, MMM d'); // e.g. "Wed, Apr 5"
    }
  };

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

  return (
    <div className="space-y-6 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <NewEntryForm onEntryCreated={handleUpdate} />
      </div>

      {/* Active Tasks Section (sorted by assigned date) */}
      <DashboardCard 
        title="Active Tasks"
        content={
          <div className="space-y-3">
            {activeTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No active tasks</div>
            ) : (
              activeTasks.map(task => (
                <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
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
                          <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                            Mark as Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <h3 className="font-medium text-gray-900">
                        {task.item.title}
                      </h3>
                    </div>
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority || 'normal'}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                  )}
                  
                  <div className="ml-7 mt-2 flex flex-wrap gap-2 text-xs">
                    {task.due_date && (
                      <span className={`flex items-center ${isPast(new Date(task.due_date)) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        <Clock className="mr-1 h-3 w-3" />
                        Due: {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                    {task.assigned_date && (
                      <span className="flex items-center text-gray-500">
                        <Calendar className="mr-1 h-3 w-3" />
                        Assigned: {format(new Date(task.assigned_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        }
      />

      {/* Upcoming Due Tasks Section (next 3 days) */}
      <DashboardCard 
        title="Due Soon (Next 3 Days)"
        content={
          <div className="space-y-3">
            {upcomingDueTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks due in the next 3 days</div>
            ) : (
              upcomingDueTasks.map(task => (
                <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
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
                          {task.status !== 'active' && (
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'active')}>
                              Mark as Active
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'on_deck' && (
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
                              Mark as On Deck
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                            Mark as Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <h3 className="font-medium text-gray-900">
                        {task.item.title}
                      </h3>
                    </div>
                    <Badge className={`${getStatusColor(task.status || 'on_deck')} mr-2`}>
                      {task.status || 'on_deck'}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                  )}
                  
                  <div className="ml-7 mt-2 flex flex-wrap gap-2 text-xs">
                    {task.due_date && (
                      <span className={`flex items-center font-medium ${isToday(new Date(task.due_date)) ? 'text-orange-600' : 'text-red-600'}`}>
                        <Clock className="mr-1 h-3 w-3" />
                        Due: {formatDateDisplay(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))
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
                tasksWithoutDates.slice(0, 5).map(task => (
                  <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                            <button
                              className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
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
                            {task.status !== 'active' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'active')}>
                                Mark as Active
                              </DropdownMenuItem>
                            )}
                            {task.status !== 'on_deck' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
                                Mark as On Deck
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                              Mark as Completed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <h3 className="font-medium text-gray-900">
                          {task.item.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(task.status || 'on_deck')}>
                          {task.status || 'on_deck'}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority || 'normal'}
                        </Badge>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                    )}
                  </div>
                ))
              )}
              
              {tasksWithoutDates.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{tasksWithoutDates.length - 5} more unscheduled tasks
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

// Helper function to get status color
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

export default DashboardPage;