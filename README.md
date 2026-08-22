# Personal Tracker — Daily Task Tracker
![Version](https://img.shields.io/badge/version-0.2.0-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-3776ab)
![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688)
![License](https://img.shields.io/badge/license-MIT-green)

Modern card-based desktop app for daily tasks — **FastAPI + SQLite + pywebview**. Ships as a single windowed `PersonalTracker.exe` (no console) with Dark/Light theme, priority/status badges, and append-only history with timestamps.

> **Latest release: v0.2.0** (2026-08-21) — See [CHANGELOG.md](CHANGELOG.md) for details. Previous tag: `v0.1.0-alpha`.

## ✨ Features (v0.2.0)
- **Dashboard UI** — Rounded cards (`--radius:16px`), `Inter` font, subtle `box-shadow`, `translateY` hover micro-interactions (`static/style.css:1`)
- **Dark/Light theme** — CSS variables (`:root` / `[data-theme="dark"]`), toggle in header (`#theme-toggle`), `localStorage` key `daily-tracker-theme`, `prefers-color-scheme` fallback (`static/app.js:25`)
- **Badges** — `priority-badge` (High/Medium/Low) + `status-badge` (Pending/Completed) (`static/style.css:822`)
- **Empty states** — Illustrated placeholders for no tasks / no results (`static/index.html:99`)
- **Append-only history** — Every completion saves `{title, description, priority, created_at, completed_at}` and groups by date (`main.py:104`, `schemas.py:17`). No more overwrite on completion.
- **Windowed exe** — `console=False` (`PersonalTracker.spec:32`), `ctypes` hide, `uvicorn` `log_level="critical"`, `webview.start(debug=False)` — no black console flash.

## Project Structure
```
Personal Tracker/
├── main.py                 # FastAPI + pywebview launcher (v0.2.0, windowed)
├── version.py / VERSION    # Single source of truth
├── database.py             # Engine + Alembic runner (PT_DB_PATH env override; frozen-exe paths)
├── models.py               # TaskModel, HistoryModel (DateTime timestamps)
├── schemas.py              # Pydantic schemas with HistoryTaskDetail
├── alembic.ini             # Alembic config (dev CLI: autogenerate revisions)
├── alembic/                # Migration chain (alembic/env.py + versions/)
├── tests/                  # pytest suite - pip install -r requirements-dev.txt
├── file_version_info.txt   # Windows exe version resource (0.2.0.0)
├── PersonalTracker.spec    # PyInstaller windowed spec (console=False)
├── static/
│   ├── index.html          # Dashboard + theme toggle + empty states
│   ├── style.css           # CSS variables + cards + badges
│   └── app.js              # Theme persistence + history timestamps
├── requirements.txt        # Pinned deps (+ alembic)
├── requirements-dev.txt    # Test deps (pytest, httpx)
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
# -> http://127.0.0.1:8000  and  http://127.0.0.1:8000/docs

# Or run as desktop app (pywebview frameless window)
python main.py
```

## 📦 Build Windowed EXE (no console)
```bash
# Ensure spec is tracked (v0.2.0 fixes .gitignore)
pyinstaller PersonalTracker.spec --noconfirm --clean
# Output: dist/PersonalTracker.exe  (~23 MB, windowed, version 0.2.0.0)
# DB is created next to exe on first run, or %APPDATA%\PersonalTracker\tasks.db if exe dir is read-only
```

> **Console hidden:** `PersonalTracker.spec:32` `console=False` + `main.py:1` `ctypes ShowWindow(SW_HIDE)` + `sys.stdout` null-guard + `uvicorn` `log_level="critical"` + `disable_windowed_traceback=False` + `webview.start(debug=False)`.

## 🔌 API Endpoints
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/tasks/` | `{title, description?, priority?}` | `Task{id, title, description, priority, completed, created_at, completed_at}` |
| `GET`  | `/tasks/?skip=&limit=` | — | `List[Task]` |
| `PUT`  | `/tasks/{task_id}` | `{completed, priority?}` | `Task` (also appends to history if completing) |
| `DELETE` | `/tasks/{task_id}` | — | `{ok: true}` |
| `GET`  | `/history/` | — | `List[DailyCount{date, count, tasks:[{title, description, priority, created_at, completed_at}]}>` |
| `GET`  | `/version` | — | `{version: "0.2.0"}` |
| `GET`  | `/` | — | `static/index.html` |
| `GET`  | `/docs` | — | Swagger UI |

All history entries are **immutable** — unchecking a task does **not** delete history.

## 🔧 Configuration
- **Host/Port:** `HOST=127.0.0.1`, `PORT=8000` in `main.py:21`
- **DB path:** `database.py:8` `_get_db_path()` — frozen exe uses `sys.executable` dir, fallback to `%APPDATA%\PersonalTracker`. Dev uses project root.
- **Version:** `version.py:1` / `VERSION:1` — bump both, update `file_version_info.txt:6` (`filevers=(0,2,0,0)`) before `pyinstaller`.

## 📝 Changelog
See [CHANGELOG.md](CHANGELOG.md). Highlights for v0.2.0:
- UI overhaul (cards, theme, badges, empty states)
- History append-only with `created_at`/`completed_at` per entry
- Windowed exe hardening (no console)

## 🤝 Release Process (for maintainers)
```bash
# 1. Bump version in version.py / VERSION / file_version_info.txt / README badge / CHANGELOG
# 2. Commit (spec is now tracked!)
git add version.py VERSION file_version_info.txt PersonalTracker.spec main.py database.py models.py schemas.py static/* requirements.txt README.md CHANGELOG.md .gitignore
git commit -m "Release v0.2.0"

# 3. Tag & push (triggers GitHub Release workflow)
git tag v0.2.0
git push origin main --tags
# GitHub Actions (.github/workflows/release.yml) builds windowed exe and creates Release with PersonalTracker.exe
```

## 📄 License
MIT — see original repo.

## 🆘 Troubleshooting
- **Exe shows console:** Rebuild with `PersonalTracker.spec` (`console=False` at line 32) and ensure `main.py` hide logic at top is present. Do not use `pyinstaller main.py --console`.
- **DB not found after moving exe:** Copy `tasks.db` next to exe or check `%APPDATA%\PersonalTracker\tasks.db` (fallback for Program Files installs).
- **Port in use:** Change `PORT` in `main.py` or kill `uvicorn`/`PersonalTracker.exe` still running.
