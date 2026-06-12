import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isSyncConfigured, pushTask } from '@/lib/googleTasksSync';
import { GoogleAuthError } from '@/lib/googleAuth';
import { updateSyncStatus } from '@/lib/integrations';
import { fetchTaskWithDetails } from '@/lib/taskService';

export const dynamic = 'force-dynamic';

// POST /api/sync/push-task
//
// Body: { taskId: string }
//
// Responses:
//   200 { pushed: boolean } — pushed=false if sync not configured or auth_expired
//   400 { error: 'invalid_body' | 'missing_taskId' }
//   401 { error: 'unauthenticated' }
//   404 { error: 'task_not_found' } — the task row doesn't exist (or belongs to another user)
//   500 { error: string }            — unexpected internal failure
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { taskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const taskId = body?.taskId;
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return NextResponse.json({ error: 'missing_taskId' }, { status: 400 });
  }

  try {
    const configured = await isSyncConfigured(supabase, user.id);
    if (!configured) {
      // Silent skip — caller treats this as "user hasn't connected sync".
      return NextResponse.json({ pushed: false });
    }

    let task;
    try {
      task = await fetchTaskWithDetails(supabase, user.id, taskId);
    } catch {
      // Row was deleted between the local write and the background push, or
      // belongs to another user (RLS). Either way, nothing to push.
      return NextResponse.json({ error: 'task_not_found' }, { status: 404 });
    }

    const pushed = await pushTask(supabase, user.id, task);
    return NextResponse.json({ pushed });
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'auth_expired') {
      // Surface auth_expired on the integration so Phase 4 UI can prompt reconnect.
      try {
        await updateSyncStatus(supabase, user.id, 'google_tasks', {
          syncStatus: 'auth_expired',
          lastError: err.message,
        });
      } catch {
        // Best-effort.
      }
      return NextResponse.json({ pushed: false });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/sync/push-task] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
