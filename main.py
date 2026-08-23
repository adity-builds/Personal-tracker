"""
Personal Tracker v0.3.2
Daily Task Tracker - Standalone Desktop App (FastAPI + pywebview)
"""
from datetime import datetime, timedelta
import os
import sys
import threading
import time
import urllib.request

# --- Windowed exe: hide console immediately ---
try:
    import ctypes
    # SW_HIDE = 0
    whnd = ctypes.windll.kernel32.GetConsoleWindow()
    if whnd != 0:
        ctypes.windll.user32.ShowWindow(whnd, 0)
        ctypes.windll.kernel32.CloseHandle(whnd)
except Exception:
    pass

# In windowed mode (console=False) stdout/stderr are None -> prevent crashes on print/logging
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import uvicorn
import webview
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

try:
    from version import __version__
except ImportError:
    __version__ = "0.3.2"

HOST = "127.0.0.1"
PORT = 8000

def resource_path(relative_path: str) -> str:
    # PyInstaller _MEIPASS for bundled static/, else project root
    base_path = getattr(sys, "_MEIPASS", os.path.abspath("."))
    path = os.path.join(base_path, relative_path)
    if os.path.exists(path):
        return path
    # fallback for dev when cwd differs
    alt = os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)
    return alt if os.path.exists(alt) else path

# Alembic owns schema creation/upgrades; legacy DBs are stamped as head
database.init_db()

app = FastAPI(title="Daily Task Tracker API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=resource_path("static")), name="static")

@app.get("/")
def read_index():
    return FileResponse(resource_path("static/index.html"))

def get_db():
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
    db_task = models.TaskModel(
        title=task.title,
        description=task.description,
        completed=False,
        created_at=datetime.now(),
        completed_at=None,
        due_date=task.due_date,
        priority=task.priority,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(models.TaskModel).offset(skip).limit(limit).all()
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

@app.get("/history/", response_model=List[schemas.DailyCount])
def read_history(db: Session = Depends(get_db)):
    rows = (
        db.query(models.HistoryModel)
        .order_by(
            models.HistoryModel.completed_at.desc(),
            models.HistoryModel.id.desc(),
        )
        .all()
    )
    # Group by date part of completed_at (datetime -> date)
    grouped = {}
    for row in rows:
        if row.completed_at is None:
            continue
        completed = row.completed_at
        if isinstance(completed, str):
            try:
                dt = datetime.fromisoformat(completed)
                day = dt.date()
            except Exception:
                day_str = completed.split("T")[0].split(" ")[0]
                from datetime import date as date_cls
                day = date_cls.fromisoformat(day_str)
        elif hasattr(completed, "date"):
            day = completed.date() if isinstance(completed, datetime) else completed
        else:
            day = completed
        detail = {
            "title": row.title,
            "description": row.description,
            "priority": row.priority or "Medium",
            "created_at": row.created_at,
            "completed_at": row.completed_at,
        }
        grouped.setdefault(day, []).append(detail)
    return [
        {"date": day, "count": len(details), "tasks": details}
        for day, details in grouped.items()
    ]

@app.get("/stats/", response_model=schemas.StatsSummary)
def read_stats(db: Session = Depends(get_db)):
    """Insights computed from the immutable history table.

    - current_streak: consecutive days with >=1 completion, walking back from
      today (today itself may still be empty without breaking the streak -
      yesterday then anchors it).
    - last_7_days: chronological counts ending today.
    """
    from datetime import timedelta

    today = datetime.now().date()

    rows = db.query(models.HistoryModel).all()
    per_day = {}
    by_priority = {"High": 0, "Medium": 0, "Low": 0}
    total = 0
    for row in rows:
        if row.completed_at is None:
            continue
        completed = row.completed_at
        day = completed.date() if isinstance(completed, datetime) else completed
        per_day[day] = per_day.get(day, 0) + 1
        priority = (row.priority or "Medium").strip().title() or "Medium"
        by_priority[priority] = by_priority.get(priority, 0) + 1
        total += 1

    # Streak: anchor on yesterday when today has no completions yet
    streak = 0
    cursor = today if today in per_day else today - timedelta(days=1)
    while cursor in per_day:
        streak += 1
        cursor -= timedelta(days=1)

    if per_day:
        # ties broken by most recent day
        best_day, best_count = max(per_day.items(), key=lambda kv: (kv[1], kv[0]))
    else:
        best_day, best_count = None, 0

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


class Api:
    def __init__(self) -> None:
        self._window = None
        self._is_maximized = False

    def minimize(self) -> None:
        if self._window:
            self._window.minimize()

    def toggle_maximize(self) -> bool:
        if not self._window:
            return False
        if self._is_maximized:
            self._window.restore()
            self._is_maximized = False
        else:
            self._window.maximize()
            self._is_maximized = True
        return self._is_maximized

    def close(self) -> None:
        if self._window:
            self._window.destroy()


def run_server() -> None:
    # Windowed exe must not log to missing console
    config = uvicorn.Config(
        app,
        host=HOST,
        port=PORT,
        log_level="critical",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.run()

def wait_for_server(timeout: float = 15.0) -> bool:
    url = f"http://{HOST}:{PORT}"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


if __name__ == "__main__":
    # Required for PyInstaller windowed + multiprocessing
    import multiprocessing
    multiprocessing.freeze_support()

    # Extra hide for cases where console was created before ctypes call
    try:
        import ctypes
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
    except Exception:
        pass

    threading.Thread(target=run_server, daemon=True).start()

    if not wait_for_server():
        raise RuntimeError(f"Server failed to start on {HOST}:{PORT}")

    api = Api()
    window = webview.create_window(
        "Daily Task Tracker",
        f"http://{HOST}:{PORT}",
        width=1000,
        height=720,
        frameless=True,
        easy_drag=False,
        js_api=api,
    )
    api._window = window
    # debug=False ensures no extra console/debug window
    webview.start(debug=False)
