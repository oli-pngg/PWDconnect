import 'server-only';

const SUPABASE_REQUEST_TIMEOUT_MS = 30_000;

export const fetchWithTimeout: typeof fetch = (input, init) => {
  const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeoutSignal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeoutSignal]) : timeoutSignal;
  return globalThis.fetch(input, { ...init, signal });
};
