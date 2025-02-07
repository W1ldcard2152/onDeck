import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link, ChevronDown, ChevronUp } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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


export const TaskTable = ({ tasks, onTaskUpdate }: TaskTableProps): JSX.Element => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [sorts, setSorts] = useState<SortState[]>([]);
  const supabase = createClientComponentClient<Database>();

  const getIconClasses = (level: number): string => {
    switch(level) {
      case 1: return "h-5 w-5";
      case 2: return "h-4 w-4";
      case 3: return "h-3 w-3";
      default: return "h-4 w-4";
    }
  };

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

    const getIconSize = (level: number): string => {
      switch(level) {
        case 1: return "h-5 w-5";
        case 2: return "h-4 w-4";
        case 3: return "h-3 w-3";
        default: return "h-4 w-4";
      }
    };

    return (
      <span className="ml-2 inline-flex items-center gap-1" title={`Sort level ${sort.level}`}>
        <div className={`flex items-center ${getIconColor(sort.level)}`}>
          {sort.direction === 'asc' ? (
            <ChevronUp className={getIconSize(sort.level)} />
          ) : (
            <ChevronDown className={getIconSize(sort.level)} />
          )}
          {sort.level > 1 && (
            <span className="text-xs ml-0.5">{sort.level}</span>
          )}
        </div>
      </span>
    );
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

  const sortedTasks = [...tasks].sort((a, b) => {
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

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort('status')}
                className="hover:bg-gray-100"
              >
                Status {getSortIcon('status')}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort('title')}
                className="hover:bg-gray-100"
              >
                Title {getSortIcon('title')}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort('priority')}
                className="hover:bg-gray-100"
              >
                Priority {getSortIcon('priority')}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort('assigned_date')}
                className="hover:bg-gray-100"
              >
                Assigned Date {getSortIcon('assigned_date')}
              </Button>
            </TableHead>
            <TableHead>Description</TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort('due_date')}
                className="hover:bg-gray-100"
              >
                Due Date {getSortIcon('due_date')}
              </Button>
            </TableHead>
            <TableHead>Linked Project</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isLoading = loading[task.id];
            const status = task.status || 'on_deck';
            const priority = task.priority || 'normal';
            
            return (
              <TableRow 
                key={task.id}
                className={isCompleted ? 'bg-gray-50' : ''}
              >
                {/* Rest of your existing row content */}
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
                      {/* Your existing dropdown content */}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
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
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
                  {task.assigned_date ? format(new Date(task.assigned_date), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
                  {task.description || '-'}
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
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
                        onClick={() => updateTaskStatus(task.id, 'active')}
                        disabled={isLoading}
                      >
                        Mark Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        disabled={isLoading}
                      >
                        Mark Completed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};