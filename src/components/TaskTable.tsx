import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";
import type { Database } from '@/types/database.types';
import type { TaskWithDetails } from '@/lib/types';

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onTaskUpdate }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'on_deck': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Database['public']['Tables']['tasks']['Row']['status']) => {
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

  const updateTaskPriority = async (taskId: string, newPriority: Database['public']['Tables']['tasks']['Row']['priority']) => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ priority: newPriority })
        .eq('id', taskId);

      if (updateError) throw updateError;
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
            return (
              <TableRow 
                key={task.id}
                className={isCompleted ? 'bg-gray-50' : ''}
              >
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                        <Badge 
                          className={`${getStatusColor(task.status)} border-0 cursor-pointer hover:opacity-80`}
                        >
                          {task.status || 'on_deck'}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'on_deck')}
                        className={task.status === 'on_deck' ? 'bg-yellow-50' : ''}
                      >
                        On Deck
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'active')}
                        className={task.status === 'active' ? 'bg-green-50' : ''}
                      >
                        Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className={task.status === 'completed' ? 'bg-gray-50' : ''}
                      >
                        Completed
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
                      <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                        <Badge 
                          className={`${getPriorityColor(task.priority)} border-0 cursor-pointer hover:opacity-80`}
                        >
                          {task.priority || 'none'}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => updateTaskPriority(task.id, null)}
                        className={!task.priority ? 'bg-gray-50' : ''}
                      >
                        None
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskPriority(task.id, 'low')}
                        className={task.priority === 'low' ? 'bg-blue-50' : ''}
                      >
                        Low
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskPriority(task.id, 'medium')}
                        className={task.priority === 'medium' ? 'bg-yellow-50' : ''}
                      >
                        Medium
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskPriority(task.id, 'high')}
                        className={task.priority === 'high' ? 'bg-orange-50' : ''}
                      >
                        High
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
                  {task.project_id && (
                    <div className="flex items-center text-blue-600">
                      <Link className="h-4 w-4 mr-1" />
                      Project {task.project_id.slice(0, 8)}
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
                        disabled={loading[task.id]}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'active')}
                      >
                        Mark Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTaskStatus(task.id, 'completed')}
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