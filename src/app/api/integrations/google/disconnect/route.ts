import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getIntegration, deleteIntegration } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const integration = await getIntegration(supabase, user.id, 'google_tasks');
  if (!integration) {
    return NextResponse.json({ disconnected: true });
  }

  // Revoke at Google — best-effort, don't block disconnect if this fails
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(integration.accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
  } catch (err) {
    console.error('Google token revoke failed (proceeding with disconnect):', err);
  }

  await deleteIntegration(supabase, user.id, 'google_tasks');

  return NextResponse.json({ disconnected: true });
}
