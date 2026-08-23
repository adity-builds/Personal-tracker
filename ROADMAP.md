# Roadmap

Staged plan for Personal Tracker. Done items graduate into [CHANGELOG.md](CHANGELOG.md).
Current release: **v0.3.0** — see [README.md](README.md).

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

## v0.4 — Data safety & portability
- [ ] Export tasks + history to JSON / CSV
- [ ] Import from JSON (merge or replace)
- [ ] Automatic `tasks.db` backup rotation (keep last N)

## v0.5 — Quality of life
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
