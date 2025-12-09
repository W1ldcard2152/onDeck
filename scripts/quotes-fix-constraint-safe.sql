-- Safe migration to update items table check constraint
-- Run this SQL in your Supabase SQL editor

-- Step 1: First, let's see what item_type values currently exist
-- (Just for information - you can run this separately to see)
-- SELECT DISTINCT item_type FROM items;

-- Step 2: Drop the existing check constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check;

-- Step 3: Add a new constraint that includes all current types plus 'quote'
-- This assumes you have: task, note, project, and potentially others
-- If you get an error, we need to see what other types exist
ALTER TABLE items ADD CONSTRAINT items_item_type_check
  CHECK (item_type IN ('task', 'note', 'project', 'quote', 'habit', 'checklist'));

-- If the above fails, use this more permissive version instead:
-- ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check;
-- This removes the constraint entirely, allowing any item_type value
