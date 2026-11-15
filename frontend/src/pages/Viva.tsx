import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { api, ApiError } from '@/lib/api';
import type { Question, Turn, TurnResponse, SupportedLanguage, CodeSubmissionResponse } from '@/types';
import { LearnPanel } from '@/components/LearnPanel';
import {
  AlertCircle,
  Loader2,
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Clock,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Send,
  Code2,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface IWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpeechRecognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webkitSpeechRecognition?: any;
}

const STARTER_CODE: Record<SupportedLanguage, string> = {
  python: '# Write your solution below\n\ndef solution(nums):\n    pass\n',
  javascript: '// Write your solution below\n\nfunction solution(nums) {\n    \n}\n',
  java: '// Write your solution below\n\nclass Solution {\n    public int[] solution(int[] nums) {\n        return new int[]{};\n    }\n}\n',
  cpp: '// Write your solution below\n\n#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> solution(vector<int>& nums) {\n        return {};\n    }\n};\n',
};

export function Viva() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [activeFollowUp, setActiveFollowUp] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('dryrun_muted') === 'true';
    }
    return false;
  });
  const [showHint, setShowHint] = useState(false);
  const [lastTurn, setLastTurn] = useState<Turn | null>(null);
  const [turnCounter, setTurnCounter] = useState(1);
  const [isFinished, setIsFinished] = useState(false);

  // Learn Panel state
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string>('');
  const [lastSubmittedCode, setLastSubmittedCode] = useState<string>('');

  // Speech and Browser Compatibility
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  // Code Mode state
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [codeText, setCodeText] = useState<string>(STARTER_CODE.python);
  const [codeTurnSubmitted, setCodeTurnSubmitted] = useState<Turn | null>(null);
  const [codeFollowUps, setCodeFollowUps] = useState<string[]>([]);
  const [followUpIdx, setFollowUpIdx] = useState<number>(0);

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      sessionStorage.setItem('dryrun_muted', String(next));
      return next;
    });
  };

  // Load Session
  const {
    data: sessionData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['session', id],
    queryFn: () => api.getSession(id!),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (sessionData) {
      if (!currentQuestion) {
        setCurrentQuestion(sessionData.question);
      }
      if (sessionData.session.status === 'finished') {
        setIsFinished(true);
      }
      const rawStartedAt = String(sessionData.session.started_at);
      const isoString = rawStartedAt.endsWith('Z') || rawStartedAt.includes('+') ? rawStartedAt : `${rawStartedAt}Z`;
      const started = new Date(isoString).getTime();
      const durationMs = sessionData.session.duration_seconds * 1000;
      const elapsed = Date.now() - started;
      const remainingSec = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
      setSecondsRemaining(remainingSec);
    }
  }, [sessionData, currentQuestion]);

  // Timer countdown
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0 || isFinished) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining, isFinished]);

  // Speech Synthesis helper
  const speakText = useCallback(
    (text: string) => {
      if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    },
    [isMuted]
  );

  useEffect(() => {
    if (currentQuestion && !lastTurn && !activeFollowUp && sessionData?.session.mode === 'viva') {
      speakText(currentQuestion.prompt);
    }
  }, [currentQuestion, lastTurn, activeFollowUp, sessionData, speakText]);

  // Speech Recognition setup
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setAnswerText((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error === 'not-allowed' || event?.error === 'permission-denied') {
          setMicPermissionDenied(true);
        }
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    } else {
      setIsSpeechSupported(false);
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleMic = () => {
    if (!isSpeechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in this browser (e.g. Firefox, Safari). You can type your answer in the text area below.');
      return;
    }
    setMicPermissionDenied(false);
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  // Viva Turn Mutation
  const turnMutation = useMutation({
    mutationFn: (text: string) => {
      if (!currentQuestion) throw new Error('No question active');
      return api.submitTurn(id!, {
        question_id: currentQuestion.id,
        kind: activeFollowUp ? 'follow_up' : 'viva',
        answer: text,
      });
    },
    onSuccess: (data: TurnResponse) => {
      setLastTurn(data.turn);
      setTurnCounter((c) => c + 1);
      setAnswerText('');
      setShowHint(false);

      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }

      if (data.session_status === 'finished') {
        setIsFinished(true);
      } else if (codeTurnSubmitted && codeFollowUps.length > 0) {
        // In code mode: check if more follow-ups remain
        const nextIdx = followUpIdx + 1;
        if (nextIdx < codeFollowUps.length) {
          setFollowUpIdx(nextIdx);
          setActiveFollowUp(codeFollowUps[nextIdx]);
          speakText(`Follow-up ${nextIdx + 1}: ${codeFollowUps[nextIdx]}`);
        } else {
          // Completed all follow-ups for this coding problem
          setCodeTurnSubmitted(null);
          setCodeFollowUps([]);
          setActiveFollowUp(null);
          if (data.next_question) {
            setCurrentQuestion(data.next_question);
            speakText(`Next problem: ${data.next_question.prompt}`);
          }
        }
      } else if (data.follow_up) {
        setActiveFollowUp(data.follow_up);
        speakText(`Follow up: ${data.follow_up}`);
      } else if (data.next_question) {
        setActiveFollowUp(null);
        setCurrentQuestion(data.next_question);
        speakText(data.next_question.prompt);
      }
    },
  });

  // Code Submission Mutation
  const codeMutation = useMutation({
    mutationFn: (code: string) => {
      if (!currentQuestion) throw new Error('No question active');
      return api.submitCode(id!, {
        question_id: currentQuestion.id,
        language,
        code,
      });
    },
    onSuccess: (data: CodeSubmissionResponse) => {
      setCodeTurnSubmitted(data.turn);
      setLastTurn(data.turn);
      setCodeFollowUps(data.follow_ups);
      setFollowUpIdx(0);
      if (data.follow_ups.length > 0) {
        setActiveFollowUp(data.follow_ups[0]);
        speakText(`Code review complete. Follow-up question: ${data.follow_ups[0]}`);
      }
    },
  });

  // Finish / End Mutation
  const endMutation = useMutation({
    mutationFn: () => api.finishSession(id!),
    onSuccess: (report) => {
      navigate(`/report/${report.id || report.session_id}`);
    },
  });

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    if (!codeText || Object.values(STARTER_CODE).includes(codeText)) {
      setCodeText(STARTER_CODE[newLang]);
    }
  };

  const getLangExtension = (lang: SupportedLanguage) => {
    switch (lang) {
      case 'python':
        return [python()];
      case 'javascript':
        return [javascript()];
      case 'java':
        return [java()];
      case 'cpp':
        return [cpp()];
      default:
        return [python()];
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted">Loading your interview session…</p>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : 'Could not load session. Please try again.';
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
              to="/setup"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-soft-green"
            >
              Back to setup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const session = sessionData!.session;
  const isCodeMode = session.mode === 'code';
  const isTimeUp = secondsRemaining !== null && secondsRemaining <= 0;

  const handleTryAgain = () => {
    setIsLearnOpen(false);
    setTimeout(() => {
      answerInputRef.current?.focus();
    }, 150);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* ─── Top Bar ─── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-paper p-4 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/setup"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink mr-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Setup
          </Link>
          <span className="rounded-md bg-primary px-2.5 py-0.5 text-xs font-semibold text-paper">
            {session.topic}
          </span>
          <span className="rounded-md bg-soft-green px-2.5 py-0.5 text-xs font-semibold text-primary">
            {session.difficulty}
          </span>
          <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
            {isCodeMode ? 'Code + Viva' : 'Viva only'}
          </span>
          <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
            Turn {turnCounter}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {secondsRemaining !== null && (
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium ${
                isTimeUp ? 'bg-coral/20 text-coral font-bold' : 'bg-background text-ink'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{isTimeUp ? 'Time Up' : formatTime(secondsRemaining)}</span>
            </div>
          )}

          <button
            type="button"
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            onClick={toggleMute}
            className="rounded-lg border border-border p-1.5 text-muted hover:text-ink hover:bg-soft-green min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            aria-label="End interview"
            onClick={() => endMutation.mutate()}
            disabled={endMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-coral/40 bg-coral/10 px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral/20 min-h-[44px] focus-visible:ring-2 focus-visible:ring-coral focus-visible:outline-none transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            End
          </button>
        </div>
      </div>

      {/* ─── CODE MODE WORKSPACE ─── */}
      {isCodeMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Problem Details & Follow-ups */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-soft-green px-2.5 py-0.5 text-xs font-bold text-primary">
                    Problem {session.asked_question_ids.length}
                  </span>
                  <span className="text-xs text-muted font-medium capitalize">{currentQuestion?.difficulty}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLearnOpen(true)}
                  aria-label="I don't know, teach me"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>I don&apos;t know, teach me</span>
                </button>
              </div>

              <h2 className="font-heading text-lg font-bold text-ink mb-3">{currentQuestion?.prompt}</h2>

              {/* Examples */}
              {currentQuestion?.examples && currentQuestion.examples.length > 0 && (
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Example</span>
                  {currentQuestion.examples.map((ex, idx) => (
                    <div key={idx} className="rounded-lg bg-background p-3 text-xs font-mono border border-border space-y-1">
                      <div><span className="text-muted">Input: </span>{ex.input}</div>
                      <div><span className="text-muted">Output: </span>{ex.output}</div>
                      {ex.explanation && (
                        <div className="text-muted font-sans text-xs pt-1">{ex.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {currentQuestion?.constraints && currentQuestion.constraints.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">Constraints</span>
                  <ul className="list-disc pl-4 text-xs text-muted space-y-0.5 font-mono">
                    {currentQuestion.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Code Review Result */}
            {codeTurnSubmitted && (
              <div className="rounded-2xl border border-primary/30 bg-paper p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {codeTurnSubmitted.source === 'fallback' ? 'Code Review (Offline)' : 'AI Code Review'}
                    </span>
                  </div>
                  {codeTurnSubmitted.source === 'fallback' && (
                    <span className="rounded bg-background border border-border px-2 py-0.5 text-xs text-muted">
                      AI evaluation unavailable
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink italic mb-3">&ldquo;{codeTurnSubmitted.note}&rdquo;</p>
                {codeTurnSubmitted.scores ? (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-xs text-muted block">Correctness</span>
                      <span className="font-bold text-ink">{codeTurnSubmitted.scores.correctness}%</span>
                    </div>
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-xs text-muted block">Approach</span>
                      <span className="font-bold text-ink">{codeTurnSubmitted.scores.approach}%</span>
                    </div>
                    <div className="rounded bg-background p-1.5 border border-border">
                      <span className="text-xs text-muted block">Clarity</span>
                      <span className="font-bold text-ink">{codeTurnSubmitted.scores.communication}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-background p-3 border border-border text-xs">
                    <span className="text-muted">Not scored — AI evaluation unavailable.</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (lastSubmittedCode) codeMutation.mutate(lastSubmittedCode);
                      }}
                      disabled={codeMutation.isPending}
                      className="rounded bg-primary px-3 py-1 font-semibold text-paper hover:opacity-90 disabled:opacity-50"
                    >
                      Retry Code Evaluation
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Callout */}
            {activeFollowUp && (
              <div className="rounded-2xl border-l-4 border-primary bg-soft-green p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Follow-Up Viva Question ({followUpIdx + 1}/{codeFollowUps.length || 1})
                  </span>
                  <button
                    type="button"
                    onClick={() => speakText(activeFollowUp)}
                    aria-label="Repeat follow-up"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Speak
                  </button>
                </div>
                <p className="text-sm font-semibold text-ink leading-relaxed">{activeFollowUp}</p>
              </div>
            )}
          </div>

          {/* Right Column: CodeMirror Editor or Viva Follow-up Answer */}
          <div className="lg:col-span-7 space-y-4">
            {!codeTurnSubmitted ? (
              <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm flex flex-col h-full">
                {/* Editor Header: Language selector & disclaimer */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                      aria-label="Select Programming Language"
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <span className="text-xs text-muted">
                    AI analyzes your code structure without executing it.
                  </span>
                </div>

                {/* CodeMirror Editor */}
                <div className="rounded-xl border border-border overflow-hidden bg-background text-sm min-h-[350px]">
                  <CodeMirror
                    value={codeText}
                    height="350px"
                    extensions={getLangExtension(language)}
                    onChange={(val) => setCodeText(val)}
                    theme="light"
                  />
                </div>

                {/* Submit Code */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted">{codeText.length}/10,000 characters</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLastSubmittedCode(codeText);
                      codeMutation.mutate(codeText);
                    }}
                    disabled={!codeText.trim() || codeMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 disabled:opacity-50"
                  >
                    {codeMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing Code…
                      </>
                    ) : (
                      <>
                        Submit Solution
                        <Code2 className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Code Submit Error with Retry */}
                {codeMutation.isError && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {codeMutation.error instanceof ApiError
                          ? codeMutation.error.message
                          : 'Failed to evaluate code. Please try again.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const c = lastSubmittedCode || codeText;
                        if (c.trim()) codeMutation.mutate(c);
                      }}
                      disabled={codeMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Follow-up Viva Answer Area */
              <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <label htmlFor="followup-answer" className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Defend Your Code (Speak or Type)
                  </label>
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      isListening
                        ? 'bg-coral text-paper animate-pulse'
                        : 'border border-border bg-soft-green text-primary hover:bg-soft-green-light'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        Listening…
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        Answer with Voice
                      </>
                    )}
                  </button>
                </div>

                {/* Speech & Mic Warnings */}
                {!isSpeechSupported && (
                  <div className="mb-3 rounded-lg bg-soft-green/50 border border-border p-2.5 text-xs text-muted flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
                    <span>Speech recognition is not supported in this browser. You can type your answer below.</span>
                  </div>
                )}
                {micPermissionDenied && (
                  <div className="mb-3 rounded-lg bg-coral/10 border border-coral/30 p-2.5 text-xs text-coral flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Microphone access was denied. Please allow microphone access in your browser to speak, or type your answer below.</span>
                  </div>
                )}

                <textarea
                  id="followup-answer"
                  rows={4}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Explain the time complexity, boundary handling, or algorithmic choices in your code…"
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {answerText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!answerText.trim() || turnMutation.isPending) return;
                      setLastSubmittedAnswer(answerText.trim());
                      turnMutation.mutate(answerText.trim());
                    }}
                    disabled={!answerText.trim() || turnMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 disabled:opacity-50"
                  >
                    {turnMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Evaluating…
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <Send className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Viva Turn Error with Retry */}
                {turnMutation.isError && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {turnMutation.error instanceof ApiError
                          ? turnMutation.error.message
                          : 'Failed to evaluate answer. Please try again.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const a = lastSubmittedAnswer || answerText.trim();
                        if (a) turnMutation.mutate(a);
                      }}
                      disabled={turnMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}

                {/* Follow-up Turn Error with Retry */}
                {turnMutation.isError && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {turnMutation.error instanceof ApiError
                          ? turnMutation.error.message
                          : 'Failed to evaluate answer. Please try again.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const a = lastSubmittedAnswer || answerText.trim();
                        if (a) turnMutation.mutate(a);
                      }}
                      disabled={turnMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}

                {/* Follow-up Turn Error with Retry */}
                {turnMutation.isError && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {turnMutation.error instanceof ApiError
                          ? turnMutation.error.message
                          : 'Failed to evaluate answer. Please try again.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const a = lastSubmittedAnswer || answerText.trim();
                        if (a) turnMutation.mutate(a);
                      }}
                      disabled={turnMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── VIVA ONLY WORKSPACE ─── */
        <div>
          {/* Question Card */}
          <div className="rounded-2xl border border-border bg-paper p-8 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    turnMutation.isPending ? 'bg-coral animate-ping' : 'bg-lime'
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Interviewer • Question {session.asked_question_ids.length}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const text = activeFollowUp || currentQuestion?.prompt;
                    if (text) speakText(text);
                  }}
                  aria-label="Repeat question"
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft-green hover:text-ink focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Repeat
                </button>
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  aria-label="Get hint"
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft-green hover:text-ink focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Hint
                </button>
                <button
                  type="button"
                  onClick={() => setIsLearnOpen(true)}
                  aria-label="I don't know, teach me"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>I don&apos;t know, teach me</span>
                </button>
              </div>
            </div>

            <p className="font-heading text-xl font-medium text-ink leading-relaxed">
              {currentQuestion?.prompt}
            </p>

            {activeFollowUp && (
              <div className="mt-4 rounded-xl border-l-4 border-primary bg-soft-green p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                  Follow-up Question
                </p>
                <p className="text-sm font-medium text-ink">{activeFollowUp}</p>
              </div>
            )}

            {showHint && currentQuestion && (
              <div className="mt-4 rounded-lg border border-lime bg-soft-green/50 p-3 text-xs text-ink">
                <span className="font-bold">Interviewer Tip: </span>
                {currentQuestion.tags.length > 0
                  ? `Consider the mechanics of ${currentQuestion.tags.join(', ')} and asymptotic behavior.`
                  : 'Focus on explaining the underlying mechanism and edge cases.'}
              </div>
            )}
          </div>

          {/* Last Turn Rubric Feedback */}
          {lastTurn && (
            <div className="mt-6 rounded-2xl border border-border bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                    Feedback on previous response
                  </span>
                </div>
                {lastTurn.source === 'fallback' && (
                  <span className="rounded bg-background border border-border px-2 py-0.5 text-xs text-muted">
                    Evaluated by offline fallback
                  </span>
                )}
              </div>

              <p className="text-sm text-ink mb-4 italic">&ldquo;{lastTurn.note}&rdquo;</p>

              {lastTurn.scores ? (
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="text-xs text-muted block">Correctness</span>
                    <span className="font-bold text-ink">{lastTurn.scores.correctness}%</span>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="text-xs text-muted block">Approach</span>
                    <span className="font-bold text-ink">{lastTurn.scores.approach}%</span>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="text-xs text-muted block">Complexity</span>
                    <span className="font-bold text-ink">{lastTurn.scores.complexity}%</span>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="text-xs text-muted block">Edge Cases</span>
                    <span className="font-bold text-ink">{lastTurn.scores.edge_cases}%</span>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="text-xs text-muted block">Communication</span>
                    <span className="font-bold text-ink">{lastTurn.scores.communication}%</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-background p-3 border border-border text-xs">
                  <span className="text-muted">Not scored — AI evaluation unavailable.</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastSubmittedAnswer) {
                        turnMutation.mutate(lastSubmittedAnswer);
                      }
                    }}
                    disabled={turnMutation.isPending}
                    className="rounded bg-primary px-3 py-1 font-semibold text-paper hover:opacity-90 disabled:opacity-50"
                  >
                    Retry Evaluation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Answering Area */}
          {!isFinished && !isTimeUp && (
            <div className="mt-6 rounded-2xl border border-border bg-paper p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="answer-input" className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Your Answer (Speak or Type)
                </label>

                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={isListening ? 'Stop listening' : 'Start speaking'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isListening
                      ? 'bg-coral text-paper animate-pulse'
                      : 'border border-border bg-soft-green text-primary hover:bg-soft-green-light'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" />
                      Listening…
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" />
                      Answer with Voice (en-IN)
                    </>
                  )}
                </button>
              </div>

              {/* Speech & Mic Warnings */}
              {!isSpeechSupported && (
                <div className="mb-3 rounded-lg bg-soft-green/50 border border-border p-2.5 text-xs text-muted flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
                  <span>Speech recognition is not supported in this browser. You can type your answer below.</span>
                </div>
              )}
              {micPermissionDenied && (
                <div className="mb-3 rounded-lg bg-coral/10 border border-coral/30 p-2.5 text-xs text-coral flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Microphone access was denied. Please allow microphone access in your browser to speak, or type your answer below.</span>
                </div>
              )}

              <textarea
                id="answer-input"
                ref={answerInputRef}
                rows={4}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your explanation or click the microphone to speak your answer out loud…"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {answerText.trim().split(/\s+/).filter(Boolean).length} words
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!answerText.trim() || turnMutation.isPending) return;
                    setLastSubmittedAnswer(answerText.trim());
                    turnMutation.mutate(answerText.trim());
                  }}
                  disabled={!answerText.trim() || turnMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 disabled:opacity-50"
                >
                  {turnMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Evaluating…
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Viva Turn Error with Retry */}
              {turnMutation.isError && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {turnMutation.error instanceof ApiError
                        ? turnMutation.error.message
                        : 'Failed to evaluate answer. Please try again.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const a = lastSubmittedAnswer || answerText.trim();
                      if (a) turnMutation.mutate(a);
                    }}
                    disabled={turnMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Finished / Expired State */}
      {(isFinished || isTimeUp) && (
        <div className="mt-6 rounded-2xl border border-primary/20 bg-soft-green p-8 text-center">
          <h3 className="font-heading text-xl font-bold text-primary mb-2">
            {isTimeUp ? 'Time is up!' : 'Interview session complete!'}
          </h3>
          <p className="text-xs text-muted mb-6">
            All your code and viva answers have been evaluated against standard DSA interview rubrics.
          </p>
          <button
            type="button"
            onClick={() => endMutation.mutate()}
            disabled={endMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-paper shadow-sm hover:opacity-95"
          >
            {endMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                View Performance Report
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── Learn & Socratic Tutor Panel ─── */}
      {currentQuestion && (
        <LearnPanel
          isOpen={isLearnOpen}
          onClose={() => setIsLearnOpen(false)}
          onTryAgain={handleTryAgain}
          sessionId={id!}
          question={currentQuestion}
          topic={session.topic}
        />
      )}
    </div>
  );
}
