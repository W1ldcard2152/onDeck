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

  // Redirect to the dashboard after successful sign-in
  // You can change this to any page you want users to land on after login
  return NextResponse.redirect(new URL('/dashboard', request.url));
}