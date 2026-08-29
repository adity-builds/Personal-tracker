"""
Personal Tracker v0.4.0
Daily Task Tracker - FastAPI backend for Electron + React UI
"""
from datetime import datetime, timedelta
import os
import sys

# In windowed mode (Electron child) stdout/stderr may be None
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import database
import models
import schemas

try:
    from version import __version__
except ImportError:
    __version__ = "0.4.0"

HOST = "127.0.0.1"
PORT = 8000

def resource_path(relative_path: str) -> str:
    # PyInstaller _MEIPASS for bundled files, else project root
    base_path = getattr(sys, "_MEIPASS", os.path.abspath("."))
    path = os.path.join(base_path, relative_path)
    if os.path.exists(path):
        return path
    alt = os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)
    return alt if os.path.exists(alt) else path

# Fast startup: DB init deferred until first request (saves ~0.8s on import)
_db_initialized = False

def _ensure_db():
    global _db_initialized
    if not _db_initialized:
        database.init_db()
        _db_initialized = True

# Eager init for normal run, but tests can set PT_DB_PATH before import
try:
    _ensure_db()
except Exception:
    pass

app = FastAPI(title="Daily Task Tracker API", version=__version__)

# Allow local dev, Vite proxy, and Electron file:// (Origin "null")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Serve frontend — only dist-react (Vite) in prod; static is legacy fallback
_dist_dir = resource_path("dist-react")
if os.path.isdir(_dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist_dir, "assets")), name="assets")

_cached_index: str | None = None
_index_checked = False

def _find_index() -> str | None:
    global _cached_index, _index_checked
    if _index_checked:
        return _cached_index
    for cand in ("dist-react/index.html", "dist/index.html", "static/index.html"):
        p = resource_path(cand)
        if os.path.exists(p):
            _cached_index = p
            _index_checked = True
            return p
    _index_checked = True
    return None

@app.get("/")
def read_index():
    _ensure_db()
    idx = _find_index()
    if idx:
        return FileResponse(idx, headers={"Cache-Control": "no-cache"})
    return {"status": "ok", "message": "Personal Tracker API — Electron UI loads via file://"}

def get_db():
    _ensure_db()
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _reject_past_due(provided: datetime | None, stored: datetime | None) -> None:
    """Deadlines must be in the future when (re)set.

    - 60s grace so picking the current minute never fails on submit lag.
    - Keeping a task's existing deadline is always allowed, even if it already
      slipped into the past (that's what the Overdue badge is for).
    """
    if provided is None:
        return
    if provided < datetime.now() - timedelta(seconds=60):
        same_as_stored = (
            stored is not None
            and provided.replace(tzinfo=None, second=0, microsecond=0)
            == stored.replace(tzinfo=None, second=0, microsecond=0)
        )
        if not same_as_stored:
            raise HTTPException(status_code=422, detail="Deadline can't be in the past")

@app.get("/version")
def get_version():
    return {"version": __version__, "name": "Personal Tracker"}

