"""
Personal Tracker v0.5.0
Daily Task Tracker - Standalone Desktop App (FastAPI + pywebview + React)
"""
from datetime import datetime, timedelta
import csv
import io
import os
import sys
import threading
import time
import urllib.request

# --- Windowed exe: hide console immediately (like v0.3.2) ---
try:
    import ctypes

    whnd = ctypes.windll.kernel32.GetConsoleWindow()
    if whnd != 0:
        ctypes.windll.user32.ShowWindow(whnd, 0)
        ctypes.windll.kernel32.CloseHandle(whnd)
except Exception:
    pass

# In windowed mode (console=False) stdout/stderr are None -> prevent crashes
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import database
import models
import schemas

try:
    from version import __version__
except ImportError:
    __version__ = "0.5.0"

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

@app.get("/tasks/", response_model=List[schemas.Task])
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


@app.get("/export/json")
def export_json(db: Session = Depends(get_db)):
    """Full database dump as JSON: tasks + history + metadata."""
    tasks = (
        db.query(models.TaskModel)
        .order_by(models.TaskModel.id.asc())
        .all()
    )
    history = (
        db.query(models.HistoryModel)
        .order_by(models.HistoryModel.id.asc())
        .all()
    )

    def _task_row(t):
        return {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "completed": t.completed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority,
        }

    def _history_row(h):
        return {
            "id": h.id,
            "task_id": h.task_id,
            "title": h.title,
            "description": h.description,
            "priority": h.priority,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "completed_at": h.completed_at.isoformat() if h.completed_at else None,
        }

    return {
        "version": __version__,
        "exported_at": datetime.now().isoformat(),
        "tasks": [_task_row(t) for t in tasks],
        "history": [_history_row(h) for h in history],
    }


@app.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    """Full database dump as CSV: tasks section then history section."""
    tasks = (
        db.query(models.TaskModel)
        .order_by(models.TaskModel.id.asc())
        .all()
    )
    history = (
        db.query(models.HistoryModel)
        .order_by(models.HistoryModel.id.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Tasks section
    writer.writerow(["section", "tasks"])
    writer.writerow([
        "id", "title", "description", "completed", "created_at",
        "completed_at", "due_date", "priority",
    ])
    for t in tasks:
        writer.writerow([
            t.id, t.title, t.description or "", t.completed,
            t.created_at.isoformat() if t.created_at else "",
            t.completed_at.isoformat() if t.completed_at else "",
            t.due_date.isoformat() if t.due_date else "",
            t.priority,
        ])

    # History section
    writer.writerow([])
    writer.writerow(["section", "history"])
    writer.writerow([
        "id", "task_id", "title", "description", "priority",
        "created_at", "completed_at",
    ])
    for h in history:
        writer.writerow([
            h.id, h.task_id or "", h.title, h.description or "", h.priority,
            h.created_at.isoformat() if h.created_at else "",
            h.completed_at.isoformat() if h.completed_at else "",
        ])

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="personaltracker_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        },
    )


def _parse_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


@app.post("/import/json")
def import_json(payload: dict, db: Session = Depends(get_db)):
    """Import tasks + history from a JSON export.

    Body: {mode: "replace"|"merge", data: {tasks: [...], history: [...]}}.

    - replace: clears all tasks + history, then loads imported rows.
    - merge: upserts tasks by id (imported ids preserved where possible),
             appends history entries that don't duplicate an existing
             (task_id, completed_at) pair.

    Returns {imported_tasks, imported_history, skipped, mode}.
    """
    mode = payload.get("mode", "merge")
    if mode not in ("replace", "merge"):
        raise HTTPException(status_code=422, detail='mode must be "replace" or "merge"')

    data = payload.get("data", {})
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="data must be an object")

    imported_tasks = data.get("tasks", [])
    imported_history = data.get("history", [])
    if not isinstance(imported_tasks, list) or not isinstance(imported_history, list):
        raise HTTPException(status_code=422, detail="data.tasks and data.history must be arrays")

    if mode == "replace":
        db.query(models.HistoryModel).delete()
        db.query(models.TaskModel).delete()
        db.commit()

    skipped = 0
    imported_tasks_count = 0
    imported_history_count = 0

    # Import tasks
    existing_task_ids = {
        t.id for t in db.query(models.TaskModel.id).all()
    }
    for row in imported_tasks:
        if not isinstance(row, dict):
            skipped += 1
            continue
        try:
            task_id = row.get("id")
            if task_id is None:
                skipped += 1
                continue
            title = (row.get("title") or "").strip()
            if not title:
                skipped += 1
                continue

            db_task = models.TaskModel(
                id=task_id,
                title=title,
                description=row.get("description"),
                completed=bool(row.get("completed", False)),
                created_at=_parse_iso(row.get("created_at")),
                completed_at=_parse_iso(row.get("completed_at")),
                due_date=_parse_iso(row.get("due_date")),
                priority=row.get("priority") or "Medium",
            )
            db.merge(db_task)
            imported_tasks_count += 1
        except Exception:
            skipped += 1
            continue

    db.commit()

    # Import history
    existing_history_keys = {
        (h.task_id, h.completed_at)
        for h in db.query(models.HistoryModel.task_id, models.HistoryModel.completed_at).all()
    }
    for row in imported_history:
        if not isinstance(row, dict):
            skipped += 1
            continue
        try:
            task_id = row.get("task_id")
            completed_at = _parse_iso(row.get("completed_at"))
            key = (task_id, completed_at)
            if mode == "merge" and key in existing_history_keys:
                skipped += 1
                continue

            db_history = models.HistoryModel(
                id=row.get("id"),
                task_id=task_id,
                title=row.get("title") or "",
                description=row.get("description"),
                priority=row.get("priority") or "Medium",
                created_at=_parse_iso(row.get("created_at")),
                completed_at=completed_at,
            )
            db.merge(db_history)
            existing_history_keys.add(key)
            imported_history_count += 1
        except Exception:
            skipped += 1
            continue

    db.commit()

    return {
        "imported_tasks": imported_tasks_count,
        "imported_history": imported_history_count,
        "skipped": skipped,
        "mode": mode,
    }


