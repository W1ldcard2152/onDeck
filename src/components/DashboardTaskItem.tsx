'use client'

import React from 'react';
import { CheckCircle2, ChevronUp, ChevronDown, MoreVertical, Link, CheckSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskWithDetails } from '@/lib/types';
import type { TaskStatus } from '@/types/database.types';
import {
  getContextColor,
  getStatusColor,
  formatReminderTime,
  type Habit,
} from '@/lib/dashboardUtils';

interface DashboardTaskItemProps {
  task: TaskWithDetails;
  habits: Habit[];
  contextLabel?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onComplete: (taskId: string) => void;
  onEdit: (task: TaskWithDetails) => void;
  onDelete: (taskId: string) => void;
  onStatusToggle: (taskId: string, newStatus: TaskStatus) => void;
  onChecklistRun?: (templateId: string) => void;
  showMoveControls?: boolean;
}

export const DashboardTaskItem: React.FC<DashboardTaskItemProps> = React.memo(({
  task,
  habits,
  contextLabel,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onComplete,
  onEdit,
  onDelete,
  onStatusToggle,
  onChecklistRun,
  showMoveControls = false,
}) => {
  const habitTimeDisplay = React.useMemo(() => {
    if (task.reminder_time || !task.habit_id) return null;
    const habit = habits.find(h => h.id === task.habit_id);
    if (!habit) return null;
    const rule = typeof habit.recurrence_rule === 'string'
      ? JSON.parse(habit.recurrence_rule)
      : habit.recurrence_rule;
    if (!rule?.time_of_day) return null;
    return format(new Date(`2000-01-01T${rule.time_of_day}`), 'h:mm a');
  }, [task.reminder_time, task.habit_id, habits]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={`p-3 md:p-4 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer ${getContextColor(task)}`}>
          <div className="flex items-start gap-2 md:gap-3">
            {showMoveControls && (
              <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${!canMoveUp ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${!canMoveDown ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8 flex-shrink-0">
                    <MoreVertical className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => onEdit(task)} className="text-base md:text-sm py-3 md:py-2">
                    Edit Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onComplete(task.id)} className="text-base md:text-sm py-3 md:py-2">
                    Mark Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusToggle(task.id, task.status === 'active' ? 'on_deck' : 'active')}
                    className="text-base md:text-sm py-3 md:py-2"
                  >
                    Edit Status: {task.status === 'active' ? 'Set On Deck' : 'Set Active'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(task.id)}
                    className="text-red-600 hover:text-red-700 text-base md:text-sm py-3 md:py-2"
                  >
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onComplete(task.id); }} className="flex-shrink-0 mt-0.5 p-1 md:p-0">
              <CheckCircle2 className="h-6 w-6 md:h-5 md:w-5 text-blue-500" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-base md:text-sm break-words">{task.item.title}</h3>
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-1 text-xs text-gray-600">
                {contextLabel && (
                  <span className={`font-medium whitespace-nowrap ${contextLabel === "OVERDUE" ? "text-red-600" : "text-orange-500"}`}>
                    {contextLabel}
                  </span>
                )}
                {task.assigned_date && (
                  <span className="whitespace-nowrap">Assigned: {format(parseISO(task.assigned_date), 'MMM d, yyyy')}</span>
                )}
                {task.due_date && (
                  <span className="text-orange-600 font-medium whitespace-nowrap">Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                )}
                {task.reminder_time && (
                  <span className="flex items-center text-blue-600 font-medium whitespace-nowrap">
                    🔔 {formatReminderTime(task.reminder_time)}
                  </span>
                )}
                {habitTimeDisplay && (
                  <span className="flex items-center text-blue-600 font-medium whitespace-nowrap">
                    🔔 {habitTimeDisplay}
                  </span>
                )}
                {task.project_id && (
                  <span className="flex items-center text-blue-500 whitespace-nowrap">
                    <Link className="mr-1 h-3 w-3" />
                    Project
                  </span>
                )}
                {task.checklist_template_id && onChecklistRun && (
                  <button
                    className="inline-flex items-center text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChecklistRun(task.checklist_template_id!);
                    }}
                  >
                    <CheckSquare className="mr-1 h-3 w-3" />
                    Run Checklist
                  </button>
                )}
              </div>
            </div>
            {task._pending ? (
              <Badge className="bg-amber-100 text-amber-800 flex-shrink-0 text-xs">
                Pending
              </Badge>
            ) : (
              <Badge className={`${getStatusColor(task.status || 'active')} flex-shrink-0 text-xs`}>
                {task.status || 'active'}
              </Badge>
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 p-4" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        {task.description ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No description</p>
        )}
      </PopoverContent>
    </Popover>
  );
});

DashboardTaskItem.displayName = 'DashboardTaskItem';
