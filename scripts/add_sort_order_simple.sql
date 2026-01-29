-- Simple version: Add sort_order column to tasks table
-- Run each section separately in Supabase SQL Editor

-- Step 1: Add the column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);

-- Step 3: Initialize sort_order for existing tasks
UPDATE tasks
SET sort_order = subquery.new_order
FROM (
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
  WHERE sort_order IS NULL
) AS subquery
WHERE tasks.id = subquery.id;

-- Step 4: Set default value for new tasks
ALTER TABLE tasks ALTER COLUMN sort_order SET DEFAULT 0;

-- Step 5: Set NOT NULL constraint (only after all existing rows have values)
ALTER TABLE tasks ALTER COLUMN sort_order SET NOT NULL;

-- Step 6: Verify it worked
SELECT COUNT(*) as total_tasks,
       COUNT(sort_order) as tasks_with_sort_order,
       MIN(sort_order) as min_order,
       MAX(sort_order) as max_order
FROM tasks;
