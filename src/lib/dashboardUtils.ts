import { isToday, isTomorrow, isPast, isFuture, isWithinInterval, addDays, format } from 'date-fns';
import type { TaskWithDetails, DailyContext } from '@/lib/types';
import type { TaskStatus } from '@/types/database.types';

// --- Date parsing ---

export function parseDateForDisplay(dateString: string | null): Date | null {
  if (!dateString) return null;
  try {
    if (dateString.includes('-') && dateString.length <= 10) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  } catch {
    return null;
  }
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
    return format(date, 'EEE, MMM d');
  }
  return format(date, 'MMM d');
}

export function formatReminderTime(reminderTimeString: string): string {
  try {
    const date = new Date(reminderTimeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// --- Context helpers ---

export function taskMatchesContext(task: TaskWithDetails, context: DailyContext | 'all' | 'past'): boolean {
  let taskContexts: DailyContext[] = [];
  if (task.daily_context) {
    try {
      taskContexts = JSON.parse(task.daily_context);
    } catch {
      taskContexts = [];
    }
  }
  const isAllDay = !task.daily_context || taskContexts.length === 0;
  if (context === 'all' || context === 'past') return true;
  return isAllDay || taskContexts.includes(context);
}

export function getPrimaryContext(task: TaskWithDetails): DailyContext | 'none' {
  if (!task.daily_context) return 'none';
  try {
    const contexts: DailyContext[] = JSON.parse(task.daily_context);
    return contexts[0] || 'none';
  } catch {
    return 'none';
  }
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

export function getContextColor(task: TaskWithDetails): string {
  if (task.due_date) {
    const isDueToday = isDateToday(task.due_date);
    const isDuePast = isDatePast(task.due_date);
    if (isDueToday || isDuePast) return 'bg-red-100 border-red-400';
  }

  const dailyContexts: DailyContext[] = task.daily_context
    ? (() => { try { return JSON.parse(task.daily_context); } catch { return []; } })()
    : [];

  const primaryContext = dailyContexts[0];
  switch (primaryContext) {
    case 'all_day': return 'bg-white border-gray-200';
    case 'morning': return 'bg-orange-50 border-orange-200';
    case 'work': return 'bg-red-50 border-red-200';
    case 'family': return 'bg-green-50 border-green-200';
    case 'evening': return 'bg-purple-50 border-purple-200';
    default: return 'bg-white border-gray-200';
  }
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
