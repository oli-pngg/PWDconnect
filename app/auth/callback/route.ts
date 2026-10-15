import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/auth-redirect';
import { safeNext } from '@/lib/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  let siteOrigin: string;
  try {
    siteOrigin = getSiteUrl(request);
  } catch {
    return NextResponse.json({ error: 'Authentication email links are not configured.' }, { status: 503 });
  }
  if (process.env.NODE_ENV === 'production' && requestUrl.origin !== siteOrigin) {
    return NextResponse.redirect(new URL('/login?authError=expired-link', siteOrigin));
  }
  if (!code) return NextResponse.redirect(new URL('/login?authError=expired-link', siteOrigin));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/login?authError=expired-link', siteOrigin));
  } catch {
    return NextResponse.redirect(new URL('/login?authError=expired-link', siteOrigin));
  }

  const recoveryFallback = requestUrl.searchParams.get('type') === 'recovery' ? '/reset-password' : '/auth/continue';
  const next = safeNext(requestUrl.searchParams.get('next') ?? recoveryFallback);
  return NextResponse.redirect(new URL(next, siteOrigin));
}
