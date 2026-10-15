import { getAdminAccess } from '@/lib/admin-access';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const validStatuses = ['not_submitted', 'pending', 'needs_information', 'approved', 'rejected', 'suspended'] as const;

export async function GET(request: Request) {
  try {
    const access = await getAdminAccess();
    if (!access.user) return jsonError('Authentication required.', 401);
    if (access.error) return jsonError('Unable to verify administrator access.', 500);
    if (access.role !== 'admin') return jsonError('Administrator access required.', 403);
    const limited = await checkRateLimit(request, 'admin-employer-verification-stats', { limit: 30, windowMs: 60 * 1000 }, access.user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const rpc = access.supabase as unknown as {
      rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
    const { data, error } = await rpc.rpc('admin_employer_verification_status_counts');
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      return jsonError('Unable to load employer-verification counts.', 500);
    }
    const counts = Object.fromEntries(validStatuses.map((status) => [status, 0])) as Record<(typeof validStatuses)[number], number>;
    for (const row of (data ?? []) as Array<{ status: string; total: number | string }>) {
      if (validStatuses.includes(row.status as (typeof validStatuses)[number])) counts[row.status as (typeof validStatuses)[number]] = Number(row.total) || 0;
    }
    return jsonOk({ counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) });
  } catch {
    return jsonError('Unable to load employer-verification counts.', 500);
  }
}
