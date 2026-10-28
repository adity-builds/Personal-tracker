import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent


def _get_db_path() -> str:
    """Return writable DB path.

    Priority: PT_DB_PATH env var (tests / custom installs) > frozen exe dir
    (portable) > AppData fallback > project dir in dev.

    The installed exe lives in Program Files (not writable for normal users),
    so we must not try to create tasks.db there — it would fail with
    'unable to open database file' (sqlite3.OperationalError).
    """
    env_path = os.environ.get("PT_DB_PATH")
    if env_path:
        path = Path(env_path).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return str(path)

    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent

        def _is_under_program_files(p: Path) -> bool:
            try:
                for env in ("ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"):
                    pf = os.environ.get(env)
                    if pf:
                        try:
                            if p.is_relative_to(Path(pf).resolve()):
                                return True
                        except Exception:
                            pass
                s = str(p).lower()
                if "program files" in s or "progra~" in s:
                    return True
            except Exception:
                pass
            return False

        # Only use the exe dir for portable installs (writable locations).
        # Program Files is never writable for a standard user, so fall back to
        # %APPDATA%\PersonalTracker there — os.access is unreliable on Windows
        # with UAC, so we use a path heuristic + actual write test.
        try:
            if not _is_under_program_files(exe_dir) and exe_dir.exists():
                try:
                    probe = exe_dir / ".writetest.tmp"
                    probe.touch(exist_ok=True)
                    probe.unlink(missing_ok=True)
                    candidate = exe_dir / "tasks.db"
                    candidate.parent.mkdir(parents=True, exist_ok=True)
                    return str(candidate)
                except Exception:
                    pass
        except Exception:
            pass
        appdata = os.environ.get("APPDATA") or str(Path.home())
        data_dir = Path(appdata) / "PersonalTracker"
        data_dir.mkdir(parents=True, exist_ok=True)
        # One-time migration: if an old DB was created in Program Files
        # during an elevated first run, move it to AppData so the user
        # doesn't lose data and doesn't keep hitting the permission error.
        try:
            old_candidate = exe_dir / "tasks.db"
            new_candidate = data_dir / "tasks.db"
            if old_candidate.exists() and not new_candidate.exists():
                import shutil

                shutil.copy2(str(old_candidate), str(new_candidate))
        except Exception:
            pass
        return str(data_dir / "tasks.db")

    path = BASE_DIR / "tasks.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


DB_PATH = _get_db_path()
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{Path(DB_PATH).as_posix()}"

# Fast startup: no echo, pre_ping disabled (SQLite file), timeout 15s for busy DB
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15},
    pool_pre_ping=False,
    echo=False,
    future=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()


def _alembic_config():
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{Path(DB_PATH).as_posix()}")
    return cfg


def _legacy_fixups(engine) -> None:
    """Bring pre-Alembic DBs up to the v0.2 baseline shape so they can be
    stamped as head. Mirrors the old hand-rolled migrate() logic."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "tasks" not in tables:
        return  # fresh DB - Alembic creates everything

    task_cols = {col["name"] for col in inspector.get_columns("tasks")}
    stmts = []
    if "priority" not in task_cols:
        stmts.append(
            "ALTER TABLE tasks ADD COLUMN priority VARCHAR DEFAULT 'Medium'"
        )
    if "created_at" not in task_cols:
        stmts.append("ALTER TABLE tasks ADD COLUMN created_at DATETIME")
        stmts.append(
            "UPDATE tasks SET created_at = datetime('now') WHERE created_at IS NULL"
        )
    if "due_date" not in task_cols:
        stmts.append("ALTER TABLE tasks ADD COLUMN due_date DATETIME")

    if "history" not in tables:
        stmts.append(
            "CREATE TABLE history (id INTEGER NOT NULL PRIMARY KEY, "
            "task_id INTEGER, title VARCHAR, description VARCHAR, "
            "priority VARCHAR DEFAULT 'Medium', created_at DATETIME, "
            "completed_at DATETIME)"
        )
        stmts.append(
            "INSERT INTO history (task_id, title, description, priority, "
            "created_at, completed_at) SELECT id, title, description, priority, "
            "created_at, completed_at FROM tasks WHERE completed_at IS NOT NULL"
        )
    else:
        hist_cols = {col["name"] for col in inspector.get_columns("history")}
        if "created_at" not in hist_cols:
            stmts.append("ALTER TABLE history ADD COLUMN created_at DATETIME")
        if "description" not in hist_cols:
            stmts.append("ALTER TABLE history ADD COLUMN description VARCHAR")
        if "priority" not in hist_cols:
            stmts.append(
                "ALTER TABLE history ADD COLUMN priority VARCHAR DEFAULT 'Medium'"
            )
        stmts.append(
            "UPDATE history SET priority = 'Medium' WHERE priority IS NULL"
        )
        stmts.append(
            """UPDATE history SET created_at = (
                SELECT tasks.created_at FROM tasks WHERE tasks.id = history.task_id
            ) WHERE created_at IS NULL AND task_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = history.task_id
                          AND tasks.created_at IS NOT NULL)"""
        )
        stmts.append(
            "UPDATE history SET created_at = completed_at "
            "WHERE created_at IS NULL AND completed_at IS NOT NULL"
        )
        stmts.append(
            "UPDATE history SET created_at = datetime('now') WHERE created_at IS NULL"
        )

    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


def run_migrations() -> None:
    """Ensure schema is at head.

    - Fresh DB: runs all Alembic migrations.
    - Existing DB without alembic_version (pre-Alembic install): applies
      legacy column fixups, then stamps head to adopt it as-is.
    - Existing DB with alembic_version: upgrades to head normally.
    """
    from alembic import command

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    cfg = _alembic_config()

    if ("tasks" in tables or "history" in tables) and (
        "alembic_version" not in tables
    ):
        _legacy_fixups(engine)
        command.stamp(cfg, "head")
        return

    command.upgrade(cfg, "head")


def _rotate_backups(db_path: str, keep: int = 5) -> None:
    """Keep at most N timestamped backups of the SQLite database.

    Runs once at app startup. Prunes the oldest backups, then copies
    tasks.db -> tasks.db.bak.<timestamp>, so the total never exceeds `keep`.
    Disabled when keep <= 0. Failures never block startup.
    """
    if keep <= 0:
        return
    db = Path(db_path)
    if not db.exists():
        return
    backup_dir = db.parent
    prefix = db.name + ".bak."
    existing = sorted(
        [p for p in backup_dir.iterdir() if p.name.startswith(prefix) and p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    # Leave room for the backup created below so the total stays == keep.
    for old in existing[keep - 1:]:
        try:
            old.unlink()
        except Exception:
            pass
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{db.name}.bak.{timestamp}"
        shutil.copy2(str(db), str(backup_path))
    except Exception:
        pass


def init_db() -> None:
    run_migrations()
    try:
        keep = int(os.environ.get("PT_BACKUP_KEEP", "5"))
    except (TypeError, ValueError):
        keep = 5
    _rotate_backups(DB_PATH, keep=keep)
