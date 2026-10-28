# Changelog

All notable changes to Personal Tracker are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [SemVer](https://semver.org/).

## [0.6.0] - 2026-10-28

### Added
- **Automatic database backups** (`database.py:206` `_rotate_backups`): timestamped `tasks.db.bak.<stamp>` copies created at startup, keeping the latest `PT_BACKUP_KEEP` (default 5, `0` disables); rotation failures never block startup
- **Export endpoints**: `GET /export/json` (tasks + history + metadata) and `GET /export/csv` (download) (`main.py:318`)
- **Import endpoint**: `POST /import/json` with `merge` (upsert tasks, skip duplicate history) and `replace` (clear then restore) modes (`main.py:429`)
- **Settings menu** (`src/components/SettingsMenu.jsx`): Light/Dark theme, 12h/24h clock, Aurora speed/amplitude/blend sliders, reset, and Data Safety panel for export/import
- **Aurora background** (`src/components/Aurora.jsx`): WebGL/OGL shader with theme-aware colors, CSS-mesh fallback, reduced-motion handling, live prop updates
- **CI guards**: `npm run lint` and a cross-file version consistency check in the release workflow

### Changed
- **Electron bundle is self-contained**: PyInstaller backend is copied to `resources/backend/PersonalTracker.exe` via `extraResources` and spawned with `--api-only`; output moved to `dist-electron` so it no longer collides with the portable `dist/PersonalTracker.exe`; packaged Electron defaults to `%APPDATA%\PersonalTracker\tasks.db` (overridable with `PT_DB_PATH`)
- **Version bump** `0.5.0 → 0.6.0` (`version.py`, `VERSION`, `package.json`, `package-lock.json`, `file_version_info.txt`, README)
- **Lint stack**: ESLint 9 flat config + `eslint-plugin-react` + `eslint-plugin-react-hooks`; renderer code is lint-clean

### Fixed
- **Rules-of-hooks violation** in `InsightsPanel` — `useMemo` now runs before loading/error early returns (`src/components/Sidebar.jsx`)
- **Stale memo dependencies** in `TaskCard` callbacks (`src/components/TaskCard.jsx`)
- **Import did not refresh the UI** — Settings now calls back into `App` after a successful import (`src/components/SettingsMenu.jsx`, `src/App.jsx`)
- **Recursive PyInstaller payload**: `dist/` is no longer bundled into the exe, cutting it from ~80 MB to ~26 MB and avoiding accidental inclusion of `tasks.db` (`PersonalTracker.spec`)
- **Electron CI resilience**: release workflow retries without exe metadata editing when Windows symlink privileges are unavailable, then asserts the bundled backend exists
- **Repo hygiene**: DB backup files and Electron output dirs ignored by git, package metadata encoding corrected, scratch debug file removed

## [0.5.0] - 2026-09-02

### Added
- **3-column dashboard** (`src/App.jsx:222`): `TodayCard`+`InsightsPanel` left `[300px]`, `TaskForm`+list center `1fr`, `HistoryPanel` right `[340px]` — `max-w-[1420px]` + `lg:sticky top-[72px]` so no vertical scroll in `1440×900` window; mobile `Panels` toggle `src/App.jsx:180`
- **Live clock** (`src/components/LiveClock.jsx:1`, `src/hooks/useNow.js:1`): per-second `useNow(1000)` isolated from `App useNow(60000)`, 12h/24h switch `localStorage:tracker-clock-24h` `src/App.jsx:31`
- **Adaptive window** (`main.py:407` `_adaptive_size`, `electron/main.js:92` `getAdaptiveSize`): DPI-aware `GetSystemMetrics` / `screen.getPrimaryDisplay().workAreaSize` → `min(1440, sw*0.92)` × `min(900, sh*0.88)` clamped `980×640`, `center:true`; fits `1366×768→1311×706`, `1920×1080→1440×900`

### Changed
- **Light mesh stronger** (`src/index.css:112`): `hsla 0.065/0.03/0.04/0.014 42%/48%/52%` → `0.12/0.065/0.085/0.038 58%/56%/60%` — visible ink mixing on `40 20% 98%` background, animation still `32s` `meshMove`
- Version bump `0.4.3→0.5.0` (`version.py:1`, `VERSION:1`, `file_version_info.txt:8`, `package.json:3`, `README.md:2`)

### Fixed
- `uvicorn main:app` from `node_modules` → `Could not import module "main"` — docs now stress running from project root `README.md:65`

## [0.4.3] - 2026-08-29

### Added
- **Standalone window restored** (`main.py:1`): frameless `pywebview` `Api` (`minimize`/`toggle_maximize`/`close`) + `threading` + `wait_for_server`, loads `http://127.0.0.1:8000/` (`dist-react/index.html`). `PYWEBVIEW_DISABLED=1` for Electron spawn `electron/main.js:74`, `requirements.txt:6` `pywebview==6.2.1` + `pythonnet`/`clr_loader`, `PersonalTracker.spec:32` `webview` hiddenimports

### Changed
- `src/components/TitleBar.jsx:4` shim `window.electronAPI` ↔ `window.pywebview.api` for `minimize`/`toggleMaximize`/`close`, so `21 MB` Inno installer is windowed again (no browser needed, like v0.3.2)
- `README.md:4` `pywebview + React`, `ROADMAP.md:40` Phase 8

### Fixed
- N/A — window was missing in `v0.4.2` Inno `21 MB` (API-only `main.py:290` headless)

## [0.4.2] - 2026-08-29

### Fixed
- **Release `npm ci` lock out-of-sync** (`package-lock.json:1`, `.github/workflows/release.yml:27`): `electron-builder` missing deps (`electron-builder-squirrel-windows` `archiver` `picomatch` mismatch) — regenerated lock with `npm 11` (`Node 26`), bumped `setup-node` `20→22`, added fallback `npm ci || npm install` for resilience
- **CI Python 3.11 compat**: `main.py:15` revert `list[Task]` → `List[Task]` + `from typing import List`, `PersonalTracker.spec:49` `optimize 2→0` (avoids PyInstaller `tzdata` warnings on `windows-latest`)
- Bump `0.4.1→0.4.2` (`VERSION`, `version.py`, `file_version_info.txt:8`, `package.json:3`)

## [0.4.1] - 2026-08-29

### Added
- N/A

### Changed
- **Performance**: `vite.config.js:27` `target:esnext` + `esbuild` + `manualChunks` (react/motion split), `optimizeDeps` — build 53s → 9s, initial JS 304k → 46k + 134k react (motion 122k lazy) `src/App.jsx:7`
- **Frontend memoization**: `App.jsx:42` `useCallback` `loadAll`, isolated `keydown` effect, `TaskCard.jsx:1` `memo` + `useMemo` + CSS fade vs `motion.layout`, `Sidebar.jsx:40` `memo` + `useMemo` week/max, `Toolbar.jsx:1` `memo`, history capped 20 per day
- **Backend**: `database.py:93` `timeout 15` + `expire_on_commit False`, `schemas.py:1` `ConfigDict` (clears 88 warnings), `main.py:42` lazy `uvicorn` + cached `_find_index`, clamped pagination `main.py:128`, single-pass `GET /history/` `main.py:184` + `GET /stats/` `main.py:225` (select only needed cols)
- **Electron**: `electron/main.js:19` exponential backoff `waitForServer`, `windowsHide:true`, `backgroundThrottling:false`, removed duplicate `electron/preload.js` → `preload.cjs` only

### Fixed
- **Dark mode — calendar/clock glyphs invisible** (`src/index.css:164`): added `color-scheme: light/dark` on `:root`/`.dark` + `input[type=date/time]` + `select`, `.dark ::-webkit-calendar-picker-indicator { filter:invert(1) }` now white (was `0.75` and violet-300 lucide), `select option` dark bg `#1e293b white`
- **Dropdowns "All priorities"/filter invisible** (`src/components/Toolbar.jsx:18`, `TaskForm.jsx:81`): `dark:border-white/15 dark:bg-slate-800`, `select dark:text-white`, `option dark:bg-slate-800 dark:text-white`, `select {color-scheme:dark}` in `.dark`
- **Completion bubble invisible in dark** (`src/components/TaskCard.jsx:40`): `bg-card dark:bg-white/[0.06] border-border dark:border-white/25` + `hover:border-violet-500` + `shadow-sm` + affordance dot `group-hover:bg-violet-500/20`, focus ring `ring-violet-500/40`

## [0.4.0] - 2026-08-25

### Added
- **Complete UI rebuild — Electron + React** (`src/`, `electron/`, `vite.config.js:1`, `tailwind.config.js:1`, `package.json:1`)
  - Old `static/index.html` / `app.js` / `style.css` **trashed** (kept `static/README.md` as note); `static/core.js` ported to `src/utils/core.js:1` (ESM+CJS, still tested via `node tests/test_core_logic.js` — 29 tests)
  - Vite 5 + Tailwind 3 + Framer Motion + lucide-react + Inter/Plus Jakarta Sans
  - Glassmorphic system: `glass` / `glass-strong` + `gradient-mesh` + `backdrop-blur-16` + mesh gradients (`src/index.css:1`)
  - React components: `TitleBar` (drag + `window.electronAPI` `electron/preload.cjs:1`), `Sidebar` (Today/Insights/History `src/components/Sidebar.jsx:27`), `TaskForm` (`src/components/TaskForm.jsx:1`), `Toolbar`, `TaskCard` (`src/components/TaskCard.jsx:1`), `EditModal` (`src/components/EditModal.jsx:1`) — all with motion animations

### Changed
- **Electron shell** (`electron/main.js:1`): frameless `BrowserWindow` (1280×820), spawns Python backend (`spawn python main.py` `electron/main.js:45`), `waitForServer` polling, `preload.cjs` bridge for minimize/maximize/close. Dev loads `http://localhost:5173`, prod loads `dist-react/index.html` via `file://`
- **Backend is now API-only** (`main.py:1`): removed `pywebview`, `Api` class, `threading`+`wait_for_server`; `main.py:35` mounts `dist-react` + legacy `static` and prefers `dist-react/index.html`; `run_server()` `main.py:290` is plain `uvicorn`
- **Build pipeline**: `vite.config.js:10` `outDir: 'dist-react'` (avoids PyInstaller `dist` collision), `PersonalTracker.spec:12` bundles `dist-react` if present and drops `pywebview` hiddenimports, `.gitignore:1` adds `dist-react/` + `node_modules/`, `requirements.txt:1` drops `pywebview`/`pythonnet`/`clr_loader`/`pywin32-ctypes`
- **Tests**: `tests/test_core_logic.js:1` now `import` from `src/utils/core.js` and is ESM (package.json `type: module`); CJS compat added to `src/utils/core.js:95` for fallback
- **Release workflow** (`.github/workflows/release.yml:1`): adds Node 20 + `npm ci` + `node tests/test_core_logic.js` + `pytest` + `npm run build` before PyInstaller + optional `electron-builder` step
- Version bump `0.3.2` → `0.4.0` (`version.py:1`, `VERSION:1`, `file_version_info.txt:8` `filevers=(0,4,0,0)`, README badge)

### Removed
- `pywebview` desktop wrapper and all vanilla JS UI assets (`static/app.js`, `static/style.css`, `static/index.html`, `static/core.js`)

## [0.3.2] - 2026-08-23

### Fixed
- **Installer still shows "unable to open database file" on some machines — 8.3 short-name edge case** (`database.py:21`)
  - `Path.resolve()` on some systems returns `C:\PROGRA~1\...` which the old `"program files" in path` check missed; now also checks `PROGRA~` and the actual `ProgramFiles` env vars via `is_relative_to()`
  - Verified with mocked `PROGRA~1` install path falling back to `%APPDATA%\PersonalTracker`

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

