-- OnDeck Checklists System Migration
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create checklist_templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  version numeric(10, 1) DEFAULT 1.0 NOT NULL,
  recurrence_rule jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Add constraint to ensure unique template names per user
  UNIQUE(user_id, name)
);

-- 2. Create checklist_items table
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  item_text text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Ensure unique order within each template
  UNIQUE(template_id, order_index)
);

-- 3. Create checklist_contexts junction table
CREATE TABLE IF NOT EXISTS checklist_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  context text NOT NULL CHECK (context IN ('Morning', 'Work', 'Family', 'Evening', 'Weekend')),

  -- Ensure a template can't have duplicate contexts
  UNIQUE(template_id, context)
);

-- 4. Create checklist_completions table
CREATE TABLE IF NOT EXISTS checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  template_version numeric(10, 1) NOT NULL,
  completed_at timestamptz DEFAULT now() NOT NULL,
  checked_items jsonb NOT NULL, -- Array of objects: [{item_id: uuid, item_text: string, checked: boolean, order_index: number}]
  notes text,

  -- Index for querying completions by template
  created_at timestamptz DEFAULT now()
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS checklist_templates_user_id_idx ON checklist_templates(user_id);
CREATE INDEX IF NOT EXISTS checklist_items_template_id_idx ON checklist_items(template_id);
CREATE INDEX IF NOT EXISTS checklist_contexts_template_id_idx ON checklist_contexts(template_id);
CREATE INDEX IF NOT EXISTS checklist_completions_user_id_idx ON checklist_completions(user_id);
CREATE INDEX IF NOT EXISTS checklist_completions_template_id_idx ON checklist_completions(template_id);
CREATE INDEX IF NOT EXISTS checklist_completions_completed_at_idx ON checklist_completions(completed_at);

-- 6. Create RLS (Row Level Security) policies

-- Checklist Templates policies
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checklist templates" ON checklist_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checklist templates" ON checklist_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist templates" ON checklist_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist templates" ON checklist_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Checklist Items policies
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items for their templates" ON checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_items.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items for their templates" ON checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_items.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items for their templates" ON checklist_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_items.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items for their templates" ON checklist_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_items.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

-- Checklist Contexts policies
ALTER TABLE checklist_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contexts for their templates" ON checklist_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_contexts.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contexts for their templates" ON checklist_contexts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_contexts.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contexts for their templates" ON checklist_contexts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_contexts.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contexts for their templates" ON checklist_contexts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM checklist_templates
      WHERE checklist_templates.id = checklist_contexts.template_id
      AND checklist_templates.user_id = auth.uid()
    )
  );

-- Checklist Completions policies
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checklist completions" ON checklist_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checklist completions" ON checklist_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist completions" ON checklist_completions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist completions" ON checklist_completions
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Function to update timestamps
CREATE OR REPLACE FUNCTION update_checklist_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamps
CREATE TRIGGER update_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_template_updated_at();

-- Migration complete!
-- Don't forget to update your TypeScript types to match the new schema
