import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, MoreHorizontal } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { TaskWithDetails } from '@/lib/types';
import type { Database } from '@/types/database.types';

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onTaskUpdate }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  // Sort tasks: active first, then by due date, then by creation date
  const sortedTasks = [...tasks].sort((a, b) => {
    // First by status
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    
    // Then by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    
    // Finally by creation date
    return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
  });

  const updateTaskStatus = async (taskId: string, newStatus: 'active' | 'completed') => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (updateError) throw updateError;
      onTaskUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating task status';
      setError(message);
      console.error('Error updating task status:', err);
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const archiveTask = async (taskId: string) => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      const { error: archiveError } = await supabase
        .from('items')
        .update({ 
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (archiveError) throw archiveError;
      onTaskUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error archiving task';
      setError(message);
      console.error('Error archiving task:', err);
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
            <TableHead>Description</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => {
            const isCompleted = task.status !== 'active';
            return (
              <TableRow 
                key={task.id}
                className={isCompleted ? 'bg-gray-50' : ''}
              >
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isCompleted ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => updateTaskStatus(task.id, isCompleted ? 'active' : 'completed')}
                    disabled={loading[task.id]}
                  >
                    <Check className="h-4 w-4" />
                    <span className="sr-only">
                      Mark as {isCompleted ? 'active' : 'completed'}
                    </span>
                  </Button>
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
                  {task.item.title}
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
                  {task.description || '-'}
                </TableCell>
                <TableCell className={isCompleted ? 'text-gray-500' : ''}>
                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={loading[task.id]}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, isCompleted ? 'active' : 'completed')}
                      >
                        Mark as {isCompleted ? 'Active' : 'Completed'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => archiveTask(task.id)}
                      >
                        Archive
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