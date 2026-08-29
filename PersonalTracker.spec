# -*- mode: python ; coding: utf-8 -*-
# Personal Tracker v0.4.3 - PyInstaller spec for windowed standalone (pywebview + React)
# Build with: pyinstaller PersonalTracker.spec  (--noconfirm)
# Console is DISABLED for windowed exe (no black console on launch)

import os

# Optional app icon: builds stay green without assets/app.ico,
# and the user-supplied icon is embedded automatically once present.
APP_ICON = 'assets/app.ico'
ICON_ARG = APP_ICON if os.path.exists(APP_ICON) else None

# Include Vite build if present (Electron loads it via file://, but browser fallback serves it)
_dist_datas = []
if os.path.isdir('dist-react'):
    _dist_datas.append(('dist-react', 'dist-react'))
if os.path.isdir('dist'):
    _dist_datas.append(('dist', 'dist'))
if os.path.isdir('static'):
    _dist_datas.append(('static', 'static'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('version.py', '.'),
        ('VERSION', '.'),
        ('alembic', 'alembic'),  # migration scripts - runtime upgrade needs them
    ] + _dist_datas,
    hiddenimports=[
        'webview.platforms.winforms',
        'webview.platforms.edgechromium',
        'clr_loader',
        'pythonnet',
        'alembic',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
    ],
    # PIL/Pillow is only a local-dev convenience (icon conversion); the app
    # never uses it at runtime. Excluding keeps local bundles identical to CI.
    excludes=['PIL', 'PIL._imaging', 'PIL._imagingft'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='PersonalTracker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # <-- CRITICAL: hides console window on exe launch
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=ICON_ARG,
    version='file_version_info.txt',
)
