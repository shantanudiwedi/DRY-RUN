# Dryrun: Master Build Brief for Antigravity
Version 1.0. Author: Shantanu Diwedi. Purpose: one document that tells an AI coding agent everything needed to build Dryrun from scratch.

## 0. How to use this document
1. Open the project folder in Antigravity. Save this document as Markdown in the project root and also as a workspace rule (for example `.agent/rules/dryrun.md`).
2. Create `backend/.env` yourself with `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `GROQ_API_KEY`, `GEMINI_API_KEY`. The agent must never read, print or commit this file.
3. First message to the agent: "Read DRYRUN_BRIEF.md fully. Show a plan with milestones. Do not write code until I approve."
4. Then build one milestone at a time (section 14). After each milestone the agent shows a diff summary, runs the checks in section 15, and waits for approval.

---

## 1. Product summary
Dryrun is an AI mock technical interview for Indian college students preparing for internships and placements. The first subject is Data Structures and Algorithms. The student practises out loud (a voice viva) or by writing code and then defending it. The AI listens, asks follow-ups, adapts difficulty, and gives an honest rubric-based report. If the student is stuck, a Learn panel teaches the concept without leaving the app.

The name comes from "dry run": tracing code by hand before it runs. Dryrun is the rehearsal before the real interview. (Formerly named Altiora.)

---

## 2. Problem and users
- Students solve problems silently on coding sites, but real interviews require explaining thinking out loud and handling follow-ups.
- Mock interviews with seniors are hard to arrange and inconsistent.
- Existing tools check whether code passes, not whether the student understands.

**Primary users:** B.Tech, BCA and MCA students (years 2 to 4) in India. Later: bootcamp learners, early-career developers, college placement cells.

---

## 3. Goals and non-goals

### Goals
- On-demand viva in under a minute, in two modes: Viva only, and Code plus viva.
- Real adaptivity: the next question changes with how the student performs.
- Honest evaluation: scores come from a rubric applied to the actual answer, never from answer length or keywords.
- Learn without leaving: tutor chat, curated videos and a cheat sheet inside the session.
- Calm, clean UI that lowers interview anxiety.

### Non-goals for v1
- No real code execution sandbox (optional later via Judge0).
- No system design, HR or aptitude rounds.
- No video interviews or proctoring.
- No login. The app is open, single-browser practice mode, with data scoped to an anonymous device id.
- No paid APIs.

---

## 4. Existing prototype: what to reuse and what to avoid
An earlier prototype was generated on Emergent (FastAPI + MongoDB backend, Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui frontend). It is about 40 percent correct. This is a fresh build, but keep its good parts.

### Keep
- Flow: `/` to `/setup` to `/viva/:id` to `/report/:id`, plus `/history`.
- Browser speech recognition with `en-IN`, with typed answers as a fallback.
- The visual design (section 11).
- The idea of a curated question bank with prompt, follow-up and tags.

### Bugs and fakes found in the prototype. Do not repeat them
1. Report numbers were fake: every dimension was derived from one average (avg + 4, avg - 6) and "Pace" was always 82.
2. Fallback scoring counted keywords and answer length. A long answer scored high even when wrong. The user was never told when the real AI was not used.
3. Turns had no session_id, so transcripts could not be linked to a session.
4. "Surprise me" returned the same first question again and again, and the first question of every session was always the first item in the pool.
5. Topics with one question looped on the same question.
6. Adaptation was only a text label. Difficulty and mastery were never used.
7. The bank's follow-up questions were never asked.
8. Duration and elapsed time were accepted but ignored.
9. Deleting a report left the answers (turns) behind, and reports were visible to everyone.
10. It depended on Emergent's own LLM key and a paid model. Not allowed here.
11. Possible missing catch-all route (any unknown URL rendered a blank page).

---

## 5. Features

### 5.1 Setup
Topic (Surprise me, Arrays, Strings, Linked lists, Trees, Graphs, Dynamic programming), length (10, 20, 30 minutes), difficulty (Adaptive, Foundations, Intermediate, Advanced), mode toggle (Viva only, Code plus viva), and a mic check.

### 5.2 Viva mode
- The interviewer shows each question as text and speaks it (browser SpeechSynthesis, with a mute toggle).
- The student answers by voice (browser SpeechRecognition `en-IN`, live transcript) or by typing.
- Buttons: Repeat, Hint, End, and "I don't know, teach me".
- If an answer is vague or incomplete, the interviewer asks a follow-up before moving on. Use the question's follow_up field or generate one.
- A session timer is shown, and the duration is enforced server-side.

### 5.3 Code mode
- A coding problem is shown (statement, examples, constraints).
- The student writes a solution in an in-browser editor (CodeMirror 6, bundled, no CDN). Languages: Python, JavaScript, Java, C++.
- On Submit, the LLM reviews the code without executing it: correctness reasoning, complexity, edge cases.
- The interviewer then asks 2 to 3 follow-up questions about the student's own code (for example the complexity of a specific loop, or what happens on an empty input). The student answers by voice or text.
- The report shows a code score and a viva score separately.
- Later (optional): Judge0 for real test cases.

### 5.4 Learn panel ("I don't know, teach me")
Opens beside the question without leaving the session.
1. AI tutor chat: explains simply, step by step. Order: hint first, then a walkthrough, then the full solution only if the student asks.
2. Curated videos: from a JSON file (topic, youtube_id, title) maintained by hand. The LLM must never invent URLs. If no curated video exists, show a YouTube search link built from the question title.
3. Cheat sheet: a short written summary for the topic.
4. Try again: returns to the same question. The report marks the question as "learned".

### 5.5 Evaluation
Rubric scores from 0 to 100: correctness, approach, complexity, edge cases, communication, plus a short note. Evaluate the quality of the explanation only, never accent or phrasing. Every evaluation response includes source: "llm" | "fallback". When the fallback is used, the UI shows a small notice so the student knows it was not model-evaluated. The fallback must not use answer length as a proxy for quality.

### 5.6 Adaptivity
Per device and per topic, keep a mastery score (start simple, Elo-style). Raise difficulty after strong answers. After repeated struggles, step down or offer a hint. Never repeat a question within a session. "Surprise me" picks across topics, weighted towards weaker topics.

### 5.7 Report
Built server-side from stored turns only. No hardcoded numbers and no client-supplied scores. Contents: overall score, per-dimension bars, code score and viva score (Code mode), weak topics, coach note, "learned" questions, next-practice banner, transcript accordion, delete button.

### 5.8 History and Progress
History: stat cards and a list of past sessions. Progress: a topic by week heatmap of mastery.

### 5.9 Privacy
- Never store raw audio. Store transcripts only.
- Everything is scoped by an anonymous device_id (random id in localStorage).
- Deleting a report deletes its session, turns and report together.
- Do not send sensitive personal data to free-tier LLM providers (free tiers may use data to improve models).

---

## 6. Tech stack (free only)

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Frontend | Vite, React 19, TypeScript strict, Tailwind v4, shadcn/ui, react-router-dom, TanStack Query | Use useQuery and useMutation, not fetch-in-effect |
| Editor | CodeMirror 6 | Bundled |
| Backend | FastAPI, motor (async MongoDB), Pydantic v2 | All routes under `APIRouter(prefix="/api")` |
| Database | MongoDB (local or free Atlas) | String uuid4 ids, never ObjectId |
| Live interviewer LLM | Groq, Llama 8B | Fast turns, higher daily limits |
| Evaluation and report LLM | Gemini Flash (Google AI Studio free tier) | Large context |
| LLM client | One OpenAI-compatible client with a fallback chain | If one provider rate-limits, use the next |
| Speech to text | Browser SpeechRecognition `en-IN`; optional Groq Whisper later | Typed fallback always available |
| Text to speech | Browser SpeechSynthesis | Open-source Piper or Kokoro later |
| Hosting (later) | Free tiers, Mumbai region where possible | Verify limits at signup |

### Free-tier reality
The Groq 70B free limit is roughly 100,000 tokens per day, and the 8B model roughly 500,000 per day. A 20 minute viva is roughly 30,000 tokens. Log token usage per session so limits are visible.

### Code conventions
- Import with `from lib.x import y` inside the backend (uvicorn runs from `backend/`).
- Every Pydantic model has a mirrored TypeScript interface, updated in the same edit.
- Use `import type` for types. Keep `strict: true`.
- Datetimes: store aware UTC, normalise on read.
- Every page renders its shell even if a fetch fails (no blank pages on errors).
- One shared Mongo client in `lib/db.py`. Add an index with every new query.

---

## 7. Data model
- **Session:** `id`, `device_id`, `topic`, `mode` (viva | code), `difficulty`, `duration_seconds`, `status` (active | finished | expired), `started_at`, `finished_at`, `asked_question_ids`, `learned_question_ids`.
- **Turn:** `id`, `session_id`, `device_id`, `question_id`, `kind` (viva | code | follow_up | learn), `answer`, `code`, `language`, `scores` (`correctness`, `approach`, `complexity`, `edge_cases`, `communication`), `note`, `source` (llm | fallback), `created_at`.
- **Report:** `session_id`, `device_id`, `overall`, `dimensions`, `code_score`, `viva_score`, `weak_topics`, `coach_note`, `learned`, `created_at`.
- **Mastery:** `device_id`, `topic`, `score`, `updated_at`.
- **Question bank** (JSON or collection): `id`, `topic`, `difficulty`, `type` (concept | coding), `prompt`, `follow_up`, `tags`, `reference_answer`, and for coding problems `examples`, `constraints`.
- **Resources JSON:** per topic, a list of `{ youtube_id, title }`, plus the cheat sheet text.

**Indexes:**
- sessions by `(device_id, started_at)`
- turns by `(session_id, created_at)`
- reports by `(device_id, created_at)`
- mastery by `(device_id, topic)` unique.

---

## 8. API (all under `/api`)

| Method & Path | Purpose |
| :--- | :--- |
| `GET /questions` | Topics and question metadata |
| `POST /sessions` | Create a session; returns the first question |
| `POST /sessions/{id}/turn` | Submit an answer; returns rubric feedback, follow-up or next question, source |
| `POST /sessions/{id}/code` | Submit code; returns review and follow-up questions |
| `POST /sessions/{id}/learn` | Tutor chat message; returns reply |
| `POST /sessions/{id}/finish` | Finish and build the report server-side |
| `GET /reports` & `GET /reports/{id}` | List and read reports (scoped by device id) |
| `DELETE /reports/{id}` | Cascade delete of session, turns, report |
| `GET /progress` | Heatmap data |
| `GET /resources?topic=` | Curated videos and cheat sheet |

*Send the device id in a header (for example `X-Device-Id`) on every request. Validate every id returned by the LLM against the question bank before trusting it. Return 422-style errors for bad input, and test one negative case per route.*

---

## 9. LLM prompting rules
- The interviewer persona is calm, fair and encouraging. It never mocks, and it gives hints on request.
- Ask for JSON only, validate it against a schema, retry once on invalid JSON, then fall back (and mark `source: "fallback"`).
- Evaluation input: the question, the reference answer, the student's answer and the rubric. Output: five integer scores and a note of at most two sentences.
- Code review: the model reasons about correctness and complexity and never claims to have executed the code.
- Tutor chat: hint, then walkthrough, then full solution only on request. Keep replies short.
- Never let the model produce URLs. Videos come only from the curated JSON.

---

## 10. Screens
- **Home:** two-column hero (headline, subtext, Start button) with a live-preview panel (waveform, interviewer card, sample question), a trust line, and a topic strip.
- **Setup:** one card with topic tiles, segmented controls for length, difficulty and mode, and a mic check row.
- **Viva:** left side panel (topic, difficulty, turn count, tip). Main area: interviewer state with a pulsing avatar, large question, follow-up with a left border, answer box with mic button and send. A Learn panel slides in beside the question. In Code mode, an editor replaces the answer box.
- **Report:** score circle, two-column metric cards, coach note, dark-green next-practice banner, transcript accordion, delete.
- **History:** three stat cards and a list.
- **Progress:** topic by week heatmap and a next-up card.

**Routes:** `/`, `/setup`, `/viva/:id`, `/report/:id`, `/history`, `/progress`, and a catch-all `*` that redirects to `/`.

---

## 11. Design system
Calm, light, clean and smooth, based on the prototype.
- **Colours:** background `#f5f5f1`, ink `#1b2722`, primary `#1c4435`, lime accent `#d7ec7b`, paper `#fbfcf8`, border `#dfe4dc`, muted `#718078`, coral `#e48770`, soft greens `#e5efd8` and `#d9e9c9`.
- **Fonts:** Space Grotesk for headings (weight 500, tight tracking), DM Sans for body. Use the `@fontsource-variable` packages, not Google Fonts imports.
- **Shapes:** radius 5 to 12 px, 1 px borders, tiny uppercase tracked labels, avatars with one sharp corner, soft shadows, a slight tilt on the hero panel, subtle motion on hover and between steps.
- **Improvements over prototype:** minimum text size 12 px, stronger contrast on muted greys, visible focus rings, 44 px touch targets on mobile, real button and label elements, aria-label on icon-only buttons, no emoji, responsive at 800 px.

