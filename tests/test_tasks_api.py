"""CRUD tests for /tasks/ endpoints."""


def test_create_task_returns_defaults(client):
    resp = client.post("/tasks/", json={"title": "Write tests"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Write tests"
    assert body["description"] is None
    assert body["completed"] is False
    assert body["priority"] == "Medium"
    assert isinstance(body["id"], int)
    assert body["created_at"] is not None
    assert body["completed_at"] is None


def test_create_task_with_all_fields(client, make_task):
    task = make_task("Ship v0.3", description="Alembic + tests", priority="High")
    assert task["priority"] == "High"
    assert task["description"] == "Alembic + tests"


def test_create_task_requires_title(client):
    resp = client.post("/tasks/", json={"description": "no title"})
    assert resp.status_code == 422


def test_list_tasks(client, make_task):
    make_task("A")
    make_task("B")
    resp = client.get("/tasks/")
    assert resp.status_code == 200
    titles = {t["title"] for t in resp.json()}
    assert titles == {"A", "B"}


def test_list_tasks_pagination(client, make_task):
    for i in range(5):
        make_task(f"task {i}")
    page = client.get("/tasks/", params={"skip": 2, "limit": 2})
    assert page.status_code == 200
    assert len(page.json()) == 2


def test_complete_task_sets_completed_at(client, make_task):
    task = make_task("finish me")
    resp = client.put(f"/tasks/{task['id']}", json={"completed": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed"] is True
    assert body["completed_at"] is not None


def test_uncheck_completed_task_is_rejected(client, make_task):
    """Completed tasks are permanent: unchecking returns 409 and keeps state."""
    task = make_task("no undo")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    resp = client.put(f"/tasks/{task['id']}", json={"completed": False})

    assert resp.status_code == 409
    tasks = {t["id"]: t for t in client.get("/tasks/").json()}
    assert tasks[task["id"]]["completed"] is True
    assert tasks[task["id"]]["completed_at"] is not None


def test_recomplete_completed_task_is_noop(client, make_task):
    """PUT completed=True on an already-completed task leaves it untouched."""
    task = make_task("already done")
    first = client.put(f"/tasks/{task['id']}", json={"completed": True}).json()
    second = client.put(f"/tasks/{task['id']}", json={"completed": True}).json()

    assert second["completed"] is True
    assert second["completed_at"] == first["completed_at"]


def test_update_priority_only(client, make_task):
    task = make_task("reprioritize")
    resp = client.put(
        f"/tasks/{task['id']}", json={"completed": False, "priority": "Low"}
    )
    assert resp.json()["priority"] == "Low"


def _future(days=7, hour=9, minute=0):
    """Dynamic future deadline - tests must not rot as real time passes."""
    from datetime import datetime, timedelta

    dt = (datetime.now() + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return dt.isoformat()


def test_create_task_with_due_date(client):
    resp = client.post(
        "/tasks/",
        json={"title": "dated", "due_date": _future()},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["due_date"] is not None
    assert body["due_date"] == _future() + ":00" or body["due_date"].startswith(_future()[:16])


def test_create_task_rejects_past_due_date(client):
    from datetime import datetime, timedelta

    past = (datetime.now() - timedelta(days=2)).isoformat()
    resp = client.post("/tasks/", json={"title": "late born", "due_date": past})
    assert resp.status_code == 422


def test_create_task_tolerates_current_minute_edge(client):
    """Picking 'now' then submitting seconds later must not fail (60s grace)."""
    from datetime import datetime, timedelta

    almost_now = (datetime.now() - timedelta(seconds=30)).replace(microsecond=0)
    resp = client.post("/tasks/", json={"title": "just in time", "due_date": almost_now.isoformat()})
    assert resp.status_code == 200


def test_edit_task_fields(client, make_task):
    task = make_task("original", description="old", priority="Low")

    resp = client.put(
        f"/tasks/{task['id']}",
        json={
            "completed": False,
            "title": "  renamed  ",
            "description": "new note",
            "priority": "High",
            "due_date": _future(),
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "renamed"  # trimmed
    assert body["description"] == "new note"
    assert body["priority"] == "High"
    assert body["due_date"].startswith(_future()[:16])


def test_edit_partial_payload_leaves_other_fields_untouched(client, make_task):
    task = make_task("keep me", description="stable", priority="High")
    client.put(f"/tasks/{task['id']}", json={"completed": False, "due_date": _future(14, 8)})

    # completed-only payload (the old shape) must not wipe anything
    resp = client.put(f"/tasks/{task['id']}", json={"completed": True})
    body = resp.json()
    assert body["description"] == "stable"
    assert body["priority"] == "High"
    assert body["due_date"].startswith(_future(14, 8)[:16])


def test_edit_clears_due_date_with_explicit_null(client, make_task):
    task = make_task("clearable")
    client.put(f"/tasks/{task['id']}", json={"completed": False, "due_date": _future(3, 10)})

    resp = client.put(f"/tasks/{task['id']}", json={"completed": False, "due_date": None})
    assert resp.status_code == 200
    assert resp.json()["due_date"] is None


def test_edit_rejects_moving_deadline_into_the_past(client, make_task):
    task = make_task("no backdating")
    client.put(f"/tasks/{task['id']}", json={"completed": False, "due_date": _future()})

    from datetime import datetime, timedelta

    past = (datetime.now() - timedelta(hours=5)).replace(microsecond=0).isoformat()
    resp = client.put(f"/tasks/{task['id']}", json={"completed": False, "due_date": past})
    assert resp.status_code == 422


def test_edit_rejects_empty_title(client, make_task):
    task = make_task("valid")
    resp = client.put(f"/tasks/{task['id']}", json={"completed": False, "title": "   "})
    assert resp.status_code == 422


def test_edit_missing_task_returns_404(client):
    resp = client.put("/tasks/9999", json={"completed": False, "title": "ghost"})
    assert resp.status_code == 404


def test_completed_task_is_editable_but_not_uncheckable(client, make_task):
    task = make_task("locked state", priority="Medium")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    resp = client.put(f"/tasks/{task['id']}", json={"completed": True, "title": "edited after done"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "edited after done"

    blocked = client.put(f"/tasks/{task['id']}", json={"completed": False})
    assert blocked.status_code == 409


def test_edit_keeps_existing_overdue_deadline(client, make_task):
    """A task that legitimately became overdue keeps its deadline on edit."""
    import sys

    assert "database" in sys.modules and "models" in sys.modules
    database_mod = sys.modules["database"]
    models_mod = sys.modules["models"]

    from datetime import datetime, timedelta

    overdue = (datetime.now() - timedelta(days=3)).replace(microsecond=0)

    with database_mod.SessionLocal() as db:
        db_task = models_mod.TaskModel(
            title="overdue chore",
            description=None,
            completed=False,
            created_at=datetime.now(),
            completed_at=None,
            due_date=overdue,
            priority="High",
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        task_id = db_task.id

    # Same deadline (minute precision) + other edits -> allowed
    resp = client.put(
        f"/tasks/{task_id}",
        json={
            "completed": False,
            "title": "still overdue",
            "priority": "Medium",
            "due_date": overdue.isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "still overdue"
    assert body["priority"] == "Medium"
    assert body["due_date"].startswith(overdue.isoformat()[:16])

    # Moving to a *different* past deadline -> rejected
    from datetime import timedelta as td

    other_past = (datetime.now() - td(days=10)).replace(microsecond=0).isoformat()
    resp2 = client.put(
        f"/tasks/{task_id}", json={"completed": False, "due_date": other_past}
    )
    assert resp2.status_code == 422


def test_update_missing_task_returns_404(client):
    resp = client.put("/tasks/9999", json={"completed": True})
    assert resp.status_code == 404


def test_delete_task(client, make_task):
    task = make_task("delete me")
    resp = client.delete(f"/tasks/{task['id']}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    remaining = client.get("/tasks/").json()
    assert remaining == []
    # deleting again -> 404
    assert client.delete(f"/tasks/{task['id']}").status_code == 404


def test_delete_missing_task_returns_404(client):
    assert client.delete("/tasks/9999").status_code == 404


def test_version_endpoint(client):
    resp = client.get("/version")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Personal Tracker"
    assert "version" in resp.json()
