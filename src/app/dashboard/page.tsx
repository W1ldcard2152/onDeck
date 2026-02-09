'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardTaskItem } from '@/components/DashboardTaskItem';
import { NewEntryForm } from '@/components/NewEntryForm';
import { NewEntryDropdown } from '@/components/NewEntryDropdown';
import { QuoteOfTheDay } from '@/components/QuoteOfTheDay';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits } from '@/hooks/useHabits';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { addDays, isWithinInterval, isToday, isTomorrow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TaskWithDetails, DailyContext } from '@/lib/types';
import type { TaskStatus } from '@/types/database.types';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';
import { getSupabaseClient } from '@/lib/supabase-client';
import { startOfDay, parseISO, isBefore } from 'date-fns';
import { useChecklists } from '@/hooks/useChecklists';
import { ChecklistCompletion } from '@/components/ChecklistCompletion';
import {
  parseDateForDisplay,
  isDateToday,
  isDatePast,
  isDateWithinUpcoming,
  formatDateDisplay,
  formatReminderTime,
  taskMatchesContext,
  getPrimaryContext,
  getStatusColor,
} from '@/lib/dashboardUtils';

const DashboardPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { tasks: fetchedTasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(
    user?.id,
    50,
    true,
    ['active', 'habit', 'project']
  );
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const { habits, isLoading: habitsLoading } = useHabits(user?.id);
  const { templates: checklistTemplates } = useChecklists(user?.id);
  const [completingTemplateId, setCompletingTemplateId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);

  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<TaskWithDetails[]>([]);

  // Sync fetched tasks to local state
  useEffect(() => {
    setLocalTasks(fetchedTasks);
  }, [fetchedTasks]);

  const tasks = localTasks;

  const [taskToView, setTaskToView] = useState<TaskWithDetails | null>(null);
  const supabase = getSupabaseClient();

  // --- Task actions ---

  const handleUpdate = useCallback(() => {
    refetchTasks();
    refetchNotes();
    setRefreshKey(prev => prev + 1);
  }, [refetchTasks, refetchNotes]);

  const moveTask = useCallback(async (taskId: string, direction: 'up' | 'down', filteredTasks: TaskWithDetails[]) => {
    const currentIndex = filteredTasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredTasks.length) return;

    const currentTask = filteredTasks[currentIndex];
    const targetTask = filteredTasks[targetIndex];

    if (!currentTask.due_date && targetTask.due_date) return;

    const newCurrentSortOrder = targetTask.sort_order;
    const newTargetSortOrder = currentTask.sort_order;

    const previousTasks = [...localTasks];

    setLocalTasks(prev => prev.map(task => {
      if (task.id === currentTask.id) return { ...task, sort_order: newCurrentSortOrder };
      if (task.id === targetTask.id) return { ...task, sort_order: newTargetSortOrder };
      return task;
    }));

    try {
      const results = await Promise.all([
        supabase.from('tasks').update({ sort_order: newCurrentSortOrder }).eq('id', currentTask.id),
        supabase.from('tasks').update({ sort_order: newTargetSortOrder }).eq('id', targetTask.id)
      ]);

      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        setLocalTasks(previousTasks);
        refetchTasks();
      }
    } catch {
      setLocalTasks(previousTasks);
      refetchTasks();
    }
  }, [localTasks, supabase, refetchTasks]);

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    const task = localTasks.find(t => t.id === taskId);

    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    try {
      const { error: taskError } = await supabase
        .from('tasks')
        // @ts-ignore - Supabase type inference issue
        .update({ status: newStatus })
        .eq('id', taskId);

      if (taskError) throw taskError;

      const { error: itemError } = await supabase
        .from('items')
        // @ts-ignore - Supabase type inference issue
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (itemError) throw itemError;

      // If completing a habit task, generate the next occurrence
      if (newStatus === 'completed' && task?.habit_id && user?.id) {
        const habit = habits.find(h => h.id === task.habit_id);
        if (habit && habit.is_active) {
          try {
            const taskGenerator = new HabitTaskGenerator(supabase, user.id);
            await taskGenerator.generateNextTask(habit, new Date(), false);
            refetchTasks();
          } catch {
            // Completion was successful, just task generation failed
          }
        }
      }
    } catch {
      setLocalTasks(previousTasks);
    }
  }, [localTasks, supabase, user?.id, habits, refetchTasks]);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
      return;
    }

    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(task => task.id !== taskId));

    try {
      const { error: taskError } = await supabase.from('tasks').delete().eq('id', taskId);
      if (taskError) throw taskError;
      const { error: itemError } = await supabase.from('items').delete().eq('id', taskId);
      if (itemError) throw itemError;
    } catch {
      setLocalTasks(previousTasks);
    }
  }, [localTasks, supabase]);

  // --- Memoized data ---

  const dashboardData = useMemo(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);
    const threeDaysLater = addDays(today, 3);
    const activeTasks = tasks;
    return { today, tomorrow, dayAfterTomorrow, threeDaysLater, activeTasks };
  }, [tasks]);

  const { today, tomorrow, threeDaysLater, activeTasks } = dashboardData;

  const getFilteredTasks = useCallback((context: DailyContext | 'all' | 'past') => {
    const todayStart = startOfDay(new Date());

    const contextOrder: Record<string, number> = {
      'all_day': 0, 'morning': 1, 'work': 2, 'family': 3, 'evening': 4, 'none': 5
    };

    const filtered = tasks.filter(task => {
      if (task.status === 'completed') return false;
      const assignedDate = task.assigned_date ? startOfDay(parseISO(task.assigned_date)) : null;
      const dueDate = task.due_date ? startOfDay(parseISO(task.due_date)) : null;

      if (context === 'past') {
        const hasRelevantAssignedDate = assignedDate && isBefore(assignedDate, todayStart);
        const hasRelevantDueDate = dueDate && isBefore(dueDate, todayStart);
        return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, context);
      }

      const hasRelevantAssignedDate = assignedDate && (isToday(assignedDate) || isBefore(assignedDate, todayStart));
      const hasRelevantDueDate = dueDate && (isToday(dueDate) || isBefore(dueDate, todayStart));
      return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, context);
    });

    return filtered.sort((a, b) => {
      if (context === 'all' || context === 'past') {
        const contextA = getPrimaryContext(a);
        const contextB = getPrimaryContext(b);
        const contextDiff = contextOrder[contextA] - contextOrder[contextB];
        if (contextDiff !== 0) return contextDiff;
      }
      const hasDueA = !!a.due_date;
      const hasDueB = !!b.due_date;
      if (hasDueA && !hasDueB) return -1;
      if (!hasDueA && hasDueB) return 1;
      if (hasDueA && hasDueB) {
        const dateA = new Date(a.due_date!).getTime();
        const dateB = new Date(b.due_date!).getTime();
        if (dateA !== dateB) return dateA - dateB;
      }
      return a.sort_order - b.sort_order;
    });
  }, [tasks]);

  const taskSections = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };

    const todayDueTasks = activeTasks.filter(task => {
      if (!task.due_date) return false;
      return isDateToday(task.due_date) || isDatePast(task.due_date);
    }).sort((a, b) => {
      if (isDatePast(a.due_date) && isDatePast(b.due_date)) {
        const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
        const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
        return aDate - bDate;
      }
      return (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1);
    });

    const todayAssignedTasks = activeTasks.filter(task => {
      if (task.due_date && (isDateToday(task.due_date) || isDatePast(task.due_date))) return false;
      return task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date));
    }).sort((a, b) => {
      const getTaskTime = (task: TaskWithDetails): string | null => {
        if (task.reminder_time) {
          const date = new Date(task.reminder_time);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        return null;
      };

      const aTime = getTaskTime(a);
      const bTime = getTaskTime(b);

      if (!aTime && !bTime) {
        if (isDatePast(a.assigned_date) && isDatePast(b.assigned_date)) {
          const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
          const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
          return aDate - bDate;
        }
        return (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1);
      }
      if (!aTime) return -1;
      if (!bTime) return 1;
      return aTime.localeCompare(bTime);
    });

    const upcomingDueTasks = activeTasks.filter(task => {
      if (!task.due_date || task.habit_id) return false;
      if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
      return isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater);
    }).sort((a, b) => {
      const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
      if (aDate === bDate) {
        return (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1);
      }
      return aDate - bDate;
    });

    const upcomingAssignedTasks = activeTasks.filter(task => {
      if (task.habit_id) return false;
      if (task.due_date) {
        if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
        if (isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater)) return false;
      }
      if (task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date))) return false;
      if (task.assigned_date) {
        const assignedDate = parseDateForDisplay(task.assigned_date);
        if (assignedDate && isTomorrow(assignedDate)) return true;
      }
      return task.assigned_date && isDateWithinUpcoming(task.assigned_date, tomorrow, threeDaysLater);
    }).sort((a, b) => {
      const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
      if (aDate === bDate) {
        return (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1);
      }
      return aDate - bDate;
    });

    const tasksWithoutDates = activeTasks
      .filter(task => !task.due_date && !task.assigned_date)
      .sort((a, b) => (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1))
      .slice(0, 5);

    return { todayDueTasks, todayAssignedTasks, upcomingDueTasks, upcomingAssignedTasks, tasksWithoutDates };
  }, [activeTasks, tomorrow, threeDaysLater]);

  const { todayDueTasks, todayAssignedTasks, upcomingDueTasks, upcomingAssignedTasks, tasksWithoutDates } = taskSections;

  const recentNotes = useMemo(() => {
    return [...notes]
      .filter(note => {
        if (!note.item || !note.item.created_at) return false;
        const createdDate = new Date(note.item.created_at);
        return isWithinInterval(createdDate, { start: addDays(today, -7), end: today });
      })
      .sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime())
      .slice(0, 3);
  }, [notes, today]);

  // --- Rendering helpers ---

  const renderTaskItem = useCallback((task: TaskWithDetails, contextLabel?: string, filteredTasks?: TaskWithDetails[], index?: number) => {
    const showMoveControls = filteredTasks !== undefined && index !== undefined;
    return (
      <DashboardTaskItem
        key={task.id}
        task={task}
        habits={habits}
        contextLabel={contextLabel}
        showMoveControls={showMoveControls}
        canMoveUp={showMoveControls && index > 0}
        canMoveDown={showMoveControls && index < (filteredTasks?.length ?? 0) - 1}
        onMoveUp={() => filteredTasks && moveTask(task.id, 'up', filteredTasks)}
        onMoveDown={() => filteredTasks && moveTask(task.id, 'down', filteredTasks)}
        onComplete={(id) => updateTaskStatus(id, 'completed')}
        onEdit={setTaskToEdit}
        onDelete={deleteTask}
        onStatusToggle={updateTaskStatus}
        onChecklistRun={setCompletingTemplateId}
      />
    );
  }, [habits, moveTask, updateTaskStatus, deleteTask]);

  const renderContextTaskList = useCallback((context: DailyContext | 'all' | 'past') => {
    const filteredTasks = getFilteredTasks(context);
    const getContextTitle = (ctx: typeof context) => {
      if (ctx === 'all') return 'All';
      if (ctx === 'past') return 'Past';
      if (ctx === 'all_day') return 'All Day';
      return ctx.charAt(0).toUpperCase() + ctx.slice(1);
    };

    return (
      <DashboardCard
        title={`${getContextTitle(context)} Tasks (${filteredTasks.length})`}
        content={
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks</div>
            ) : (
              filteredTasks.map((task, index) => {
                const isPastDue = task.due_date && isDatePast(task.due_date);
                const isPastAssigned = task.assigned_date && isDatePast(task.assigned_date);
                const label = isPastDue ? "OVERDUE" : isPastAssigned ? "PAST ASSIGNED" : undefined;
                return renderTaskItem(task, label, filteredTasks, index);
              })
            )}
          </div>
        }
      />
    );
  }, [getFilteredTasks, renderTaskItem]);

  // --- Loading state ---

  if (tasksLoading || notesLoading || habitsLoading) {
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

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <NewEntryDropdown onEntryCreated={handleUpdate} />
        </div>
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <NewEntryDropdown onEntryCreated={handleUpdate} />
        </div>
      </div>

      <QuoteOfTheDay />

      {/* Edit task modal */}
      {taskToEdit && (
        <NewEntryForm
          initialData={taskToEdit}
          isEditing={true}
          onEntryCreated={() => { handleUpdate(); setTaskToEdit(null); }}
          onClose={() => setTaskToEdit(null)}
        />
      )}

      {/* Task detail dialog */}
      {taskToView && (
        <Dialog open={Boolean(taskToView)} onOpenChange={(open) => !open && setTaskToView(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{taskToView.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2 text-sm">
                {taskToView.assigned_date && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>Assigned: {formatDateDisplay(taskToView.assigned_date)}</span>
                  </div>
                )}
                {taskToView.reminder_time && (
                  <div className="flex items-center text-blue-600 font-medium">
                    🔔 {formatReminderTime(taskToView.reminder_time)}
                  </div>
                )}
                {taskToView.due_date && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="mr-1 h-4 w-4" />
                    <span>Due: {formatDateDisplay(taskToView.due_date)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Badge className={getStatusColor(taskToView.status || 'on_deck')}>
                  {taskToView.status || 'on_deck'}
                </Badge>
                {taskToView.project_id && (
                  <Badge className="bg-blue-100 text-blue-800">Project</Badge>
                )}
              </div>
              {taskToView.description ? (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{taskToView.description}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">No description available</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setTaskToView(null); setTaskToEdit(taskToView); }}>
                  Edit
                </Button>
                <Button onClick={() => setTaskToView(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Context-based task tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 gap-1">
          <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
          <TabsTrigger value="past" className="text-xs md:text-sm">Past</TabsTrigger>
          <TabsTrigger value="all_day" className="text-xs md:text-sm">All Day</TabsTrigger>
          <TabsTrigger value="morning" className="text-xs md:text-sm">Morning</TabsTrigger>
          <TabsTrigger value="work" className="text-xs md:text-sm">Work</TabsTrigger>
          <TabsTrigger value="family" className="text-xs md:text-sm">Family</TabsTrigger>
          <TabsTrigger value="evening" className="text-xs md:text-sm">Evening</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderContextTaskList('all')}</TabsContent>
        <TabsContent value="past">{renderContextTaskList('past')}</TabsContent>
        <TabsContent value="all_day">{renderContextTaskList('all_day')}</TabsContent>
        <TabsContent value="morning">{renderContextTaskList('morning')}</TabsContent>
        <TabsContent value="work">{renderContextTaskList('work')}</TabsContent>
        <TabsContent value="family">{renderContextTaskList('family')}</TabsContent>
        <TabsContent value="evening">{renderContextTaskList('evening')}</TabsContent>
      </Tabs>

      <WeeklyCalendar tasks={tasks} habits={habits} />

      {/* Upcoming Tasks */}
      <DashboardCard
        title={`Upcoming (${upcomingDueTasks.length + upcomingAssignedTasks.length})`}
        content={
          <div className="space-y-3">
            {upcomingDueTasks.length === 0 && upcomingAssignedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No upcoming tasks</div>
            ) : (
              <>
                {upcomingDueTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Due Soon</h3>
                    <div className="space-y-2">
                      {upcomingDueTasks.map(task => renderTaskItem(task))}
                    </div>
                  </div>
                )}
                {upcomingAssignedTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Soon</h3>
                    <div className="space-y-2">
                      {upcomingAssignedTasks.map(task => renderTaskItem(task))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="pt-2">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto" asChild>
                <a href="/tasks">View all tasks <ArrowRight className="ml-1 h-4 w-4" /></a>
              </Button>
            </div>
          </div>
        }
      />

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
          }
        />

        <DashboardCard
          title="Unscheduled Tasks"
          content={
            <div className="space-y-3">
              {tasksWithoutDates.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No unscheduled tasks</div>
              ) : (
                <div className="space-y-2">
                  {tasksWithoutDates.map(task => renderTaskItem(task))}
                </div>
              )}
              {activeTasks.filter(task => !task.due_date && !task.assigned_date).length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{activeTasks.filter(task => !task.due_date && !task.assigned_date).length - 5} more unscheduled tasks
                </div>
              )}
              <div className="pt-2">
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto" asChild>
                  <a href="/tasks">View all tasks <ArrowRight className="ml-1 h-4 w-4" /></a>
                </Button>
              </div>
            </div>
          }
        />
      </div>

      {/* Inline Checklist Completion Modal */}
      {completingTemplateId && (() => {
        const template = checklistTemplates.find(t => t.id === completingTemplateId);
        if (!template) return null;
        return (
          <ChecklistCompletion
            template={template}
            onClose={() => setCompletingTemplateId(null)}
            onComplete={() => {
              setCompletingTemplateId(null);
              refetchTasks();
            }}
          />
        );
      })()}
    </div>
  );
};

export default DashboardPage;
