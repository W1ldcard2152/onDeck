'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardTaskItem } from '@/components/DashboardTaskItem';
import { SortableDashboardTaskItem } from '@/components/SortableDashboardTaskItem';
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
import type { TaskWithDetails } from '@/lib/types';
import { useContexts } from '@/hooks/useContexts';
import type { TaskStatus } from '@/types/database.types';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';
import { getSupabaseClient } from '@/lib/supabase-client';
import { startOfDay, parseISO, isBefore } from 'date-fns';
import { nowISO } from '@/lib/timezone';
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
  const {
    tasks: fetchedTasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
    reorderTasks: reorderTasksMutation,
    updateTaskStatus: updateTaskStatusMutation,
    deleteTask: deleteTaskMutation,
  } = useTasks(
    user?.id,
    50,
    true,
    ['active', 'habit', 'project']
  );
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const { habits, isLoading: habitsLoading } = useHabits(user?.id);
  const { templates: checklistTemplates } = useChecklists(user?.id);
  const { contexts } = useContexts();
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const reorderTasks = useCallback(async (groupTasks: TaskWithDetails[], oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex || groupTasks.length < 2) return;

    const reordered = arrayMove(groupTasks, oldIndex, newIndex);

    // Reuse the existing sort_orders from the group, but renormalize when any
    // are 0 (DB default) or duplicated, so dragging is stable from then on.
    const sortedExisting = groupTasks.map(t => t.sort_order ?? 0).sort((a, b) => a - b);
    const needsNormalize = sortedExisting[0] === 0 || new Set(sortedExisting).size !== sortedExisting.length;
    const STEP = 100;
    const newSortOrders = needsNormalize
      ? Array.from({ length: groupTasks.length }, (_, i) => (i + 1) * STEP)
      : sortedExisting;

    const updates: { id: string; sort_order: number }[] = [];
    const newSortOrderById = new Map<string, number>();
    reordered.forEach((task, i) => {
      const next = newSortOrders[i];
      newSortOrderById.set(task.id, next);
      if ((task.sort_order ?? 0) !== next) {
        updates.push({ id: task.id, sort_order: next });
      }
    });

    if (updates.length === 0) return;

    const previousTasks = localTasks;
    setLocalTasks(prev => prev.map(t => {
      const next = newSortOrderById.get(t.id);
      return next !== undefined ? { ...t, sort_order: next } : t;
    }));

    try {
      // Hook handles tasks updates + items.updated_at bump
      await reorderTasksMutation(updates);
    } catch {
      setLocalTasks(previousTasks);
      refetchTasks();
    }
  }, [localTasks, reorderTasksMutation, refetchTasks]);

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    const task = localTasks.find(t => t.id === taskId);

    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    try {
      // Hook handles tasks update + items.updated_at bump
      await updateTaskStatusMutation(taskId, newStatus);

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
  }, [localTasks, updateTaskStatusMutation, supabase, user?.id, habits, refetchTasks]);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
      return;
    }

    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(task => task.id !== taskId));

    try {
      // Hook handles tasks + items + correct (items-only) user_id scoping.
      // Pre-migration this site had a tasks.user_id filter that 400'd silently
      // because tasks has no user_id column.
      await deleteTaskMutation(taskId);
    } catch {
      setLocalTasks(previousTasks);
    }
  }, [localTasks, deleteTaskMutation]);

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

  const getFilteredTasks = useCallback((contextId: string | 'all' | 'past') => {
    const todayStart = startOfDay(new Date());

    const filtered = tasks.filter(task => {
      if (task.status === 'completed') return false;
      const assignedDate = task.assigned_date ? startOfDay(parseISO(task.assigned_date)) : null;
      const dueDate = task.due_date ? startOfDay(parseISO(task.due_date)) : null;

      if (contextId === 'past') {
        const hasRelevantAssignedDate = assignedDate && isBefore(assignedDate, todayStart);
        const hasRelevantDueDate = dueDate && isBefore(dueDate, todayStart);
        return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, contextId);
      }

      const hasRelevantAssignedDate = assignedDate && (isToday(assignedDate) || isBefore(assignedDate, todayStart));
      const hasRelevantDueDate = dueDate && (isToday(dueDate) || isBefore(dueDate, todayStart));
      return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, contextId);
    });

    // Sort by primary context first (so contexts stay grouped), then by manual
    // sort_order within a context (drag-and-drop sets this). Tiebreak by id.
    return filtered.sort((a, b) => {
      if (contextId === 'all' || contextId === 'past') {
        const ctxA = getPrimaryContext(a, contexts);
        const ctxB = getPrimaryContext(b, contexts);
        const orderA = ctxA ? ctxA.sort_order : 0;
        const orderB = ctxB ? ctxB.sort_order : 0;
        if (orderA !== orderB) return orderA - orderB;
      }
      return ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || a.id.localeCompare(b.id);
    });
  }, [tasks, contexts]);

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

  const renderTaskItem = useCallback((task: TaskWithDetails, contextLabel?: string, sortable: boolean = false) => {
    const Component = sortable ? SortableDashboardTaskItem : DashboardTaskItem;
    return (
      <Component
        key={task.id}
        task={task}
        habits={habits}
        contextLabel={contextLabel}
        showMoveControls={sortable}
        onComplete={(id) => updateTaskStatus(id, 'completed')}
        onEdit={setTaskToEdit}
        onDelete={deleteTask}
        onStatusToggle={updateTaskStatus}
        onChecklistRun={setCompletingTemplateId}
      />
    );
  }, [habits, updateTaskStatus, deleteTask]);

  const renderContextTaskList = useCallback((contextId: string | 'all' | 'past', label: string) => {
    const filteredTasks = getFilteredTasks(contextId);

    const renderGroup = (group: TaskWithDetails[], groupKey: string) => {
      const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = group.findIndex(t => t.id === active.id);
        const newIndex = group.findIndex(t => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        reorderTasks(group, oldIndex, newIndex);
      };

      return (
        <DndContext key={groupKey} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={group.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {group.map(task => {
              const isPastDue = task.due_date && isDatePast(task.due_date);
              const isPastAssigned = task.assigned_date && isDatePast(task.assigned_date);
              const taskLabel = isPastDue ? "OVERDUE" : isPastAssigned ? "PAST ASSIGNED" : undefined;
              return renderTaskItem(task, taskLabel, true);
            })}
          </SortableContext>
        </DndContext>
      );
    };

    // For 'all' and 'past', drag must stay within a primary-context group.
    // Split the (already context-sorted) list into runs that share a primary context.
    const isAggregateView = contextId === 'all' || contextId === 'past';
    const groups: { key: string; tasks: TaskWithDetails[] }[] = [];
    if (isAggregateView) {
      let currentKey: string | null = null;
      let currentRun: TaskWithDetails[] = [];
      for (const task of filteredTasks) {
        const primary = getPrimaryContext(task, contexts);
        const key = primary?.id ?? 'all-day';
        if (key !== currentKey && currentRun.length > 0) {
          groups.push({ key: currentKey!, tasks: currentRun });
          currentRun = [];
        }
        currentKey = key;
        currentRun.push(task);
      }
      if (currentRun.length > 0 && currentKey !== null) {
        groups.push({ key: currentKey, tasks: currentRun });
      }
    } else {
      groups.push({ key: contextId, tasks: filteredTasks });
    }

    return (
      <DashboardCard
        title={`${label} Tasks (${filteredTasks.length})`}
        content={
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks</div>
            ) : (
              groups.map(g => renderGroup(g.tasks, g.key))
            )}
          </div>
        }
      />
    );
  }, [getFilteredTasks, renderTaskItem, sensors, reorderTasks, contexts]);

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
        <TabsList className="flex flex-wrap w-full gap-1 h-auto">
          <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
          <TabsTrigger value="past" className="text-xs md:text-sm">Past</TabsTrigger>
          <TabsTrigger value="all_day" className="text-xs md:text-sm">All Day</TabsTrigger>
          {contexts.map(ctx => (
            <TabsTrigger key={ctx.id} value={ctx.id} className="text-xs md:text-sm">
              {ctx.emoji} {ctx.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">{renderContextTaskList('all', 'All')}</TabsContent>
        <TabsContent value="past">{renderContextTaskList('past', 'Past')}</TabsContent>
        <TabsContent value="all_day">{renderContextTaskList('all_day', 'All Day')}</TabsContent>
        {contexts.map(ctx => (
          <TabsContent key={ctx.id} value={ctx.id}>
            {renderContextTaskList(ctx.id, ctx.name)}
          </TabsContent>
        ))}
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
