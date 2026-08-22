"""Migration behavior tests: fresh installs, legacy adoption, stamping."""
import sqlite3

from sqlalchemy import inspect, text

from conftest import PROJECT_ROOT, load_fresh_app

TASK_COLUMNS = {
    "id",
    "title",
    "description",
    "completed",
    "created_at",
    "completed_at",
    "priority",
}
HISTORY_COLUMNS = {
    "id",
    "task_id",
    "title",
    "description",
    "priority",
    "created_at",
    "completed_at",
}


def _head_revision() -> str:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config()
    cfg.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    return ScriptDirectory.from_config(cfg).get_current_head()


def _alembic_version(engine):
    insp = inspect(engine)
    if "alembic_version" not in insp.get_table_names():
        return None
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_db_upgrades_to_head(app):
    """The app fixture boots a brand-new DB; schema must be complete + stamped."""
    import sys

    db_mod = sys.modules["database"]
    engine = db_mod.engine

    insp = inspect(engine)
    tables = set(insp.get_table_names())
    assert {"tasks", "history", "alembic_version"} <= tables

    assert {c["name"] for c in insp.get_columns("tasks")} == TASK_COLUMNS
    assert {c["name"] for c in insp.get_columns("history")} == HISTORY_COLUMNS

    indexes = {
        idx["name"]
        for table in ("tasks", "history")
        for idx in insp.get_indexes(table)
    }
    assert {"ix_tasks_title", "ix_history_task_id", "ix_history_completed_at"} <= indexes

    assert _alembic_version(engine) == _head_revision()


def _seed_v02_era_db(path):
    """Pre-Alembic v0.2-era DB: current shape, no alembic_version, real data."""
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE tasks (
            id INTEGER NOT NULL PRIMARY KEY,
            title VARCHAR,
            description VARCHAR,
            completed BOOLEAN,
            created_at DATETIME,
            completed_at DATETIME,
            priority VARCHAR DEFAULT 'Medium'
        );
        CREATE TABLE history (
            id INTEGER NOT NULL PRIMARY KEY,
            task_id INTEGER,
            title VARCHAR,
            description VARCHAR,
            priority VARCHAR DEFAULT 'Medium',
            created_at DATETIME,
            completed_at DATETIME
        );
        INSERT INTO tasks (id, title, description, completed, created_at, completed_at, priority)
        VALUES (1, 'legacy task', 'note', 1, '2026-01-01 08:00:00', '2026-01-01 09:00:00', 'High');
        INSERT INTO history (id, task_id, title, description, priority, created_at, completed_at)
        VALUES (1, 1, 'legacy task', 'note', 'High', '2026-01-01 08:00:00', '2026-01-01 09:00:00');
        """
    )
    conn.commit()
    conn.close()


def test_legacy_v02_db_stamped_without_data_change(load_app, tmp_path):
    db_path = tmp_path / "legacy.db"
    _seed_v02_era_db(db_path)

    load_app(db_path)  # import runs init_db()

    import sys

    engine = sys.modules["database"].engine
    assert _alembic_version(engine) == _head_revision()

    with engine.connect() as conn:
        task_row = conn.execute(
            text("SELECT id, title, priority FROM tasks")
        ).fetchone()
        history_count = conn.execute(text("SELECT COUNT(*) FROM history")).scalar()

    assert task_row == (1, "legacy task", "High")  # data untouched
    assert history_count == 1


def test_legacy_v01_db_gets_fixups_then_stamped(load_app, tmp_path):
    """v0.1-era DB (no priority/created_at/history) is upgraded to baseline."""
    db_path = tmp_path / "v0.1.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE tasks (
            id INTEGER NOT NULL PRIMARY KEY,
            title VARCHAR,
            description VARCHAR,
            completed BOOLEAN,
            completed_at DATE
        );
        INSERT INTO tasks (id, title, description, completed, completed_at)
        VALUES (7, 'old completed', NULL, 1, '2026-02-02');
        """
    )
    conn.commit()
    conn.close()

    load_app(db_path)

    import sys

    engine = sys.modules["database"].engine
    assert _alembic_version(engine) == _head_revision()

    insp = inspect(engine)
    assert {c["name"] for c in insp.get_columns("tasks")} == TASK_COLUMNS
    assert "history" in insp.get_table_names()

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT title, priority, created_at FROM tasks WHERE id = 7")
        ).fetchone()
        seeded = conn.execute(
            text("SELECT title, priority FROM history WHERE task_id = 7")
        ).fetchall()

    assert row[0] == "old completed"
    assert row[1] == "Medium"  # default applied during fixup
    assert row[2] is not None  # created_at backfilled
    assert seeded == [("old completed", "Medium")]  # history seeded


def test_repeated_startup_is_idempotent(load_app, tmp_path):
    """Booting the app twice on the same DB must not duplicate or fail."""
    db_path = tmp_path / "reuse.db"
    load_app(db_path)
    load_app(db_path)  # second boot: plain upgrade path on stamped DB

    import sys

    engine = sys.modules["database"].engine
    with engine.connect() as conn:
        versions = conn.execute(
            text("SELECT COUNT(*) FROM alembic_version")
        ).scalar()
    assert versions == 1
