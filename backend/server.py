import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from lib.config import settings
from lib.db import init_db, close_db
from routers.questions import router as questions_router
from routers.sessions import router as sessions_router
from routers.reports import router as reports_router
from routers.progress import router as progress_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log active model names at startup
    import logging
    logger = logging.getLogger("uvicorn.info")
    logger.info("Active LLM Models -> GROQ_MODEL: '%s', GEMINI_MODEL: '%s'", settings.GROQ_MODEL, settings.GEMINI_MODEL)

    # Startup: ensure MongoDB indexes in background if not in tests
    is_testing = os.environ.get("PYTEST_CURRENT_TEST") is not None or os.environ.get("TESTING") == "true"
    if not is_testing:
        asyncio.create_task(init_db())
    yield
    # Shutdown: close MongoDB client if not in tests
    if not is_testing:
        try:
            await close_db()
        except Exception:
            pass

app = FastAPI(
    title="Dryrun API",
    description="Backend API for Dryrun - AI Mock Technical Interview for DSA",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Master API Router under prefix /api
api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def api_root():
    return {"status": "ok", "message": "Dryrun API root"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "app": "Dryrun API"}

# Include sub-routers
api_router.include_router(questions_router)
api_router.include_router(sessions_router)
api_router.include_router(reports_router)
api_router.include_router(progress_router)

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
