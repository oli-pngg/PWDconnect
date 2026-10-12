import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/auth';
import { safeNext } from '@/lib/navigation';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) return NextResponse.redirect(new URL('/login', requestUrl.origin));

  const { data: profile } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).maybeSingle();
  const destination = profile?.profile_completed ? safeNext(requestUrl.searchParams.get('next')) : '/profile?setup=1';
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
