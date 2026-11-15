import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import {
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

export function Report() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({ 0: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.getReportDetail(id!),
    enabled: !!id,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteReport(id!),
    onSuccess: () => {
      navigate('/history');
    },
  });

  const toggleAccordion = (idx: number) => {
    setOpenAccordions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted">Building your performance report…</p>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : 'Could not load report. Please try again.';
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
              to="/history"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-soft-green"
            >
              View past interviews
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { report, session, turns, questions } = data!;
  const dims = report.dimensions;

  const dimensionList = dims
    ? [
        { label: 'Correctness', value: dims.correctness, desc: 'Technical accuracy & conceptual precision' },
        { label: 'Approach', value: dims.approach, desc: 'Optimal strategy & structural problem solving' },
        { label: 'Complexity', value: dims.complexity, desc: 'Time & space tradeoff awareness' },
        { label: 'Edge Cases', value: dims.edge_cases, desc: 'Boundary conditions & exception handling' },
        { label: 'Communication', value: dims.communication, desc: 'Clarity, conciseness & logical structuring' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/history"
            aria-label="Back to history"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            History
          </Link>
          <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-paper">
            {report.topic}
          </span>
          <span className="rounded-md bg-soft-green px-2.5 py-1 text-xs font-semibold text-primary">
            {session.difficulty}
          </span>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted">
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Delete button */}
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-coral transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Report
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-coral font-medium">Delete session & turns?</span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded bg-coral px-2.5 py-1 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-soft-green"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ─── Hero Score & Coach Note ─── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Score Circle Card */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-paper p-8 text-center shadow-sm">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-lime bg-soft-green/30">
            <div>
              {report.overall !== null && report.overall !== undefined ? (
                <>
                  <span className="font-heading text-4xl font-extrabold text-primary">
                    {report.overall}
                  </span>
                  <span className="block text-xs font-semibold text-muted uppercase">out of 100</span>
                </>
              ) : (
                <span className="font-heading text-lg font-bold text-muted uppercase">
                  Not scored
                </span>
              )}
            </div>
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold text-ink">Overall Readiness</h2>
          <p className="text-xs text-muted mt-1">
            {report.mode === 'code' ? 'Code + Viva Evaluation' : 'DSA Viva Evaluation'}
          </p>

          {/* Code vs Viva separate scores if present */}
          {report.mode === 'code' && (
            <div className="mt-4 flex items-center justify-center gap-4 pt-4 border-t border-border w-full">
              <div>
                <span className="block text-xs text-muted font-medium">Code Score</span>
                <span className="font-heading text-sm font-bold text-primary">
                  {report.code_score !== null && report.code_score !== undefined ? `${report.code_score}%` : 'Not scored'}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-border" />
              <div>
                <span className="block text-xs text-muted font-medium">Viva Score</span>
                <span className="font-heading text-sm font-bold text-primary">
                  {report.viva_score !== null && report.viva_score !== undefined ? `${report.viva_score}%` : 'Not scored'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Coach Note Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-paper p-8 shadow-sm md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Interviewer Assessment
                </span>
              </div>
              {report.coach_note_source === 'fallback' && (
                <span className="rounded bg-background border border-border px-2 py-0.5 text-xs text-muted">
                  Offline fallback note
                </span>
              )}
            </div>

            <p className="font-heading text-base font-medium text-ink leading-relaxed">
              &ldquo;{report.coach_note}&rdquo;
            </p>
          </div>

          {report.weak_topics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-xs text-muted">Areas to sharpen: </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {report.weak_topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-coral/30 bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Metric Dimension Cards with Progress Bars ─── */}
      <div className="mt-8">
        <h3 className="font-heading text-lg font-bold text-ink mb-4">Rubric Dimensions</h3>
        {dimensionList.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dimensionList.map((d) => (
              <div key={d.label} className="rounded-xl border border-border bg-paper p-5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-ink">{d.label}</span>
                  <span className="text-sm font-bold text-primary">{d.value}%</span>
                </div>
                <p className="text-xs text-muted mb-3">{d.desc}</p>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, d.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-paper p-6 text-center text-xs text-muted">
            AI evaluation was unavailable; no turns were scored in this session.
          </div>
        )}
      </div>

      {/* ─── Dark Green Next-Practice Banner ─── */}
      <div className="mt-8 rounded-2xl bg-primary p-6 text-paper shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-lime">Next Recommended Practice</span>
          <h4 className="font-heading text-xl font-bold mt-1">
            Focus on {report.weak_topics[0] || report.topic} Viva Drills
          </h4>
          <p className="text-xs text-paper/80 mt-1 max-w-md">
            Review edge cases and runtime trade-offs before starting another session.
          </p>
        </div>
        <Link
          to="/setup"
          className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 whitespace-nowrap"
        >
          Practice Again
          <RotateCcw className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ─── Concepts Learned & Reviewed ─── */}
      {report.learned && report.learned.length > 0 && (
        <div className="mt-8 rounded-2xl border border-primary/20 bg-soft-green/30 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-ink">
              Concepts Learned &amp; Reviewed ({report.learned.length})
            </h3>
          </div>
          <p className="text-xs text-muted mb-4">
            You used the Socratic tutor for these questions during the interview. Practise these topics again to solidify mastery!
          </p>
          <div className="space-y-2">
            {report.learned.map((qId) => {
              const qObj = questions.find((q) => q.id === qId);
              return (
                <div
                  key={qId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-paper p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 rounded-md bg-soft-green px-2 py-0.5 font-semibold text-primary">
                      {qObj?.topic || report.topic}
                    </span>
                    <span className="font-medium text-ink truncate">
                      {qObj?.prompt || qId}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    Reviewed with Tutor
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Transcript Accordion ─── */}
      <div className="mt-8">
        <h3 className="font-heading text-lg font-bold text-ink mb-4">Interview Transcript ({turns.length} turns)</h3>
        {turns.length === 0 ? (
          <div className="rounded-xl border border-border bg-paper p-6 text-center text-sm text-muted">
            No turns were recorded for this session.
          </div>
        ) : (
          <div className="space-y-3">
            {turns.map((turn, idx) => {
              const q = questions.find((item) => item.id === turn.question_id);
              const isOpen = !!openAccordions[idx];

              return (
                <div key={turn.id} className="rounded-xl border border-border bg-paper overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(idx)}
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-soft-green/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-soft-green px-2.5 py-0.5 text-xs font-bold text-primary">
                        Turn {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-ink line-clamp-1">
                        {q?.prompt || 'Question'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-primary">
                        {turn.scores
                          ? `Avg: ${Math.round((turn.scores.correctness + turn.scores.approach + turn.scores.complexity + turn.scores.edge_cases + turn.scores.communication) / 5)}%`
                          : 'Not scored'}
                      </span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 border-t border-border/60 bg-background/50 space-y-3">
                      <div className="pt-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
                          Question Prompt:
                        </span>
                        <p className="text-sm font-medium text-ink">{q?.prompt}</p>
                      </div>

                      {turn.kind === 'code' ? (
                        <div className="rounded-lg border border-border bg-ink p-3 text-paper font-mono text-xs overflow-x-auto">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/20 text-muted">
                            <span className="text-xs uppercase font-bold text-lime">{turn.language} Code</span>
                            <span className="text-xs">{turn.code?.length || 0} chars</span>
                          </div>
                          <pre className="whitespace-pre">{turn.code}</pre>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border bg-paper p-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                            Your Explanation:
                          </span>
                          <p className="text-sm text-ink whitespace-pre-wrap">{turn.answer}</p>
                        </div>
                      )}

                      <div className="rounded-lg bg-soft-green/40 p-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                          Interviewer Feedback:
                        </span>
                        <p className="text-xs text-ink italic">&ldquo;{turn.note}&rdquo;</p>
                      </div>

                      {turn.scores ? (
                        <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                          <div className="rounded border border-border bg-paper p-1.5">
                            <span className="text-muted block text-xs">Correct</span>
                            <span className="font-bold text-ink">{turn.scores.correctness}%</span>
                          </div>
                          <div className="rounded border border-border bg-paper p-1.5">
                            <span className="text-muted block text-xs">Approach</span>
                            <span className="font-bold text-ink">{turn.scores.approach}%</span>
                          </div>
                          <div className="rounded border border-border bg-paper p-1.5">
                            <span className="text-muted block text-xs">Complexity</span>
                            <span className="font-bold text-ink">{turn.scores.complexity}%</span>
                          </div>
                          <div className="rounded border border-border bg-paper p-1.5">
                            <span className="text-muted block text-xs">Edge Cases</span>
                            <span className="font-bold text-ink">{turn.scores.edge_cases}%</span>
                          </div>
                          <div className="rounded border border-border bg-paper p-1.5">
                            <span className="text-muted block text-xs">Comm.</span>
                            <span className="font-bold text-ink">{turn.scores.communication}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded border border-border bg-paper p-2 text-center text-xs text-muted">
                          AI evaluation was unavailable for this turn (unscored).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Back CTA ─── */}
      <div className="mt-8 text-center">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          View all past interviews
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
