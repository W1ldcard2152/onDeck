import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { dateToDateString, toDate } from "@/lib/timezone"

/**
 * Ensures a date is stored with the same local date regardless of timezone
 * This function preserves the year, month, and day components of a date
 */
export function preserveLocalDate(date: Date | undefined): string | null {
  if (!date) return null;
  return dateToDateString(date);
}

/**
 * Parses a date string that's stored as YYYY-MM-DD
 */
export function parseLocalDateString(dateString: string | null): Date | null {
  if (!dateString) return null;
  return toDate(dateString);
}


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}