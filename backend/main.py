"""
Product Analytics Dashboard — FastAPI Application

DATA ACCESS POLICY
==================
This application reads ONLY from pre-aggregated Parquet files in analytics/.
It NEVER accesses the raw CSV files in data/.  The pipeline (pipeline/preprocess.py)
is a separate, one-time offline step that is NOT invoked by this server.
"""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend directory is on the Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import assert_no_csv_access, validate_analytics_tables
from routers import overview, funnel, retention, behavior, categories, revenue, filters
from routers import insights, recommendations, segments


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: confirm data-access policy before handling any requests.
    print("[startup] Verifying analytics data sources...")
    assert_no_csv_access()       # logs a notice if CSV files sit on disk (they won't be read)
    validate_analytics_tables()  # warns about any missing Parquet tables
    print("[startup] Backend is ready — serving from analytics/*.parquet only.")
    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="Product Analytics Dashboard API",
    description=(
        "Analytics API for e-commerce user behavior data. "
        "All data served from pre-aggregated Parquet files — raw CSVs are never loaded."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS env var lets you add production domains without code changes.
# Format: comma-separated list, e.g.
#   ALLOWED_ORIGINS=https://my-app.vercel.app,https://custom-domain.com
_extra = os.getenv("ALLOWED_ORIGINS", "")
_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *[o.strip() for o in _extra.split(",") if o.strip()],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",   # covers all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS ───────────────────────────────────────────────────────────────────
app.include_router(overview.router)
app.include_router(funnel.router)
app.include_router(retention.router)
app.include_router(behavior.router)
app.include_router(categories.router)
app.include_router(revenue.router)
app.include_router(filters.router)
app.include_router(insights.router)
app.include_router(recommendations.router)
app.include_router(segments.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "analytics-api"}


@app.get("/")
def root():
    return {
        "message": "Product Analytics Dashboard API",
        "docs": "/docs",
        "endpoints": [
            "/api/overview",
            "/api/funnel",
            "/api/retention",
            "/api/behavior",
            "/api/categories",
            "/api/revenue",
            "/api/filters",
            "/api/insights",
            "/api/recommendations",
            "/api/segments",
        ],
    }
