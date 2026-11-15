import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import {
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  Award,
  ArrowRight,
  TrendingUp,
  Inbox,
} from 'lucide-react';

export function History() {
  const {
    data: reports,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.getReports(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted">Loading your interview history…</p>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : 'Could not load history. Please try again.';
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-coral/30 bg-coral/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-coral" />
          <p className="mt-3 text-sm font-medium text-ink">{message}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-paper hover:opacity-90"
            >
              Retry
            </button>
            <Link
              to="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-soft-green"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const list = reports || [];

  // Compute stat cards
  const totalSessions = list.length;
  const scoredSessions = list.filter((item) => item.overall !== null && item.overall !== undefined);
  const avgScore =
    scoredSessions.length > 0
      ? Math.round(scoredSessions.reduce((acc, curr) => acc + (curr.overall ?? 0), 0) / scoredSessions.length)
      : null;
  const totalSeconds = list.reduce((acc, curr) => acc + (curr.duration_seconds || 1200), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ─── Header ─── */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">Interview History</h1>
          <p className="text-xs text-muted mt-1">
            Past viva rehearsal sessions scoped to your anonymous device ID.
          </p>
        </div>
        <Link
          to="/setup"
          className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95"
        >
          New Viva Session
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ─── 3 Stat Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sessions Completed</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <span className="font-heading text-3xl font-extrabold text-ink">{totalSessions}</span>
          <p className="text-xs text-muted mt-1">Recorded mock vivas</p>
        </div>

        <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Score</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <span className="font-heading text-3xl font-extrabold text-primary">
            {avgScore !== null ? `${avgScore}%` : 'Not scored'}
          </span>
          <p className="text-xs text-muted mt-1">Rubric overall mean</p>
        </div>

        <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Practice Time</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <span className="font-heading text-3xl font-extrabold text-ink">{totalMinutes}m</span>
          <p className="text-xs text-muted mt-1">Speaking & reasoning</p>
        </div>
      </div>

      {/* ─── List of Past Reports ─── */}
      <div>
        <h2 className="font-heading text-xl font-bold text-ink mb-4">Past Sessions</h2>
        {list.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-border bg-paper p-12 text-center shadow-sm">
            <Inbox className="mx-auto h-10 w-10 text-muted/60 mb-3" />
            <h3 className="font-heading text-lg font-semibold text-ink">No interview reports yet</h3>
            <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-6">
              Start your first AI mock technical interview. Speak your answers out loud and get instant rubric feedback.
            </p>
            <Link
              to="/setup"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-paper shadow-sm hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Start your first viva
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <Link
                key={item.id}
                to={`/report/${item.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-paper p-5 shadow-sm hover:border-primary/40 hover:bg-soft-green/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-soft-green font-heading text-xs font-bold text-primary text-center px-1">
                    {item.overall !== null && item.overall !== undefined ? `${item.overall}%` : 'Not scored'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-base font-bold text-ink">{item.topic}</span>
                      <span className="rounded bg-background border border-border px-2 py-0.5 text-xs uppercase font-semibold text-muted">
                        {item.mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{item.turns_count} turns</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  View Report
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
