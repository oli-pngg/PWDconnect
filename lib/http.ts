import { NextResponse } from 'next/server';

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
