import 'server-only'

// SERVER-ONLY: depends on googleAuth (server-only) and calls
// tasks.googleapis.com (blocked from the browser by CSP). Do not import from
// 'use client' files. Use the /api/sync/* routes instead.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getValidAccessToken } from '@/lib/googleAuth'

/** Google Tasks API task resource (subset we use) */
export interface GoogleTask {
  id: string
  etag: string
  title: string
  notes?: string
  status: 'needsAction' | 'completed'
  due?: string          // RFC 3339 date-time, but Google only honors the date portion
  completed?: string    // RFC 3339 date-time when status is 'completed'
  updated: string       // RFC 3339 date-time, last modified
  deleted?: boolean     // True if task was deleted (only returned when showDeleted=true)
  hidden?: boolean
  parent?: string
  position?: string
}

/** Input shape for creating/updating */
export interface GoogleTaskInput {
  title: string
  notes?: string | null
  status?: 'needsAction' | 'completed'
  due?: string | null   // RFC 3339; we send YYYY-MM-DDT00:00:00.000Z
}

export interface ListTasksOptions {
  showCompleted?: boolean   // default true
  showHidden?: boolean      // default false
  showDeleted?: boolean     // default false (set true to detect Google-side deletes)
  updatedMin?: string       // RFC 3339; only return tasks modified since this time
  maxResults?: number       // default 100, max 100 per request
  pageToken?: string        // for pagination
}

export interface ListTasksResult {
  items: GoogleTask[]
  nextPageToken?: string
}

export class GoogleTasksApiError extends Error {
  constructor(
    public code: 'auth_expired' | 'not_found' | 'rate_limited' | 'network' | 'server_error' | 'unknown',
    public httpStatus: number | null,
    message: string,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'GoogleTasksApiError'
  }
}

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1'

interface GoogleTaskList {
  id: string
  title: string
  updated: string
}

interface GoogleTaskListsResponse {
  items?: GoogleTaskList[]
}

interface GoogleErrorBody {
  error?: {
    code?: number
    message?: string
    status?: string
    errors?: Array<{ reason?: string; domain?: string; message?: string }>
  }
}

function isQuotaError(body: unknown, status: number): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  const errs = (body as GoogleErrorBody | undefined)?.error?.errors ?? []
  return errs.some(e =>
    e.reason === 'rateLimitExceeded' ||
    e.reason === 'userRateLimitExceeded' ||
    e.reason === 'quotaExceeded'
  )
}

function mapHttpToCode(status: number, body: unknown): GoogleTasksApiError['code'] {
  if (status === 401) return 'auth_expired'
  if (status === 404) return 'not_found'
  if (isQuotaError(body, status)) return 'rate_limited'
  if (status >= 500) return 'server_error'
  return 'unknown'
}

/**
 * Issue an authenticated request to the Tasks API. Handles the 401-retry-with-
 * fresh-token flow specified in the build doc. Maps HTTP status to typed errors.
 *
 * Note on the 401 retry: the retry forces a refresh-token exchange
 * (forceRefresh) so it always retries with a genuinely new access token. If
 * the refresh grant itself is rejected (invalid_grant), getValidAccessToken
 * throws GoogleAuthError('auth_expired'); if Google still 401s the fresh
 * token, we throw GoogleTasksApiError('auth_expired') — caller decides.
 */
async function authedRequest(
  supabase: SupabaseClient,
  userId: string,
  path: string,
  init: RequestInit & { expectJson?: boolean } = {}
): Promise<Response> {
  const url = `${TASKS_API_BASE}${path}`
  const expectJson = init.expectJson ?? true

  let token: string
  try {
    token = await getValidAccessToken(supabase, userId)
  } catch (err) {
    // GoogleAuthError propagates unchanged; anything else gets wrapped.
    throw err
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(url, { ...init, headers })
  } catch (err) {
    throw new GoogleTasksApiError(
      'network',
      null,
      `Tasks API fetch failed (${path}): ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Single 401 retry with a forced token refresh — without forceRefresh,
  // a token outside the 60s expiry leeway would be returned from storage
  // unchanged and the retry would replay the same credentials.
  if (response.status === 401) {
    try {
      token = await getValidAccessToken(supabase, userId, { forceRefresh: true })
    } catch (err) {
      throw err
    }
    try {
      response = await fetch(url, {
        ...init,
        headers: { ...headers, Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      throw new GoogleTasksApiError(
        'network',
        null,
        `Tasks API retry fetch failed (${path}): ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  if (!response.ok) {
    let body: unknown
    if (expectJson) {
      try { body = await response.json() } catch { body = undefined }
    }
    const code = mapHttpToCode(response.status, body)
    const message =
      (body as GoogleErrorBody | undefined)?.error?.message ??
      `Tasks API ${response.status} on ${path}`
    throw new GoogleTasksApiError(code, response.status, message, body)
  }

  return response
}

export async function listTasks(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  options?: ListTasksOptions
): Promise<ListTasksResult> {
  const params = new URLSearchParams()
  // Defaults per spec
  params.set('showCompleted', String(options?.showCompleted ?? true))
  params.set('showHidden', String(options?.showHidden ?? false))
  params.set('showDeleted', String(options?.showDeleted ?? false))
  if (options?.updatedMin) params.set('updatedMin', options.updatedMin)
  if (options?.maxResults !== undefined) params.set('maxResults', String(options.maxResults))
  if (options?.pageToken) params.set('pageToken', options.pageToken)

  const response = await authedRequest(
    supabase,
    userId,
    `/lists/${encodeURIComponent(listId)}/tasks?${params.toString()}`,
    { method: 'GET' }
  )

  let body: { items?: GoogleTask[]; nextPageToken?: string }
  try {
    body = await response.json()
  } catch (err) {
    throw new GoogleTasksApiError(
      'network',
      response.status,
      `listTasks: response was not JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  return {
    items: body.items ?? [],
    nextPageToken: body.nextPageToken,
  }
}

export async function getDefaultTaskListId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const response = await authedRequest(
    supabase,
    userId,
    '/users/@me/lists',
    { method: 'GET' }
  )

  let body: GoogleTaskListsResponse
  try {
    body = await response.json()
  } catch (err) {
    throw new GoogleTasksApiError(
      'network',
      response.status,
      `getDefaultTaskListId: response was not JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const first = body.items?.[0]
  if (!first?.id) {
    throw new GoogleTasksApiError(
      'not_found',
      response.status,
      'getDefaultTaskListId: no task lists returned for user'
    )
  }
  return first.id
}

export async function insertTask(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  input: GoogleTaskInput
): Promise<GoogleTask> {
  const response = await authedRequest(
    supabase,
    userId,
    `/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  )

  try {
    return await response.json() as GoogleTask
  } catch (err) {
    throw new GoogleTasksApiError(
      'network',
      response.status,
      `insertTask: response was not JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export async function updateTask(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  googleTaskId: string,
  input: Partial<GoogleTaskInput>
): Promise<GoogleTask> {
  const response = await authedRequest(
    supabase,
    userId,
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(googleTaskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  )

  try {
    return await response.json() as GoogleTask
  } catch (err) {
    throw new GoogleTasksApiError(
      'network',
      response.status,
      `updateTask: response was not JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export async function deleteTask(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  googleTaskId: string
): Promise<void> {
  try {
    await authedRequest(
      supabase,
      userId,
      `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(googleTaskId)}`,
      { method: 'DELETE', expectJson: false }
    )
  } catch (err) {
    // 404 = already gone. Idempotent: treat as success.
    if (err instanceof GoogleTasksApiError && err.code === 'not_found') return
    throw err
  }
}
