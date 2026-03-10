"""
DuckDB connection and query utilities for the analytics backend.
All queries read EXCLUSIVELY from precomputed Parquet files in the analytics/ directory.
Raw CSV files in /data are NEVER accessed at runtime.
"""

import math
import os
import glob
import duckdb
from typing import Optional, Dict, Any

# Path to analytics tables — the ONLY data source used at runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANALYTICS_DIR = os.path.join(ROOT_DIR, "analytics")

# Memory-safe settings.
# On Render free tier the entire process is limited to 512 MB.
# Python + uvicorn + pandas overhead is ~150 MB, so DuckDB gets the rest.
_DUCKDB_THREADS = 1
_DUCKDB_MEMORY  = "256MB"

REQUIRED_TABLES = [
    # Core tables — server refuses to start if any are missing
    "funnel_metrics",
    "daily_active_users",
    "revenue_metrics",
    "category_performance",
    "retention_cohorts",
    "user_segments",
    "hourly_patterns",
    "brand_performance",
    "filter_categories",
    "filter_brands",
    # Supplementary tables — present after a full pipeline run
    "conversion_metrics",
    "weekly_active_users",
    "product_performance",
    "session_metrics",
    # session_summary: tiny single-row KPI file added in the refactored pipeline.
    # Falls back to session_metrics sampling if absent (behaviour.py handles this).
    "session_summary",
]


_CSV_DANGER_PATTERNS = [
    "read_csv",
    "read_csv_auto",
    "pandas.read_csv",
    'open(' ,           # broad catch — refined by /data check below
    "data/*.csv",
    "data/2019",
]


def assert_no_csv_access():
    """
    Hard startup guard.  Scans every Python file inside backend/ for patterns
    that would read raw CSV data.  Raises RuntimeError if any are found.

    This ensures that even if someone accidentally adds a CSV read to a router
    in the future, the server will refuse to start rather than silently eating RAM.
    """
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    violations = []

    for py_file in glob.glob(os.path.join(backend_dir, "**", "*.py"), recursive=True):
        # Skip this file (db.py) — it holds the pattern list itself
        if os.path.abspath(py_file) == os.path.abspath(__file__):
            continue
        try:
            src = open(py_file).read()
        except OSError:
            continue

        for pattern in _CSV_DANGER_PATTERNS:
            # Skip lines that are pure comments or docstrings
            for lineno, line in enumerate(src.splitlines(), 1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                if pattern in line and "data/*.csv" not in line.replace("data/", ""):
                    # More specific check for the generic "open(" pattern
                    if pattern == 'open(' and ".csv" not in line and "/data/" not in line:
                        continue
                    violations.append(f"  {os.path.relpath(py_file, ROOT_DIR)}:{lineno}  →  {stripped[:100]}")
                    break  # one violation per pattern per file is enough

    if violations:
        raise RuntimeError(
            "\n[STARTUP BLOCKED] CSV/raw-data access detected in backend source code.\n"
            "The backend must ONLY read from analytics/*.parquet.\n"
            "Violating lines:\n" + "\n".join(violations) + "\n"
            "Fix the code above, then restart the server."
        )

    # CSV files may exist on disk for pipeline use — that is fine.
    data_dir = os.path.join(ROOT_DIR, "data")
    csv_files = glob.glob(os.path.join(data_dir, "*.csv"))
    if csv_files:
        print(
            f"[db] OK: {len(csv_files)} raw CSV file(s) present in {data_dir} "
            "(pipeline artefacts only — this server will NEVER read them)."
        )
    else:
        print("[db] OK: No raw CSV files detected in /data.")


def validate_analytics_tables():
    """
    Verify that all required Parquet analytics tables exist before serving traffic.
    Raises RuntimeError for missing core tables; warns for optional ones.
    """
    core_tables = {
        "funnel_metrics", "daily_active_users", "revenue_metrics",
        "category_performance", "retention_cohorts", "user_segments",
        "hourly_patterns", "brand_performance", "filter_categories",
        "filter_brands",
        # session_metrics / session_summary are large/optional; warn but don't block
    }
    missing_core, missing_optional = [], []

    for name in REQUIRED_TABLES:
        path = get_table_path(name)
        if not os.path.exists(path):
            (missing_core if name in core_tables else missing_optional).append(name)

    if missing_optional:
        print(
            "[db] WARNING: Optional tables missing (non-critical): " +
            ", ".join(f"analytics/{n}.parquet" for n in missing_optional)
        )

    if missing_core:
        raise RuntimeError(
            "\n[STARTUP BLOCKED] Required analytics tables are missing:\n  " +
            "\n  ".join(f"analytics/{n}.parquet" for n in missing_core) + "\n"
            "Run the preprocessing pipeline once:\n"
            "  npm run pipeline\n"
            "Then restart the server."
        )

    sizes = {}
    for name in REQUIRED_TABLES:
        p = get_table_path(name)
        if os.path.exists(p):
            sizes[name] = os.path.getsize(p)

    total_mb = sum(sizes.values()) / 1_048_576
    print(
        f"[db] All analytics tables verified ✓  "
        f"({len(sizes)} files, {total_mb:.1f} MB total on disk)"
    )


def get_table_path(name: str) -> str:
    return os.path.join(ANALYTICS_DIR, f"{name}.parquet")


def _new_con() -> duckdb.DuckDBPyConnection:
    """Create a memory-safe DuckDB connection (never touches CSV files)."""
    con = duckdb.connect()
    con.execute(f"SET threads TO {_DUCKDB_THREADS};")
    con.execute(f"SET memory_limit = '{_DUCKDB_MEMORY}';")
    return con


def _clean(records: list[dict]) -> list[dict]:
    """Replace NaN/Inf float values (pandas representation of SQL NULL) with None.
    Python's json module raises ValueError on NaN/Inf; None serialises to JSON null."""
    def _fix(v: Any) -> Any:
        if isinstance(v, float) and not math.isfinite(v):
            return None
        return v
    return [{k: _fix(v) for k, v in row.items()} for row in records]


def query(sql: str, params: Optional[Dict[str, Any]] = None) -> list[dict]:
    """Execute a SQL query against Parquet files using DuckDB and return list of dicts."""
    con = _new_con()
    try:
        df = con.execute(sql).fetchdf()
        return _clean(df.to_dict(orient="records"))
    finally:
        con.close()


def query_df(sql: str):
    """Return a pandas DataFrame."""
    con = _new_con()
    try:
        return con.execute(sql).fetchdf()
    finally:
        con.close()


def table(name: str) -> str:
    """Return a read_parquet() SQL expression for use in queries."""
    path = get_table_path(name)
    return f"read_parquet('{path}')"


def build_date_filter(
    table_alias: str,
    start_date: Optional[str],
    end_date: Optional[str],
    date_col: str = "event_date"
) -> str:
    clauses = []
    if start_date:
        clauses.append(f"{table_alias}.{date_col} >= '{start_date}'::DATE")
    if end_date:
        clauses.append(f"{table_alias}.{date_col} <= '{end_date}'::DATE")
    return " AND ".join(clauses)
