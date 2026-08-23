# App Icon Assets

Drop your application icon here as **`app.ico`** (a multi-resolution Windows
icon containing at least 256x256, 128x128, 64x64, 48x48, 32x32, 16x16).

When `assets/app.ico` exists:

- `PersonalTracker.spec` embeds it into `PersonalTracker.exe`
- The Inno Setup installer uses it for the wizard and shortcuts
- Start Menu / desktop shortcuts show it automatically (from the exe)

Until then, builds succeed with the default generic icon.
