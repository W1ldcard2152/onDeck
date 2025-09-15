-- Task Time Association Migration
-- Add time-related fields to tasks table

-- Add new column to tasks table for simple reminder times
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS reminder_time timestamptz;

-- Add indexes for better query performance on reminder-based operations
CREATE INDEX IF NOT EXISTS tasks_reminder_time_idx ON tasks(reminder_time) WHERE reminder_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_assigned_date_idx ON tasks(assigned_date) WHERE assigned_date IS NOT NULL;

-- Add comment to document the new field
COMMENT ON COLUMN tasks.reminder_time IS 'When to send a reminder notification for this task';

-- Fix habit task status: Change all habit tasks from 'on_deck' to 'habit' status
UPDATE tasks 
SET status = 'habit' 
WHERE habit_id IS NOT NULL 
  AND status = 'on_deck';

-- Migration complete!
-- This adds a simple reminder_time field for notification scheduling
-- and fixes habit task status to use correct 'habit' status instead of 'on_deck'