class Api:
    """JS bridge for pywebview window controls (frameless, resizable, workArea-aware)."""

    def __init__(self) -> None:
        self._window = None
        self._is_maximized = False
        self._prev_rect = None  # (x, y, w, h) before workArea maximize

    def minimize(self) -> None:
        if self._window:
            self._window.minimize()

    def _get_hwnd(self):
        try:
            import ctypes
            hwnd = ctypes.windll.user32.FindWindowW(None, "Personal Tracker")
            return hwnd if hwnd else None
        except Exception:
            return None

    def _get_work_area(self):
        try:
            import ctypes
            from ctypes import wintypes
            rect = wintypes.RECT()
            ctypes.windll.user32.SystemParametersInfoW(48, 0, ctypes.byref(rect), 0)
            return (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
        except Exception:
            return None

    def toggle_maximize(self) -> bool:
        if not self._window:
            return False
        # Use workArea so taskbar stays visible (frameless maximize otherwise covers it)
        if self._is_maximized:
            try:
                if self._prev_rect:
                    x, y, w, h = self._prev_rect
                    hwnd = self._get_hwnd()
                    if hwnd:
                        import ctypes
                        ctypes.windll.user32.MoveWindow(hwnd, x, y, w, h, True)
                    else:
                        self._window.restore()
                else:
                    self._window.restore()
            except Exception:
                try:
                    self._window.restore()
                except Exception:
                    pass
            self._is_maximized = False
            self._prev_rect = None
        else:
            try:
                import ctypes
                hwnd = self._get_hwnd()
                if hwnd:
                    rect = ctypes.wintypes.RECT()
                    ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
                    self._prev_rect = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
                    wa = self._get_work_area()
                    if wa:
                        x, y, w, h = wa
                        ctypes.windll.user32.MoveWindow(hwnd, x, y, w, h, True)
                    else:
                        self._window.maximize()
                else:
                    self._window.maximize()
            except Exception:
                try:
                    self._window.maximize()
                except Exception:
                    pass
            self._is_maximized = True
        return self._is_maximized

    def start_drag(self) -> None:
        """Initiate system drag for frameless window (titlebar mousedown)."""
        try:
            import ctypes
            hwnd = self._get_hwnd()
            if hwnd:
                WM_NCLBUTTONDOWN = 0xA1
                HTCAPTION = 2
                ctypes.windll.user32.ReleaseCapture()
                ctypes.windll.user32.SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0)
        except Exception:
            pass

    def close(self) -> None:
        if self._window:
            self._window.destroy()


def run_server() -> None:
    """Run the API server (standalone or Electron child)."""
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


