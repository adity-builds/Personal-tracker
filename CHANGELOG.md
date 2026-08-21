# Changelog

All notable changes to Personal Tracker are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [SemVer](https://semver.org/).

## [0.2.0] - 2026-08-21

### Added
- **Modern UI overhaul** (`static/index.html:1`, `static/style.css:1`, `static/app.js:1`)
  - Card-based dashboard layout with `Inter` + `Plus Jakarta Sans` fonts, 16px rounded cards, `var(--shadow)` subtle shadows
  - Dark/Light theme via CSS variables (`:root` / `[data-theme="dark"]`) with `localStorage` (`daily-tracker-theme`) and `prefers-color-scheme` fallback
  - Visual `priority-badge` (`High/Medium/Low`) and `status-badge` (`Pending/Completed`) with hover lift `translateY(-2px)` and `0.2s` micro-interactions
  - Empty-state illustration (`empty-illustration`) for no tasks / no results
- **Append-only history with timestamps** (`models.py:4`, `schemas.py:17`, `main.py:54`, `database.py:14`)
  - `TaskModel.created_at: DateTime` and `HistoryModel.created_at/completed_at: DateTime` (was `Date`)
  - Every completion now inserts an **immutable** `HistoryModel` row with `{title, description, priority, created_at, completed_at}` — no longer overwrites or deletes on uncheck
  - `GET /history/` groups by `completed_at.date()` and returns `DailyCount{date, count, tasks:[{title, created_at, completed_at}]}` with both timestamps
  - Frontend `renderHistory()` shows `Created 11:26 AM → Completed 11:31 AM • High` with tooltips
  - `database.migrate()` backfills `created_at`, `description`, `priority` for existing DBs
- **Windowed release hardening** (`main.py:1`, `PersonalTracker.spec:1`, `file_version_info.txt`)
  - `console=False` in spec, `ctypes.windll.kernel32.GetConsoleWindow` hide, `sys.stdout` null-guard, `uvicorn` `log_level="critical"` + `access_log=False`, `webview.start(debug=False)`, `multiprocessing.freeze_support()`
  - `database.py:8` DB now resolves to exe dir (portable) with `%APPDATA%/PersonalTracker` fallback for read-only installs
  - Windows version resource `file_version_info.txt` (0.2.0.0) embedded via PyInstaller

### Changed
- `requirements.txt` pinned to tested versions (`fastapi==0.141.1`, `uvicorn==0.52.4`, `sqlalchemy==2.0.52`, `pydantic==2.13.4`, `pywebview==6.2.1`, `pyinstaller==6.22.2`)
- `.gitignore` now tracks `PersonalTracker.spec` (`!PersonalTracker.spec`) and ignores `tasks.db` / `__pycache__` / `build/` / `dist/`
- `README.md` rewritten for v0.2.0 with setup, API, build instructions, and release notes
- `version.py` / `VERSION` introduced as single source of truth (`0.2.0`)

### Fixed
- History no longer replaces previous entry — now correctly accumulates multiple completions per day
- Console flash on exe launch eliminated for windowed build

## [0.1.0-alpha] - 2026-08-20
- Initial alpha: FastAPI + SQLite + pywebview frameless window, CRUD tasks, collapsible sidebar, history grouped by date, basic PyInstaller spec
