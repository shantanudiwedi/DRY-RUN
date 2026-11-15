import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Question, ChatMessage, TopicResource } from '@/types';
import {
  X,
  MessageSquare,
  Video,
  FileText,
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface LearnPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTryAgain: () => void;
  sessionId: string;
  question: Question;
  topic: string;
}

export function LearnPanel({
  isOpen,
  onClose,
  onTryAgain,
  sessionId,
  question,
  topic,
}: LearnPanelProps) {
  const [activeTab, setActiveTab] = useState<'tutor' | 'videos' | 'cheatsheet'>('tutor');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSentMessage, setLastSentMessage] = useState<string>('');
  const [tutorSource, setTutorSource] = useState<string | null>(null);
  const [isMarkingLearned, setIsMarkingLearned] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch topic resources for cheat sheet & videos
  const topicName = question.topic || topic;
  const {
    data: resourceData,
    isLoading: isResourceLoading,
    isError: isResourceError,
    refetch: refetchResources,
  } = useQuery({
    queryKey: ['resources', topicName],
    queryFn: async () => {
      const res = await api.getResources(topicName);
      return res as TopicResource;
    },
    enabled: isOpen,
    staleTime: 1000 * 60 * 10,
  });

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll messages to bottom on new message
  useEffect(() => {
    if (activeTab === 'tutor') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingReply, activeTab]);

  // Auto-focus input when opening or switching to tutor
  useEffect(() => {
    if (isOpen && activeTab === 'tutor') {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoadingReply) return;

    if (message.length > 1000) {
      setErrorMsg('Message exceeds 1,000 characters.');
      return;
    }

    setErrorMsg(null);
    setLastSentMessage(message);
    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(updatedMessages);
    if (!textToSend) {
      setInputMessage('');
    }
    setIsLoadingReply(true);

    try {
      const res = await api.tutorChat(sessionId, {
        question_id: question.id,
        messages: updatedMessages.slice(-6),
        message,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      setTutorSource(res.source);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to reach tutor. Please try again.';
      setErrorMsg(msg);
    } finally {
      setIsLoadingReply(false);
    }
  };

  const handleTryAgainClick = async () => {
    setIsMarkingLearned(true);
    try {
      await api.markLearned(sessionId, question.id);
    } catch {
      // Continue even if network error so student can proceed
    } finally {
      setIsMarkingLearned(false);
      onTryAgain();
    }
  };

  const videos = resourceData?.videos || [];
  const cheatSheet = resourceData?.cheat_sheet || 'No cheat sheet available for this topic.';
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${question.prompt.slice(0, 80)} dsa ${topicName}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Learn & Socratic Tutor Panel"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-over panel (bottom sheet on mobile, right panel on sm+) */}
      <div
        ref={panelRef}
        className="relative z-10 flex h-[90vh] sm:h-full w-full sm:max-w-xl flex-col bg-paper shadow-2xl rounded-t-2xl sm:rounded-none self-end sm:self-auto border-l border-border animate-in slide-in-from-right duration-200"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-background/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-soft-green text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-ink">Learn &amp; Master</h2>
              <p className="text-xs text-muted truncate max-w-[260px] sm:max-w-sm">
                {question.prompt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close learn panel"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-soft-green hover:text-ink focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Tabs Navigation ─── */}
        <div
          role="tablist"
          aria-label="Learn panel tabs"
          className="flex border-b border-border bg-paper px-4 pt-2 gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tutor'}
            onClick={() => setActiveTab('tutor')}
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              activeTab === 'tutor'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Socratic Tutor
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'videos'}
            onClick={() => setActiveTab('videos')}
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              activeTab === 'videos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Video className="h-4 w-4" />
            Curated Videos
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cheatsheet'}
            onClick={() => setActiveTab('cheatsheet')}
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              activeTab === 'cheatsheet'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <FileText className="h-4 w-4" />
            Cheat Sheet
          </button>
        </div>

        {/* ─── Tab Content ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: Socratic Tutor Chat */}
          {activeTab === 'tutor' && (
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-3 pb-4">
                {/* Initial Welcome Message */}
                <div className="rounded-xl border border-border bg-soft-green/30 p-3.5 text-xs text-ink">
                  <div className="flex items-center gap-2 font-semibold text-primary mb-1">
                    <Sparkles className="h-4 w-4" />
                    <span>DSA Interview Tutor</span>
                  </div>
                  <p>
                    Stuck on this question? I can give you a quick conceptual hint, walk you through step-by-step, or provide the complete solution when you ask.
                  </p>
                </div>

                {/* Quick Prompts */}
                {messages.length === 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Quick questions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Can you give me a conceptual hint?')}
                        className="rounded-lg border border-border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-soft-green focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                      >
                        💡 Give me a hint
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Walk me through the approach step-by-step.')}
                        className="rounded-lg border border-border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-soft-green focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                      >
                        🪜 Step-by-step walkthrough
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Show me the full solution and code explanation.')}
                        className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                      >
                        ⚡ Show full solution
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Bubbles */}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      m.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-primary text-paper rounded-br-none'
                          : 'bg-background border border-border text-ink rounded-bl-none shadow-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoadingReply && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted w-fit">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Thinking…</span>
                  </div>
                )}

                {/* Fallback Notice */}
                {tutorSource === 'fallback' && (
                  <p className="text-xs text-muted italic text-center">
                    Tutor responded using offline reference baseline.
                  </p>
                )}

                {/* Error Banner with Retry */}
                {errorMsg && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                    {lastSentMessage && (
                      <button
                        type="button"
                        onClick={() => handleSendMessage(lastSentMessage)}
                        disabled={isLoadingReply}
                        className="inline-flex items-center gap-1 rounded-lg bg-coral text-paper px-2.5 py-1 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input & Full Solution Action */}
              <div className="pt-2 border-t border-border mt-auto">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Please show the complete solution and reference code.')}
                    disabled={isLoadingReply}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Show full solution
                  </button>
                  <span className="text-xs text-muted">
                    {inputMessage.length}/1000
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask a question or request a hint…"
                    maxLength={1000}
                    disabled={isLoadingReply}
                    className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-ink placeholder-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isLoadingReply}
                    aria-label="Send message to tutor"
                    className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-primary px-4 text-paper hover:opacity-90 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-opacity"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Curated Videos */}
          {activeTab === 'videos' && (
            <div className="space-y-4">
              {isResourceLoading ? (
                <div className="py-12 text-center text-xs text-muted">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                  Loading videos…
                </div>
              ) : isResourceError ? (
                <div className="rounded-xl border border-coral/30 bg-coral/10 p-4 text-center text-xs text-coral">
                  <p>Could not load video resources.</p>
                  <button
                    type="button"
                    onClick={() => refetchResources()}
                    className="mt-2 text-xs font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              ) : videos.length > 0 ? (
                <div className="space-y-4">
                  {videos.map((vid) => (
                    <div
                      key={vid.youtube_id}
                      className="overflow-hidden rounded-xl border border-border bg-paper shadow-sm"
                    >
                      <div className="aspect-video w-full">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${vid.youtube_id}`}
                          title={vid.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full border-0"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-bold text-ink">{vid.title}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background p-6 text-center space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-soft-green text-primary">
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Curated Videos Coming Soon</h4>
                    <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                      Verified tutorial videos are currently being curated for this topic. You can explore relevant video tutorials on YouTube right now:
                    </p>
                  </div>
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-paper hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-opacity"
                  >
                    <span>Search &ldquo;{topicName}&rdquo; tutorials on YouTube</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Cheat Sheet */}
          {activeTab === 'cheatsheet' && (
            <div className="space-y-3">
              {isResourceLoading ? (
                <div className="py-12 text-center text-xs text-muted">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                  Loading cheat sheet…
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-heading text-sm font-bold text-ink">
                      {topicName} Cheat Sheet &amp; Patterns
                    </h3>
                  </div>
                  <div className="prose prose-xs text-xs text-ink leading-relaxed whitespace-pre-wrap font-sans">
                    {cheatSheet}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Bottom Action: Try the Question Again ─── */}
        <div className="border-t border-border bg-background/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted flex items-center gap-1.5 text-center sm:text-left">
            <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Retrying updates mastery at 50% weight to build confidence.</span>
          </div>

          <button
            type="button"
            onClick={handleTryAgainClick}
            disabled={isMarkingLearned}
            className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-xs font-bold text-primary shadow-sm hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all whitespace-nowrap"
          >
            {isMarkingLearned ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span>Try the question again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
