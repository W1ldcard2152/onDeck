import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isSyncConfigured, pullTasks, pushPendingDeletions } from '@/lib/googleTasksSync';
import { GoogleAuthError } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

// POST /api/sync/now
//
// Runs a full sync: drains pending deletion tombstones, then pulls Google changes.
//
// Responses:
//   200 { pulled: { inserted, updated, deleted, conflicts_resolved }, pushedDeletions: number }
//   401 { error: 'unauthenticated' | 'auth_expired' }
//   409 { error: 'not_configured' } — no google_tasks integration row for this user
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
      return NextResponse.json({ error: 'not_configured' }, { status: 409 });
    }

    const pushedDeletions = await pushPendingDeletions(supabase, user.id);
    const pulled = await pullTasks(supabase, user.id);

    return NextResponse.json({ pulled, pushedDeletions });
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'auth_expired') {
      return NextResponse.json({ error: 'auth_expired' }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/sync/now] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
