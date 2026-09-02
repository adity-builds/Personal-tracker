# Roadmap

Staged plan for Personal Tracker. Done items graduate into [CHANGELOG.md](CHANGELOG.md).
Current release: **v0.5.0** — see [README.md](README.md).

---

## v0.4 — Glassmorphic Electron + React Rebuild ✅

### Phase 1 — Trash & Scaffold ✅
- [x] `static/` vanilla UI trashed (`index.html`/`app.js`/`style.css`/`core.js` removed, `static/README.md` stub)
- [x] Scaffold `package.json` (React 18 + Vite 5 + Electron 30 + Tailwind 3 + Framer Motion + lucide-react)
- [x] `vite.config.js` `outDir: dist-react` to avoid PyInstaller `dist` collision
- [x] Port `TrackerCore` to `src/utils/core.js` (ESM+CJS, 29 headless tests via `node tests/test_core_logic.js`)
- [x] Remove `pywebview` from `requirements.txt` / `PersonalTracker.spec` (drop webview hiddenimports)

### Phase 2 — Glassmorphic Design System ✅
- [x] `src/index.css` — Tailwind + `glass`/`glass-strong` + `gradient-mesh` + dark/light CSS vars + custom scrollbars
- [x] `tailwind.config.js` — brand fonts (Inter + Plus Jakarta Sans), glassmorphic tokens, animations

### Phase 3 — React Components ✅
- [x] `src/components/TitleBar.jsx` — frameless drag + version badge + `window.electronAPI`
- [x] `src/components/Sidebar.jsx` — `TodayCard` (gradient) + `InsightsPanel` (streak/flame + animated 7-day bars) + `HistoryPanel` (grouped by date)
- [x] `src/components/TaskForm.jsx` — glassmorphic add form with date/time/priority + `Core.combineDeadline` + grace validation
- [x] `src/components/TaskCard.jsx` — glass card, `dueStatus` badges (Overdue/Due today), priority/status pills, motion layout
- [x] `src/components/Toolbar.jsx` — search + priority/status filters
- [x] `src/components/EditModal.jsx` — Framer Motion animated modal, `sameMinute` overdue-keep logic
- [x] `src/App.jsx` — orchestrator: `fetchTasks`/`History`/`Stats`, `Core.compareTasks` sort, `Ctrl+K` focus, theme hook

### Phase 4 — Electron Shell + API-only Backend ✅
- [x] `electron/main.js` — frameless 1280×820, `waitForServer`, `spawn python main.py` fallback, `dist-react/index.html` file:// load
- [x] `electron/preload.cjs` — `contextBridge` IPC for minimize/maximize/close
- [x] `main.py` — stripped to API-only (no pywebview/Api/threading), mounts `dist-react` + `static`, `run_server()` plain uvicorn
- [x] `src/utils/api.js` — `API_BASE=http://127.0.0.1:8000` fetch wrappers with `apiError` detail parsing

### Phase 5 — Build & Release ✅
- [x] `npm ci` + `node tests/test_core_logic.js` + `pytest -q` + `npm run build` + `pyinstaller` + `electron-builder` in `.github/workflows/release.yml`
- [x] Bump `version.py` / `VERSION` / `file_version_info.txt` / README badge `0.4.0`

### Phase 6 — Perf & Dark-Mode Polish (v0.4.1) ✅
- [x] Backend: `schemas.py` `ConfigDict`, `database.py` pool tuning, `main.py` lazy `uvicorn`, cached `dist-react/index.html`, clamped pagination, single-pass `stats`/`history`
- [x] Frontend: `App.jsx` `useCallback` + `Suspense` lazy `EditModal`, `TaskCard` `memo` + CSS vs motion, `Sidebar` `memo` + `useMemo` week, `vite.config.js` `esnext` + `manualChunks` (react 134k / motion 122k / index 46k) — build 53s→9s
- [x] Dark-mode: `color-scheme` + `invert(1)` white picker glyphs, white `select` options, high-contrast completion bubble (`src/index.css:164`, `Toolbar.jsx:18`, `TaskCard.jsx:40`)

### Phase 7 — Release Hotfix (v0.4.2) ✅
- [x] Fix `npm ci` lock out-of-sync: regenerate `package-lock.json` (npm 11, 463 packages), `setup-node 20→22`, fallback `npm ci || npm install` (`.github/workflows/release.yml:27`)
- [x] Python 3.11 compat: `main.py:15` revert `list[Task]` → `List[Task]`, `PersonalTracker.spec:49` `optimize 2→0`

