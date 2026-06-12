'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// Mirrors Integration fields minus tokens, with dates as ISO strings
// (JSON-serialized form returned by /api/integrations/google/status).
export interface GoogleTasksStatus {
  id: string
  userId: string
  provider: string
  expiresAt: string
  scopes: string[]
  connectedAt: string
  lastSyncedAt: string | null
  syncStatus: 'ok' | 'failed' | 'auth_expired' | null
  lastError: string | null
}

/**
 * Shape returned by /api/sync/now's `pulled` field. Defined locally to keep
 * client code free of any server-only sync-lib imports. The route's response
 * matches this exactly; see src/lib/googleTasksSync.ts for the source.
 */
export interface PullResult {
  inserted: number
  updated: number
  deleted: number
  conflicts_resolved: number
}

export interface SyncResult {
  pulled: PullResult
  pushedDeletions: number
}

const EMPTY_SYNC_RESULT: SyncResult = {
  pulled: { inserted: 0, updated: 0, deleted: 0, conflicts_resolved: 0 },
  pushedDeletions: 0,
}

/**
 * Dispatched on window after a sync whose pull changed local task state
 * (inserted/updated/deleted > 0). useTasks instances listen and refetch.
 */
export const GOOGLE_SYNC_COMPLETE_EVENT = 'praxis:google-sync-complete'

export type GoogleSyncState =
  | 'not_connected'
  | 'syncing'
  | 'offline'
  | 'auth_expired'
  | 'failed'
  | 'ok'

interface GoogleSyncContextValue {
  integration: GoogleTasksStatus | null
  integrationLoaded: boolean
  isOnline: boolean
  isSyncing: boolean
  lastSyncResult: SyncResult | null
  lastClientError: string | null
  state: GoogleSyncState
  syncNow: () => Promise<void>
  refreshStatus: () => Promise<void>
}

const GoogleSyncContext = createContext<GoogleSyncContextValue | null>(null)

// Module-level guards (not refs): survive React StrictMode's dev double-mount
// and any accidental second provider instance.
// - inFlightSync: at most one /api/sync/now request at a time; concurrent
//   syncNow() calls join the in-flight promise instead of issuing another.
// - lastSyncedUserId: "already synced this session" marker, set only after a
//   SUCCESSFUL sync so a failed mount-time sync can be retried via syncNow().
let inFlightSync: Promise<SyncResult> | null = null
let lastSyncedUserId: string | null = null

export function GoogleSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth()
  const userId = user?.id

  const [integration, setIntegration] = useState<GoogleTasksStatus | null>(null)
  const [integrationLoaded, setIntegrationLoaded] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [lastClientError, setLastClientError] = useState<string | null>(null)

  // Ref mirror of `integration` so window listeners don't need re-binding on
  // every status change.
  const integrationRef = useRef<GoogleTasksStatus | null>(null)
  integrationRef.current = integration

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/integrations/google/status')
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      setIntegration((data.integration as GoogleTasksStatus | null) ?? null)
    } catch (err) {
      // Keep last-known integration: a transient status-fetch failure
      // shouldn't flip the indicator to not_connected (hidden).
      console.error('[GoogleSync] failed to fetch integration status', err)
    } finally {
      setIntegrationLoaded(true)
    }
  }, [])

  /**
   * Run (or join) a sync via POST /api/sync/now.
   *
   * A 409 response means no Google integration — treated as a silent no-op.
   * Failures are recorded in lastClientError (not thrown) so button handlers
   * can call this directly. After the sync settles, integration status is
   * re-fetched so the indicator reflects what the server wrote, and a
   * GOOGLE_SYNC_COMPLETE_EVENT is dispatched if the pull changed local tasks.
   */
  const syncNow = useCallback(async (): Promise<void> => {
    if (!userId) return

    if (!inFlightSync) {
      inFlightSync = (async () => {
        const res = await fetch('/api/sync/now', { method: 'POST' })
        if (res.status === 409) {
          // Not configured — silent no-op success.
          return EMPTY_SYNC_RESULT
        }
        if (!res.ok) {
          let detail = ''
          try {
            const body = await res.json()
            if (body?.error) detail = `: ${body.error}`
          } catch {
            // ignore unparseable body
          }
          throw new Error(`Sync failed (${res.status})${detail}`)
        }
        return (await res.json()) as SyncResult
      })()
    }
    const promise = inFlightSync

    setIsSyncing(true)
    try {
      const result = await promise
      lastSyncedUserId = userId
      setLastSyncResult(result)
      setLastClientError(null)
      const pulledChanges =
        result.pulled.inserted + result.pulled.updated + result.pulled.deleted
      if (pulledChanges > 0) {
        window.dispatchEvent(new CustomEvent(GOOGLE_SYNC_COMPLETE_EVENT))
      }
    } catch (err) {
      setLastClientError(err instanceof Error ? err.message : String(err))
    } finally {
      if (inFlightSync === promise) inFlightSync = null
      setIsSyncing(false)
      // Reflect whatever sync_status the server wrote (ok/failed/auth_expired).
      await refreshStatus()
    }
  }, [userId, refreshStatus])

  // Mount-time (per sign-in session) sync: fetch integration status; if
  // connected and online and this user hasn't successfully synced this
  // session, run one sync. Replaces the per-useTasks-instance trigger that
  // fired ~9 parallel /api/sync/now calls per Dashboard load.
  useEffect(() => {
    if (!userId) {
      setIntegration(null)
      setIntegrationLoaded(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/integrations/google/status')
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        const fetched = (data.integration as GoogleTasksStatus | null) ?? null
        setIntegration(fetched)
        setIntegrationLoaded(true)
        if (fetched && navigator.onLine && lastSyncedUserId !== userId) {
          void syncNow()
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[GoogleSync] initial status fetch failed', err)
          setIntegrationLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, syncNow])

  // Online/offline tracking. This is independent of useOfflineSync (the
  // Supabase offline write queue) — separate systems, deliberately not merged.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (integrationRef.current) {
        void syncNow()
      }
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  // Derived indicator state — precedence order matters, first match wins.
  const state: GoogleSyncState = useMemo(() => {
    if (integrationLoaded && !integration) return 'not_connected'
    if (isSyncing) return 'syncing'
    if (!isOnline) return 'offline'
    if (integration?.syncStatus === 'auth_expired') return 'auth_expired'
    if (integration?.syncStatus === 'failed' || lastClientError) return 'failed'
    return 'ok' // includes syncStatus === null (connected, never synced)
  }, [integration, integrationLoaded, isOnline, isSyncing, lastClientError])

  const value = useMemo<GoogleSyncContextValue>(
    () => ({
      integration,
      integrationLoaded,
      isOnline,
      isSyncing,
      lastSyncResult,
      lastClientError,
      state,
      syncNow,
      refreshStatus,
    }),
    [
      integration,
      integrationLoaded,
      isOnline,
      isSyncing,
      lastSyncResult,
      lastClientError,
      state,
      syncNow,
      refreshStatus,
    ]
  )

  return <GoogleSyncContext.Provider value={value}>{children}</GoogleSyncContext.Provider>
}

export function useGoogleSync(): GoogleSyncContextValue {
  const ctx = useContext(GoogleSyncContext)
  if (!ctx) {
    throw new Error('useGoogleSync must be used within a GoogleSyncProvider')
  }
  return ctx
}
