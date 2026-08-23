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
