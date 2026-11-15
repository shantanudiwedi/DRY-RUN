import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { SessionCreate, SessionDifficulty, SessionMode } from '@/types';
import { AlertCircle, ArrowRight, RefreshCw, Volume2 } from 'lucide-react';

const TOPICS = [
  'Surprise me',
  'Arrays',
  'Strings',
  'Linked lists',
  'Trees',
  'Graphs',
  'Dynamic programming',
] as const;

const DURATIONS = [
  { label: '10 min', value: 600 },
  { label: '20 min', value: 1200 },
  { label: '30 min', value: 1800 },
] as const;

const DIFFICULTIES: { label: string; value: SessionDifficulty }[] = [
  { label: 'Adaptive', value: 'Adaptive' },
  { label: 'Foundations', value: 'Foundations' },
  { label: 'Intermediate', value: 'Intermediate' },
  { label: 'Advanced', value: 'Advanced' },
];

const MODES: { label: string; value: SessionMode; description: string }[] = [
  { label: 'Viva only', value: 'viva', description: 'Explain concepts out loud' },
  { label: 'Code + Viva', value: 'code', description: 'Write code then defend it' },
];

export function Setup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTopic = searchParams.get('topic');

  const [topic, setTopic] = useState<string>(() => {
    if (queryTopic && TOPICS.some((t) => t.toLowerCase() === queryTopic.toLowerCase())) {
      const match = TOPICS.find((t) => t.toLowerCase() === queryTopic.toLowerCase());
      return match || 'Surprise me';
    }
    return 'Surprise me';
  });
  const [duration, setDuration] = useState<600 | 1200 | 1800>(1200);
  const [difficulty, setDifficulty] = useState<SessionDifficulty>('Adaptive');
  const [mode, setMode] = useState<SessionMode>('viva');

  const mutation = useMutation({
    mutationFn: (payload: SessionCreate) => api.createSession(payload),
    onSuccess: (data) => {
      navigate(`/viva/${data.session.id}`);
    },
  });

  const handleStart = () => {
    mutation.mutate({ topic, duration_seconds: duration, difficulty, mode });
  };

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold text-ink">Set up your interview</h1>
        <p className="mt-2 text-muted text-sm">
          Pick a topic, duration and difficulty. Then hit start.
        </p>
      </div>

      <div className="space-y-8">
        {/* ─── Topic ─── */}
        <fieldset>
          <legend className="font-heading text-sm font-semibold text-ink mb-3">Topic</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Select topic: ${t}`}
                onClick={() => setTopic(t)}
                className={`min-h-[44px] rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                  ${
                    topic === t
                      ? 'border-primary bg-primary text-paper'
                      : 'border-border bg-paper text-ink hover:border-primary/40 hover:bg-soft-green'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Duration ─── */}
        <fieldset>
          <legend className="font-heading text-sm font-semibold text-ink mb-3">Duration</legend>
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-label={`Select duration: ${d.label}`}
                onClick={() => setDuration(d.value)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none text-center
                  ${
                    duration === d.value
                      ? 'border-primary bg-primary text-paper'
                      : 'border-border bg-paper text-ink hover:bg-soft-green'
                  }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Difficulty ─── */}
        <fieldset>
          <legend className="font-heading text-sm font-semibold text-ink mb-3">Difficulty</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-label={`Select difficulty: ${d.label}`}
                onClick={() => setDifficulty(d.value)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none text-center
                  ${
                    difficulty === d.value
                      ? 'border-primary bg-primary text-paper'
                      : 'border-border bg-paper text-ink hover:bg-soft-green'
                  }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Mode ─── */}
        <fieldset>
          <legend className="font-heading text-sm font-semibold text-ink mb-3">Mode</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-label={`Select mode: ${m.label}`}
                onClick={() => setMode(m.value)}
                className={`min-h-[44px] rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                  ${
                    mode === m.value
                      ? 'border-primary bg-soft-green'
                      : 'border-border bg-paper hover:border-primary/40'
                  }`}
              >
                <span className="block text-xs font-bold text-ink">{m.label}</span>
                <span className="block text-xs text-muted mt-0.5">{m.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Audio & Voice Readiness ─── */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-paper px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft-green text-primary">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-ink">Voice &amp; Audio Input Active</p>
            <p className="text-xs text-muted">Speech recognition (en-IN) and typed answer fallbacks are ready.</p>
          </div>
        </div>

        {/* ─── Error banner ─── */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
            <div className="flex-1">
              <p className="text-xs font-medium text-ink">{errorMessage}</p>
              <button
                type="button"
                onClick={() => mutation.reset()}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ─── Start button ─── */}
        <button
          type="button"
          onClick={handleStart}
          disabled={mutation.isPending}
          aria-label="Start viva session"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-lime px-8 py-3 text-xs font-bold text-primary
                     shadow-sm transition-all hover:brightness-95 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              Start viva
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
