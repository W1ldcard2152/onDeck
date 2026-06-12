'use client'

import { useState, useEffect, useCallback } from 'react';
import type { GoogleTasksStatus } from '@/contexts/GoogleSyncContext';

export type { GoogleTasksStatus };

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
