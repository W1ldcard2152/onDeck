-- Quotes System Migration
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  content text NOT NULL,
  author text,
  source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS quotes_author_idx ON quotes(author);
CREATE INDEX IF NOT EXISTS quotes_source_idx ON quotes(source);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
-- Users can view their own quotes (through items table)
CREATE POLICY "Users can view their own quotes" ON quotes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = quotes.id
      AND items.user_id = auth.uid()
    )
  );

-- Users can insert their own quotes (through items table)
CREATE POLICY "Users can insert their own quotes" ON quotes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = quotes.id
      AND items.user_id = auth.uid()
    )
  );

-- Users can update their own quotes (through items table)
CREATE POLICY "Users can update their own quotes" ON quotes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = quotes.id
      AND items.user_id = auth.uid()
    )
  );

-- Users can delete their own quotes (through items table)
CREATE POLICY "Users can delete their own quotes" ON quotes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = quotes.id
      AND items.user_id = auth.uid()
    )
  );

-- 5. Create function to update timestamps
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to update timestamps
CREATE TRIGGER update_quotes_updated_at_trigger
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- Migration complete!
-- Don't forget to update your TypeScript types to match the new schema
