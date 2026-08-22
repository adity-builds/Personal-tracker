"""History endpoint tests: append-only semantics and day grouping."""
from datetime import datetime


def _history(client):
    return client.get("/history/").json()


def test_history_empty_initially(client):
    assert _history(client) == []


def test_completion_appends_to_history(client, make_task):
    task = make_task("done deal", description="details", priority="High")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    history = _history(client)
    assert len(history) == 1

    today_entry = history[0]
    assert today_entry["count"] == 1
    assert len(today_entry["tasks"]) == 1

    entry = today_entry["tasks"][0]
    assert entry["title"] == task["title"]
    assert entry["description"] == "details"
    assert entry["priority"] == "High"
    assert entry["created_at"] is not None
    assert entry["completed_at"] is not None


def test_today_group_matches_local_date(client, make_task):
    from datetime import date

    task = make_task("today only")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    history = _history(client)
    expected_day = date.today().isoformat()
    assert history[0]["date"] == expected_day


def test_uncheck_preserves_history(client, make_task):
    """Append-only guarantee: unchecking must NOT remove history entries."""
    task = make_task("audit me")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    client.put(f"/tasks/{task['id']}", json={"completed": False})

    # Task itself back to pending...
    tasks = {t["id"]: t for t in client.get("/tasks/").json()}
    assert tasks[task["id"]]["completed"] is False
    # ...but history entry survives.
    history = _history(client)
    assert history[0]["count"] == 1


def test_recompleting_appends_new_immutable_entry(client, make_task):
    task = make_task("twice done")
    client.put(f"/tasks/{task['id']}", json={"completed": True})
    client.put(f"/tasks/{task['id']}", json={"completed": False})
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    history = _history(client)
    assert len(history) == 1  # still one day group
    assert history[0]["count"] == 2  # two immutable entries for that day


def test_deleting_task_preserves_history(client, make_task):
    task = make_task("gone but remembered")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    client.delete(f"/tasks/{task['id']}")

    history = _history(client)
    assert history[0]["count"] == 1
    assert history[0]["tasks"][0]["title"] == "gone but remembered"


def test_history_groups_by_day_across_dates(client, make_task):
    """Entries with different completed_at dates land in separate groups.

    Seeds an extra history row directly (past date) since the API always
    completes 'now'. Requires the client fixture to have loaded the app first.
    """
    import sys

    assert "database" in sys.modules and "models" in sys.modules, (
        "app modules not loaded - add the client fixture to this test"
    )
    database_mod = sys.modules["database"]
    models_mod = sys.modules["models"]

    with database_mod.SessionLocal() as db:
        db.add(
            models_mod.HistoryModel(
                task_id=None,
                title="old chore",
                description=None,
                priority="Low",
                created_at=datetime(2026, 1, 1, 9, 0, 0),
                completed_at=datetime(2026, 1, 1, 10, 30, 0),
            )
        )
        db.commit()

    task = make_task("today chore")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    history = _history(client)
    dates = [entry["date"] for entry in history]
    assert "2026-01-01" in dates
    assert len(dates) >= 2  # past group + today's group

    past = next(e for e in history if e["date"] == "2026-01-01")
    assert past["count"] == 1
    assert past["tasks"][0]["title"] == "old chore"


def test_history_sorted_most_recent_first(client, make_task):
    first = make_task("first")
    second = make_task("second")
    client.put(f"/tasks/{first['id']}", json={"completed": True})
    client.put(f"/tasks/{second['id']}", json={"completed": True})

    tasks_in_group = _history(client)[0]["tasks"]
    completed_order = [t["title"] for t in tasks_in_group]
    assert completed_order == ["second", "first"]
