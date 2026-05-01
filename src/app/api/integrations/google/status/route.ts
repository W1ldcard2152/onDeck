import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getIntegration } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ integration: null });
  }

  const integration = await getIntegration(supabase, user.id, 'google_tasks');

  if (!integration) {
    return NextResponse.json({ integration: null });
  }

  // Return all fields except tokens
  return NextResponse.json({
    integration: {
      id: integration.id,
      userId: integration.userId,
      provider: integration.provider,
      expiresAt: integration.expiresAt,
      scopes: integration.scopes,
      connectedAt: integration.connectedAt,
      lastSyncedAt: integration.lastSyncedAt,
      syncStatus: integration.syncStatus,
      lastError: integration.lastError,
    },
  });
}
