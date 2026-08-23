# Personal Tracker — Daily Task Tracker
![Version](https://img.shields.io/badge/version-0.3.2-blue?style=flat) ![Python](https://img.shields.io/badge/python-3.10%2B-3776ab) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688) ![License](https://img.shields.io/badge/license-MIT-green)

Modern card-based desktop app for daily tasks — **FastAPI + SQLite + pywebview**. Ships as a windowed `PersonalTracker.exe` (no console) with a proper installer, task editing with deadlines, an insights dashboard, Dark/Light theme, and append-only history with timestamps.

> **Latest release: v0.3.2** (2026-08-23) — See [CHANGELOG.md](CHANGELOG.md) for details. Previous tag: `v0.3.1`.

## ✨ Features (v0.3.2)
- **Task editing + deadlines** — Edit modal (title/description/priority), calendar + clock deadline pickers, past-deadline blocking, red `Overdue` / amber `Due today` badges
- **Insights dashboard** — Current streak 🔥, all-time total, 7-day trend chart (inline SVG), best day — computed from the immutable history (`main.py`, `static/app.js`)
- **Proper installer** — `PersonalTrackerSetup-v…exe` with Start Menu shortcut and real uninstaller; portable exe also published (`installer/personal_tracker.iss`)
- **Completed tasks are permanent** — no unchecking (`409`), so history can never be spammed by toggling
- **Dashboard UI** — Rounded cards (`--radius:16px`), Inter font, Dark/Light theme with native widgets that follow the theme via `color-scheme` (`static/style.css:1`)
- **Append-only history** — Every completion saves `{title, description, priority, created_at, completed_at}` and groups by date (`main.py:163`, `schemas.py`). One entry per completion, guaranteed.
- **Windowed exe** — `console=False` (`PersonalTracker.spec`), `ctypes` hide, `uvicorn` `log_level="critical"`, `webview.start(debug=False)` — no black console flash. App icon auto-embedded from `assets/app.ico`.

## Project Structure
```
Personal Tracker/
├── main.py                 # FastAPI + pywebview launcher (v0.3.0, windowed)
├── version.py / VERSION    # Single source of truth
├── database.py             # Engine + Alembic runner (PT_DB_PATH env override; frozen-exe paths)
├── models.py               # TaskModel (due_date), HistoryModel (DateTime timestamps)
├── schemas.py              # Pydantic schemas incl. StatsSummary for /stats/
├── alembic.ini             # Alembic config (dev CLI: autogenerate revisions)
├── alembic/                # Migration chain (baseline + add_tasks_due_date)
├── tests/                  # pytest suite + node tests/test_core_logic.js (frontend logic)
├── installer/              # Inno Setup script for PersonalTrackerSetup.exe
├── assets/                 # app.ico (auto-detected by spec + installer)
├── file_version_info.txt   # Windows exe version resource (0.3.0.0)
├── PersonalTracker.spec    # PyInstaller windowed spec (console=False)
├── static/
│   ├── index.html          # Dashboard + edit modal + insights panel
│   ├── style.css           # CSS variables + cards + badges + modal
│   ├── core.js             # TrackerCore - pure date/sort logic (unit-tested in Node)
│   └── app.js              # Theme persistence + editing UX + stats rendering
├── requirements.txt        # Pinned deps (+ alembic)
├── requirements-dev.txt    # Test deps (pytest, httpx)
├── ROADMAP.md              # Phased plan (v0.3 phases, v0.4+, decisions log)
├── CHANGELOG.md
└── tasks.db                # SQLite (gitignored, stored next to exe or %APPDATA%)
```

## 🚀 Quick Start (Development)
```bash
# 1. Clone
git clone https://github.com/adity-builds/Personal-tracker.git
cd "Personal tracker"

# 2. Install (pinned)
pip install -r requirements.txt

# 3. Run as web server (with reload + docs)
uvicorn main:app --reload
# -> http://127.0.0.1:8000  and  http://127.0.0.1/docs

# Or run as desktop app (pywebview frameless window)
python main.py
```

## 📦 Install on Windows (end users)

Two ways to run the app — both are published on the [Releases](https://github.com/adity-builds/Personal-tracker/releases) page:

| | **Installer** (`PersonalTrackerSetup-v…exe`) | **Portable** (`PersonalTracker.exe`) |
|---|---|---|
| Setup | Wizard, Start Menu shortcut, optional desktop icon | none — just run it |
| Install location | `C:\Program Files\PersonalTracker` | anywhere you like |
| Task data (`tasks.db`) | `%APPDATA%\PersonalTracker\tasks.db` | next to the exe |
| Removal | Settings → Apps → Uninstall | delete the file |

> ⚠️ The two modes keep data in different places by design (installed apps must not write into Program Files). Copy `tasks.db` between the two locations to migrate your tasks.

**App icon:** builds automatically embed `assets/app.ico` when that file is present.

## 🧱 Build Windowed EXE + Installer
```bash
# Ensure spec is tracked (v0.2.0 fixes .gitignore)
pyinstaller PersonalTracker.spec --noconfirm --clean
# Output: dist/PersonalTracker.exe  (~26 MB, windowed, versioned via file_version_info.txt)
# DB is created next to exe on first run, or %APPDATA%\PersonalTracker\tasks.db if exe dir is read-only

# Installer (needs Inno Setup 6 - ISCC.exe):
iscc installer/personal_tracker.iss /DAppVersion=0.3.2
# Output: dist/PersonalTrackerSetup-v0.3.2.exe
```

> **Console hidden:** `PersonalTracker.spec` `console=False` + `main.py:1` `ctypes ShowWindow(SW_HIDE)` + `sys.stdout` null-guard + `uvicorn` `log_level="critical"` + `webview.start(debug=False)`.

## 🔌 API Endpoints
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/tasks/` | `{title, description?, due_date?, priority?}` | `Task{id, title, description, priority, completed, created_at, completed_at, due_date}` |
| `GET`  | `/tasks/?skip=&limit=` | — | `List[Task]` |
| `PUT`  | `/tasks/{task_id}` | `{completed, title?, description?, priority?, due_date?}` | `Task` (full edit; `409` when unchecking a completed task; `422` for empty titles or newly-past deadlines) |
| `DELETE` | `/tasks/{task_id}` | — | `{ok: true}` |
| `GET`  | `/history/` | — | `List[DailyCount{date, count, tasks:[{title, description, priority, created_at, completed_at}]}>` |
| `GET`  | `/stats/` | — | `{total_completions, current_streak, best_day, best_day_count, last_7_days[7], by_priority}` |
| `GET`  | `/version` | — | `{version: "0.3.2"}` |
| `GET`  | `/` | — | `static/index.html` |
| `GET`  | `/docs` | — | Swagger UI |

Completed tasks are **permanent** — they cannot be unchecked (`409`). All history entries are **immutable** — every completion records exactly one entry, so toggling can never duplicate history rows.

## 🔧 Configuration
- **Host/Port:** `HOST=127.0.0.1`, `PORT=8000` in `main.py`
- **DB path:** `database.py` `_get_db_path()` — frozen exe uses `sys.executable` dir, fallback to `%APPDATA%\PersonalTracker`. Dev uses project root.
- **Version:** `version.py` / `VERSION` — bump both, update `file_version_info.txt` (`filevers=(0,3,0,0)`) before `pyinstaller`.

## 📝 Changelog
See [CHANGELOG.md](CHANGELOG.md). Highlights for v0.3.2:
- Task editing with calendar/clock deadline pickers and overdue badges
- Insights dashboard (streak, 7-day trend, best day) from immutable history
- Proper Windows installer (Start Menu + uninstaller) alongside the portable exe

## 🤝 Release Process (for maintainers)
```bash
# 1. Bump version in version.py / VERSION / file_version_info.txt / README badge / CHANGELOG
# 2. Commit
git add -A
git commit -m "Release v0.3.0"

# 3. Tag & push (triggers GitHub Release workflow)
git tag v0.3.0
git push origin main --tags
# GitHub Actions (.github/workflows/release.yml) builds the exe AND the installer,
# then creates a Release with both artifacts
```

## 📄 License
MIT — see original repo.

## 🆘 Troubleshooting
- **Exe shows console:** Rebuild with `PersonalTracker.spec` (`console=False`) and ensure `main.py` hide logic at top is present. Do not use `pyinstaller main.py --console`.
- **DB not found after moving exe:** Copy `tasks.db` next to exe or check `%APPDATA%\PersonalTracker\tasks.db` (fallback for Program Files installs).
- **Port in use:** Change `PORT` in `main.py` or kill `uvicorn`/`PersonalTracker.exe` still running.