def wait_for_server(timeout: float = 15.0) -> bool:
    url = f"http://{HOST}:{PORT}/version"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()

    # If spawned by Electron (PYWEBVIEW_DISABLED=1) -> just run API, no window
    if os.environ.get("PYWEBVIEW_DISABLED") == "1" or "--api-only" in sys.argv:
        run_server()
    else:
        # Extra hide for cases where console was created before ctypes call
        try:
            import ctypes

            ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
        except Exception:
            pass

        threading.Thread(target=run_server, daemon=True).start()

        if not wait_for_server():
            raise RuntimeError(f"Server failed to start on {HOST}:{PORT}")

        try:
            import webview
        except ImportError:
            # Fallback: no window, just keep server running (browser mode)
            print("pywebview not installed, running at http://127.0.0.1:8000/")
            print("Open http://127.0.0.1:8000/ in your browser")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                sys.exit(0)

        # Auto-fit to primary display (like Electron's getAdaptiveSize)
        def _adaptive_size(default_w=1440, default_h=900, min_w=980, min_h=640):
            try:
                import ctypes
                # Make process DPI-aware so GetSystemMetrics returns true pixels
                try:
                    ctypes.windll.shcore.SetProcessDpiAwareness(1)
                except Exception:
                    try:
                        ctypes.windll.user32.SetProcessDPIAware()
                    except Exception:
                        pass
                user32 = ctypes.windll.user32
                sw = user32.GetSystemMetrics(0)
                sh = user32.GetSystemMetrics(1)
                w = min(default_w, int(sw * 0.92))
                h = min(default_h, int(sh * 0.88))
                w = max(w, min_w)
                h = max(h, min_h)
                w = min(w, sw - 16)
                h = min(h, sh - 16)
                if sw <= 1366:
                    w = int(sw * 0.96)
                if sh <= 800:
                    h = int(sh * 0.92)
                return w, h
            except Exception:
                return default_w, default_h

        win_w, win_h = _adaptive_size()
        api = Api()
        window = webview.create_window(
            "Personal Tracker",
            f"http://{HOST}:{PORT}/",
            width=win_w,
            height=win_h,
            min_size=(980, 640),
            resizable=True,
            frameless=True,
            easy_drag=False,
            js_api=api,
        )
        api._window = window
        # Fix frameless window to be resizable via WS_THICKFRAME (winforms sets FormBorderStyle=None which disables resize)
        def _fix_frameless_resizable():
            try:
                import ctypes
                hwnd = api._get_hwnd()
                if not hwnd:
                    return
                GWL_STYLE = -16
                WS_THICKFRAME = 0x00040000
                WS_MAXIMIZEBOX = 0x00010000
                WS_MINIMIZEBOX = 0x00020000
                style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_STYLE)
                style |= WS_THICKFRAME | WS_MAXIMIZEBOX | WS_MINIMIZEBOX
                ctypes.windll.user32.SetWindowLongW(hwnd, GWL_STYLE, style)
                # Force frame redraw
                SWP_FRAMECHANGED = 0x0020
                SWP_NOMOVE = 0x0002
                SWP_NOSIZE = 0x0001
                SWP_NOZORDER = 0x0004
                ctypes.windll.user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER)
            except Exception:
                pass

        # Shim: make React's window.electronAPI also work on pywebview
        # (TitleBar checks window.electronAPI, pywebview exposes window.pywebview.api)
        def _shim_electron_api():
            try:
                window.evaluate_js(
                    """
                    if (!window.electronAPI && window.pywebview && window.pywebview.api) {
                        window.electronAPI = {
                            minimize: () => window.pywebview.api.minimize(),
                            toggleMaximize: () => window.pywebview.api.toggle_maximize(),
                            close: () => window.pywebview.api.close(),
                            startDrag: () => window.pywebview.api.start_drag(),
                            isElectron: false
                        };
                    }
                    """
                )
            except Exception:
                pass

        # Use webview start with shim after window loads
        try:
            # webview.start blocks until window closed
            # Inject shim + fix resizable via 'loaded' event if available
            try:
                def _on_loaded():
                    _shim_electron_api()
                    _fix_frameless_resizable()
                window.events.loaded += lambda: _on_loaded()
            except Exception:
                pass
            webview.start(debug=False)
        except Exception as e:
            print(f"Window failed: {e}, fallback to http://127.0.0.1:8000/")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                sys.exit(0)
