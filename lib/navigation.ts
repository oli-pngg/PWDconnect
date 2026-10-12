const localOrigin = 'https://pwd-connect.invalid';

export function safeNext(value: string | null) {
  if (!value) return '/dashboard';

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f]/.test(decoded)) return '/dashboard';
    const target = new URL(decoded, localOrigin);
    if (target.origin !== localOrigin) return '/dashboard';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/dashboard';
  }
}
