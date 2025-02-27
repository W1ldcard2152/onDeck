'use client'

import React, { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckSquare, FileText, ArrowRight } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, isToday, isPast, isFuture, addDays, isWithinInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { TaskWithDetails, NoteWithDetails } from '@/lib/types';
import type { TaskStatus } from '@/types/database.types';
import type { Database } from '@/types/database.types';

const DashboardPage: React.FC = () => {
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
      
      // Handle project-related task logic if needed
      if (currentTask?.project_id) {
        // Project task logic would go here if needed
        // For now, just refresh the data
      }
  
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

  // Filter tasks for Today's Focus
  const todayTasks = tasks.filter(task => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const assignedDate = task.assigned_date ? new Date(task.assigned_date) : null;
    
    // Include tasks that are:
    // 1. Due today or in the past (not completed)
    // 2. Assigned for today or in the past (active or on deck)
    return (
      (task.status !== 'completed' && dueDate && (isToday(dueDate) || isPast(dueDate))) ||
      ((task.status === 'active' || task.status === 'on_deck') && 
        assignedDate && (isToday(assignedDate) || isPast(assignedDate)))
    );
  });

  // Sort by priority (high to low) and then by due date (earliest first)
  todayTasks.sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    
    // First sort by priority
    if (priorityOrder[aPriority] !== priorityOrder[bPriority]) {
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    }
    
    // Then sort by due date
    const aDate = a.due_date ? new Date(a.due_date) : new Date(9999, 11, 31);
    const bDate = b.due_date ? new Date(b.due_date) : new Date(9999, 11, 31);
    return aDate.getTime() - bDate.getTime();
  });

  // Filter tasks for On Deck (next 7 days)
  const today = new Date();
  const nextWeek = addDays(today, 7);
  
  const onDeckTasks = tasks.filter(task => {
    // Skip completed tasks and tasks already shown in Today's Focus
    if (task.status === 'completed' || todayTasks.includes(task)) return false;
    
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const assignedDate = task.assigned_date ? new Date(task.assigned_date) : null;
    
    // Include tasks that are:
    // 1. Due in the next 7 days
    // 2. Assigned in the next 7 days
    return (
      (dueDate && isFuture(dueDate) && isWithinInterval(dueDate, { start: today, end: nextWeek })) ||
      (assignedDate && isFuture(assignedDate) && isWithinInterval(assignedDate, { start: today, end: nextWeek }))
    );
  });

  // Group on deck tasks by day
  const onDeckByDay: Record<string, TaskWithDetails[]> = {};
  onDeckTasks.forEach(task => {
    // Use due date if available, otherwise assigned date
    const taskDate = task.due_date || task.assigned_date;
    if (!taskDate) return;
    
    const date = new Date(taskDate);
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!onDeckByDay[dateKey]) {
      onDeckByDay[dateKey] = [];
    }
    onDeckByDay[dateKey].push(task);
  });
  
  // Sort each day's tasks by priority
  Object.keys(onDeckByDay).forEach(date => {
    onDeckByDay[date].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });
  });
  
  // Get dates sorted chronologically
  const sortedDates = Object.keys(onDeckByDay).sort();

  // Filter for active tasks without dates
  const activeTasks = tasks.filter(task => {
    if (task.status !== 'active') return false;
    if (todayTasks.includes(task) || onDeckTasks.includes(task)) return false;
    
    // Include active tasks with no assigned or due date
    return !task.assigned_date && !task.due_date;
  });
  
  // Sort by priority
  activeTasks.sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
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

      {/* Today's Focus Section */}
      <DashboardCard 
        title="Today's Focus"
        content={
          <div className="space-y-3">
            {todayTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks for today</div>
            ) : (
              todayTasks.map(task => (
                <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <button
                        onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'active' : 'completed')}
                        disabled={loadingTasks[task.id]}
                        className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                        aria-label={task.status === 'completed' ? "Mark as active" : "Mark as complete"}
                      >
                        {loadingTasks[task.id] ? (
                          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : task.status === 'completed' ? (
                          <CheckSquare className="h-5 w-5 text-green-500 fill-green-500" />
                        ) : (
                          <CheckSquare className="h-5 w-5 text-blue-500" />
                        )}
                      </button>
                      <h3 className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
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
                      <span className={`flex items-center ${isPast(new Date(task.due_date)) && task.status !== 'completed' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
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

      {/* On Deck Section */}
      <DashboardCard 
        title="On Deck"
        content={
          <div className="space-y-4">
            {sortedDates.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No upcoming tasks</div>
            ) : (
              sortedDates.map(dateKey => (
                <div key={dateKey} className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="mr-1 h-4 w-4 text-gray-500" />
                    {formatDateDisplay(dateKey)}
                  </h3>
                  
                  <div className="space-y-2 pl-6 border-l-2 border-gray-100">
                    {onDeckByDay[dateKey].map(task => (
                      <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-gray-900">{task.item.title}</h3>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority || 'normal'}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {task.due_date && (
                            <span className="flex items-center text-gray-500">
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
                    ))}
                  </div>
                </div>
              ))
            )}
            
            {/* View all tasks link */}
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

        {/* Active Tasks */}
        <DashboardCard 
          title="Active Tasks"
          content={
            <div className="space-y-3">
              {activeTasks.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No active tasks without dates</div>
              ) : (
                activeTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <button
                          onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'active' : 'completed')}
                          disabled={loadingTasks[task.id]}
                          className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                          aria-label={task.status === 'completed' ? "Mark as active" : "Mark as complete"}
                        >
                          {loadingTasks[task.id] ? (
                            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          ) : task.status === 'completed' ? (
                            <CheckSquare className="h-5 w-5 text-green-500 fill-green-500" />
                          ) : (
                            <CheckSquare className="h-5 w-5 text-blue-500" />
                          )}
                        </button>
                        <h3 className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {task.item.title}
                        </h3>
                      </div>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority || 'normal'}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                  </div>
                ))
              )}
              
              {activeTasks.length > 3 && (
                <div className="text-center text-sm text-gray-500 mt-2">
                  +{activeTasks.length - 3} more active tasks
                </div>
              )}
              
              <div className="mt-2">
                <Button variant="outline" className="w-full" onClick={() => {
                  const addTaskBtn = document.querySelector('[class*="NewEntryForm"] button') as HTMLButtonElement;
                  if (addTaskBtn) addTaskBtn.click();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Task
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