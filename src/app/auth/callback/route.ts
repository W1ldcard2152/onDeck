import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Exchange the auth code for a session
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to the home page after successful sign-in
  // The home page (/) includes the proper layout with sidebar and top bar
  return NextResponse.redirect(new URL('/', request.url));
}