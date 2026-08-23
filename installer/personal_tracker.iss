; ============================================================================
; Personal Tracker - Inno Setup installer script (v0.3 Phase 4)
; Compile with:  ISCC.exe installer\personal_tracker.iss /DAppVersion=x.y.z
;
; - Installs the PyInstaller-built exe into Program Files
; - Start Menu shortcut + optional desktop shortcut
; - Registers a proper uninstaller in Add/Remove Programs
; - User data is NEVER touched on uninstall: the app stores tasks.db in
;   %APPDATA%\PersonalTracker when its install dir is not writable.
;
; AppVersion is injected by CI from the VERSION file; the fallback keeps
; local test compiles working.
; ============================================================================

#define MyAppName "Personal Tracker"
#define MyAppExeName "PersonalTracker.exe"
#define MyAppPublisher "adity-builds"
#define RepoRoot SourcePath + "\\.."

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
; Fixed AppId: never change between releases, or updates/uninstalls break.
AppId={{B3F7C2A1-5D9E-4F8B-A6C0-21E9D84713F5}
AppName={#MyAppName}
AppVersion={#AppVersion}
AppVerName={#MyAppName} {#AppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir={#RepoRoot}\dist
OutputBaseFilename=PersonalTrackerSetup-v{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}

#if FileExists(RepoRoot + "\assets\app.ico")
SetupIconFile={#RepoRoot}\assets\app.ico
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#RepoRoot}\dist\PersonalTracker.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

; NOTE: no [UninstallDelete] section on purpose - uninstall must never touch
; user data in %APPDATA%\PersonalTracker.
