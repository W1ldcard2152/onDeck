# Database Migration Scripts

This directory contains SQL migration scripts for the Sophia Praxis database.

## Running Migrations

### Migration: Add sort_order to tasks

**File:** `add_sort_order_to_tasks.sql`

**Purpose:** Adds a `sort_order` field to the tasks table to enable manual ordering of tasks independent of their assigned dates.

**How to run:**

1. Connect to your Supabase database using the SQL Editor in the Supabase Dashboard:
   - Go to https://app.supabase.com
   - Select your project
   - Click on "SQL Editor" in the left sidebar

2. Copy the entire contents of `add_sort_order_to_tasks.sql`

3. Paste into the SQL Editor

4. Click "Run" to execute the migration

**What it does:**

- Adds a `sort_order INTEGER` column to the `tasks` table
- Creates an index on `sort_order` for better query performance
- Initializes `sort_order` for all existing tasks based on their current ordering
- Sets `sort_order` as NOT NULL with a default value of 0 for new tasks

**After running:**

- Tasks will have a `sort_order` field that controls their display order
- The up/down arrows in the dashboard will update `sort_order` instead of `assigned_date`
- Manual ordering will work reliably without interfering with actual task dates

## Rollback

If you need to rollback this migration, run:

```sql
DROP INDEX IF EXISTS idx_tasks_sort_order;
ALTER TABLE tasks DROP COLUMN IF EXISTS sort_order;
```

**Note:** This will lose all manual ordering data.
