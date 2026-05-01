import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const state = randomBytes(32).toString('hex');
  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_TASKS_CLIENT_ID!,
    redirect_uri: `${origin}/api/integrations/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/tasks',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
