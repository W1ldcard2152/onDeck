import { isToday, isTomorrow, isPast, isFuture, isWithinInterval, addDays } from 'date-fns';
import type { TaskWithDetails, Context } from '@/lib/types';
import type { TaskStatus } from '@/types/database.types';
import { toDate, formatDateShort, formatDateWithWeekday, formatTime } from '@/lib/timezone';

// Maps a context color name to Tailwind card classes.
export function contextColorToClasses(color: string): string {
  const map: Record<string, string> = {
    orange: 'bg-orange-50 border-orange-200',
    red:    'bg-red-50 border-red-200',
    green:  'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    blue:   'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    pink:   'bg-pink-50 border-pink-200',
    sky:    'bg-sky-50 border-sky-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    teal:   'bg-teal-50 border-teal-200',
  };
  return map[color] ?? 'bg-white border-gray-200';
}

// Maps a context color name to Tailwind badge classes.
export function contextColorToBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-700',
    red:    'bg-red-100 text-red-700',
    green:  'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    blue:   'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    pink:   'bg-pink-100 text-pink-700',
    sky:    'bg-sky-100 text-sky-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    teal:   'bg-teal-100 text-teal-700',
  };
  return map[color] ?? 'bg-gray-100 text-gray-700';
}

// --- Date parsing ---

export function parseDateForDisplay(dateString: string | null): Date | null {
  if (!dateString) return null;
  return toDate(dateString);
}

export function isDateToday(dateString: string | null): boolean {
  const date = parseDateForDisplay(dateString);
  return date ? isToday(date) : false;
}

export function isDatePast(dateString: string | null): boolean {
  const date = parseDateForDisplay(dateString);
  return date ? isPast(date) && !isToday(date) : false;
}

export function isDateInFuture(dateString: string | null): boolean {
  const date = parseDateForDisplay(dateString);
  return date ? isFuture(date) : false;
}

export function isDateWithinUpcoming(dateString: string | null, start: Date, end: Date): boolean {
  const date = parseDateForDisplay(dateString);
  if (!date) return false;
  try {
    if (isTomorrow(date)) return true;
    return isWithinInterval(date, { start, end });
  } catch {
    return false;
  }
}

export function formatDateDisplay(dateString: string): string {
  const date = parseDateForDisplay(dateString);
  if (!date) return '';

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const threeDaysLater = addDays(today, 3);

  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isWithinInterval(date, { start: tomorrow, end: threeDaysLater })) {
    return formatDateWithWeekday(dateString);
  }
  return formatDateShort(dateString);
}

export function formatReminderTime(reminderTimeString: string): string {
  return formatTime(reminderTimeString);
}

// --- Context helpers ---

function parseContextIds(daily_context: string | null | undefined): string[] {
  if (!daily_context) return [];
  try { return JSON.parse(daily_context) as string[]; }
  catch { return []; }
}

/** Returns true if the task belongs to the given context ID (or is all-day when contextId is 'all_day'). */
export function taskMatchesContext(task: TaskWithDetails, contextId: string | 'all' | 'past'): boolean {
  const ids = parseContextIds(task.daily_context);
  const isAllDay = ids.length === 0;
  if (contextId === 'all' || contextId === 'past') return true;
  if (contextId === 'all_day') return isAllDay;
  return isAllDay || ids.includes(contextId);
}

/** Returns the primary context object for a task (first in sort order), or null. */
export function getPrimaryContext(task: TaskWithDetails, contexts: Context[]): Context | null {
  const ids = parseContextIds(task.daily_context);
  if (ids.length === 0) return null;
  // Return whichever listed ID appears earliest in the contexts sort order
  for (const ctx of contexts) {
    if (ids.includes(ctx.id)) return ctx;
  }
  return null;
}

// --- Color helpers ---

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'on_deck': return 'bg-yellow-100 text-yellow-800';
    case 'active': return 'bg-green-100 text-green-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusBadgeColor(status: TaskStatus): string {
  switch (status) {
    case 'on_deck': return 'bg-gray-100 text-gray-800';
    case 'active': return 'bg-orange-100 text-orange-800';
    case 'habit': return 'bg-blue-100 text-blue-800';
    case 'project': return 'bg-purple-100 text-purple-800';
    case 'completed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getContextColor(task: TaskWithDetails, contexts: Context[]): string {
  if (task.due_date) {
    const isDueToday = isDateToday(task.due_date);
    const isDuePast = isDatePast(task.due_date);
    if (isDueToday || isDuePast) return 'bg-red-100 border-red-400';
  }
  const primary = getPrimaryContext(task, contexts);
  return primary ? contextColorToClasses(primary.color) : 'bg-white border-gray-200';
}

export interface Habit {
  id: string;
  title: string;
  is_active: boolean;
  recurrence_rule: any;
  [key: string]: any;
}

export function getTimeColor(task: TaskWithDetails, habits: Habit[]): string {
  let timeString: string | null = null;

  if (task.reminder_time) {
    const date = new Date(task.reminder_time);
    timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else if (task.habit_id) {
    const habit = habits.find(h => h.id === task.habit_id);
    if (habit) {
      const rule = typeof habit.recurrence_rule === 'string'
        ? JSON.parse(habit.recurrence_rule)
        : habit.recurrence_rule;
      timeString = rule?.time_of_day || null;
    }
  }

  if (!timeString) return 'bg-white border-gray-200';

  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  const timeSlots = [
    { time: 8 * 60, color: 'bg-yellow-50 border-yellow-200' },
    { time: 9 * 60 + 45, color: 'bg-orange-50 border-orange-200' },
    { time: 13 * 60, color: 'bg-red-50 border-red-200' },
    { time: 18 * 60 + 15, color: 'bg-green-50 border-green-200' },
    { time: 20 * 60 + 20, color: 'bg-blue-50 border-blue-200' },
  ];

  let selectedColor = 'bg-yellow-50 border-yellow-200';
  for (const slot of timeSlots) {
    if (totalMinutes <= slot.time) {
      selectedColor = slot.color;
      break;
    }
    selectedColor = slot.color;
  }

  return selectedColor;
}
