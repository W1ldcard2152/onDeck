-- Fix sort_order values: assign sequential numbers to all tasks
-- This ensures tasks have unique sort_order values for reordering to work

-- Update all tasks with sequential sort_order based on their current order
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

-- Verify the update
SELECT
  COUNT(*) as total_tasks,
  COUNT(DISTINCT sort_order) as unique_sort_orders,
  MIN(sort_order) as min_order,
  MAX(sort_order) as max_order
FROM tasks;

-- Show a sample of tasks with their new sort_order
SELECT
  id,
  sort_order,
  due_date,
  assigned_date
FROM tasks
ORDER BY sort_order
LIMIT 10;
