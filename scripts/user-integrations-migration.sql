-- ============================================================
-- User Integrations Migration
-- Creates the user_integrations table for storing OAuth tokens
-- for third-party service integrations (e.g., Google Tasks).
-- Tokens are stored encrypted (AES-256-GCM) by the application
-- layer before insert/update; this table stores only ciphertext.
-- Includes RLS so users can only access their own rows, and an
-- updated_at trigger to maintain the timestamp automatically.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Create user_integrations table
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        text        NOT NULL,
  access_token    text        NOT NULL,        -- encrypted (AES-256-GCM)
  refresh_token   text        NOT NULL,        -- encrypted (AES-256-GCM)
  expires_at      timestamptz NOT NULL,
  scopes          text[]      NOT NULL DEFAULT '{}',
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  sync_status     text,                        -- 'ok' | 'failed' | 'auth_expired'
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS user_integrations_user_id_idx ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS user_integrations_provider_idx ON public.user_integrations(provider);

-- 3. Row-level security
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own integrations" ON public.user_integrations;
CREATE POLICY "Users can view their own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own integrations" ON public.user_integrations;
CREATE POLICY "Users can insert their own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own integrations" ON public.user_integrations;
CREATE POLICY "Users can update their own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.user_integrations;
CREATE POLICY "Users can delete their own integrations"
  ON public.user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_integrations_updated_at();
