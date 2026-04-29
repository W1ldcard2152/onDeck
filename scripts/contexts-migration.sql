-- ============================================================
-- Contexts Migration
-- Run in the Supabase SQL editor.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Create contexts table
CREATE TABLE IF NOT EXISTS contexts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  emoji       TEXT        NOT NULL DEFAULT '📌',
  color       TEXT        NOT NULL DEFAULT 'gray',
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- 2. Row-level security
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own contexts" ON contexts;
CREATE POLICY "Users manage their own contexts"
  ON contexts FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Seed the four default contexts for every existing user.
--    ON CONFLICT DO NOTHING makes this idempotent.
INSERT INTO contexts (user_id, name, emoji, color, sort_order)
SELECT DISTINCT user_id, 'Morning', '🌅', 'orange', 1 FROM items
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO contexts (user_id, name, emoji, color, sort_order)
SELECT DISTINCT user_id, 'Work', '💼', 'red', 2 FROM items
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO contexts (user_id, name, emoji, color, sort_order)
SELECT DISTINCT user_id, 'Family', '👨‍👩‍👧', 'green', 3 FROM items
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO contexts (user_id, name, emoji, color, sort_order)
SELECT DISTINCT user_id, 'Evening', '🌙', 'purple', 4 FROM items
ON CONFLICT (user_id, name) DO NOTHING;

-- 4. Migrate tasks.daily_context from string names to context UUIDs.
--    Preserves all task→context relationships.
--    Tasks with no context stay null.
--    Any unrecognised string value is silently dropped.
UPDATE tasks t
SET daily_context = (
  SELECT jsonb_agg(c.id::text ORDER BY c.sort_order)::text
  FROM   jsonb_array_elements_text(t.daily_context::jsonb) AS elem(name)
  JOIN   items    i ON i.id = t.id
  JOIN   contexts c ON c.user_id = i.user_id
                   AND lower(c.name) = lower(elem.name)
)
WHERE  t.daily_context IS NOT NULL
  AND  t.daily_context <> 'null'
  AND  t.daily_context <> '[]'
  -- Skip rows already migrated (UUIDs don't match any of the legacy names)
  AND  t.daily_context ~ '(morning|work|family|evening)';
