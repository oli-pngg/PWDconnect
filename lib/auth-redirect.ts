import 'server-only';

import { safeNext } from '@/lib/navigation';

export function getSiteUrl(request?: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const value = configuredUrl || (process.env.NODE_ENV !== 'production' && request ? new URL(request.url).origin : '');
  if (!value) throw new Error('NEXT_PUBLIC_SITE_URL must be configured for authentication email links.');

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an origin without credentials, a path, or query parameters.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS in production.');
  }
  return url.origin;
}

export function getAuthRedirectUrl(request: Request, destination: string) {
  const callback = new URL('/auth/callback', `${getSiteUrl(request)}/`);
  callback.searchParams.set('next', safeNext(destination));
  return callback.toString();
}
