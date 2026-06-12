-- ============================================================
-- Google Tasks Sync Migration
-- Adds the schema needed to sync Praxis tasks with Google Tasks:
--   1. Tracking columns on public.tasks (google_task_id, google_etag,
--      last_synced_at) so each local task knows its Google counterpart.
--   2. A task_deletions tombstone table — when a synced task is hard-
--      deleted locally, we record its google_task_id here so the next
--      push can delete the Google counterpart.
-- Includes RLS so users can only see their own tombstones, and partial
-- indexes for the only access patterns that matter (lookup by
-- google_task_id during pull, find-unpushed-tombstones during push).
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Add Google Tasks tracking columns to public.tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS google_task_id text,
  ADD COLUMN IF NOT EXISTS google_etag    text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Partial index for fast lookups by google_task_id during pull/match.
-- Most rows will be null until first sync; partial keeps the index small.
CREATE INDEX IF NOT EXISTS tasks_google_task_id_idx
  ON public.tasks(google_task_id)
  WHERE google_task_id IS NOT NULL;

-- 2. Create task_deletions tombstone table
CREATE TABLE IF NOT EXISTS public.task_deletions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_task_id  text        NOT NULL,
  deleted_at      timestamptz NOT NULL DEFAULT now(),
  pushed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes on task_deletions
-- Partial index for the only query that matters: find unpushed tombstones for a user.
CREATE INDEX IF NOT EXISTS task_deletions_user_unpushed_idx
  ON public.task_deletions(user_id, pushed_at)
  WHERE pushed_at IS NULL;

-- 4. Row-level security on task_deletions
ALTER TABLE public.task_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own task_deletions" ON public.task_deletions;
CREATE POLICY "Users can view their own task_deletions"
  ON public.task_deletions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own task_deletions" ON public.task_deletions;
CREATE POLICY "Users can insert their own task_deletions"
  ON public.task_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own task_deletions" ON public.task_deletions;
CREATE POLICY "Users can update their own task_deletions"
  ON public.task_deletions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own task_deletions" ON public.task_deletions;
CREATE POLICY "Users can delete their own task_deletions"
  ON public.task_deletions FOR DELETE
  USING (auth.uid() = user_id);
