import React, { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckSquare, 
  FileText, 
  ArrowRight, 
  MoreHorizontal,
  Check 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const updateTaskStatus = async (taskId: string, newStatus: 'on_deck' | 'active' | 'completed'): Promise<void> => {
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
    
    // Include tasks that are:
    // 1. Active tasks due today or in the past
    return (
      task.status === 'active' && 
      dueDate && 
      (isToday(dueDate) || isPast(dueDate))
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

  // Filter tasks for On Deck (next 3 days)
  const today = new Date();
  const nextThreeDays = addDays(today, 3);
  
  const onDeckTasks = tasks.filter(task => {
    // Only consider "on_deck" status tasks
    if (task.status !== 'on_deck') {
      return false;
    }
    
    // Skip tasks already shown in Today's Focus
    if (todayTasks.includes(task)) {
      return false;
    }
    
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    
    // Only include tasks that have a due date within the next 3 days
    return (
      dueDate && 
      isFuture(dueDate) && 
      isWithinInterval(dueDate, { start: today, end: nextThreeDays })
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

  // Filter for active tasks without due dates
  const activeTasks = tasks.filter(task => {
    // Only include tasks with active status
    if (task.status !== 'active') {
      return false;
    }
    
    // Skip tasks that are already in other sections
    if (todayTasks.includes(task) || onDeckTasks.includes(task)) {
      return false;
    }
    
    // Include active tasks with no due date
    return !task.due_date;
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

  // Get status color for the status indicator
  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'on_deck': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
                      {/* Status dropdown menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                            disabled={loadingTasks[task.id]}
                            aria-label="Change task status"
                          >
                            {loadingTasks[task.id] ? (
                              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckSquare className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-500 fill-green-500' : 'text-blue-500'}`} />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {task.status !== 'completed' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark completed
                              {task.status === 'completed' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'active' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark active
                              {task.status === 'active' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'on_deck' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'on_deck')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark on deck
                              {task.status === 'on_deck' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Due Soon Section */}
      <DashboardCard 
        title="Due Soon"
        content={
          <div className="space-y-3">
            {tasksWithDueDates.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks due soon</div>
            ) : (
              tasksWithDueDates.map(task => (
                <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      {/* Status dropdown menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                            disabled={loadingTasks[task.id]}
                            aria-label="Change task status"
                          >
                            {loadingTasks[task.id] ? (
                              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckSquare className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-500 fill-green-500' : task.status === 'on_deck' ? 'text-yellow-500' : 'text-blue-500'}`} />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => updateTaskStatus(task.id, 'completed')}
                            disabled={loadingTasks[task.id]}
                          >
                            Mark completed
                            {task.status === 'completed' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateTaskStatus(task.id, 'active')}
                            disabled={loadingTasks[task.id]}
                          >
                            Mark active
                            {task.status === 'active' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateTaskStatus(task.id, 'on_deck')}
                            disabled={loadingTasks[task.id]}
                          >
                            Mark on deck
                            {task.status === 'on_deck' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div>
                        <h3 className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {task.item.title}
                        </h3>
                        <Badge className={`ml-0 mt-1 text-xs ${task.status === 'on_deck' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700'}`}>
                          {task.status}
                        </Badge>
                      </div>
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
                      <span className={`flex items-center font-medium ${isToday(new Date(task.due_date)) ? 'text-orange-600' : isPast(new Date(task.due_date)) ? 'text-red-600' : 'text-green-600'}`}>
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
                        {/* Status dropdown menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                              disabled={loadingTasks[task.id]}
                              aria-label="Change task status"
                            >
                              {loadingTasks[task.id] ? (
                                <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckSquare className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-500 fill-green-500' : 'text-blue-500'}`} />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark completed
                              {task.status === 'completed' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark active
                              {task.status === 'active' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'on_deck')}
                              disabled={loadingTasks[task.id]}
                            >
                              Mark on deck
                              {task.status === 'on_deck' && <Check className="ml-2 h-4 w-4" />}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <h3 className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {task.item.title}
                        </h3>
                      </div>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority || 'normal'}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="ml-7 text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                  </div>
                ))
              )}
              
              {tasksWithoutDates.length > 3 && (
                <div className="text-center text-sm text-gray-500 mt-2">
                  +{tasksWithoutDates.length - 3} more active tasks
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