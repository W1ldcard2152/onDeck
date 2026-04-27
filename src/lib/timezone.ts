// Centralized timezone configuration and formatting utilities.
// All date display formatting should go through these functions.
// Pattern: store UTC in database, server sends UTC, client converts for display.

// Single source of truth for timezone. Configure via NEXT_PUBLIC_TIMEZONE in .env.
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'America/New_York';

/**
 * Smart date parser. Date-only strings (YYYY-MM-DD) are treated as noon UTC
 * to prevent timezone-induced date shifts. Full timestamps are parsed normally.
 */
export function toDate(dateString: string): Date | null {
  if (!dateString) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString + 'T12:00:00Z');
  }
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/** "Feb 22, 2026" */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

/** "Feb 22" */
export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, month: 'short', day: 'numeric',
  }).format(date);
}

/** "February 22, 2026" */
export function formatDateLong(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

/** "Sat, Feb 22" */
export function formatDateWithWeekday(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'short', month: 'short', day: 'numeric',
  }).format(date);
}

/** "Saturday" */
export function formatWeekday(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'long',
  }).format(date);
}

/** "Sat" */
export function formatWeekdayShort(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'short',
  }).format(date);
}

/** "February 2026" */
export function formatMonthYear(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: 'long',
  }).format(date);
}

/**
 * "3:45 PM"
 * Handles time-only strings ("15:30") without timezone conversion,
 * and full timestamps with timezone conversion.
 */
export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dateString)) {
    const date = new Date(`2000-01-01T${dateString}`);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit',
    }).format(date);
  }
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit',
  }).format(date);
}

/** "Feb 22, 2026, 3:45 PM" */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(date);
}

/** "Saturday, February 22, 2026, 3:45 PM" */
export function formatDateTimeLong(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = toDate(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(date);
}

/** Get today's date as YYYY-MM-DD in the configured timezone. */
export function todayDateString(): string {
  return dateToDateString(new Date());
}

/** Convert a Date object to YYYY-MM-DD in the configured timezone. */
export function dateToDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/** Get current UTC ISO string for database storage. */
export function nowISO(): string {
  return new Date().toISOString();
}
