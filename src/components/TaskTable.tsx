import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import React, { useState, useEffect } from 'react';
import TruncatedCell from './TruncatedCell';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, AlertCircle, Repeat } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { NewEntryForm } from '@/components/NewEntryForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from '@/types/database.types';
import type { TaskWithDetails } from '@/lib/types';
import type { Priority, TaskStatus } from '@/types/database.types';
import ScrollableTableWrapper from './layouts/responsiveNav/ScrollableTableWrapper';
import { ProjectTaskManager } from '@/lib/projectTaskManager';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define types
type SortDirection = 'asc' | 'desc' | null;
type SortField = 'status' | 'title' | 'priority' | 'assigned_date' | 'description' | 'due_date' | 'project' | 'reminder_time' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
  level: number;
}

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
  onCompletedToggle?: (shouldFetch: boolean) => void;
  completedLoading?: boolean;
}

interface TaskTableBaseProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
  sorts: SortState[];
  onSort: (field: SortField) => void;
  tableType: 'active' | 'completed';
}

interface ProjectInfo {
  title: string;
  status: string;
  stepTitle?: string;
}

function parseDateForDisplay(dateString: string | null): Date | null {
  if (!dateString) return null;
  
  try {
    // For dates stored as YYYY-MM-DD
    if (dateString.includes('-') && dateString.length <= 10) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // For ISO dates, create a new Date object
    return new Date(dateString);
  } catch (e) {
    console.error('Error parsing date:', e);
    return null;
  }
}

function formatTimeForDisplay(dateTimeString: string | null): string {
  if (!dateTimeString) return '';
  
  try {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Error parsing time:', e);
    return '';
  }
}

// Helper function for future notification system
function canSendNotification(task: TaskWithDetails): boolean {
  return Boolean(task.reminder_time && task.assigned_date);
}

function getUpcomingReminders(tasks: TaskWithDetails[]): TaskWithDetails[] {
  const now = new Date();
  return tasks.filter(task => {
    if (!task.reminder_time) return false;
    const reminderTime = new Date(task.reminder_time);
    return reminderTime > now;
  });
}

