import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'admin-evaluation-read', { limit: 30, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return jsonError('Research administrator access required.', 403);

    const admin = createSupabaseAdminClient();
    const [profiles, jobs, applications, attempts, events] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('jobs').select('id', { count: 'exact', head: true }),
      admin.from('applications').select('id, fit_score', { count: 'exact' }).limit(1000),
      admin.from('assessment_attempts').select('id, score, total_points', { count: 'exact' }).limit(1000),
      admin.from('platform_events').select('duration_ms').not('duration_ms', 'is', null).order('created_at', { ascending: false }).limit(1000)
    ]);
    if (profiles.error || jobs.error || applications.error || attempts.error || events.error) return jsonError('Unable to load evaluation data.', 500);
    const applicationRows = (applications.data ?? []) as unknown as Array<{ fit_score: number | string | null }>;
    const attemptRows = (attempts.data ?? []) as unknown as Array<{ score: number; total_points: number }>;
    const eventRows = (events.data ?? []) as unknown as Array<{ duration_ms: number | null }>;
    const matchScores = applicationRows.map((row) => Number(row.fit_score)).filter(Number.isFinite);
    const assessmentScores = attemptRows.map((row) => row.total_points ? (row.score / row.total_points) * 100 : 0).filter(Number.isFinite);
    const durations = eventRows.map((row) => row.duration_ms).filter((value): value is number => typeof value === 'number');
    const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    return jsonOk({
      generatedAt: new Date().toISOString(),
      counts: { users: profiles.count ?? 0, jobs: jobs.count ?? 0, applications: applications.count ?? 0, assessments: attempts.count ?? 0 },
      quality: { averageFitScore: average(matchScores), averageAssessmentScore: average(assessmentScores), averageResponseMs: average(durations) },
      dimensions: [
        { name: 'Functional suitability', value: 'Account, assessment, profile, job, and matching workflows are instrumented for pilot verification.' },
        { name: 'Performance efficiency', value: durations.length ? `Observed average API duration is ${average(durations)} ms.` : 'Collecting response-time events during pilot use.' },
        { name: 'Interaction capability', value: 'Run keyboard, screen-reader, contrast, and user error protection checks with PWD participants before formal conformance claims.' }
      ]
    });
  } catch {
    return jsonError('Unable to load evaluation data.', 500);
  }
}
