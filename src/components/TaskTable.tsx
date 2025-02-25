import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import React, { useState } from 'react';
import TruncatedCell from './TruncatedCell';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
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
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define types
type SortDirection = 'asc' | 'desc' | null;
type SortField = 'status' | 'title' | 'priority' | 'assigned_date' | 'description' | 'due_date' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
  level: number;
}

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
}

interface TaskTableBaseProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
  sorts: SortState[];
  onSort: (field: SortField) => void;
  tableType: 'active' | 'completed';
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
  const supabase = createClientComponentClient<Database>();
  const { user } = useSupabaseAuth();

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
              "This task is part of a project with incomplete prior steps. " +
              "Deleting it may cause inconsistencies in your project workflow. Continue?"
            )) {
              setLoading(prev => ({ ...prev, [taskId]: false }));
              return;
            }
          }
          
          // Check if there are later converted steps dependent on this one
          const hasConvertedLaterSteps = steps?.slice(stepIndex + 1).some(step => step.is_converted);
          
          if (hasConvertedLaterSteps && thisStep.status !== 'completed') {
            if (!window.confirm(
              "This task is part of a project workflow with follow-up tasks already created. " +
              "Deleting it will disrupt the workflow. Continue?"
            )) {
              setLoading(prev => ({ ...prev, [taskId]: false }));
              return;
            }
          }
        }
        
        // Notify the ProjectTaskManager about the task deletion
        await projectTaskManager.handleTaskDeletion(taskId);
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

  const handleProjectTaskCompletion = async (taskData: any, taskId: string) => {
    try {
      // Update project step
      const { error: stepError } = await supabase
        .from('project_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('converted_task_id', taskId)
        .select()
        .single();

      if (stepError) throw stepError;

      // Get all project steps
      const { data: projectSteps, error: stepsError } = await supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', taskData.project_id)
        .order('order_number', { ascending: true });

      if (stepsError) throw stepsError;

      // Find next unconverted step
      const nextStep = projectSteps?.find(step => 
        !step.is_converted && step.status !== 'completed'
      );

      if (nextStep) {
        await createNextTask(nextStep, taskData.project_id);
      }
    } catch (error) {
      console.error('Error handling project task completion:', error);
      throw error;
    }
  };

  const createNextTask = async (nextStep: any, projectId: string) => {
    const now = new Date().toISOString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const { data: newTaskItem, error: newItemError } = await supabase
        .from('items')
        .insert([{
          title: nextStep.title,
          user_id: user?.id,
          item_type: 'task',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();

      if (newItemError) throw newItemError;

      const { error: newTaskError } = await supabase
        .from('tasks')
        .insert([{
          id: newTaskItem.id,
          status: 'on_deck',
          description: nextStep.description,
          priority: 'normal',
          due_date: tomorrow.toISOString(),
          assigned_date: now,
          project_id: projectId,
          is_project_converted: true
        }]);

      if (newTaskError) throw newTaskError;

      const { error: stepUpdateError } = await supabase
        .from('project_steps')
        .update({
          is_converted: true,
          converted_task_id: newTaskItem.id
        })
        .eq('id', nextStep.id);

      if (stepUpdateError) throw stepUpdateError;
    } catch (error) {
      console.error('Error creating next task:', error);
      throw error;
    }
  };

  const updateTaskPriority = async (taskId: string, newPriority: Priority): Promise<void> => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ priority: newPriority })
        .eq('id', taskId);

      if (taskError) throw taskError;

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
                  {tableType === 'active' ? (
                    <Button 
                      variant="ghost" 
                      onClick={() => onSort('status')}
                      className="hover:bg-gray-100"
                    >
                      Status {getSortIcon('status')}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">Status</span>
                  )}
                </TableHead>
                <TableHead>
                  {tableType === 'active' ? (
                    <Button 
                      variant="ghost" 
                      onClick={() => onSort('title')}
                      className="hover:bg-gray-100"
                    >
                      Title {getSortIcon('title')}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">Title</span>
                  )}
                </TableHead>
                <TableHead>
                  {tableType === 'active' ? (
                    <Button 
                      variant="ghost" 
                      onClick={() => onSort('priority')}
                      className="hover:bg-gray-100"
                    >
                      Priority {getSortIcon('priority')}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">Priority</span>
                  )}
                </TableHead>
                <TableHead>
                  {tableType === 'active' ? (
                    <Button 
                      variant="ghost" 
                      onClick={() => onSort('assigned_date')}
                      className="hover:bg-gray-100"
                    >
                      Assigned Date {getSortIcon('assigned_date')}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">Assigned Date</span>
                  )}
                </TableHead>
                <TableHead>
                  <span className="text-sm font-medium">Description</span>
                </TableHead>
                <TableHead>
                  {tableType === 'active' ? (
                    <Button 
                      variant="ghost" 
                      onClick={() => onSort('due_date')}
                      className="hover:bg-gray-100"
                    >
                      Due Date {getSortIcon('due_date')}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">Due Date</span>
                  )}
                </TableHead>
                <TableHead>
                  <span className="text-sm font-medium">Linked Project</span>
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
  
  return (
    <TableRow 
      key={task.id}
      className={isProjectTask ? "bg-blue-50/30" : ""}
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
        {task.item.title}
        {isProjectTask && (
          <div className="flex items-center mt-1">
            <span className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              <Link className="h-3 w-3 mr-1" />
              Project Task
            </span>
          </div>
        )}
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
        {task.assigned_date ? format(new Date(task.assigned_date), 'MMM d, yyyy') : '-'}
      </TableCell>
      
      <TableCell className="max-w-[12rem] truncate">
        <TruncatedCell content={task.description} maxLength={60} />
      </TableCell>
      
      <TableCell>
        {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
      </TableCell>
      
      <TableCell>
        {isProjectTask && (
          <div className="flex items-center text-blue-600">
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto text-xs flex items-center text-blue-600"
              onClick={() => {
                // If needed, you can add project navigation here
                // router.push(`/projects/${task.project_id}`);
              }}
            >
              <Link className="h-3 w-3 mr-1" />
              View project
            </Button>
          </div>
        )}
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
            
            {/* Add warning for project tasks */}
            <DropdownMenuItem
              onClick={() => {
                const confirmMessage = isProjectTask 
                  ? 'This task is part of a project workflow. Deleting it will affect the project. Are you sure?'
                  : 'Are you sure you want to delete this task? This action cannot be undone.';
                  
                if (window.confirm(confirmMessage)) {
                  deleteTask(task.id);
                }
              }}
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
const TaskTable: React.FC<TaskTableProps> = ({ tasks, onTaskUpdate }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [sorts, setSorts] = useState<SortState[]>([]);

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

  const sortTasks = (tasksToSort: TaskWithDetails[]): TaskWithDetails[] => {
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
        }

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  };
  console.log('Raw tasks:', tasks.map(t => ({ id: t.id, status: t.status })));

  const activeTasks = sortTasks(tasks.filter(task => {
    const status = task?.status?.toLowerCase() || 'on_deck';
    return task.status === 'active' || task.status === 'on_deck';
    console.log('Task being filtered:', task.id, task.status);
  }));
  
  const completedTasks = sortTasks(tasks.filter(task => {
    const status = task?.status?.toLowerCase() || 'on_deck';
    return status === 'completed';
  }));

  // Debug logs
  console.log('Filtered active tasks:', activeTasks.map(t => ({ id: t.id, status: t.status })));
  console.log('Filtered completed tasks:', completedTasks.map(t => ({ id: t.id, status: t.status })));

  const completedCount = completedTasks.length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <TaskTableBase 
          tasks={activeTasks}
          onTaskUpdate={onTaskUpdate}
          sorts={sorts}
          onSort={handleSort}
          tableType="active"
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowCompleted(!showCompleted)}
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
            {completedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No completed tasks</div>
            ) : (
              <TaskTableBase 
                tasks={completedTasks}
                onTaskUpdate={onTaskUpdate}
                sorts={sorts}
                onSort={handleSort}
                tableType="completed"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { TaskTable };
export default TaskTable;