// TaskTableBase Component
const TaskTableBase: React.FC<TaskTableBaseProps> = ({ 
  tasks, 
  onTaskUpdate,
  sorts,
  onSort,
  tableType
}) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);
  const [projectInfoMap, setProjectInfoMap] = useState<Record<string, ProjectInfo>>({});
  const supabase = createClientComponentClient<Database>();
  const { user } = useSupabaseAuth();

  // Fetch project information for project-linked tasks with optimized query
  useEffect(() => {
    const fetchProjectInfo = async () => {
      try {
        // Get all unique project IDs from tasks
        const projectIds = [...new Set(
          tasks
            .filter(task => task.project_id)
            .map(task => task.project_id)
        )].filter(Boolean) as string[];
        
        if (projectIds.length === 0) {
          setProjectInfoMap({});
          return;
        }

        // Get project task IDs for step lookup
        const projectTaskIds = tasks
          .filter(task => task.project_id)
          .map(task => task.id);
        
        // Single optimized query with joins
        const { data: projectsWithItems, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            status,
            items!inner (
              id,
              title
            )
          `)
          .in('id', projectIds);
        
        if (projectsError) throw projectsError;
        
        // Fetch step data in parallel if we have project tasks
        let stepsData = null;
        if (projectTaskIds.length > 0) {
          const { data, error: stepsError } = await supabase
            .from('project_steps')
            .select('converted_task_id, title')
            .in('converted_task_id', projectTaskIds)
            .not('converted_task_id', 'is', null);
          
          if (stepsError) throw stepsError;
          stepsData = data;
        }
        
        // Create a map of task IDs to step titles
        const taskToStepMap: Record<string, string> = {};
        if (stepsData) {
          stepsData.forEach(step => {
            if (step.converted_task_id) {
              taskToStepMap[step.converted_task_id] = step.title;
            }
          });
        }
        
        // Build project info map
        const infoMap: Record<string, ProjectInfo> = {};
        if (projectsWithItems) {
          projectsWithItems.forEach(project => {
            infoMap[project.id] = {
              title: (project.items as any).title || 'Unknown Project',
              status: project.status
            };
          });
          
          // Add step info to tasks
          tasks.forEach(task => {
            if (task.project_id && infoMap[task.project_id] && task.id in taskToStepMap) {
              infoMap[task.project_id].stepTitle = taskToStepMap[task.id];
            }
          });
        }
        
        setProjectInfoMap(infoMap);
      } catch (err) {
        console.error('Error fetching project info:', err);
      }
    };
    
    // Only fetch if tasks have changed meaningfully
    const projectTasksSignature = tasks
      .filter(task => task.project_id)
      .map(task => `${task.id}:${task.project_id}`)
      .sort()
      .join(',');
    
    if (projectTasksSignature) {
      fetchProjectInfo();
    } else {
      setProjectInfoMap({});
    }
  }, [tasks, supabase]);

  const deleteTask = async (taskId: string): Promise<void> => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      // Get the task to check if it's project-related
      const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // If task is part of a project, check if it should be allowed to be deleted
      if (taskData?.project_id) {
        const projectTaskManager = new ProjectTaskManager({ 
          supabase, 
          userId: user ? user.id : null
        });
        
        // Get project info
        const projectInfo = projectInfoMap[taskData.project_id];
        
        // Get project steps to check if this is a critical task
        const { data: steps } = await supabase
          .from('project_steps')
          .select('*')
          .eq('project_id', taskData.project_id)
          .order('order_number', { ascending: true });
          
        const thisStep = steps?.find(step => step.converted_task_id === taskId);
        
        if (thisStep) {
          // Check if this task is for a completed step with incomplete steps before it
          const stepIndex = steps?.findIndex(step => step.id === thisStep.id) || 0;
          const hasIncompletePriorSteps = steps?.slice(0, stepIndex).some(step => step.status !== 'completed');
          
          if (hasIncompletePriorSteps) {
            if (!window.confirm(
              `This task is part of the project "${projectInfo?.title}" and is associated with step "${thisStep.title}". ` +
              "There are incomplete prior steps in the project workflow. " +
              "Deleting it may cause inconsistencies. Continue?"
            )) {
              setLoading(prev => ({ ...prev, [taskId]: false }));
              return;
            }
          }
          
          // Check if there are later converted steps dependent on this one
          const hasConvertedLaterSteps = steps?.slice(stepIndex + 1).some(step => step.is_converted);
          
          if (hasConvertedLaterSteps && thisStep.status !== 'completed') {
            if (!window.confirm(
              `This task is part of the project "${projectInfo?.title}" workflow with follow-up tasks already created. ` +
              "Deleting it will disrupt the workflow. Continue?"
            )) {
              setLoading(prev => ({ ...prev, [taskId]: false }));
              return;
            }
          }
        }
        
        // Notify the ProjectTaskManager about the task deletion
        await projectTaskManager.handleTaskDeletion(taskId);
      } else {
        // Regular confirmation for non-project tasks
        if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
          setLoading(prev => ({ ...prev, [taskId]: false }));
          return;
        }
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
  
      onTaskUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting task';
      setError(message);
      console.error('Error deleting task:', err);
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      // Get the current task data first
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (fetchError) throw fetchError;
      
      console.log(`Updating task ${taskId} from ${currentTask?.status} to ${newStatus}`);
      
      // Check for project-related task logic
      const isProjectTask = currentTask?.project_id;
      const isCompletingTask = newStatus === 'completed' && currentTask?.status !== 'completed';
      const isUncompletingTask = newStatus !== 'completed' && currentTask?.status === 'completed';
      
      if (isProjectTask) {
        const projectInfo = projectInfoMap[currentTask.project_id];
        
        // Special handling for project tasks based on status
        if (isCompletingTask) {
          const confirmComplete = window.confirm(
            `This task is part of project "${projectInfo?.title}". ` +
            "Marking it as completed will advance the project workflow. Continue?"
          );
          
          if (!confirmComplete) {
            setLoading(prev => ({ ...prev, [taskId]: false }));
            return;
          }
        } else if (isUncompletingTask) {
          const confirmUncomplete = window.confirm(
            `This task is part of project "${projectInfo?.title}". ` +
            "Unmarking it as completed may affect the project workflow. Continue?"
          );
          
          if (!confirmUncomplete) {
            setLoading(prev => ({ ...prev, [taskId]: false }));
            return;
          }
        }
      }
      
      // Update the task status
      const { data: updatedTask, error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();
  
      if (taskError) {
        console.error('Error updating task status:', taskError);
        throw taskError;
      }
  
      console.log('Task updated successfully:', updatedTask);
  
      // Update item timestamps
      const { error: itemError } = await supabase
        .from('items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);
  
      if (itemError) throw itemError;
      
      // Handle project-related task logic with ProjectTaskManager
      if (isProjectTask) {
        const projectTaskManager = new ProjectTaskManager({ 
          supabase, 
          userId: user ? user.id : null 
        });
        
        if (isCompletingTask) {
          // When marking a task as completed
          await projectTaskManager.handleTaskCompletion(taskId, currentTask.project_id);
          console.log('Project task marked complete and next step processed');
        } else if (isUncompletingTask) {
          // When unmarking a completed task
          await projectTaskManager.handleTaskUncomplete(taskId);
          console.log('Project task uncompleted and step reset');
        }
      }
  
      onTaskUpdate();
    } catch (err) {
      console.error('Error in updateTaskStatus:', err);
      const message = err instanceof Error ? err.message : 'Error updating task status';
      setError(message);
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const updateTaskPriority = async (taskId: string, newPriority: Priority): Promise<void> => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      // Get the task to check if it's project-related
      const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();
        
      if (fetchError) throw fetchError;

      // If it's a project task, also update the corresponding step's priority
      if (taskData?.project_id) {
        const { data: stepData, error: stepFetchError } = await supabase
          .from('project_steps')
          .select('id')
          .eq('converted_task_id', taskId)
          .single();
          
        if (!stepFetchError && stepData) {
          // Update step priority
          const { error: stepUpdateError } = await supabase
            .from('project_steps')
            .update({ priority: newPriority })
            .eq('id', stepData.id);
            
          if (stepUpdateError) {
            console.error('Error updating step priority:', stepUpdateError);
          }
        }
      }
      
      // Update task priority
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ priority: newPriority })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Update item timestamp
      const { error: itemError } = await supabase
        .from('items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (itemError) throw itemError;

      onTaskUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating task priority';
      setError(message);
      console.error('Error updating task priority:', err);
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const getPriorityColor = (priority: Priority): string => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'on_deck': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getSortIcon = (field: SortField): JSX.Element | null => {
    if (!sorts || sorts.length === 0) return null;
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

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="relative">
        <ScrollableTableWrapper>
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
                    onClick={() => onSort('priority')}
                    className="hover:bg-gray-100"
                  >
                    Priority {getSortIcon('priority')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => onSort('assigned_date')}
                    className="hover:bg-gray-100"
                  >
                    Assigned Date {getSortIcon('assigned_date')}
                  </Button>
                </TableHead>
                <TableHead>
                  <span className="text-sm font-medium">Description</span>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => onSort('due_date')}
                    className="hover:bg-gray-100"
                  >
                    Due Date {getSortIcon('due_date')}
                  </Button>
                </TableHead>
                <TableHead className="bg-blue-50">
                  <Button 
                    variant="ghost" 
                    onClick={() => onSort('reminder_time')}
                    className="hover:bg-gray-100 font-semibold text-blue-800"
                  >
                    🔔 Reminder {getSortIcon('reminder_time')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => onSort('project')}
                    className="hover:bg-gray-100"
                  >
                    Linked Project {getSortIcon('project')}
                  </Button>
                </TableHead>
                <TableHead className="w-12 text-right">
                  <span className="text-sm font-medium">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const isLoading = loading[task.id];
                const status = task.status || 'on_deck';
                const priority = task.priority || 'normal';
                const isProjectTask = Boolean(task.project_id);
                const isHabitTask = Boolean(task.habit_id);
                const projectInfo = task.project_id ? projectInfoMap[task.project_id] : null;
                
                return (
                  <TableRow 
                    key={task.id}
                    className={isProjectTask ? "bg-blue-50/30" : isHabitTask ? "bg-green-50/30" : ""}
                  >
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="p-0 h-auto hover:bg-transparent"
                            disabled={isLoading}
                          >
                            <Badge 
                              className={`${getStatusColor(status)} border-0 cursor-pointer hover:opacity-80`}
                            >
                              {isLoading ? 'Updating...' : status}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {status !== 'completed' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              disabled={isLoading}
                            >
                              Mark completed
                            </DropdownMenuItem>
                          )}
                          {status !== 'active' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              disabled={isLoading}
                            >
                              Mark active
                            </DropdownMenuItem>
                          )}
                          {status !== 'on_deck' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'on_deck')}
                              disabled={isLoading}
                            >
                              Mark on deck
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{task.item.title}</span>
                        {isProjectTask && (
                          <span className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                            <Link className="h-3 w-3 mr-1" />
                            Project Task
                          </span>
                        )}
                        {isHabitTask && (
                          <span className="inline-flex items-center bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                            <Repeat className="h-3 w-3 mr-1" />
                            Habit Task
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="p-0 h-auto hover:bg-transparent"
                            disabled={isLoading}
                          >
                            <Badge 
                              className={`${getPriorityColor(priority)} border-0 cursor-pointer hover:opacity-80`}
                            >
                              {isLoading ? 'Updating...' : priority}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => updateTaskPriority(task.id, 'low')}
                            className={priority === 'low' ? 'bg-gray-50' : ''}
                            disabled={isLoading}
                          >
                            Low
                            {priority === 'low' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateTaskPriority(task.id, 'normal')}
                            className={priority === 'normal' ? 'bg-blue-50' : ''}
                            disabled={isLoading}
                          >
                            Normal
                            {priority === 'normal' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateTaskPriority(task.id, 'high')}
                            className={priority === 'high' ? 'bg-red-50' : ''}
                            disabled={isLoading}
                          >
                            High
                            {priority === 'high' && <Check className="ml-2 h-4 w-4" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    
                    <TableCell>
                      {task.assigned_date ? format(parseDateForDisplay(task.assigned_date)!, 'MMM d, yyyy') : '-'}
                    </TableCell>
                    
                    <TableCell className="max-w-[12rem] truncate">
                      <TruncatedCell content={task.description} maxLength={60} />
                    </TableCell>
                    
                    <TableCell>
                      {task.due_date ? format(parseDateForDisplay(task.due_date)!, 'MMM d, yyyy') : '-'}
                    </TableCell>
                    
                    <TableCell className="bg-blue-50">
                      <div className="space-y-1">
                        {task.reminder_time && (
                          <div className="text-sm font-medium text-blue-700">
                            🔔 {formatTimeForDisplay(task.reminder_time)}
                          </div>
                        )}
                        {task.assigned_date && task.reminder_time && (
                          <div className="text-xs text-gray-600">
                            on {format(parseDateForDisplay(task.assigned_date)!, 'MMM d')}
                          </div>
                        )}
                        {!task.reminder_time && (
                          <div className="text-gray-400 text-sm">No reminder</div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {isProjectTask && projectInfo ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-blue-600 font-medium text-sm">
                            {projectInfo.title}
                          </div>
                          <div className="flex items-center">
                            <Badge className={`${getProjectStatusColor(projectInfo.status)}`}>
                              {projectInfo.status}
                            </Badge>
                          </div>
                          {projectInfo.stepTitle && (
                            <div className="text-xs text-gray-600 mt-1">
                              Step: {projectInfo.stepTitle}
                            </div>
                          )}
                        </div>
                      ) : '-'}
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
                            onClick={() => setTaskToEdit(task)}
                            disabled={isLoading}
                          >
                            Edit Task
                          </DropdownMenuItem>
                          
                          {/* Show different options based on current status */}
                          {status !== 'completed' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              disabled={isLoading}
                            >
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                          {status === 'completed' && (
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              disabled={isLoading}
                            >
                              Mark Active
                            </DropdownMenuItem>
                          )}
                          
                          {/* Delete task with warning for project tasks */}
                          <DropdownMenuItem
                            onClick={() => deleteTask(task.id)}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollableTableWrapper>

        {taskToEdit && (
          <NewEntryForm
            initialData={taskToEdit}
            isEditing={true}
            onEntryCreated={() => {
              onTaskUpdate();
              setTaskToEdit(null);
            }}
            onClose={() => setTaskToEdit(null)}
          />
        )}
      </div>
    </div>
  );
};

// Main TaskTable component
const TaskTable: React.FC<TaskTableProps> = ({ 
  tasks, 
  onTaskUpdate, 
  onCompletedToggle,
  completedLoading = false 
}) => {
  const [showCompleted, setShowCompleted] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskTable_showCompleted');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  
  // Track if we've fetched completed tasks
  const [hasTriggeredFetch, setHasTriggeredFetch] = useState(false);
  
  const [completedTasksPage, setCompletedTasksPage] = useState(1);
  const completedTasksPerPage = 100;
  
  // Trigger fetching completed tasks when toggle is clicked
  useEffect(() => {
    if (showCompleted && !hasTriggeredFetch && onCompletedToggle) {
      onCompletedToggle(true);
      setHasTriggeredFetch(true);
    }
  }, [showCompleted, hasTriggeredFetch, onCompletedToggle]);
  
  // Initialize sorts from localStorage
  const [activeSorts, setActiveSorts] = useState<SortState[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskTable_activeSorts');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [completedSorts, setCompletedSorts] = useState<SortState[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('taskTable_completedSorts');
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.error('Error loading completed sorts from localStorage:', error);
        return [];
      }
    }
    return [];
  });

  const createSortHandler = (setSorts: React.Dispatch<React.SetStateAction<SortState[]>>, storageKey: string) => (field: SortField): void => {
    setSorts(prevSorts => {
      const existingIndex = prevSorts.findIndex(sort => sort.field === field);

      let newSorts: SortState[];
      
      if (existingIndex === -1) {
        if (prevSorts.length >= 3) return prevSorts;
        newSorts = [...prevSorts, { field, direction: 'asc', level: prevSorts.length + 1 }];
      } else {
        const existing = prevSorts[existingIndex];
        const tempSorts = [...prevSorts];

        if (existing.direction === 'asc') {
          tempSorts[existingIndex] = { ...existing, direction: 'desc' };
          newSorts = tempSorts;
        } else {
          tempSorts.splice(existingIndex, 1);
          newSorts = tempSorts.map((sort, index) => ({
            ...sort,
            level: index + 1
          }));
        }
      }

      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newSorts));
        } catch (error) {
          console.error('Error saving sorts to localStorage:', error);
        }
      }
      
      return newSorts;
    });
  };

  const handleActiveSort = createSortHandler(setActiveSorts, 'taskTable_activeSorts');
  const handleCompletedSort = createSortHandler(setCompletedSorts, 'taskTable_completedSorts');
  
  // Reset to page 1 when completed sorts change
  useEffect(() => {
    setCompletedTasksPage(1);
  }, [completedSorts]);

  const sortTasks = (tasksToSort: TaskWithDetails[], sorts: SortState[]): TaskWithDetails[] => {
    return [...tasksToSort].sort((a, b) => {
      for (const sort of sorts) {
        let comparison = 0;
        
        switch (sort.field) {
          case 'status': {
            const statusOrder: Record<TaskStatus, number> = { 'active': 0, 'on_deck': 1, 'completed': 2 };
            const aStatus = a.status || 'on_deck';
            const bStatus = b.status || 'on_deck';
            comparison = statusOrder[aStatus] - statusOrder[bStatus];
            break;
          }
          case 'title': {
            comparison = (a.item.title || '').localeCompare(b.item.title || '');
            break;
          }
          case 'priority': {
            const priorityOrder: Record<Priority, number> = { 'high': 0, 'normal': 1, 'low': 2 };
            const aPriority: Priority = a.priority || 'normal';
            const bPriority: Priority = b.priority || 'normal';
            comparison = priorityOrder[aPriority] - priorityOrder[bPriority];
            break;
          }
          case 'assigned_date': {
            const aAssigned = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
            const bAssigned = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
            comparison = aAssigned - bAssigned;
            break;
          }
          case 'due_date': {
            const aDue = a.due_date ? new Date(a.due_date).getTime() : 0;
            const bDue = b.due_date ? new Date(b.due_date).getTime() : 0;
            comparison = aDue - bDue;
            break;
          }
          case 'reminder_time': {
            const aReminder = a.reminder_time ? new Date(a.reminder_time).getTime() : 0;
            const bReminder = b.reminder_time ? new Date(b.reminder_time).getTime() : 0;
            comparison = aReminder - bReminder;
            break;
          }
          case 'project': {
            const aHasProject = Boolean(a.project_id);
            const bHasProject = Boolean(b.project_id);
            comparison = Number(aHasProject) - Number(bHasProject);
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

  const activeTasks = sortTasks(tasks.filter(task => {
    const status = task?.status?.toLowerCase() || 'on_deck';
    return status === 'active' || status === 'on_deck';
  }), activeSorts);
  
  const allCompletedTasks = sortTasks(tasks.filter(task => {
    const status = task?.status?.toLowerCase() || 'on_deck';
    return status === 'completed';
  }), completedSorts);

  const completedCount = allCompletedTasks.length;
  const totalCompletedPages = Math.ceil(completedCount / completedTasksPerPage);
  
  // Get the current page of completed tasks
  const startIndex = (completedTasksPage - 1) * completedTasksPerPage;
  const endIndex = startIndex + completedTasksPerPage;
  const paginatedCompletedTasks = allCompletedTasks.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <TaskTableBase 
          tasks={activeTasks}
          onTaskUpdate={onTaskUpdate}
          sorts={activeSorts}
          onSort={handleActiveSort}
          tableType="active"
          key={`active-${activeSorts.map(s => `${s.field}-${s.direction}-${s.level}`).join(',')}`}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => {
            const newValue = !showCompleted;
            setShowCompleted(newValue);
            if (typeof window !== 'undefined') {
              localStorage.setItem('taskTable_showCompleted', JSON.stringify(newValue));
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChevronRight 
                className={`h-5 w-5 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
              />
              <h3 className="text-lg font-medium">Completed Tasks</h3>
              <Badge variant="secondary">{completedCount}</Badge>
            </div>
          </div>
        </div>
        
        {showCompleted && (
          <div className="p-6">
            {completedLoading ? (
              <div className="text-gray-500 text-center py-4">Loading completed tasks...</div>
            ) : paginatedCompletedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No completed tasks</div>
            ) : (
              <>
                <TaskTableBase 
                  tasks={paginatedCompletedTasks}
                  onTaskUpdate={onTaskUpdate}
                  sorts={completedSorts}
                  onSort={handleCompletedSort}
                  tableType="completed"
                  key={`completed-${completedSorts.map(s => `${s.field}-${s.direction}-${s.level}`).join(',')}`}
                />
                
                {/* Pagination Controls */}
                {totalCompletedPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompletedTasksPage(prev => Math.max(prev - 1, 1))}
                      disabled={completedTasksPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalCompletedPages) }, (_, i) => {
                        let pageNum;
                        if (totalCompletedPages <= 5) {
                          pageNum = i + 1;
                        } else if (completedTasksPage <= 3) {
                          pageNum = i + 1;
                        } else if (completedTasksPage >= totalCompletedPages - 2) {
                          pageNum = totalCompletedPages - 4 + i;
                        } else {
                          pageNum = completedTasksPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === completedTasksPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCompletedTasksPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompletedTasksPage(prev => Math.min(prev + 1, totalCompletedPages))}
                      disabled={completedTasksPage === totalCompletedPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm text-gray-500 ml-4">
                      Page {completedTasksPage} of {totalCompletedPages} ({completedCount} total tasks)
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { TaskTable };
export default TaskTable;