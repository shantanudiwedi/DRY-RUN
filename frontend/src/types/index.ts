export interface RubricScores {
  correctness: number;
  approach: number;
  complexity: number;
  edge_cases: number;
  communication: number;
}

export interface QuestionExample {
  input: string;
  output: string;
  explanation?: string;
}

export type TopicName =
  | 'Arrays'
  | 'Strings'
  | 'Linked lists'
  | 'Trees'
  | 'Graphs'
  | 'Dynamic programming';

export type DifficultyLevel = 'Foundations' | 'Intermediate' | 'Advanced';
export type SessionDifficulty = 'Adaptive' | DifficultyLevel;
export type QuestionType = 'concept' | 'coding';
export type SessionMode = 'viva' | 'code';
export type SessionStatus = 'active' | 'finished' | 'expired';
export type TurnKind = 'viva' | 'code' | 'follow_up' | 'learn';
export type EvaluationSource = 'llm' | 'fallback';

export interface Question {
  id: string;
  topic: TopicName | string;
  difficulty: DifficultyLevel;
  type: QuestionType;
  prompt: string;
  follow_up: string;
  tags: string[];
  reference_answer: string;
  examples?: QuestionExample[];
  constraints?: string[];
}

export interface VideoResource {
  youtube_id: string;
  title: string;
}

export interface TopicResource {
  videos: VideoResource[];
  cheat_sheet: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorChatRequest {
  question_id: string;
  messages?: ChatMessage[];
  message: string;
}

export interface TutorChatResponse {
  reply: string;
  source: EvaluationSource;
  messages_count: number;
}

export interface MarkLearnedRequest {
  question_id: string;
}

export interface MarkLearnedResponse {
  status: string;
  learned_question_ids: string[];
}

export interface Session {
  id: string;
  device_id: string;
  topic: TopicName | string;
  mode: SessionMode;
  difficulty: SessionDifficulty;
  duration_seconds: number;
  status: SessionStatus;
  started_at: string;
  finished_at?: string | null;
  asked_question_ids: string[];
  learned_question_ids: string[];
  learn_messages_count?: number;
}

export interface SessionCreate {
  topic: string;
  mode?: SessionMode;
  difficulty?: SessionDifficulty;
  duration_seconds?: 600 | 1200 | 1800;
}

export interface SessionResponse {
  session: Session;
  question: Question;
}

export interface Turn {
  id: string;
  session_id: string;
  device_id: string;
  question_id: string;
  kind: TurnKind;
  answer?: string | null;
  code?: string | null;
  language?: string | null;
  scores?: RubricScores | null;
  note?: string | null;
  source: EvaluationSource;
  follow_ups?: string[] | null;
  code_turn_id?: string | null;
  created_at: string;
}

export interface TurnCreate {
  question_id: string;
  kind?: TurnKind;
  answer: string;
  code_turn_id?: string | null;
}

export type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp';

export interface CodeSubmissionCreate {
  question_id: string;
  language: SupportedLanguage;
  code: string;
}

export interface CodeSubmissionResponse {
  turn: Turn;
  follow_ups: string[];
}

export interface TurnResponse {
  turn: Turn;
  next_question?: Question | null;
  follow_up?: string | null;
  session_status: SessionStatus;
}

export interface Report {
  id: string;
  session_id: string;
  device_id: string;
  topic: string;
  mode: string;
  overall?: number | null;
  dimensions?: RubricScores | null;
  code_score?: number | null;
  viva_score?: number | null;
  weak_topics: string[];
  coach_note: string;
  coach_note_source: EvaluationSource;
  questions_asked: string[];
  learned: string[];
  created_at: string;
}

export interface ReportListItem {
  id: string;
  session_id: string;
  topic: string;
  mode: string;
  overall?: number | null;
  created_at: string;
  duration_seconds: number;
  turns_count: number;
}

export interface ReportDetailResponse {
  report: Report;
  session: Session;
  turns: Turn[];
  questions: Question[];
}

export interface Mastery {
  device_id: string;
  topic: TopicName | string;
  score: number;
  updated_at: string;
}

export interface TopicProgress {
  topic: TopicName | string;
  mastery_score: number;
  weekly_scores: number[];
  practice_count: number;
}

export interface ProgressResponse {
  topics: TopicProgress[];
  least_practiced_topic: string;
  weakest_topic: string;
}

export interface QuestionsResponse {
  topics: string[];
  total: number;
  questions: Question[];
}
