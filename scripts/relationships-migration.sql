-- Relationships and Communications Migration
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Add constraint to ensure unique relationship names per user
  UNIQUE(user_id, name)
);

-- 2. Create Communications table (temporary staging area)
CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relationship_id uuid REFERENCES relationships(id) ON DELETE CASCADE NOT NULL,
  medium text NOT NULL CHECK (medium IN ('Phone Call', 'Text', 'Email', 'In Person', 'Video Call', 'Other')),
  medium_other text,
  summary text NOT NULL,
  communication_date timestamptz NOT NULL DEFAULT now(),
  time_of_day text CHECK (time_of_day IN ('Morning', 'Afternoon', 'Evening', 'Other')),
  time_of_day_other text,
  synced boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS relationships_user_id_idx ON relationships(user_id);
CREATE INDEX IF NOT EXISTS relationships_name_idx ON relationships(name);
CREATE INDEX IF NOT EXISTS communications_user_id_idx ON communications(user_id);
CREATE INDEX IF NOT EXISTS communications_relationship_id_idx ON communications(relationship_id);
CREATE INDEX IF NOT EXISTS communications_synced_idx ON communications(synced);
CREATE INDEX IF NOT EXISTS communications_date_idx ON communications(communication_date);

-- 4. Create RLS (Row Level Security) policies

-- Relationships policies
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own relationships" ON relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own relationships" ON relationships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own relationships" ON relationships
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own relationships" ON relationships
  FOR DELETE USING (auth.uid() = user_id);

-- Communications policies
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own communications" ON communications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own communications" ON communications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own communications" ON communications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own communications" ON communications
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update timestamps
CREATE TRIGGER update_relationships_updated_at
  BEFORE UPDATE ON relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!
