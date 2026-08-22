"""Shared test fixtures.

Every test gets a brand-new SQLite DB (via PT_DB_PATH) and a freshly imported
app, so tests never touch the developer's real tasks.db.
"""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# Modules that bind to the DB path at import time and must be re-imported
_APP_MODULES = ("main", "database", "models", "schemas")


def load_fresh_app(db_path: Path):
    """Point PT_DB_PATH at db_path and re-import the app stack."""
    old_db = sys.modules.get("database")
    if old_db is not None and getattr(old_db, "engine", None) is not None:
        try:
            old_db.engine.dispose()
        except Exception:
            pass
    os.environ["PT_DB_PATH"] = str(db_path)
    for name in _APP_MODULES:
        sys.modules.pop(name, None)
    import main

    return main


@pytest.fixture()
def load_app():
    """Return load_fresh_app() for tests that pre-seed a DB file."""
    return load_fresh_app


@pytest.fixture()
def app(tmp_path):
    fresh_main = load_fresh_app(tmp_path / "tasks.db")
    return fresh_main.app


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def make_task(client):
    """Factory: create_task(title, description=None, priority='Medium') -> dict."""

    def _create(title, description=None, priority="Medium"):
        resp = client.post(
            "/tasks/",
            json={"title": title, "description": description, "priority": priority},
        )
        assert resp.status_code == 200, resp.text
        return resp.json()

    return _create
