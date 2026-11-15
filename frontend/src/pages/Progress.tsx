import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import {
  TrendingUp,
  RotateCcw,
  AlertCircle,
  Loader2,
  Calendar,
  Award,
  ChevronRight,
  Flame,
  ArrowRight,
} from 'lucide-react';

export function Progress() {
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.getProgress(),
    retry: false,
  });

  const getIntensityClass = (score: number) => {
    if (score === 0) return 'bg-border/60 text-muted';
    if (score < 40) return 'bg-soft-green text-primary';
    if (score < 70) return 'bg-lime/70 text-primary font-bold';
    return 'bg-primary text-paper font-bold';
  };

  const getMasteryColor = (score: number) => {
    if (score >= 75) return 'text-primary';
    if (score >= 50) return 'text-amber-700 dark:text-amber-400';
    return 'text-coral';
  };

  const weekLabels = ['Week 1 (4w ago)', 'Week 2 (3w ago)', 'Week 3 (2w ago)', 'Week 4 (Current)'];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-xs font-medium text-muted">Calculating topic progression &amp; activity…</p>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : 'Could not load progress data. Please try again.';
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-coral/30 bg-coral/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-coral" />
          <h2 className="mt-3 text-base font-bold text-ink">Progress Unavailable</h2>
          <p className="mt-1 text-xs font-medium text-muted">{message}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-paper hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
            <Link
              to="/setup"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-paper px-5 py-2.5 text-xs font-semibold text-ink hover:bg-soft-green focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
            >
              Start New Interview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { topics, least_practiced_topic, weakest_topic } = data!;
  const totalPracticeCount = topics.reduce((acc, t) => acc + t.practice_count, 0);
  const recommendedTopic = weakest_topic || least_practiced_topic || 'Arrays';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ─── Header ─── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-ink">Topic Mastery &amp; Progress</h1>
        </div>
        <p className="text-xs text-muted max-w-2xl">
          Track your algorithmic confidence across all core DSA areas. Mastery adapts with every viva explanation and code review.
        </p>
      </div>

      {/* ─── Next Up Card ─── */}
      <div className="mb-8 rounded-2xl bg-primary p-6 text-paper shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-lime text-xs font-bold uppercase tracking-wider mb-1">
            <Flame className="h-4 w-4" />
            <span>Recommended Next Drill</span>
          </div>
          <h2 className="font-heading text-xl font-bold">Focus on {recommendedTopic}</h2>
          <p className="text-xs text-paper/80 mt-1 max-w-lg">
            {weakest_topic === recommendedTopic
              ? `Your mastery in ${recommendedTopic} has room to grow. Practice edge cases and complexity analysis.`
              : `${recommendedTopic} has had the fewest practice sessions. Keep your skills balanced across all topics.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/setup?topic=${encodeURIComponent(recommendedTopic)}`)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all whitespace-nowrap w-full sm:w-auto"
        >
          <span>Practice {recommendedTopic}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Activity & Mastery Heatmap ─── */}
      <div className="mb-8 rounded-2xl border border-border bg-paper p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-heading text-base font-bold text-ink flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              4-Week Practice Heatmap
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Weekly performance scores across core DSA concepts. Darker green indicates higher rubric scores.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-muted self-start sm:self-auto">
            <span>Inactive</span>
            <div className="flex gap-1">
              <div className="h-3 w-3 rounded-sm bg-border/60" title="0% - No sessions" />
              <div className="h-3 w-3 rounded-sm bg-soft-green" title="1-39% - Developing" />
              <div className="h-3 w-3 rounded-sm bg-lime/70" title="40-69% - Good" />
              <div className="h-3 w-3 rounded-sm bg-primary" title="70-100% - Strong" />
            </div>
            <span>Strong</span>
          </div>
        </div>

        {/* Visual Heatmap Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[480px]">
            {/* Header Row */}
            <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted pb-2 border-b border-border">
              <div className="col-span-1">Topic</div>
              <div className="text-center">W-4</div>
              <div className="text-center">W-3</div>
              <div className="text-center">W-2</div>
              <div className="text-center">Current</div>
            </div>

            {/* Topic Rows */}
            <div className="space-y-2.5 pt-2.5">
              {topics.map((t) => (
                <div key={t.topic} className="grid grid-cols-5 items-center gap-2 text-xs">
                  <div className="col-span-1 font-medium text-ink truncate pr-2">
                    {t.topic}
                  </div>
                  {t.weekly_scores.map((score, wIdx) => (
                    <div
                      key={wIdx}
                      className={`flex h-8 items-center justify-center rounded-lg text-xs transition-colors ${getIntensityClass(
                        score
                      )}`}
                      title={`${t.topic} (${weekLabels[wIdx]}): ${score > 0 ? `${score}% average` : 'No practice'}`}
                      aria-hidden="true"
                    >
                      {score > 0 ? `${Math.round(score)}%` : '—'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Accessible Text Alternative for Heatmap (Screen-reader Accessible Table) */}
        <table className="sr-only">
          <caption>4-Week DSA Practice Heatmap Summary</caption>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Week 1 (4 weeks ago)</th>
              <th scope="col">Week 2 (3 weeks ago)</th>
              <th scope="col">Week 3 (2 weeks ago)</th>
              <th scope="col">Week 4 (Current)</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.topic}>
                <th scope="row">{t.topic}</th>
                {t.weekly_scores.map((score, idx) => (
                  <td key={idx}>{score > 0 ? `${score}% average score` : 'No sessions recorded'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Topic Mastery List ─── */}
      <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-base font-bold text-ink">Mastery by Topic</h2>
          </div>
          <span className="text-xs text-muted">{totalPracticeCount} total sessions completed</span>
        </div>

        {totalPracticeCount === 0 ? (
          <div className="rounded-xl border border-border bg-background p-6 text-center space-y-3">
            <p className="text-xs text-muted">
              You haven&apos;t completed any interview sessions yet. Complete your first viva or coding interview to calibrate topic mastery!
            </p>
            <Link
              to="/setup"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-paper hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-opacity"
            >
              Start First Interview
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {topics.map((t) => {
              const scorePct = Math.round(t.mastery_score);
              return (
                <div
                  key={t.topic}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-heading text-sm font-bold text-ink">{t.topic}</span>
                      <span className={`text-xs font-bold ${getMasteryColor(scorePct)}`}>
                        {scorePct} / 100
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.max(5, Math.min(100, scorePct))}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span>{t.practice_count} sessions</span>
                      <span>
                        {scorePct >= 75 ? 'Advanced readiness' : scorePct >= 50 ? 'Intermediate grasp' : 'Foundations'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-auto sm:pl-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/setup?topic=${encodeURIComponent(t.topic)}`)}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-border bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-soft-green focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                    >
                      Practice
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
