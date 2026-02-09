'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getCachedUserId } from '@/hooks/useSupabaseAuth'
import { processQueue, getQueueSize } from '@/lib/offlineSyncQueue'

interface UseOfflineSyncOptions {
  onSyncComplete?: () => void
}

export function useOfflineSync(options?: UseOfflineSyncOptions) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const isSyncingRef = useRef(false)

  // Refresh the pending count
  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueueSize())
  }, [])

  // Process the offline queue
  const sync = useCallback(async () => {
    if (isSyncingRef.current) return
    const userId = getCachedUserId()
    if (!userId) return
    if (getQueueSize() === 0) return

    isSyncingRef.current = true
    setIsSyncing(true)
    setLastSyncError(null)

    try {
      const supabase = getSupabaseClient()
      const synced = await processQueue(supabase, userId)
      refreshPendingCount()
      if (synced > 0) {
        options?.onSyncComplete?.()
      }
    } catch (e) {
      setLastSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
      isSyncingRef.current = false
    }
  }, [options?.onSyncComplete, refreshPendingCount])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      sync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // On mount: refresh count and sync if online with pending items
    refreshPendingCount()
    if (navigator.onLine && getQueueSize() > 0) {
      sync()
    }

    // Poll pending count periodically (catches items added by other components)
    const interval = setInterval(refreshPendingCount, 2000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [sync, refreshPendingCount])

  return { isOnline, pendingCount, isSyncing, lastSyncError, sync }
}
