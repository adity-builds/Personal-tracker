"""Stats endpoint tests: streaks, trends, and aggregates over seeded history."""
from datetime import datetime, timedelta


def _stats(client):
    resp = client.get("/stats/")
    assert resp.status_code == 200
    return resp.json()


def _seed_history(rows):
    """Seed HistoryModel rows directly; rows = [(priority, completed_at)]."""
    import sys

    assert "database" in sys.modules and "models" in sys.modules, (
        "app modules not loaded - call this inside a test using the client fixture"
    )
    database_mod = sys.modules["database"]
    models_mod = sys.modules["models"]

    with database_mod.SessionLocal() as db:
        for priority, completed_at in rows:
            db.add(
                models_mod.HistoryModel(
                    task_id=None,
                    title=f"task {priority} {completed_at or 'pending'}",
                    description=None,
                    priority=priority,
                    created_at=(completed_at - timedelta(hours=1)) if completed_at else None,
                    completed_at=completed_at,
                )
            )
        db.commit()


def test_stats_empty_history(client):
    stats = _stats(client)
    assert stats["total_completions"] == 0
    assert stats["current_streak"] == 0
    assert stats["best_day"] is None
    assert stats["best_day_count"] == 0
    assert len(stats["last_7_days"]) == 7  # always a full week window
    assert all(d["count"] == 0 for d in stats["last_7_days"])
    assert stats["by_priority"] == {"High": 0, "Medium": 0, "Low": 0}


def test_stats_counts_and_priorities(client):
    today = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    _seed_history([
        ("High", today),
        ("High", today + timedelta(hours=1)),
        ("Medium", today),
        ("Low", None),  # skipped: never completed
    ])

    stats = _stats(client)
    assert stats["total_completions"] == 3
    assert stats["by_priority"] == {"High": 2, "Medium": 1, "Low": 0}


def test_stats_best_day_picks_max_then_recent(client):
    now = datetime.now()
    yesterday = (now - timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    three_days_ago = (now - timedelta(days=3)).replace(hour=9, minute=0, second=0, microsecond=0)

    _seed_history([
        ("Low", three_days_ago),
        ("Low", three_days_ago),
        ("Medium", yesterday),
        ("Low", yesterday),
        ("High", yesterday),
    ])

    stats = _stats(client)
    assert stats["best_day_count"] == 3
    # tie between two days impossible here; best is yesterday with 3
    assert stats["best_day"] == yesterday.date().isoformat()


def test_stats_last_7_days_is_chronological_ending_today(client):
    now = datetime.now()
    _seed_history([
        ("Medium", now.replace(hour=8, minute=0, second=0, microsecond=0)),
        ("Medium", (now - timedelta(days=6)).replace(hour=8, minute=0, second=0, microsecond=0)),
        ("Medium", (now - timedelta(days=7)).replace(hour=8, minute=0, second=0, microsecond=0)),  # outside window
    ])

    stats = _stats(client)
    week = stats["last_7_days"]
    dates = [d["date"] for d in week]
    assert dates[-1] == datetime.now().date().isoformat()
    assert dates == sorted(dates)  # chronological
    assert sum(d["count"] for d in week) == 2  # the 7-day-old row is excluded
    assert week[0]["count"] == 1  # oldest day inside window has its completion
    assert week[-1]["count"] == 1  # today


def test_stats_current_streak_walks_back_through_consecutive_days(client):
    now = datetime.now()
    rows = []
    for offset in (0, 1, 2):  # today, yesterday, day before
        day = (now - timedelta(days=offset)).replace(hour=9, minute=0, second=0, microsecond=0)
        rows.append(("Medium", day))
    _seed_history(rows)

    stats = _stats(client)
    assert stats["current_streak"] == 3


def test_stats_streak_broken_by_gap(client):
    now = datetime.now()
    rows = [
        ("Medium", now.replace(hour=9, minute=0, second=0, microsecond=0)),
        # gap: nothing yesterday
        ("Medium", (now - timedelta(days=2)).replace(hour=9, minute=0, second=0, microsecond=0)),
        ("Medium", (now - timedelta(days=3)).replace(hour=9, minute=0, second=0, microsecond=0)),
    ]
    _seed_history(rows)

    stats = _stats(client)
    assert stats["current_streak"] == 1


def test_stats_streak_survives_when_today_is_empty(client):
    """No completions yet today must not break an active streak."""
    now = datetime.now()
    rows = [
        ("Medium", (now - timedelta(days=1)).replace(hour=20, minute=0, second=0, microsecond=0)),
        ("Medium", (now - timedelta(days=2)).replace(hour=20, minute=0, second=0, microsecond=0)),
    ]
    _seed_history(rows)

    stats = _stats(client)
    assert stats["current_streak"] == 2
