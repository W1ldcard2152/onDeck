-- Fix items table check constraint to allow 'quote' item_type
-- Run this SQL in your Supabase SQL editor

-- First, drop the existing check constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check;

-- Then, add the updated constraint that includes 'quote'
ALTER TABLE items ADD CONSTRAINT items_item_type_check
  CHECK (item_type IN ('task', 'note', 'project', 'quote'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'items'::regclass
  AND contype = 'c';
