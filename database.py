import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent


def _get_db_path() -> str:
    """Return writable DB path.

    Priority: PT_DB_PATH env var (tests / custom installs) > frozen exe dir
    (portable) > AppData fallback > project dir in dev.
    """
    env_path = os.environ.get("PT_DB_PATH")
    if env_path:
        path = os.path.abspath(env_path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    if getattr(sys, "frozen", False):
        # Running as PyInstaller exe
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        candidate = os.path.join(exe_dir, "tasks.db")
        try:
            if os.path.exists(exe_dir) and os.access(exe_dir, os.W_OK):
                return candidate
        except Exception:
            pass
        appdata = os.environ.get("APPDATA") or os.path.expanduser("~")
        data_dir = os.path.join(appdata, "PersonalTracker")
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, "tasks.db")
    else:
        return str(BASE_DIR / "tasks.db")


DB_PATH = _get_db_path()
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _alembic_config():
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
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


def init_db() -> None:
    run_migrations()
