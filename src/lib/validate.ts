/**
 * Input validation utilities for sanitizing user input before storage.
 * Used across hooks and components to enforce data integrity.
 */

const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_CONTENT_LENGTH = 50000;
const MAX_SEARCH_QUERY_LENGTH = 200;

export function validateString(
  value: unknown,
  maxLength: number = MAX_CONTENT_LENGTH
): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string value');
  }
  if (value.length > maxLength) {
    return value.slice(0, maxLength);
  }
  return value;
}

export function validateTitle(value: unknown): string {
  return validateString(value, MAX_TITLE_LENGTH).trim();
}

export function validateDescription(value: unknown): string {
  return validateString(value, MAX_DESCRIPTION_LENGTH);
}

export function validateSearchQuery(value: unknown): string {
  const query = validateString(value, MAX_SEARCH_QUERY_LENGTH).trim();
  // Strip characters that could interfere with PostgREST ilike patterns
  return query.replace(/[%_\\]/g, '');
}

export function validateUUID(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string UUID');
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error('Invalid UUID format');
  }
  return value;
}
