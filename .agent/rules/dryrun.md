# Dryrun Workspace Rule & Master Constraints

This project builds Dryrun from scratch following `DRYRUN_BRIEF.md`.

## Strict Security and Operational Rules
1. **Never read, print, log, or commit `backend/.env`**.
2. **Device ID scoping**: Every request uses `X-Device-Id`. All user data is anonymous and scoped by device ID.
3. **No Fake Numbers**: All report scores, dimensions, and feedback must be real and derived server-side from actual turns and rubric evaluations.
4. **Source Attribution**: Every evaluation must explicitly state its source: `"llm"` or `"fallback"`. Fallback evaluation must never score based on answer length or keywords.
5. **No Hallucinated Video URLs**: Curated video links must come strictly from the curated JSON resources file or a fallback YouTube search query based on the question title.
6. **No Raw Audio Storage**: Store only transcripts and text. Never store raw audio.
7. **Strict Cascade Deletion**: Deleting a report must cascade delete its session, turns, and report data simultaneously.
8. **Code Conventions**:
   - Backend imports: `from lib.x import y` (run from `backend/`).
   - Every Pydantic model must have a mirrored TypeScript interface updated in lockstep.
   - Strict TypeScript (`strict: true`), use `import type`.
   - UTC datetimes stored and normalized on read.
   - Shared MongoDB client in `lib/db.py`, query indexes created proactively.
   - Every frontend page must render its shell even if backend fetch fails.
9. **Milestone Workflow**: Work one milestone at a time, show a diff summary, run section 15 checks, and wait for user approval before moving to the next.
