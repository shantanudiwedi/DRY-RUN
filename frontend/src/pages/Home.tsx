import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Volume2, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const TOPICS = [
  'Arrays',
  'Strings',
  'Linked lists',
  'Trees',
  'Graphs',
  'Dynamic programming',
];

export function Home() {
  const { data: questionsData, isError } = useQuery({
    queryKey: ['questions', 'summary'],
    queryFn: () => api.getQuestions(),
    retry: 1,
  });

  const totalQuestions = questionsData?.total ?? 54;

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-border bg-paper/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-6 shadow-2xs">
                <Sparkles className="h-3 w-3 text-lime fill-lime" />
                Technical Viva Rehearsal for Indian Students
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.08] mb-6">
                Never get stuck explaining your code{' '}
                <span className="text-primary underline decoration-lime decoration-wavy decoration-2 underline-offset-8">
                  out loud
                </span>
                .
              </h1>

              <p className="text-base sm:text-lg text-muted max-w-xl mb-8 leading-relaxed font-sans">
                Real DSA mock interviews where the AI listens, challenges your approach, adapts
                difficulty, and rates you honestly on understanding—not keywords.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <Link
                  to="/setup"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-lime shadow-md hover:bg-primary/95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all group"
                >
                  Start Practice Viva
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <div className="flex items-center gap-2 text-xs text-muted font-medium px-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Free & instant (under 1 min)
                </div>
              </div>

              {/* Trust Line */}
              <div className="flex items-center gap-4 pt-4 border-t border-border/80 w-full text-xs text-muted flex-wrap">
                <span className="font-semibold text-ink uppercase tracking-wider text-xs">
                  Built for
                </span>
                <span>B.Tech, BCA & MCA placements</span>
                <span>•</span>
                <span>Voice viva + defended code</span>
                <span>•</span>
                <span>Anonymous</span>
              </div>
            </div>

            {/* Right Column: Live-preview Panel */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl border border-border bg-paper p-6 shadow-xl transition-transform hover:-translate-y-1 duration-300 transform lg:rotate-1">
                {/* Interviewer State Card */}
                <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-tl-xl rounded-tr-sm rounded-br-xl rounded-bl-sm bg-primary text-lime flex items-center justify-center font-bold text-xs">
                        AI
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-lime border-2 border-paper" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-heading">
                        Interviewer
                      </h4>
                      <p className="text-xs text-muted flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        Listening actively
                      </p>
                    </div>
                  </div>

                  <span className="rounded-md bg-soft-green px-2 py-0.5 text-xs font-semibold text-primary uppercase tracking-wider">
                    Adaptive Viva
                  </span>
                </div>

                {/* Question Preview */}
                <div className="mb-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1 font-mono">
                    Sample Viva Question
                  </div>
                  <p className="text-sm font-semibold text-ink leading-snug">
                    "How does a dynamic array achieve amortized O(1) insertion time when appending elements?"
                  </p>
                </div>

                {/* Simulated Audio Waveform */}
                <div className="rounded-xl bg-background border border-border p-3.5 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted uppercase">Student Response</span>
                    <Volume2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex items-end gap-1 h-7">
                    {[40, 65, 80, 45, 95, 60, 30, 85, 70, 50, 90, 75, 40, 60, 95, 50, 30, 70].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="w-1 rounded-full bg-primary/70 transition-all duration-300"
                      />
                    ))}
                  </div>
                </div>

                {/* Follow-up Peek */}
                <div className="rounded-lg border-l-2 border-primary bg-soft-green/40 p-2.5 text-xs text-ink">
                  <span className="font-semibold text-primary text-xs uppercase tracking-wider block mb-0.5">
                    Follow-up:
                  </span>
                  "What happens to memory when the array doubles versus growing by constant additions?"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Topic Strip */}
      <section className="py-8 bg-background border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-ink">
                DSA Topic Coverage
              </h3>
              <p className="text-xs text-muted">
                {isError
                  ? '6 core topics available in practice mode'
                  : `${totalQuestions}+ curated questions across Foundations, Intermediate & Advanced`}
              </p>
            </div>

            <Link
              to="/setup"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Configure Session <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TOPICS.map((topic) => (
              <div
                key={topic}
                className="flex items-center justify-between rounded-xl border border-border bg-paper p-3 text-xs font-medium text-ink shadow-2xs hover:border-primary/50 transition-colors"
              >
                <span>{topic}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-lime border border-primary/30" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Methodology Features */}
      <section className="py-12 bg-paper/30 flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-paper p-5">
              <div className="h-8 w-8 rounded-lg bg-soft-green text-primary flex items-center justify-center mb-3">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h4 className="font-heading text-sm font-bold text-ink mb-1">
                Real Rubric Evaluation
              </h4>
              <p className="text-xs text-muted leading-relaxed">
                Evaluations come strictly from a verified rubric: correctness, approach, complexity,
                edge cases, and communication. Never from answer length.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-paper p-5">
              <div className="h-8 w-8 rounded-lg bg-soft-green text-primary flex items-center justify-center mb-3">
                <Sparkles className="h-4 w-4" />
              </div>
              <h4 className="font-heading text-sm font-bold text-ink mb-1">
                Voice Viva & Defended Code
              </h4>
              <p className="text-xs text-muted leading-relaxed">
                Answer live out loud with Indian-English speech recognition, or write code and defend
                your complexity tradeoffs during follow-up turns.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-paper p-5">
              <div className="h-8 w-8 rounded-lg bg-soft-green text-primary flex items-center justify-center mb-3">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h4 className="font-heading text-sm font-bold text-ink mb-1">
                Learn Without Leaving
              </h4>
              <p className="text-xs text-muted leading-relaxed">
                If you get stuck, the "I don't know, teach me" panel provides tutor hints, curated
                free video explanations, and quick cheat sheets right inside the session.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
