import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from './encryption'

export type IntegrationProvider = 'google_tasks'

export interface Integration {
  id: string
  userId: string
  provider: IntegrationProvider
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
  connectedAt: Date
  lastSyncedAt: Date | null
  syncStatus: 'ok' | 'failed' | 'auth_expired' | null
  lastError: string | null
}

export interface NewIntegration {
  userId: string
  provider: IntegrationProvider
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

type DbRow = {
  id: string
  user_id: string
  provider: string
  access_token: string
  refresh_token: string
  expires_at: string
  scopes: string[]
  connected_at: string
  last_synced_at: string | null
  sync_status: string | null
  last_error: string | null
}

function rowToIntegration(row: DbRow): Integration {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as IntegrationProvider,
    accessToken: decryptToken(row.access_token),
    refreshToken: decryptToken(row.refresh_token),
    expiresAt: new Date(row.expires_at),
    scopes: row.scopes,
    connectedAt: new Date(row.connected_at),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
    syncStatus: row.sync_status as Integration['syncStatus'],
    lastError: row.last_error,
  }
}

export async function getIntegration(
  supabase: SupabaseClient,
  userId: string,
  provider: IntegrationProvider
): Promise<Integration | null> {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get integration: ${error.message}`)
  }
  return rowToIntegration(data as DbRow)
}

export async function upsertIntegration(
  supabase: SupabaseClient,
  integration: NewIntegration
): Promise<Integration> {
  const { data, error } = await supabase
    .from('user_integrations')
    .upsert(
      {
        user_id: integration.userId,
        provider: integration.provider,
        access_token: encryptToken(integration.accessToken),
        refresh_token: encryptToken(integration.refreshToken),
        expires_at: integration.expiresAt.toISOString(),
        scopes: integration.scopes,
        connected_at: new Date().toISOString(),
        sync_status: null,
        last_error: null,
      },
      { onConflict: 'user_id,provider' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to upsert integration: ${error.message}`)
  return rowToIntegration(data as DbRow)
}

export async function updateIntegrationTokens(
  supabase: SupabaseClient,
  userId: string,
  provider: IntegrationProvider,
  tokens: { accessToken: string; refreshToken?: string; expiresAt: Date }
): Promise<Integration> {
  const update: Record<string, unknown> = {
    access_token: encryptToken(tokens.accessToken),
    expires_at: tokens.expiresAt.toISOString(),
  }
  if (tokens.refreshToken !== undefined) {
    update.refresh_token = encryptToken(tokens.refreshToken)
  }

  const { data, error } = await supabase
    .from('user_integrations')
    .update(update)
    .eq('user_id', userId)
    .eq('provider', provider)
    .select()
    .single()

  if (error) throw new Error(`Failed to update integration tokens: ${error.message}`)
  return rowToIntegration(data as DbRow)
}

export async function updateSyncStatus(
  supabase: SupabaseClient,
  userId: string,
  provider: IntegrationProvider,
  status: { syncStatus: 'ok' | 'failed' | 'auth_expired'; lastError?: string | null; lastSyncedAt?: Date }
): Promise<void> {
  const update: Record<string, unknown> = {
    sync_status: status.syncStatus,
    last_error: status.lastError ?? null,
  }
  if (status.lastSyncedAt !== undefined) {
    update.last_synced_at = status.lastSyncedAt.toISOString()
  } else if (status.syncStatus === 'ok') {
    update.last_synced_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('user_integrations')
    .update(update)
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) throw new Error(`Failed to update sync status: ${error.message}`)
}

export async function deleteIntegration(
  supabase: SupabaseClient,
  userId: string,
  provider: IntegrationProvider
): Promise<void> {
  const { error } = await supabase
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) throw new Error(`Failed to delete integration: ${error.message}`)
}
