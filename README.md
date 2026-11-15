# Dryrun - AI Mock Technical Interview Platform for DSA

Dryrun is an AI-powered technical interview preparation application specifically designed for Indian engineering students (B.Tech, BCA, MCA) to practice explaining and defending Data Structures and Algorithms (DSA) out loud.

---

## Key Features

1. **Dual Interview Modes**:
   - **Viva Only**: Voice-driven conceptual explanation using browser SpeechRecognition (`en-IN`) and SpeechSynthesis, with typed fallbacks.
   - **Code + Viva**: Bundled CodeMirror 6 editor (Python, JavaScript, Java, C++) with instant structural AI code review followed by interactive follow-up viva questions defending complexity and boundary cases.
2. **Pedagogical Evaluation**:
   - 5-dimension rubric scoring: Correctness, Approach, Complexity, Edge Cases, Communication (0-100%).
   - Evaluated by Groq Llama 8B with Gemini Flash fallback and deterministic offline baselines. Zero keyword/length bias.
3. **Adaptive Difficulty & Elo Mastery**:
   - Dynamically calibrates question difficulty (Foundations, Intermediate, Advanced) based on student performance.
   - 4-week topic activity and mastery heatmap on `/progress` with accessible alternatives.
4. **Learn & Socratic Tutor Panel**:
   - Slide-over panel (bottom sheet on mobile) offering guided Socratic hints, step-by-step walkthroughs, topic cheat sheets, curated video tutorials, and half-weighted retry calibration.
5. **Privacy by Design**:
   - Anonymous device-scoped sessions via `X-Device-Id`.
   - Zero raw audio stored (transcripts only).
   - Atomic cascade deletion for sessions, turns, and reports.

---

## Project Structure

```
DRY RUN/
├── backend/
│   ├── data/
│   │   ├── questions.json     # 54 DSA questions (36 viva + 18 coding)
│   │   └── resources.json     # Topic cheat sheets & video resources
│   ├── lib/
│   │   ├── auth.py            # Device-ID header validation
│   │   ├── config.py          # Environment settings
│   │   ├── db.py              # Motor MongoDB client & indexes
│   │   ├── evaluator.py       # Groq/Gemini/Fallback rubric evaluation & tutor
│   │   ├── mastery.py         # Elo mastery & difficulty adaptation
│   │   ├── models.py          # Pydantic v2 schemas
│   │   └── questions.py       # Question bank loader & selectors
│   ├── routers/
│   │   ├── questions.py       # Questions & resources endpoints
│   │   ├── sessions.py        # Sessions, turns, code submissions, learn
│   │   ├── reports.py         # Performance reports & cascade delete
│   │   └── progress.py        # Mastery progress & 4-week heatmap
│   ├── server.py              # FastAPI application entrypoint
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/        # Navbar, LearnPanel
│   │   ├── pages/             # Home, Setup, Viva, Report, History, Progress
│   │   ├── lib/               # API client, device ID management
│   │   └── types/             # Mirrored TypeScript interfaces
│   └── package.json           # React 19, Tailwind v4, CodeMirror 6, TanStack Query
└── memory/
    └── SPEC.md                # System specification & API contracts
```

---

## Setup & Installation

### 1. Prerequisites
- **Node.js**: v18+ and **Yarn** v1.22+
- **Python**: v3.11+
- **MongoDB**: MongoDB Atlas connection string (or local MongoDB 6+)

---

### 2. Backend Setup

1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create the `backend/.env` configuration file with the following variables:
   ```env
   MONGO_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=dryrun_db
   GROQ_API_KEY=<your_groq_api_key>
   GEMINI_API_KEY=<your_gemini_api_key>
   CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
   ```
   *(Note: Both LLM keys are optional for offline baselines; if omitted or rate-limited, deterministic fallbacks will be used automatically).*

5. Start the backend server on port 8001:
   ```bash
   uvicorn server:app --host 127.0.0.1 --port 8001 --reload
   ```
   Health check: `http://127.0.0.1:8001/api/health`

---

### 3. Frontend Setup

1. Open a separate terminal and navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start the development server on port 3000:
   ```bash
   yarn dev --host 127.0.0.1 --port 3000
   ```
   Open your browser to `http://localhost:3000`.

---

## Verification & Testing

### Running Frontend Checks
```bash
cd frontend
yarn typecheck   # TypeScript strict type checking
yarn lint        # ESLint check
yarn build       # Production build bundle check
```

### Running Backend Unit & Integration Tests
```bash
cd backend
.\venv\Scripts\pytest -v
```

---

## Supported Browsers & Voice
- **Chrome / Edge / Chromium**: Full speech recognition (`en-IN`) and speech synthesis supported.
- **Firefox / Safari**: Speech recognition is automatically detected as unsupported; students can seamlessly use the built-in typed explanation box without loss of functionality.
