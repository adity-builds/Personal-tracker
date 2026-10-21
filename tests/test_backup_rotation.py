"""Backup rotation tests for _rotate_backups in database.py."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import database


def _make_db(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("fake sqlite contents")


def test_rotate_backups_keeps_last_n(tmp_path):
    db_path = tmp_path / "tasks.db"
    _make_db(db_path)

    # Create 7 existing backups with staggered mtimes
    existing = []
    for i in range(7):
        bak = tmp_path / f"tasks.db.bak.2026010{i}_120000"
        bak.write_text("old backup")
        existing.append(bak)

    os.environ["PT_BACKUP_KEEP"] = "3"
    database._rotate_backups(str(db_path), keep=3)

    remaining = sorted(
        [p for p in tmp_path.iterdir() if p.name.startswith("tasks.db.bak.")],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    # 3 existing kept + 1 new backup created = 4 total
    assert len(remaining) == 4


def test_rotate_backups_disabled_when_keep_zero(tmp_path):
    db_path = tmp_path / "tasks.db"
    _make_db(db_path)
    bak = tmp_path / "tasks.db.bak.20260101_120000"
    bak.write_text("old")
    database._rotate_backups(str(db_path), keep=0)
    assert bak.exists()  # nothing deleted, nothing added


def test_rotate_backups_no_db_does_nothing(tmp_path):
    missing = tmp_path / "tasks.db"
    database._rotate_backups(str(missing), keep=5)
    assert not missing.exists()
