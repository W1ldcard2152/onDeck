'use client'

import { useState, useEffect, useCallback } from 'react';

// Mirrors Integration fields minus tokens, with dates as ISO strings (JSON-serialized form)
export interface GoogleTasksStatus {
  id: string;
  userId: string;
  provider: string;
  expiresAt: string;
  scopes: string[];
  connectedAt: string;
  lastSyncedAt: string | null;
  syncStatus: 'ok' | 'failed' | 'auth_expired' | null;
  lastError: string | null;
}

interface UseGoogleTasksIntegrationResult {
  integration: GoogleTasksStatus | null;
  loading: boolean;
  refresh: () => void;
}

export function useGoogleTasksIntegration(): UseGoogleTasksIntegrationResult {
  const [integration, setIntegration] = useState<GoogleTasksStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/google/status');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setIntegration(data.integration ?? null);
    } catch (err) {
      console.error('useGoogleTasksIntegration: failed to fetch status', err);
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { integration, loading, refresh: load };
}
