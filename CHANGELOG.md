# Changelog

All notable changes to Personal Tracker are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [SemVer](https://semver.org/).

## [0.3.1] - 2026-08-23

### Fixed
- **Installer shows "unable to open database file" on launch** (`database.py:11`, `database.py:41`)
  - Installed exe in `C:\Program Files\...` is not writable — SQLite failed with `sqlite3.OperationalError` because the DB URL used backslashes/spaces and `os.access` is unreliable with UAC
  - Now detects `Program Files` installs via path heuristic + actual write probe, always falls back to `%APPDATA%\PersonalTracker\tasks.db` with forward-slash URL (`Path.as_posix()`) and ensures parent dir exists; one-time auto-migration copies an existing `Program Files\tasks.db` (from an elevated first run) to AppData
  - Validated with simulated Program Files install (mocked `sys.frozen` + `APPDATA`) and live exe launch test (`main.py:314`)

## [0.3.0] - 2026-08-23

### Added
- **Proper Windows installer (v0.3 Phase 4)** (`installer/personal_tracker.iss:1`, `.github/workflows/release.yml:31`, `PersonalTracker.spec:5`)
  - Inno Setup wizard: installs to Program Files, Start Menu shortcut, optional desktop icon, and a real uninstaller in Add/Remove Programs
  - Uninstaller never touches user data — installed builds keep `tasks.db` in `%APPDATA%\PersonalTracker` (existing fallback path)
  - Release workflow now compiles `PersonalTrackerSetup-v<version>.exe` and ships **both** installer and portable exe
  - App icon auto-activates when `assets/app.ico` is supplied (exe embedding + installer wizard + shortcuts); builds stay green without it
- **Insights dashboard (v0.3 Phase 3)** (`main.py:222`, `static/index.html:36`, `static/app.js:1`)
  - `GET /stats/` computed from immutable history: total completions, current streak (today may be empty without breaking it), best day (ties → most recent), chronological last-7-days window, per-priority counts
  - Sidebar "Insights" panel: streak counter with flame, all-time total, inline-SVG 7-day bar chart (dependency-free; today's bar highlighted, weekday labels, hover/focus tooltips) and a best-day line
- **Frontend editing UX (v0.3 Phase 2)** (`static/core.js:1`, `static/app.js:1`, `static/index.html:61`)
  - Edit modal with title/description/priority/deadline fields; pencil button on every task card; closes via Cancel, overlay click, or `Escape`
  - Timed deadlines via split calendar + clock pickers (`type="date"` / `type="time"`) on create + edit forms, with `min` guard and inline errors so past deadlines can't be entered
  - Red `Overdue` / amber `Due today` badges plus "Due <date>, <time>" labels on cards
  - Sorting: overdue → due-today → rest within each priority band (`TrackerCore.compareTasks`)
  - New dependency-free `static/core.js` (`TrackerCore`) holds all date/sort logic — timezone-safe local-date parsing, past-deadline detection with submit-lag grace — unit-tested headlessly via `node tests/test_core_logic.js` (25 tests)
  - Server enforces the same rule: `POST/PUT` reject newly-set deadlines in the past (`422`, 60s grace), while a task's own overdue deadline stays editable
- **Task due dates + full edit support (v0.3 Phase 1)** (`models.py:14`, `alembic/versions/c3f8a91d2e47_add_tasks_due_date.py:1`, `main.py:111`)
  - `tasks.due_date: DateTime` nullable column via Alembic revision `c3f8a91d2e47`; legacy pre-Alembic DBs get it through `_legacy_fixups` before stamping
  - `POST /tasks/` accepts optional `due_date`
  - `PUT /tasks/{task_id}` now edits too: optional `title`, `description`, `due_date` applied only when explicitly sent (explicit `null` clears); whitespace-only title rejected with `422`
  - Completed tasks stay editable but still cannot be unchecked (`409`)
- **ROADMAP.md** — phased plan for v0.3 (editing/due dates/stats/installer), v0.4 data safety, v0.5 QoL

### Fixed
- **Calendar/clock picker icons invisible in dark mode** (`static/style.css:2`)
  - `color-scheme: light` / `dark` now follows the theme, so native picker glyphs render white in dark mode and the popups themselves render dark
  - `@supports`-guarded `invert()` fallback for engines without `color-scheme`
- **Completed tasks can no longer be unchecked** (`main.py:116`, `static/app.js:305`)
  - `PUT /tasks/{task_id}` now rejects `completed: true → false` with `409 Completed tasks cannot be unchecked`, so toggling a task can never flood the History sidebar with duplicate entries
  - Frontend disables the checkbox for completed tasks (`cursor: not-allowed` + tooltip) so the state can't be changed by accident

### Changed
- History is still append-only, but each completion now records exactly one entry per task (re-checking an already-completed task is a no-op)
- Updated API tests for the new no-uncheck behavior (`tests/test_tasks_api.py`, `tests/test_history_api.py`)

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
