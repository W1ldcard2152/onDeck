import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
// Add this to your utils.ts file

/**
 * Ensures a date is stored with the same local date regardless of timezone
 * This function preserves the year, month, and day components of a date
 */
export function preserveLocalDate(date: Date | undefined): string | null {
  if (!date) return null;
  
  // Extract year, month, and day components
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  
  // Create a new ISO date string in format YYYY-MM-DD
  // This completely ignores time and timezone
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parses a date string that's stored as YYYY-MM-DD
 */
export function parseLocalDateString(dateString: string | null): Date | null {
  if (!dateString) return null;
  
  // Split the date string by hyphens
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create a new date using local components
  return new Date(year, month - 1, day);
}


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}