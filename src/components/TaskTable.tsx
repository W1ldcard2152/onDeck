import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link } from 'lucide-react';
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

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onTaskUpdate }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'on_deck': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
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

  const updateTaskPriority = async (taskId: string, newPriority: 'low' | 'normal' | 'high') => {
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
            <TableHead className="w-12">Status</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Linked Project</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isLoading = loading[task.id];
            const status = task.status || 'on_deck';
            const priority = task.priority || 'normal';
            
            return (
              <TableRow 
                key={task.id}
                className={isCompleted ? 'bg-gray-50' : ''}
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
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'on_deck')}
                        className={status === 'on_deck' ? 'bg-yellow-50' : ''}
                        disabled={isLoading}
                      >
                        On Deck
                        {status === 'on_deck' && <Check className="ml-2 h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'active')}
                        className={status === 'active' ? 'bg-green-50' : ''}
                        disabled={isLoading}
                      >
                        Active
                        {status === 'active' && <Check className="ml-2 h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className={status === 'completed' ? 'bg-gray-50' : ''}
                        disabled={isLoading}
                      >
                        Completed
                        {status === 'completed' && <Check className="ml-2 h-4 w-4" />}
                      </DropdownMenuItem>
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