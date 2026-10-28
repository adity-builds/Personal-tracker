# Personal Tracker — Daily Task Tracker
![Version](https://img.shields.io/badge/version-0.6.0-blue?style=flat) ![Python](https://img.shields.io/badge/python-3.10%2B-3776ab) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688) ![React](https://img.shields.io/badge/React-18-61dafb) ![Electron](https://img.shields.io/badge/Electron-30-47848f) ![License](https://img.shields.io/badge/license-MIT-green)

Desktop daily-task tracker — **pywebview + React + FastAPI + SQLite**. Ships as a frameless windowed `PersonalTracker.exe` (no console) with an Inno Setup installer, task editing with deadlines, an insights dashboard, Dark/Light theme, an animated Aurora background, and append-only history with timestamps. **v0.6.0 adds data safety**: rotating database backups, JSON/CSV export, JSON import (merge or replace), and a Settings menu.

> **Latest release: v0.6.0** (2026-10-28) — **data safety + settings**: automatic backup rotation (`database.py:206`), `/export/json`, `/export/csv`, `/import/json` (`main.py:318`), Settings menu with theme/clock/Aurora controls (`src/components/SettingsMenu.jsx`), self-contained Electron backend bundling (`electron/main.js`). See [CHANGELOG.md](CHANGELOG.md).

## Features (v0.6.0)

- **Glassmorphic dashboard** — translucent cards, mesh gradients, `Plus Jakarta Sans` + `Inter`, rounded corners, soft shadows (`src/index.css`, `src/App.jsx`)
- **Animated Aurora background** — WebGL (OGL) shader with theme-aware colors, CSS-mesh fallback, reduced-motion support, and speed/amplitude/blend controls (`src/components/Aurora.jsx`)
- **Settings menu** — Light/Dark theme, 12h/24h clock, Aurora controls with reset, live preview (`src/components/SettingsMenu.jsx`)
- **Data safety** — automatic timestamped `tasks.db` backups on startup (keep last N via `PT_BACKUP_KEEP`, default 5), JSON/CSV export, JSON import in `merge` or `replace` mode (`database.py`, `main.py`)
- **Task editing + deadlines** — edit modal with calendar/clock pickers, past-deadline blocking (`422`), red `Overdue` / amber `Due today` badges (`src/components/TaskCard.jsx`, `src/utils/core.js`)
- **Insights dashboard** — streak, all-time total, animated 7-day bar chart, best day — computed from immutable history (`src/components/Sidebar.jsx`, `main.py:258`)
- **Completed tasks permanent** — `409` on uncheck, history append-only (`main.py:171`)
- **Live clock** — isolated per-second tick with 12h/24h switch (`src/components/LiveClock.jsx`, `src/hooks/useNow.js`)
- **Adaptive window** — auto-fits the primary display (`main.py`, `electron/main.js`)
- **Proper installer** — `PersonalTrackerSetup-v*.exe` with Start Menu shortcut + uninstaller (`installer/personal_tracker.iss`); portable `PersonalTracker.exe` and Electron bundle also published

## Project Structure
```
Personal Tracker/
├── main.py                 # FastAPI + pywebview window — serves dist-react / static fallback
├── version.py / VERSION    # Single source of truth (0.6.0)
├── database.py             # Engine, Alembic runner, backup rotation (PT_DB_PATH; frozen-exe paths)
├── models.py               # TaskModel (due_date), HistoryModel
├── schemas.py              # Pydantic schemas incl. StatsSummary
├── electron/
│   ├── main.js             # Electron main — spawns/bundles Python backend, frameless window
│   └── preload.cjs         # IPC bridge (minimize/maximize/close)
├── src/
│   ├── main.jsx            # React entry
│   ├── App.jsx             # Orchestrator (fetch, filter, sort via core.js)
│   ├── index.css           # Tailwind + design system
│   ├── utils/
│   │   ├── core.js         # TrackerCore — pure date/sort logic (ESM+CJS, tested via node)
│   │   └── api.js          # Fetch wrappers for tasks/history/stats/export/import
│   ├── hooks/useNow.js     # Realtime clock hook
│   └── components/
│       ├── TitleBar.jsx    # Drag region + version + window controls
│       ├── Sidebar.jsx     # Today + Insights + History panels
│       ├── TaskForm.jsx    # Add form with date/time/priority
│       ├── Toolbar.jsx     # Search + filters
│       ├── TaskCard.jsx    # Task card + priority/urgency badges
│       ├── EditModal.jsx   # Animated edit modal
│       ├── LiveClock.jsx   # 12h/24h live clock
│       ├── SettingsMenu.jsx # Theme, clock, Aurora, data safety
│       └── Aurora.jsx      # WebGL animated background
├── vite.config.js          # Vite → dist-react
├── package.json            # React 18, Electron 30, Vite 5, ESLint 9
├── static/README.md        # Legacy note (old UI removed)
├── dist-react/             # Vite build (gitignored, bundled into Electron)
├── alembic/                # Migration chain (baseline + due_date)
├── tests/                  # pytest suite + node tests/test_core_logic.js
├── installer/              # Inno Setup script
├── assets/app.ico          # Embedded into exe + installer
├── PersonalTracker.spec    # PyInstaller windowed spec (console=False)
├── requirements.txt        # FastAPI + uvicorn + sqlalchemy + pydantic + pywebview + alembic + pyinstaller
└── tasks.db                # SQLite (gitignored, %APPDATA% fallback for installed)
```

## Quick Start (Development)

### Backend (Python API)
```bash
pip install -r requirements.txt
# optional dev deps for pytest
pip install -r requirements-dev.txt

uvicorn main:app --reload
# -> http://127.0.0.1:8000 and http://127.0.0.1:8000/docs
```

### Frontend (React + Vite)
```bash
npm ci            # Node 20+
npm run dev       # -> http://localhost:5173 (Vite)
# keep Python API running on :8000 — React fetches from http://127.0.0.1:8000
```

### Desktop (Electron)
```bash
npm run electron:dev   # concurrently vite + electron (spawns the Python backend)
# or prod preview:
npm run build          # Vite → dist-react
npm run electron       # loads dist-react/index.html + spawns Python backend
```

### Standing checks
```bash
npm run lint                     # ESLint 9 flat config
node tests/test_core_logic.js    # 29 frontend logic tests
pytest -q                        # 56 API/migration/data-safety tests
```

## Install on Windows (end users)

Two ways — both on [Releases](https://github.com/adity-builds/Personal-tracker/releases):

| | **Installer** (`PersonalTrackerSetup-v*.exe`) | **Portable** (`PersonalTracker.exe`) |
|---|---|---|
| Setup | Wizard, Start Menu, optional desktop icon | none — just run it |
| Install location | `C:\Program Files\PersonalTracker` | anywhere |
| Data (`tasks.db`) | `%APPDATA%\PersonalTracker\tasks.db` | next to exe |
| Removal | Settings → Apps → Uninstall | delete file |

> Different DB locations by design (Program Files is not writable). Copy `tasks.db` to migrate.

## Build Windowed EXE + Installer
```bash
# 1. Build React
npm ci && npm run build            # -> dist-react/

# 2. Build Python backend exe
npm run backend:build              # pyinstaller PersonalTracker.spec --noconfirm --clean
# Output: dist/PersonalTracker.exe (~26 MB, windowed, versioned via file_version_info.txt)

# 3. Installer (needs Inno Setup 6)
iscc installer/personal_tracker.iss /DAppVersion=0.6.0
# Output: dist/PersonalTrackerSetup-v0.6.0.exe

# 4. (Optional) Self-contained Electron bundle
# Requires dist/PersonalTracker.exe from step 2 (bundled via extraResources)
npm run electron:build             # -> dist-electron/*.exe via electron-builder
npm run electron:build:fallback    # use when Windows denies winCodeSign symlink privileges
```

> **Console hidden:** `PersonalTracker.spec` `console=False` + `main.py:9` null-guard + `uvicorn` `log_level="warning"`. Electron uses `frame:false` + hidden title bar.

## API Endpoints
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/tasks/` | `{title, description?, due_date?, priority?}` | `Task{id, title, description, priority, completed, created_at, completed_at, due_date}` |
| `GET`  | `/tasks/?skip=&limit=` | — | `List[Task]` |
| `PUT`  | `/tasks/{task_id}` | `{completed, title?, description?, priority?, due_date?}` | `Task` (409 on uncheck, 422 on empty title/past deadline) |
| `DELETE` | `/tasks/{task_id}` | — | `{ok: true}` |
| `GET`  | `/history/` | — | `List[DailyCount{date, count, tasks:[...]}]` |
| `GET`  | `/stats/` | — | `{total_completions, current_streak, best_day, best_day_count, last_7_days[7], by_priority}` |
| `GET`  | `/export/json` | — | Full tasks + history dump with metadata |
| `GET`  | `/export/csv` | — | Full tasks + history CSV download |
| `POST` | `/import/json` | `{mode: "merge"\|"replace", data: {tasks, history}}` | `{imported_tasks, imported_history, skipped, mode}` |
| `GET`  | `/version` | — | `{version: "0.6.0", name: "Personal Tracker"}` |
| `GET`  | `/` | — | `dist-react/index.html` (or API status when Electron loads `file://`) |
| `GET`  | `/docs` | — | Swagger UI |

Completed tasks are **permanent** (`409`). History is **append-only** — every completion inserts exactly one immutable row.

## Configuration
- **Host/Port:** `HOST=127.0.0.1`, `PORT=8000` in `main.py`
- **DB path:** `database.py` `_get_db_path()` — `PT_DB_PATH` > exe dir (portable, write-probed) > `%APPDATA%\PersonalTracker` > project dir (dev)
- **Backups:** `PT_BACKUP_KEEP` (default `5`; `0` disables) — timestamped copies created at startup
- **Version:** `version.py` / `VERSION` — bump both plus `package.json` and `file_version_info.txt` before building

## Changelog
See [CHANGELOG.md](CHANGELOG.md). Highlights for v0.6.0:
- Rotating SQLite backups + JSON/CSV export + JSON import (merge/replace)
- Settings menu: theme, 12/24h clock, Aurora speed/amplitude/blend
- Animated WebGL Aurora background with CSS fallback
- Self-contained Electron build (bundled PyInstaller backend), lint + version checks in CI

Previous v0.5.0: 3-column dashboard, adaptive window, light mesh, LiveClock.

## Release Process (for maintainers)
```bash
# 1. Bump VERSION / version.py / package.json / file_version_info.txt / README badge / CHANGELOG
# 2. Verify everything
npm run lint
node tests/test_core_logic.js
pytest -q
npm run build
# 3. Commit
git add -A
git commit -m "Release v0.6.0"
# 4. Tag & push (triggers Release workflow: lint → node tests → pytest → version check → Vite → PyInstaller → Electron → Inno Setup)
git tag v0.6.0
git push origin main --tags
```

## License
MIT — see original repo.

## Troubleshooting
- **React shows "Failed to fetch":** ensure the Python API is running: `uvicorn main:app --reload` on `:8000`
- **Port in use:** change `PORT` in `main.py` or kill `uvicorn`/`PersonalTracker.exe`
- **DB not found after moving exe:** copy `tasks.db` next to the exe or check `%APPDATA%\PersonalTracker\tasks.db`
- **Electron white screen:** `npm run build` first — Electron prod loads `dist-react/index.html`
- **Electron backend missing in packaged build:** run the PyInstaller step before `npm run electron:build`; `dist/PersonalTracker.exe` is bundled via `extraResources`
- **Lost data:** restore the newest `tasks.db.bak.*` next to your database, or import an exported JSON backup from Settings → Data Safety
