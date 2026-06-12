import 'server-only'

// SERVER-ONLY: reads GOOGLE_TASKS_CLIENT_ID / GOOGLE_TASKS_CLIENT_SECRET and
// hits Google's OAuth token endpoint. Do not import from 'use client' files.
// Use the /api/sync/* routes instead.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getIntegration, updateIntegrationTokens } from '@/lib/integrations'

export class GoogleAuthError extends Error {
  constructor(
    public code: 'not_connected' | 'auth_expired' | 'network',
    message: string
  ) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REFRESH_LEEWAY_SECONDS = 60

interface GoogleRefreshResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

/**
 * Get a valid access token for the user's google_tasks integration.
 *
 * If the stored access token is still valid (expires more than 60s from now),
 * returns it as-is. If it's expired or about to expire, refreshes via Google's
 * token endpoint, updates the stored tokens, and returns the fresh access token.
 *
 * Throws GoogleAuthError on:
 *  - 'not_connected': no google_tasks integration row for this user. Caller should
 *    surface "Reconnect Google" UI.
 *  - 'auth_expired': refresh token rejected by Google (typically invalid_grant —
 *    revoked, expired, or rotated out). Caller decides whether to mark
 *    sync_status=auth_expired or clear the integration row; this helper does not.
 *  - 'network': transient network failure or 5xx from Google.
 *
 * Throws a plain Error if GOOGLE_TASKS_CLIENT_ID / GOOGLE_TASKS_CLIENT_SECRET
 * env vars are missing — that's a deployment misconfiguration, not a runtime
 * sync error, and shouldn't be retried.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const integration = await getIntegration(supabase, userId, 'google_tasks')
  if (!integration) {
    throw new GoogleAuthError(
      'not_connected',
      `No google_tasks integration for user ${userId}`
    )
  }

  const nowMs = Date.now()
  const expiresMs = integration.expiresAt.getTime()
  if (expiresMs - nowMs > REFRESH_LEEWAY_SECONDS * 1000) {
    return integration.accessToken
  }

  const clientId = process.env.GOOGLE_TASKS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_TASKS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_TASKS_CLIENT_ID / GOOGLE_TASKS_CLIENT_SECRET env vars are required for token refresh'
    )
  }

  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
  } catch (err) {
    throw new GoogleAuthError(
      'network',
      `Token refresh fetch failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  let body: GoogleRefreshResponse
  try {
    body = (await response.json()) as GoogleRefreshResponse
  } catch {
    throw new GoogleAuthError(
      'network',
      `Token refresh returned non-JSON response (status ${response.status})`
    )
  }

  if (!response.ok) {
    // 4xx — most importantly invalid_grant means the refresh token is dead.
    if (response.status >= 400 && response.status < 500) {
      throw new GoogleAuthError(
        'auth_expired',
        `Token refresh rejected by Google (${response.status} ${body.error ?? 'unknown'}): ${body.error_description ?? ''}`
      )
    }
    // 5xx — transient.
    throw new GoogleAuthError(
      'network',
      `Token refresh server error (${response.status} ${body.error ?? 'unknown'})`
    )
  }

  if (!body.access_token || typeof body.expires_in !== 'number') {
    throw new GoogleAuthError(
      'network',
      'Token refresh response missing access_token or expires_in'
    )
  }

  const newExpiresAt = new Date(Date.now() + body.expires_in * 1000)
  await updateIntegrationTokens(supabase, userId, 'google_tasks', {
    accessToken: body.access_token,
    // Only pass refreshToken if Google rotated it; otherwise the existing one stays.
    ...(body.refresh_token ? { refreshToken: body.refresh_token } : {}),
    expiresAt: newExpiresAt,
  })

  return body.access_token
}
