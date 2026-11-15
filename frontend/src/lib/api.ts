import { getDeviceId } from './device';
import type {
  QuestionsResponse,
  Question,
  TopicResource,
  SessionCreate,
  SessionResponse,
  TurnCreate,
  TurnResponse,
  CodeSubmissionCreate,
  CodeSubmissionResponse,
  Report,
  ReportListItem,
  ReportDetailResponse,
  TutorChatRequest,
  TutorChatResponse,
  MarkLearnedResponse,
  ProgressResponse,
} from '@/types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('X-Device-Id', getDeviceId());
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    let data: unknown;
    try {
      data = await response.json();
      if (typeof data === 'object' && data !== null && 'detail' in data) {
        errorDetail = String((data as { detail: unknown }).detail);
      }
    } catch {
      // not json
    }
    throw new ApiError(response.status, errorDetail, data);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<{ status: string; app: string }>('/health'),

  getQuestions: (params?: { topic?: string; difficulty?: string; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.topic) searchParams.set('topic', params.topic);
    if (params?.difficulty) searchParams.set('difficulty', params.difficulty);
    if (params?.type) searchParams.set('type', params.type);

    const qs = searchParams.toString();
    return request<QuestionsResponse>(`/questions${qs ? `?${qs}` : ''}`);
  },

  getQuestion: (id: string) => request<Question>(`/questions/${id}`),

  getResources: (topic?: string) => {
    const qs = topic ? `?topic=${encodeURIComponent(topic)}` : '';
    return request<TopicResource | Record<string, TopicResource>>(`/resources${qs}`);
  },

  createSession: (payload: SessionCreate) =>
    request<SessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSession: (id: string) => request<SessionResponse>(`/sessions/${id}`),

  submitTurn: (sessionId: string, payload: TurnCreate) =>
    request<TurnResponse>(`/sessions/${sessionId}/turn`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitCode: (sessionId: string, payload: CodeSubmissionCreate) =>
    request<CodeSubmissionResponse>(`/sessions/${sessionId}/code`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  tutorChat: (sessionId: string, payload: TutorChatRequest) =>
    request<TutorChatResponse>(`/sessions/${sessionId}/learn`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markLearned: (sessionId: string, questionId: string) =>
    request<MarkLearnedResponse>(`/sessions/${sessionId}/learned`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId }),
    }),

  finishSession: (sessionId: string) =>
    request<Report>(`/sessions/${sessionId}/finish`, {
      method: 'POST',
    }),

  endSession: (sessionId: string) =>
    request<Report>(`/sessions/${sessionId}/end`, {
      method: 'POST',
    }),

  getReports: () => request<ReportListItem[]>('/reports'),

  getReportDetail: (id: string) => request<ReportDetailResponse>(`/reports/${id}`),

  deleteReport: (id: string) =>
    request<{ status: string; deleted_report_id: string }>(`/reports/${id}`, {
      method: 'DELETE',
    }),

  getProgress: () => request<ProgressResponse>('/progress'),
};
