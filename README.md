# Personal Tracker — Daily Task Tracker
![Version](https://img.shields.io/badge/version-0.4.3-blue?style=flat) ![Python](https://img.shields.io/badge/python-3.10%2B-3776ab) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688) ![React](https://img.shields.io/badge/React-18-61dafb) ![Electron](https://img.shields.io/badge/Electron-30-47848f) ![License](https://img.shields.io/badge/license-MIT-green)

Glassmorphic desktop app for daily tasks — **pywebview + React + FastAPI + SQLite**. Ships as a frameless windowed `PersonalTracker.exe` (no console) with a proper installer, task editing with deadlines, insights dashboard, Dark/Light theme, and append-only history with timestamps.

> **Latest release: v0.4.3** (2026-08-29) — **Standalone window restored**: `pywebview` frameless window back (like v0.3) + `window.electronAPI`/`pywebview` shim, white dark-mode glyphs, `setup-node 22` lock fix. See [CHANGELOG.md](CHANGELOG.md). Previous: `v0.4.2`.

## ✨ Features (v0.4.3)

- **Glassmorphic dashboard** — Translucent `glass` cards with `backdrop-blur-16`, mesh gradients, `Plus Jakarta Sans` + `Inter`, rounded `16px`, soft shadows (`src/index.css`, `src/App.jsx`)
- **Electron + React** — Vite on `5173` (dev) / `dist-react` (prod), frameless `BrowserWindow` `electron/main.js:42` with `preload.cjs` `electron/preload.cjs:1` for window controls
- **Task editing + deadlines** — Edit modal + calendar/clock pickers, past-deadline blocking (`422`), red `Overdue` / amber `Due today` badges (`src/components/TaskCard.jsx`, `src/utils/core.js:76`)
- **Insights dashboard** — Streak 🔥, all-time total, animated 7-day bar chart (Framer Motion), best day — from immutable history (`src/components/Sidebar.jsx:27`, `main.py:222`)
- **Proper installer** — `PersonalTrackerSetup-v…exe` with Start Menu shortcut + uninstaller (`installer/personal_tracker.iss`); portable `PersonalTracker.exe` + Electron bundle also published (`.github/workflows/release.yml:37`)
- **Completed tasks permanent** — `409` on uncheck, history append-only (`main.py:138`)
- **Dark/Light theme** — `localStorage:daily-tracker-theme` + `prefers-color-scheme` (`src/App.jsx:11`), CSS vars + `color-scheme`

## Project Structure
```
Personal Tracker/
├── main.py                 # FastAPI + pywebview window — serves dist-react / static fallback
├── version.py / VERSION    # Single source of truth (0.4.3)
├── database.py             # Engine + Alembic runner (PT_DB_PATH; frozen-exe paths)
├── models.py               # TaskModel (due_date), HistoryModel
├── schemas.py              # Pydantic schemas incl. StatsSummary
├── electron/
│   ├── main.js             # Electron Main — spawns Python backend, frameless window
│   └── preload.cjs         # IPC bridge (minimize/maximize/close)
├── src/
│   ├── main.jsx            # React entry
│   ├── App.jsx             # Orchestrator (fetch, filter, sort via core.js)
│   ├── index.css           # Tailwind + glassmorphism system
│   ├── utils/
│   │   ├── core.js         # TrackerCore — pure date/sort logic (CJS+ESM, tested via node)
│   │   └── api.js          # Fetch wrappers for /tasks /history /stats
│   └── components/
│       ├── TitleBar.jsx    # Drag region + version + window controls
│       ├── Sidebar.jsx     # Today + Insights + History panels
│       ├── TaskForm.jsx    # Glassmorphic add form
│       ├── Toolbar.jsx     # Search + filters
│       ├── TaskCard.jsx    # Glass card + priority/urgency badges
│       └── EditModal.jsx   # Animated modal (Framer Motion)
├── vite.config.js          # Vite → dist-react (avoids PyInstaller dist collision)
├── tailwind.config.js      # Content: index.html + src/**
├── package.json            # Node 20, React 18, Electron 30, Vite 5
├── static/README.md        # Legacy note (old UI trashed)
├── dist-react/             # Vite build (gitignored, bundled into Electron)
├── alembic/                # Migration chain (baseline + due_date)
├── tests/                  # pytest suite + node tests/test_core_logic.js (now imports from src/utils/core.js)
├── installer/              # Inno Setup script
├── assets/app.ico          # Auto-embedded into exe + installer
├── PersonalTracker.spec    # PyInstaller windowed spec (console=False, dist-react + pywebview)
├── requirements.txt        # FastAPI + uvicorn + sqlalchemy + pydantic + pywebview + alembic + pyinstaller
└── tasks.db                # SQLite (gitignored, %APPDATA% fallback for installed)
```

## 🚀 Quick Start (Development)

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
npm run electron:dev   # concurrently vite + electron (needs Python API running or spawns it)
# or prod preview:
npm run build          # Vite → dist-react
npm run electron       # loads dist-react/index.html + spawns Python backend
```

## 📦 Install on Windows (end users)

Two ways — both on [Releases](https://github.com/adity-builds/Personal-tracker/releases):

| | **Installer** (`PersonalTrackerSetup-v…exe`) | **Portable** (`PersonalTracker.exe`) |
|---|---|---|
| Setup | Wizard, Start Menu, optional desktop icon | none — just run it |
| Install location | `C:\Program Files\PersonalTracker` | anywhere |
| Data (`tasks.db`) | `%APPDATA%\PersonalTracker\tasks.db` | next to exe |
| Removal | Settings → Apps → Uninstall | delete file |

> ⚠️ Different DB locations by design (Program Files not writable). Copy `tasks.db` to migrate.

## 🧱 Build Windowed EXE + Installer
```bash
# 1. Build React
npm ci && npm run build            # -> dist-react/

# 2. Build Python backend exe
pyinstaller PersonalTracker.spec --noconfirm --clean
# Output: dist/PersonalTracker.exe  (~26 MB, windowed, versioned via file_version_info.txt)

# 3. Installer (needs Inno Setup 6)
iscc installer/personal_tracker.iss /DAppVersion=0.4.3
# Output: dist/PersonalTrackerSetup-v0.4.3.exe

# 4. (Optional) Electron bundle
npm run electron:build              # -> dist/*.exe via electron-builder
```

> **Console hidden:** `PersonalTracker.spec:61` `console=False` + `main.py:9` null-guard + `uvicorn` `log_level="warning"`. Electron `frame:false` + hidden titleBar `electron/main.js:44`.

## 🔌 API Endpoints
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/tasks/` | `{title, description?, due_date?, priority?}` | `Task{id, title, description, priority, completed, created_at, completed_at, due_date}` |
| `GET`  | `/tasks/?skip=&limit=` | — | `List[Task]` |
| `PUT`  | `/tasks/{task_id}` | `{completed, title?, description?, priority?, due_date?}` | `Task` (409 on uncheck, 422 on empty title/past deadline) |
| `DELETE` | `/tasks/{task_id}` | — | `{ok: true}` |
| `GET`  | `/history/` | — | `List[DailyCount{date, count, tasks:[{title, description, priority, created_at, completed_at}]}>` |
| `GET`  | `/stats/` | — | `{total_completions, current_streak, best_day, best_day_count, last_7_days[7], by_priority}` |
| `GET`  | `/version` | — | `{version: "0.4.3"}` |
| `GET`  | `/` | — | `dist-react/index.html` (or API status when Electron loads file://) |
| `GET`  | `/docs` | — | Swagger UI |

Completed tasks **permanent** (`409`). History **append-only** — every completion inserts exactly one immutable row.

## 🔧 Configuration
- **Host/Port:** `HOST=127.0.0.1`, `PORT=8000` in `main.py:31`
- **DB path:** `database.py:11` `_get_db_path()` — `PT_DB_PATH` > exe dir (portable, write-probed) > `%APPDATA%\PersonalTracker` > project dir (dev)
- **Version:** `version.py` / `VERSION` — bump both, update `file_version_info.txt` before `pyinstaller`

## 📝 Changelog
See [CHANGELOG.md](CHANGELOG.md). Highlights for v0.4.3:
- Standalone window restored: `pywebview` frameless `Api` (`main.py:1`) + `window.electronAPI` shim (`TitleBar.jsx:4`), `PYWEBVIEW_DISABLED` for Electron spawn
- No browser needed — double-click `PersonalTracker.exe` opens native window (like v0.3), data still in `%APPDATA%`
- Keeps v0.4.1 perf + dark-mode fixes (white glyphs, `setup-node 22`)

## 🤝 Release Process (for maintainers)
```bash
# 1. Bump version.py / VERSION / file_version_info.txt / README badge / CHANGELOG
# 2. Commit
git add -A
git commit -m "Release v0.4.3"
# 3. Tag & push (triggers Release workflow: Node tests → Python tests → Vite → PyInstaller → Electron → Inno Setup)
git tag v0.4.3
git push origin main --tags
```

## 📄 License
MIT — see original repo.

## 🆘 Troubleshooting
- **React shows “Failed to fetch”:** ensure Python API running: `uvicorn main:app --reload` on `:8000` (`src/utils/api.js:1` `API_BASE`)
- **Port in use:** change `PORT` in `main.py:32` or kill `uvicorn`/`PersonalTracker.exe`
- **DB not found after moving exe:** copy `tasks.db` next to exe or check `%APPDATA%\PersonalTracker\tasks.db`
- **Electron white screen:** `npm run build` first — Electron prod loads `dist-react/index.html` (`electron/main.js:68`)