---

## 12. Antigravity setup: using its custom features
- **Rules and workflows:** save key points in `.agent/rules/dryrun.md`.
- **MCP servers:** inspect collections, docs lookup, GitHub integration.
- **Browser agent:** open http://localhost:3000 (or Vite port), walk core flow, screenshots for UI validation.
- **Artifacts:** Plan artifact before coding, Walkthrough after each milestone.
- **Terminal policy:** dev servers, pytest, typecheck, lint. Do not touch or read `backend/.env`.

---

## 13. Free-tier and cost controls
- Log tokens per request and per session.
- Route cheap tasks (live turns, tutor chat) to the 8B model and heavy tasks (final report, code review) to Gemini Flash.
- Cap each session by duration and by number of turns.
- Cache tutor explanations per question where the answer does not depend on the student.
- When a provider returns a rate-limit error, switch down the fallback chain and mark source.

---

## 14. Milestones
1. **Foundation:** project scaffold, MongoDB connection, shared client, device id header, question bank (at least 6 questions per topic across three levels, plus at least 3 coding problems per topic), curated resources file. Check: backend imports, `/api/questions` works.
2. **Core viva:** setup page, sessions, turns tied to session_id, no repeated questions, voice in and out, typed fallback, timer, follow-ups, rubric evaluation with source. Check: a full 5 turn session without repeats.
3. **Report and history:** server-side report, history page, delete cascade. Check: deleting a report leaves no turns.
4. **Adaptivity and progress:** mastery scores, difficulty selection, `/progress` heatmap. Check: strong answers raise difficulty, weak ones lower it.
5. **Code mode:** editor, code review, follow-ups about the student's code, separate code and viva scores.
6. **Learn panel:** tutor chat, curated videos with search fallback, cheat sheet, "try again", "learned" marker.
7. **Polish:** responsive pass at 800 px, accessibility pass, catch-all route, empty and error states, loading states.

---

## 15. Definition of done and checks
Run once per milestone and once more at the end:
- `cd frontend && yarn typecheck` (or `npm run typecheck` / build mode) and `yarn lint`.
- `cd backend && python -c 'import server' && pytest`.
- A curl smoke test of the key routes, asserting status and a response field, plus one negative case per route.
- One browser pass through `/`, `/setup`, `/viva/:id`, `/report/:id` in both modes, using the browser agent.
- Confirm that no raw audio is stored, that delete cascades, and that the app still shows a useful page when the backend is down.
- Update `memory/SPEC.md` with final routes, seed facts and any test notes.