@app.post("/tasks/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    _reject_past_due(task.due_date, None)
    now = datetime.now()
    db_task = models.TaskModel(
        title=task.title.strip(),
        description=task.description,
        completed=False,
        created_at=now,
        completed_at=None,
        due_date=task.due_date,
        priority=task.priority,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=list[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Clamp pagination to sane bounds (prevents full table scan)
    skip = max(0, skip)
    limit = min(max(1, limit), 200)
    tasks = db.query(models.TaskModel).order_by(models.TaskModel.id.asc()).offset(skip).limit(limit).all()
    return tasks

@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task_status(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    was_completed = db_task.completed

    # Completed tasks are permanent: unchecking would spam the audit trail
    if was_completed and not task_update.completed:
        raise HTTPException(status_code=409, detail="Completed tasks cannot be unchecked")

    # Editable fields: only apply what the client explicitly sent (PATCH-style,
    # explicit null clears). Keeps old {completed}-only payloads backward compatible.
    provided = task_update.model_fields_set
    if "due_date" in provided:
        _reject_past_due(task_update.due_date, db_task.due_date)
    if "title" in provided:
        if not task_update.title or not task_update.title.strip():
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        db_task.title = task_update.title.strip()
    if "description" in provided:
        db_task.description = task_update.description
    if "due_date" in provided:
        db_task.due_date = task_update.due_date
    if task_update.priority is not None:
        db_task.priority = task_update.priority

    db_task.completed = task_update.completed
    if task_update.completed:
        # Stamp/append only on the pending -> completed transition;
        # re-checking an already-completed task is a no-op
        if not was_completed:
            db_task.completed_at = datetime.now()
            # Append-only history: every completion creates a new immutable record
            history_entry = models.HistoryModel(
                task_id=task_id,
                title=db_task.title,
                description=db_task.description,
                priority=db_task.priority,
                created_at=db_task.created_at or datetime.now(),
                completed_at=db_task.completed_at,
            )
            db.add(history_entry)
    else:
        db_task.completed_at = None

    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/history/", response_model=list[schemas.DailyCount])
def read_history(db: Session = Depends(get_db)):
    rows = (
        db.query(models.HistoryModel)
        .order_by(
            models.HistoryModel.completed_at.desc(),
            models.HistoryModel.id.desc(),
        )
        .all()
    )
    # Fast grouping — completed_at is always datetime (Alembic ensures it)
    grouped: dict = {}
    for row in rows:
        completed = row.completed_at
        if completed is None:
            continue
        # Direct date() without isinstance branching (hot path)
        day = completed.date() if isinstance(completed, datetime) else completed
        # Reuse dict literal; avoid repeated .get
        lst = grouped.get(day)
        detail = {
            "title": row.title,
            "description": row.description,
            "priority": row.priority or "Medium",
            "created_at": row.created_at,
            "completed_at": row.completed_at,
        }
        if lst is None:
            grouped[day] = [detail]
        else:
            lst.append(detail)
    return [
        {"date": day, "count": len(details), "tasks": details}
        for day, details in grouped.items()
    ]

@app.get("/stats/", response_model=schemas.StatsSummary)
def read_stats(db: Session = Depends(get_db)):
    """Insights computed from the immutable history table."""
    today = datetime.now().date()

    # Single query, single pass — no N+1, no repeated date() on non-datetime
    rows = db.query(models.HistoryModel.completed_at, models.HistoryModel.priority).all()
    per_day: dict = {}
    by_priority = {"High": 0, "Medium": 0, "Low": 0}
    total = 0
    for completed_at, priority in rows:
        if completed_at is None:
            continue
        day = completed_at.date() if isinstance(completed_at, datetime) else completed_at
        per_day[day] = per_day.get(day, 0) + 1
        # Fast normalize: already title-cased in DB, fallback only once
        p = priority or "Medium"
        if p not in by_priority:
            p = p.strip().title() or "Medium"
        by_priority[p] = by_priority.get(p, 0) + 1
        total += 1

    # Streak: anchor on yesterday when today empty (no loop if no data)
    streak = 0
    if per_day:
        cursor = today if today in per_day else today - timedelta(days=1)
        while cursor in per_day:
            streak += 1
            cursor -= timedelta(days=1)

        best_day, best_count = max(per_day.items(), key=lambda kv: (kv[1], kv[0]))
    else:
        best_day, best_count = None, 0

    # Precompute last 7 once
    last_7_days = [
        {"date": today - timedelta(days=offset), "count": per_day.get(today - timedelta(days=offset), 0)}
        for offset in range(6, -1, -1)
    ]

    return {
        "total_completions": total,
        "current_streak": streak,
        "best_day": best_day,
        "best_day_count": best_count,
        "last_7_days": last_7_days,
        "by_priority": by_priority,
    }

@app.delete("/tasks/{task_id}", response_model=dict)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"ok": True}


def run_server() -> None:
    """Run the API server (used by Electron child process or standalone)."""
    import uvicorn

    config = uvicorn.Config(
        app,
        host=HOST,
        port=PORT,
        log_level="warning",
        access_log=False,
        loop="auto",
        ws="none",
    )
    server = uvicorn.Server(config)
    server.run()


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    run_server()
