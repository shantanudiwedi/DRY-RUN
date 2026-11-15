# Dryrun Specification & Living State (memory/SPEC.md)

## 1. Project Overview
- **Product:** Dryrun — AI Mock Technical Interview for Indian College Students (DSA viva & coding defense).
- **Architecture:**
  - Frontend: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + TanStack Query + CodeMirror 6.
  - Backend: FastAPI + Motor (Async MongoDB) + Pydantic v2.
  - Database: MongoDB Atlas with UUIDv4 string IDs.
  - Interviewer LLM: Groq Llama-3.1-8B (fast live turns, code review, Socratic tutor).
  - Evaluator LLM: Gemini 1.5 Flash (fallback for rubric evaluation, code review, tutor).
  - Deterministic Offline Fallbacks: Active when LLMs or network are unavailable (zero length/keyword bias).
  - Device Isolation: Anonymous device scoping via `X-Device-Id` header (stored in localStorage).

---

## 2. Complete API Routes (Prefix: `/api`)

All routes require `X-Device-Id` header except public read-only questions/health endpoints. Cross-device access returns `404 Not Found`.

| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health status probe | Active |
| `GET` | `/questions` | List questions with optional `topic`, `difficulty`, `type` filters | Active |
| `GET` | `/questions/{id}` | Retrieve single question by ID | Active |
| `GET` | `/resources` | Retrieve topic cheat sheet and curated videos | Active |
| `POST` | `/sessions` | Create interview session (viva or code mode, adaptive or fixed difficulty) | Active |
| `GET` | `/sessions/{id}` | Get session details and active question | Active |
| `POST` | `/sessions/{id}/turn` | Submit viva answer (voice/text), evaluate rubric, return feedback & next Q / follow-up | Active |
| `POST` | `/sessions/{id}/code` | Submit code (Python, JS, Java, C++), non-executing review, return follow-ups | Active |
| `POST` | `/sessions/{id}/learn` | Socratic tutor chat (hints, step-by-step, full solution; capped at 20 msgs) | Active |
| `POST` | `/sessions/{id}/learned` | Mark question as learned during session (idempotent; 50% mastery retry) | Active |
| `POST` | `/sessions/{id}/finish` | Compute rubric report from stored turns, mark finished, generate coach note | Active |
| `POST` | `/sessions/{id}/end` | Early termination helper calling finish | Active |
| `GET` | `/reports` | List past reports for device (overall, topic, date, mode, turns) | Active |
| `GET` | `/reports/{id}` | Detailed report with score circle, rubric dimensions, transcript accordion | Active |
| `DELETE` | `/reports/{id}` | Atomic cascade delete of report, session, turns, and session learn data | Active |
| `GET` | `/progress` | Topic mastery scores, 4-week practice heatmap, weakest/least practiced topic | Active |

---

## 3. Seed Facts & Data Models

### Topics Supported (6 Core DSA Topics)
1. Arrays
2. Strings
3. Linked lists
4. Trees
5. Graphs
6. Dynamic programming

### Question Bank (`backend/data/questions.json`)
- **Total Questions:** 54 questions
  - 36 Concept Questions (6 per topic across Foundations, Intermediate, Advanced)
  - 18 Coding Problems (3 per topic across Foundations, Intermediate, Advanced)
- **Fields:** `id`, `topic`, `difficulty`, `type`, `prompt`, `follow_up`, `tags`, `reference_answer`, `examples` (coding), `constraints` (coding).

### Resources (`backend/data/resources.json`)
- Video list per topic is initialized to `[]` per specification (verified 11-char YouTube IDs validated upon addition).
- Comprehensive cheat sheets with complexities, core patterns, and watchouts for all 6 topics.

### Database Models (`backend/lib/models.py` & `frontend/src/types/index.ts`)
- `Session`: UUIDv4 `id`, `device_id`, `topic`, `mode` (`viva` \| `code`), `difficulty`, `duration_seconds`, `status` (`active` \| `finished` \| `expired`), `started_at`, `finished_at`, `asked_question_ids`, `learned_question_ids`, `learn_messages_count`.
- `Turn`: UUIDv4 `id`, `session_id`, `device_id`, `question_id`, `kind` (`viva` \| `code` \| `follow_up` \| `learn`), `answer`, `code`, `language`, `scores` (`RubricScores`), `note`, `source` (`llm` \| `fallback`), `follow_ups`, `created_at`.
- `Report`: UUIDv4 `id`, `session_id`, `device_id`, `overall`, `dimensions`, `code_score`, `viva_score`, `weak_topics`, `coach_note`, `coach_note_source`, `questions_asked`, `learned`, `created_at`.
- `Mastery`: `device_id`, `topic`, `score` (0-100), `updated_at`.
- `TopicProgress`: `topic`, `mastery_score`, `weekly_scores` (4 weeks), `practice_count`.
- `ProgressResponse`: `topics`, `least_practiced_topic`, `weakest_topic`.
- `TutorChatRequest`: `question_id`, `messages` (max 6), `message` (max 1000 chars).
- `TutorChatResponse`: `reply` (URL-free), `source`, `messages_count`.
- `MarkLearnedRequest`: `question_id`.
- `MarkLearnedResponse`: `status`, `learned_question_ids`.

### Database Indexes (`lib/db.py`)
- `sessions`: `(device_id, started_at)` and `(id)` unique
- `turns`: `(session_id, created_at)` and `(device_id, session_id)`
- `reports`: `(device_id, created_at)`, `(session_id)` unique, and `(id)` unique
- `mastery`: `(device_id, topic)` unique

---

## 4. Privacy & Safety Guarantees
- Zero raw audio stored (transcripts only).
- Never logs keys, tokens, full conversations, or full student submissions.
- Cascade deletion ensures deleting a report deletes the underlying session and all turns.
- Rate-limit and offline fallbacks ensure 100% operational resilience.