### Phase 8 — Standalone Window Restore (v0.4.3) ✅
- [x] Bring back `pywebview` window: `main.py:1` frameless `Api` + `threading` + `wait_for_server`, `requirements.txt:6` `pywebview==6.2.1`, `PersonalTracker.spec:32` `webview` hiddenimports, `PYWEBVIEW_DISABLED=1` for Electron spawn `electron/main.js:74`
- [x] `TitleBar.jsx:4` shim `window.electronAPI` ↔ `window.pywebview.api` (`minimize`/`toggle_maximize`/`close`), `src/index.css:22` white glyphs already in v0.4.1, `21 MB` Inno now windowed again (no browser needed)

---

## v0.3 — Editing, Due Dates, Stats & Installer ✅

### Phase 1 — Data layer + edit API ✅
- [x] `tasks.due_date: DateTime, nullable` — new Alembic revision on top of baseline
- [x] `_legacy_fixups()` adds `due_date` for pre-Alembic DBs (they are stamped at head, so fixups must stay schema-complete)
- [x] `POST /tasks/` accepts optional `due_date`
- [x] `PUT /tasks/{task_id}` becomes a full edit endpoint: optional `title`, `description`, `priority`, `due_date` (explicit `null` clears a value; omitted fields stay untouched)
  - Empty/whitespace title rejected with `422`
  - Completed tasks remain editable but still cannot be unchecked (`409`)
- [x] Tests: edit endpoint, due-date set/clear, validation, migration column assertions

### Phase 2 — Frontend editing UX ✅
- [x] Edit modal (reuses form styles), pencil button on task cards
- [x] Deadline input (`datetime-local` — date + time) on create + edit forms
- [x] Past deadlines blocked at entry: `min` attribute, inline validation, server-side `422` with 60s grace; a task's own overdue deadline stays editable
- [x] Badges: red `Overdue`, amber `Due today`; "Due <date>, <time>" label
- [x] Sort overdue / due-today tasks first within the same priority
- [x] Headless logic tests (`node tests/test_core_logic.js`) + live-server smoke checks

### Phase 3 — Insights dashboard ✅
- [x] `GET /stats/` computed from immutable history: current streak, total completions, last-7-days trend, per-priority counts, best day
- [x] Sidebar stats panel: streak indicator + inline-SVG 7-day bar chart (no chart library)
- [x] Tests: `tests/test_stats_api.py` (streak anchoring/gaps, window boundaries, tie-breaks) + live smoke checks

### Phase 4 — Proper Windows installer ✅
- [x] Inno Setup script wrapping `dist/PersonalTracker.exe`: Start Menu shortcut, uninstaller, Program Files install with data kept in `%APPDATA%\PersonalTracker`
- [x] Release workflow builds portable exe **and** `PersonalTrackerSetup-v<version>.exe`, attaches both to the GitHub Release
- [x] Icon wiring ready: dropping `assets/app.ico` in embeds it into the exe, installer wizard, and shortcuts (builds green without it)
- [ ] User-supplied `assets/app.ico` (awaiting icon file)
- [ ] First real installer build verified on tag push (CI)

### Phase 5 — Release v0.3.0 ✅
- [x] Bump `version.py` / `VERSION` / `file_version_info.txt` / README badge
- [x] Finalize CHANGELOG, tag `v0.3.0`, publish release

---

## v0.5 — Layout + Adaptive Window (released 2026-09-02) ✅
- [x] 3-column dashboard, adaptive window, light mesh, LiveClock (see CHANGELOG 0.5.0)
- [x] Bump `version.py` / `VERSION` / `file_version_info.txt` / `package.json` / README / CHANGELOG to `0.5.0`

## v0.6 — Data safety & portability
- [ ] Export tasks + history to JSON / CSV
- [ ] Import from JSON (merge or replace)
- [ ] Automatic `tasks.db` backup rotation (keep last N)

## v0.7 — Quality of life
- [ ] Reminders / desktop notifications for tasks due today
- [ ] Keyboard shortcuts (`N` new task, `/` search, etc.)
- [ ] CI workflow running pytest on every push/PR

---

## Future / deferred
- **Recurring habit tasks** — respawn-on-complete model chosen (clone task on completion, original stays in history); deferred until after v0.3
- **Code signing** — requires a certificate purchase; eliminates SmartScreen warnings
- **Web / LAN access** — uvicorn already serves HTTP; needs authentication before exposing beyond localhost
- **Cloud sync** — big jump: accounts, conflict resolution; only after local features mature

## Decisions log
| Decision | Rationale |
|----------|-----------|
| Completed tasks are permanent (`409` on uncheck) | Prevents toggle-spam duplicating history (fixed in v0.2.x) |
| History is append-only and immutable | Reliable audit trail; powers future stats |
| Desktop-first local app, installer-grade packaging | Single-user product; no auth/sync complexity yet |
| No recurring tasks until after v0.3 | Core editing/stats first |


