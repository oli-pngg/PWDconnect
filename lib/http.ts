import { NextResponse } from 'next/server.js';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) }
  });
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function cleanStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function cleanAllowedArray(value: unknown, allowed: readonly string[], maxItems: number) {
  if (!Array.isArray(value)) return [];
  const allowedValues = new Set(allowed);
  return value
    .filter((item): item is string => typeof item === 'string' && allowedValues.has(item))
    .slice(0, maxItems);
}

export function cleanUuidArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && /^[0-9a-f-]{36}$/i.test(item))
    .slice(0, maxItems);
}

export function safeInteger(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number);
}

export type BodyReadFailure = { ok: false; reason: 'too_large' | 'invalid' };

export async function readLimitedBody(request: Request, maxBytes: number): Promise<{ ok: true; bytes: Uint8Array } | BodyReadFailure> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > maxBytes) {
    return { ok: false, reason: 'too_large' };
  }

  if (!request.body) return { ok: true, bytes: new Uint8Array() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export async function readLimitedJsonObject(request: Request, maxBytes: number): Promise<
  { ok: true; value: Record<string, unknown> } | BodyReadFailure
> {
  const body = await readLimitedBody(request, maxBytes);
  if (!body.ok) return body;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(body.bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'invalid' };
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function bodyReadError(failure: BodyReadFailure, tooLargeMessage = 'Request is too large.') {
  return jsonError(
    failure.reason === 'too_large' ? tooLargeMessage : 'Invalid request body.',
    failure.reason === 'too_large' ? 413 : 400
  );
}
