import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isSyncConfigured, pushPendingDeletions } from '@/lib/googleTasksSync';
import { GoogleAuthError } from '@/lib/googleAuth';
import { updateSyncStatus } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

// POST /api/sync/push-deletions
//
// Drains all unprocessed task_deletions tombstones for the authenticated user.
//
// Responses:
//   200 { count: number } — number of tombstones successfully pushed to Google
//                           (also 0 when sync isn't configured — silent skip)
//   401 { error: 'unauthenticated' }
//   500 { error: string }            — unexpected internal failure
export async function POST(_request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    const configured = await isSyncConfigured(supabase, user.id);
    if (!configured) {
      return NextResponse.json({ count: 0 });
    }

    const count = await pushPendingDeletions(supabase, user.id);
    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'auth_expired') {
      try {
        await updateSyncStatus(supabase, user.id, 'google_tasks', {
          syncStatus: 'auth_expired',
          lastError: err.message,
        });
      } catch {
        // Best-effort.
      }
      return NextResponse.json({ count: 0 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/sync/push-deletions] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
