import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { upsertIntegration } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

function settingsRedirect(request: NextRequest, extra: Record<string, string>): NextResponse {
  const url = new URL('/', request.url);
  url.searchParams.set('section', 'settings');
  url.searchParams.set('tab', 'google-sync');
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(url);
  res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const origin = url.origin;

  // User denied consent or Google-side error
  if (error) {
    return settingsRedirect(request, { error });
  }

  // CSRF state validation
  const stateCookie = request.cookies.get('oauth_state')?.value;
  if (!stateCookie || stateCookie !== state) {
    return settingsRedirect(request, { error: 'invalid_state' });
  }

  // Auth check
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const res = NextResponse.redirect(new URL('/', request.url));
    res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  }

  // Exchange authorization code for tokens
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code!,
        client_id: process.env.GOOGLE_TASKS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_TASKS_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/integrations/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text());
      return settingsRedirect(request, { error: 'token_exchange_failed' });
    }
    tokenData = await tokenRes.json();
  } catch (err) {
    console.error('Google token exchange error:', err);
    return settingsRedirect(request, { error: 'token_exchange_failed' });
  }

  // Google should always issue a refresh token when prompt=consent, but guard defensively
  if (!tokenData.refresh_token) {
    return settingsRedirect(request, { error: 'no_refresh_token' });
  }

  try {
    await upsertIntegration(supabase, {
      userId: user.id,
      provider: 'google_tasks',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scopes: tokenData.scope.split(' '),
    });
  } catch (err) {
    console.error('Failed to store integration:', err);
    return settingsRedirect(request, { error: 'storage_failed' });
  }

  return settingsRedirect(request, { connected: '1' });
}
