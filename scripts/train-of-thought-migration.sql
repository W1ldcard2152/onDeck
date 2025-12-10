-- Train of Thought Migration
-- Adds note_type field to notes table to differentiate between formal notes and train-of-thought notes
-- Run this in your Supabase SQL editor

-- Add note_type column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS note_type text DEFAULT 'note' CHECK (note_type IN ('note', 'thought'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS notes_note_type_idx ON notes(note_type);

-- Update existing notes to have 'note' type (default)
UPDATE notes
SET note_type = 'note'
WHERE note_type IS NULL;

-- Migration complete!
