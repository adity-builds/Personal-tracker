import os
import sys
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

def _get_db_path() -> str:
    """Return writable DB path. In frozen exe use exe dir or AppData, else project dir."""
    if getattr(sys, "frozen", False):
        # Running as PyInstaller exe
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        # Try exe dir first (portable), fallback to AppData if not writable
        candidate = os.path.join(exe_dir, "tasks.db")
        try:
            # test writability
            if os.path.exists(exe_dir) and os.access(exe_dir, os.W_OK):
                return candidate
        except Exception:
            pass
        # Fallback to AppData/Roaming/PersonalTracker
        appdata = os.environ.get("APPDATA") or os.path.expanduser("~")
        data_dir = os.path.join(appdata, "PersonalTracker")
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, "tasks.db")
    else:
        # Dev: project root
        base = os.path.dirname(os.path.abspath(__file__))
        return os.path.join(base, "tasks.db")

DB_PATH = _get_db_path()
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def migrate():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "tasks" in tables:
        columns = {col["name"] for col in inspector.get_columns("tasks")}
        if "priority" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN priority VARCHAR DEFAULT 'Medium'"))
        if "created_at" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN created_at DATETIME"))
                # backfill existing rows with current timestamp
                conn.execute(text("UPDATE tasks SET created_at = datetime('now') WHERE created_at IS NULL"))
        # completed_at may be DATE; keep as is (SQLite stores as TEXT) but ensure it can hold DATETIME
        # no structural migration needed - existing DATE values remain valid ISO dates

    if "history" in tables:
        columns = {col["name"] for col in inspector.get_columns("history")}
        # add missing columns for immutable history with timestamps
        if "created_at" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE history ADD COLUMN created_at DATETIME"))
        if "description" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE history ADD COLUMN description VARCHAR"))
        if "priority" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE history ADD COLUMN priority VARCHAR DEFAULT 'Medium'"))
        # backfill created_at from tasks where possible, otherwise completed_at or now
        with engine.begin() as conn:
            # priority default
            conn.execute(text("UPDATE history SET priority = 'Medium' WHERE priority IS NULL"))
            # created_at: try to copy from tasks.created_at via task_id, fallback to completed_at, then now
            conn.execute(text("""
                UPDATE history SET created_at = (
                    SELECT tasks.created_at FROM tasks WHERE tasks.id = history.task_id
                ) WHERE created_at IS NULL AND task_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = history.task_id AND tasks.created_at IS NOT NULL)
            """))
            conn.execute(text("UPDATE history SET created_at = completed_at WHERE created_at IS NULL AND completed_at IS NOT NULL"))
            conn.execute(text("UPDATE history SET created_at = datetime('now') WHERE created_at IS NULL"))
        # ensure history has at least entries for any completed tasks that have not yet been archived (edge: previously single-entry logic left tasks completed but not in history)
        with engine.begin() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM history")).scalar()
        if count == 0:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO history (task_id, title, description, priority, created_at, completed_at) "
                        "SELECT id, title, description, priority, created_at, completed_at FROM tasks WHERE completed_at IS NOT NULL"
                    )
                )
    else:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE history (id INTEGER NOT NULL PRIMARY KEY, "
                    "task_id INTEGER, title VARCHAR, description VARCHAR, priority VARCHAR DEFAULT 'Medium', "
                    "created_at DATETIME, completed_at DATETIME)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO history (task_id, title, description, priority, created_at, completed_at) "
                    "SELECT id, title, description, priority, created_at, completed_at FROM tasks WHERE completed_at IS NOT NULL"
                )
            )
