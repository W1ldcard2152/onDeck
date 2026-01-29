-- Check if sort_order column exists and add it if missing
-- Run this in your Supabase SQL editor

-- Check if the column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'sort_order'
    ) THEN
        -- Add the column
        ALTER TABLE tasks ADD COLUMN sort_order INTEGER;

        -- Create index
        CREATE INDEX idx_tasks_sort_order ON tasks(sort_order);

        -- Initialize sort_order for existing tasks
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

        -- Set default and NOT NULL
        ALTER TABLE tasks ALTER COLUMN sort_order SET DEFAULT 0;
        ALTER TABLE tasks ALTER COLUMN sort_order SET NOT NULL;

        -- Add comment
        COMMENT ON COLUMN tasks.sort_order IS 'Manual sort order for tasks within their context. Lower numbers appear first.';

        RAISE NOTICE 'sort_order column added successfully';
    ELSE
        RAISE NOTICE 'sort_order column already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'sort_order';
