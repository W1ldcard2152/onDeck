-- OnDeck Knowledge Base System Migration
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create Keystones table
CREATE TABLE IF NOT EXISTS keystones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Add constraint to ensure unique keystone names per user
  UNIQUE(user_id, name)
);

-- 2. Create Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  keystone_id uuid REFERENCES keystones(id) ON DELETE SET NULL,
  entry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Add constraint to ensure unique KB names per user
  UNIQUE(user_id, name)
);

-- 3. Add new columns to existing notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS url text,
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'note' CHECK (entry_type IN ('article', 'video', 'document', 'resource', 'note', 'link')),
ADD COLUMN IF NOT EXISTS knowledge_base_id uuid REFERENCES knowledge_bases(id) ON DELETE SET NULL;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS keystones_user_id_idx ON keystones(user_id);
CREATE INDEX IF NOT EXISTS knowledge_bases_user_id_idx ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS knowledge_bases_keystone_id_idx ON knowledge_bases(keystone_id);
CREATE INDEX IF NOT EXISTS notes_knowledge_base_id_idx ON notes(knowledge_base_id);
CREATE INDEX IF NOT EXISTS notes_entry_type_idx ON notes(entry_type);

-- 5. Create RLS (Row Level Security) policies

-- Keystones policies
ALTER TABLE keystones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own keystones" ON keystones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own keystones" ON keystones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keystones" ON keystones
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keystones" ON keystones
  FOR DELETE USING (auth.uid() = user_id);

-- Knowledge Bases policies
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own knowledge bases" ON knowledge_bases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge bases" ON knowledge_bases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge bases" ON knowledge_bases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge bases" ON knowledge_bases
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Create functions to automatically update entry counts

-- Function to update knowledge base entry count
CREATE OR REPLACE FUNCTION update_knowledge_base_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.knowledge_base_id IS NOT NULL THEN
    UPDATE knowledge_bases 
    SET entry_count = entry_count + 1,
        updated_at = now()
    WHERE id = NEW.knowledge_base_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle case where knowledge_base_id changed
    IF OLD.knowledge_base_id IS DISTINCT FROM NEW.knowledge_base_id THEN
      -- Decrease count for old KB
      IF OLD.knowledge_base_id IS NOT NULL THEN
        UPDATE knowledge_bases 
        SET entry_count = entry_count - 1,
            updated_at = now()
        WHERE id = OLD.knowledge_base_id;
      END IF;
      -- Increase count for new KB
      IF NEW.knowledge_base_id IS NOT NULL THEN
        UPDATE knowledge_bases 
        SET entry_count = entry_count + 1,
            updated_at = now()
        WHERE id = NEW.knowledge_base_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.knowledge_base_id IS NOT NULL THEN
    UPDATE knowledge_bases 
    SET entry_count = entry_count - 1,
        updated_at = now()
    WHERE id = OLD.knowledge_base_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update entry counts
CREATE TRIGGER update_kb_entry_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_entry_count();

-- 7. Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update timestamps
CREATE TRIGGER update_keystones_updated_at
  BEFORE UPDATE ON keystones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Initial data seeding (optional - remove if not wanted)
-- You can uncomment these to create some sample data

/*
-- Sample keystones
INSERT INTO keystones (user_id, name, description, color) 
SELECT auth.uid(), 'Professional Development', 'Career and business growth', '#3B82F6'
WHERE auth.uid() IS NOT NULL;

INSERT INTO keystones (user_id, name, description, color) 
SELECT auth.uid(), 'Personal Growth', 'Self-improvement and learning', '#10B981'
WHERE auth.uid() IS NOT NULL;

-- Sample knowledge bases
INSERT INTO knowledge_bases (user_id, name, description, keystone_id)
SELECT 
  auth.uid(), 
  'Programming', 
  'Software development resources',
  k.id
FROM keystones k
WHERE k.name = 'Professional Development' AND k.user_id = auth.uid();

INSERT INTO knowledge_bases (user_id, name, description, keystone_id)
SELECT 
  auth.uid(), 
  'Business & Leadership', 
  'Business and leadership resources',
  k.id
FROM keystones k
WHERE k.name = 'Professional Development' AND k.user_id = auth.uid();
*/

-- 9. Recalculate existing entry counts (run this once after migration)
UPDATE knowledge_bases 
SET entry_count = (
  SELECT COUNT(*) 
  FROM notes 
  WHERE notes.knowledge_base_id = knowledge_bases.id
);

-- Migration complete!
-- Don't forget to update your TypeScript types to match the new schema