import { getAdminAccess } from '@/lib/admin-access';
import { cleanText, jsonError, jsonOk, safeInteger } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

type VerificationListRow = {
  employer_id: string;
  status: string;
  full_name: string;
  email: string;
  organization_name: string | null;
  registered_business_name: string | null;
  trading_name: string | null;
  business_type: string | null;
  last_submitted_at: string | null;
  updated_at: string;
  total_count: number | string;
};

export async function GET(request: Request) {
  try {
    const access = await getAdminAccess();
    if (!access.user) return jsonError('Authentication required.', 401);
    if (access.error) return jsonError('Unable to verify administrator access.', 500);
    if (access.role !== 'admin') return jsonError('Administrator access required.', 403);
    const limited = await checkRateLimit(request, 'admin-employer-verification-queue', { limit: 60, windowMs: 60 * 1000 }, access.user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);

    const url = new URL(request.url);
    const rawPage = url.searchParams.get('page');
    const rawPageSize = url.searchParams.get('pageSize');
    const page = Math.max(1, Math.min(100000, rawPage === null ? 1 : safeInteger(rawPage, 1)));
    const pageSize = Math.max(1, Math.min(50, rawPageSize === null ? 20 : safeInteger(rawPageSize, 20)));
    const status = cleanText(url.searchParams.get('status'), 32);
    const search = cleanText(url.searchParams.get('search'), 120);
    const rpc = access.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
    const { data, error } = await rpc.rpc('admin_list_employer_verifications', {
      p_search: search,
      p_status: status || null,
      p_page: page,
      p_page_size: pageSize
    });
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (error.code === '22023') return jsonError('Choose a valid verification status filter.');
      return jsonError('Unable to load the employer-verification queue.', 500);
    }
    const items = (data ?? []) as VerificationListRow[];
    return jsonOk({ items, total: Number(items[0]?.total_count ?? 0), page, pageSize });
  } catch {
    return jsonError('Unable to load the employer-verification queue.', 500);
  }
}
