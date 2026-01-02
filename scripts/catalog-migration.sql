-- Catalog Migration for URL and Resource Capture
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create Catalog table
CREATE TABLE IF NOT EXISTS catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  title text,
  description text,
  resource_type text CHECK (resource_type IN ('website', 'video', 'article', 'documentation', 'tutorial', 'other')),
  capture_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS catalog_user_id_idx ON catalog(user_id);
CREATE INDEX IF NOT EXISTS catalog_url_idx ON catalog(url);
CREATE INDEX IF NOT EXISTS catalog_resource_type_idx ON catalog(resource_type);
CREATE INDEX IF NOT EXISTS catalog_capture_date_idx ON catalog(capture_date);

-- 3. Create RLS (Row Level Security) policies
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own catalog entries" ON catalog
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own catalog entries" ON catalog
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own catalog entries" ON catalog
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own catalog entries" ON catalog
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Create trigger to update timestamps
CREATE TRIGGER update_catalog_updated_at
  BEFORE UPDATE ON catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!
