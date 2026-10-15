import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/server-fetch';

const protectedPrefixes = ['/dashboard', '/jobs', '/assessment', '/profile', '/employer', '/admin', '/messages', '/applications'];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  function redirectWithSessionCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return redirectWithSessionCookies(url);
  }

  if (user && isProtected) {
    const { data: profile } = await supabase.from('profiles').select('role, profile_completed').eq('id', user.id).maybeSingle();
    const isProfilePage = pathname === '/profile' || pathname.startsWith('/profile/');
    if (profile && !profile.profile_completed && !isProfilePage) {
      const url = request.nextUrl.clone();
      url.pathname = '/profile';
      url.search = '?setup=1';
      return redirectWithSessionCookies(url);
    }

    const isEmployerPage = pathname === '/employer' || pathname.startsWith('/employer/');
    const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
    if (profile && isEmployerPage && profile.role !== 'employer') return redirectWithSessionCookies(new URL('/dashboard', request.url));
    if (profile && isAdminPage && profile.role !== 'admin') return redirectWithSessionCookies(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)']
};
