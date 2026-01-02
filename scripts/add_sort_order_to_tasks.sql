-- Migration: Add sort_order field to tasks table
-- Purpose: Enable manual ordering of tasks independent of assigned_date
-- Date: 2025-01-21

-- Add sort_order column to tasks table
ALTER TABLE tasks
ADD COLUMN sort_order INTEGER;

-- Create an index on sort_order for better query performance
CREATE INDEX idx_tasks_sort_order ON tasks(sort_order);

-- Initialize sort_order for existing tasks
-- Set sort_order based on current assigned_date
-- This preserves the current ordering
WITH ranked_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
        due_date ASC NULLS LAST,
        assigned_date ASC NULLS LAST,
        id ASC
    ) as new_order
  FROM tasks
)
UPDATE tasks
SET sort_order = ranked_tasks.new_order
FROM ranked_tasks
WHERE tasks.id = ranked_tasks.id;

-- Make sort_order NOT NULL with a default value for new tasks
ALTER TABLE tasks
ALTER COLUMN sort_order SET DEFAULT 0;

ALTER TABLE tasks
ALTER COLUMN sort_order SET NOT NULL;

-- Add a comment to document the field
COMMENT ON COLUMN tasks.sort_order IS 'Manual sort order for tasks within their context. Lower numbers appear first.';
