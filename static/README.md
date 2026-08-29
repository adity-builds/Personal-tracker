# Legacy static folder — DEPRECATED

The old vanilla JS UI (index.html / app.js / style.css / core.js) was **trashed in v0.4.0**.

UI is now **Electron + React + Vite**:

- Source: `src/` (React components, Tailwind, glassmorphism)
- Core logic: `src/utils/core.js` (ported from old static/core.js)
- Build output: `dist-react/` (served by Electron via file://, fallback via FastAPI)
- Electron shell: `electron/main.js` + `electron/preload.cjs`

This folder is kept for PyInstaller bundling compatibility but is no longer used.
Do not add new files here.
