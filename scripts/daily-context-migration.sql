-- Daily Context Migration
-- Add daily_context field to tasks table to support context-based task organization
-- This replaces time-based organization with context-based organization (morning, work, family, evening)

-- Add new column to tasks table for daily contexts
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS daily_context text;

-- Add comment to document the new field
COMMENT ON COLUMN tasks.daily_context IS 'JSON array of daily contexts for this task (morning, work, family, evening), or null for all-day tasks';

-- Migration complete!
-- This adds a daily_context field for context-based task organization
-- Tasks can now be organized by context (morning, work, family, evening) instead of specific times
-- This matches the offDeck schema for better import/export compatibility
