'use client'

import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useGoogleSync, type GoogleSyncState } from '@/contexts/GoogleSyncContext'
import { formatDateTime } from '@/lib/timezone'
import { cn } from '@/lib/utils'

interface SyncStatusIndicatorProps {
  /** Matches the host header's button styling: raw button (desktop) vs shadcn ghost (mobile). */
  variant?: 'desktop' | 'mobile'
  /** Navigate to Settings → Google Sync (in-SPA section change, wired by the layout). */
  onNavigateToSettings?: () => void
}

const STATUS_WORD: Record<GoogleSyncState, string> = {
  not_connected: 'Not connected',
  syncing: 'Syncing…',
  offline: 'Offline',
  auth_expired: 'Reconnect needed',
  failed: 'Sync failed',
  ok: 'Up to date',
}

// Reuses the green/red banner palette from CalendarSyncTab for consistency.
const BADGE_CLASSES: Record<GoogleSyncState, string> = {
  not_connected: 'bg-gray-100 text-gray-600 border-gray-200',
  syncing: 'bg-blue-50 text-blue-800 border-blue-200',
  offline: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  auth_expired: 'bg-red-50 text-red-800 border-red-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  ok: 'bg-green-50 text-green-800 border-green-200',
}

const DOT_CLASSES: Partial<Record<GoogleSyncState, string>> = {
  ok: 'bg-green-500',
  offline: 'bg-yellow-500',
  failed: 'bg-red-500',
  auth_expired: 'bg-red-500',
}

export function SyncStatusIndicator({
  variant = 'desktop',
  onNavigateToSettings,
}: SyncStatusIndicatorProps) {
  const {
    integration,
    integrationLoaded,
    isSyncing,
    lastSyncResult,
    lastClientError,
    state,
    syncNow,
  } = useGoogleSync()
  const [open, setOpen] = useState(false)

  // Hidden until status is known, and hidden entirely when not connected —
  // Settings remains the discovery path for connecting Google Tasks.
  if (!integrationLoaded || state === 'not_connected') {
    return null
  }

  const statusWord = STATUS_WORD[state]
  const ariaLabel = `Google Tasks sync: ${statusWord}`
  const dotClass = DOT_CLASSES[state]
  const errorDetail = integration?.lastError ?? lastClientError

  const icon = (
    <>
      <RefreshCw
        className={cn('h-5 w-5 text-gray-600', state === 'syncing' && 'animate-spin')}
      />
      {dotClass && (
        <span
          className={cn(
            'absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-white',
            dotClass
          )}
        />
      )}
    </>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'desktop' ? (
          <button
            type="button"
            className="relative p-2 hover:bg-gray-100 rounded-lg"
            aria-label={ariaLabel}
            title={ariaLabel}
          >
            {icon}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10"
            aria-label={ariaLabel}
            title={ariaLabel}
          >
            {icon}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-72 p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Google Tasks Sync</p>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium',
                BADGE_CLASSES[state]
              )}
            >
              {statusWord}
            </span>
          </div>

          {/* Last synced */}
          <p className="text-xs text-gray-500">
            {integration?.lastSyncedAt
              ? `Last synced ${formatDateTime(integration.lastSyncedAt)}`
              : 'Never synced'}
          </p>

          {/* Error detail */}
          {state === 'failed' && errorDetail && (
            <p className="truncate text-xs text-red-600" title={errorDetail}>
              {errorDetail}
            </p>
          )}

          {/* Result of the most recent completed sync this session */}
          {lastSyncResult && (
            <p className="text-xs text-gray-600">
              Synced — {lastSyncResult.pulled.inserted} imported,{' '}
              {lastSyncResult.pulled.updated} updated,{' '}
              {lastSyncResult.pushedDeletions} deletions pushed
            </p>
          )}

          {/* Primary action */}
          {state === 'auth_expired' ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                window.location.href = '/api/integrations/google/authorize'
              }}
            >
              Reconnect Google
            </Button>
          ) : state === 'offline' ? (
            <div className="space-y-1">
              <Button size="sm" className="w-full" disabled>
                Sync now
              </Button>
              <p className="text-center text-xs text-gray-400">You&apos;re offline</p>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={isSyncing}
              onClick={() => {
                void syncNow()
              }}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                'Sync now'
              )}
            </Button>
          )}

          {/* Footer link to Settings → Google Sync */}
          {onNavigateToSettings && (
            <button
              type="button"
              className="block w-full text-left text-xs text-blue-600 hover:underline"
              onClick={() => {
                setOpen(false)
                onNavigateToSettings()
              }}
            >
              More details →
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
