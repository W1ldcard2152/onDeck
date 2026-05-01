'use client'

import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, ArrowRight, ArrowLeft, ArrowLeftRight, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleTasksIntegration } from '@/hooks/useGoogleTasksIntegration';
import { formatDateTime } from '@/lib/timezone';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Connection failed (security check). Please try again.',
  no_refresh_token: "Couldn't get persistent access. Please revoke Praxis in your Google account settings and try again.",
  access_denied: 'Connection cancelled.',
  token_exchange_failed: 'Connection failed: could not exchange authorization code with Google.',
  storage_failed: 'Connection failed: could not store credentials. Please try again.',
};

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? `Connection failed: ${code}`;
}

const contextCalendarRows = [
  { context: 'Morning', color: 'bg-orange-100 text-orange-700', calendar: 'Personal' },
  { context: 'Work',    color: 'bg-red-100 text-red-700',       calendar: 'Work' },
  { context: 'Family',  color: 'bg-green-100 text-green-700',   calendar: 'Family' },
  { context: 'Evening', color: 'bg-purple-100 text-purple-700', calendar: 'Personal' },
];

export default function CalendarSyncTab() {
  const { integration, loading, refresh } = useGoogleTasksIntegration();
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Read OAuth result from URL params (set by callback redirect), then strip them.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected === '1') {
      setBanner({ type: 'success', message: 'Google Tasks connected successfully.' });
      window.history.replaceState({}, '', '/');
    } else if (error) {
      setBanner({ type: 'error', message: getErrorMessage(error) });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/google/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      refresh();
    } catch (err) {
      console.error('Disconnect failed:', err);
      setBanner({ type: 'error', message: 'Disconnect failed. Please try again.' });
    } finally {
      setDisconnecting(false);
    }
  }, [refresh]);

  const connected = !!integration;

  return (
    <div className="space-y-8 max-w-xl">
      {banner && (
        <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
          banner.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span className="flex-1">{banner.message}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Connection card */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">Google Tasks</p>
              {loading ? (
                <p className="text-sm text-gray-400">Checking connection...</p>
              ) : connected ? (
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Connected
                  </p>
                  <p className="text-xs text-gray-500">
                    Since {formatDateTime(integration!.connectedAt)}
                  </p>
                  {integration!.scopes.length > 0 && (
                    <p className="text-xs text-gray-400 break-all">
                      Scopes: {integration!.scopes.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Not connected</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect to sync Praxis tasks bidirectionally with Google Tasks.
                    You&apos;ll be redirected to Google to authorize.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            {!loading && (
              connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : (
                <a href="/api/integrations/google/authorize" className="block w-full sm:w-auto">
                  <Button size="sm" className="w-full sm:w-auto">Connect Google Tasks</Button>
                </a>
              )
            )}
          </div>
        </div>
      </div>

      {/* Configuration — dimmed until connected (sync settings come in a later phase) */}
      <div className={connected ? '' : 'pointer-events-none opacity-40'}>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sync Direction</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Praxis → Google', icon: ArrowRight,     value: 'to-google' },
                { label: 'Both ways',       icon: ArrowLeftRight, value: 'both' },
                { label: 'Google → Praxis', icon: ArrowLeft,      value: 'from-google' },
              ].map(({ label, icon: Icon, value }) => (
                <button
                  key={value}
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-lg border p-3 text-xs text-gray-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sync Frequency</h3>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-gray-400 shrink-0" />
              <select className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-700 bg-white">
                <option>Every 15 minutes</option>
                <option>Every 30 minutes</option>
                <option>Every hour</option>
                <option>Manual only</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Context → Calendar Mapping</h3>
            <div className="space-y-2">
              {contextCalendarRows.map(({ context, color, calendar }) => (
                <div key={context} className="flex items-center gap-2 sm:gap-3">
                  <span className={`w-20 sm:w-24 shrink-0 rounded-full px-2 sm:px-3 py-1 text-xs font-medium text-center ${color}`}>
                    {context}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                  <select className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm text-gray-700 bg-white">
                    <option>{calendar}</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!connected}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
