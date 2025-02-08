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

const TaskTableBase = ({ 
  tasks, 
  onTaskUpdate,
  sorts,
  onSort,
  tableType
}: TaskTableBaseProps) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);
  const supabase = createClientComponentClient<Database>();

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (taskError) throw taskError;

      const { error: itemError } = await supabase
        .from('items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (itemError) throw itemError;

      onTaskUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating task status';
      setError(message);
      console.error('Error updating task status:', err);
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
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
              
              return (
                <TableRow key={task.id}>
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
                        {tableType === 'active' ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, status === 'on_deck' ? 'active' : 'on_deck')}
                              disabled={isLoading}
                            >
                              Mark {status === 'on_deck' ? 'active' : 'on deck'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              disabled={isLoading}
                            >
                              Mark completed
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              disabled={isLoading}
                            >
                              Mark active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateTaskStatus(task.id, 'on_deck')}
                              disabled={isLoading}
                            >
                              Mark on deck
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    {task.item.title}
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
                    {task.converted_project_id && (
                      <div className="flex items-center text-blue-600">
                        <Link className="h-4 w-4 mr-1" />
                        Project {task.converted_project_id.slice(0, 8)}
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
                        <DropdownMenuItem
                          onClick={() => updateTaskStatus(task.id, tableType === 'active' ?
                            'completed' : 'active')}
                          disabled={isLoading}
                        >
                          {tableType === 'active' ? 'Mark Completed' : 'Mark Active'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

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

const TaskTable = ({ tasks, onTaskUpdate }: TaskTableProps) => {
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

  const activeTasks = sortTasks(tasks.filter(task => 
    task.status === 'active' || task.status === 'on_deck'
  ));
  
  const completedTasks = tasks.filter(task => 
    task.status === 'completed'
  );

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
        
        {showCompleted && completedTasks.length > 0 && (
          <TaskTableBase 
            tasks={completedTasks}
            onTaskUpdate={onTaskUpdate}
            sorts={sorts}
            onSort={handleSort}
            tableType="completed"
          />
        )}
      </div>
    </div>
  );
};

export { TaskTable };
export default TaskTable;