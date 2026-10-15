const localOrigin = 'https://pwd-connect.invalid';

function hasControlCharacters(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeNext(value: string | null) {
  if (!value) return '/dashboard';

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || hasControlCharacters(decoded)) return '/dashboard';
    const target = new URL(decoded, localOrigin);
    if (target.origin !== localOrigin) return '/dashboard';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/dashboard';
  }
}
