"""Import endpoint tests: JSON import with replace + merge modes."""
from datetime import datetime, timedelta


def _export_json(client):
    resp = client.get("/export/json")
    assert resp.status_code == 200
    return resp.json()


def test_import_replace_into_empty(client):
    data = {
        "mode": "replace",
        "data": {
            "tasks": [
                {
                    "id": 1,
                    "title": "imported task",
                    "description": "note",
                    "completed": True,
                    "priority": "High",
                    "created_at": "2026-01-01T08:00:00",
                    "completed_at": "2026-01-01T09:00:00",
                    "due_date": "2026-01-02T10:00:00",
                }
            ],
            "history": [
                {
                    "id": 1,
                    "task_id": 1,
                    "title": "imported task",
                    "description": "note",
                    "priority": "High",
                    "created_at": "2026-01-01T08:00:00",
                    "completed_at": "2026-01-01T09:00:00",
                }
            ],
        },
    }
    resp = client.post("/import/json", json=data)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported_tasks"] == 1
    assert body["imported_history"] == 1
    assert body["skipped"] == 0
    assert body["mode"] == "replace"

    tasks = client.get("/tasks/").json()
    assert len(tasks) == 1
    assert tasks[0]["title"] == "imported task"
    assert tasks[0]["completed"] is True

    history = client.get("/history/").json()
    assert len(history) == 1
    assert history[0]["tasks"][0]["title"] == "imported task"


def test_import_replace_clears_existing(client, make_task):
    make_task("old task")
    client.put("/tasks/1", json={"completed": True})

    data = {
        "mode": "replace",
        "data": {"tasks": [], "history": []},
    }
    resp = client.post("/import/json", json=data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported_tasks"] == 0
    assert body["imported_history"] == 0

    assert client.get("/tasks/").json() == []
    assert client.get("/history/").json() == []


def test_import_merge_upserts(client, make_task):
    existing = make_task("existing", priority="Medium")
    existing_id = existing["id"]

    data = {
        "mode": "merge",
        "data": {
            "tasks": [
                {
                    "id": existing_id,
                    "title": "updated existing",
                    "description": None,
                    "completed": False,
                    "priority": "High",
                },
                {
                    "id": 999,
                    "title": "new task",
                    "description": None,
                    "completed": False,
                    "priority": "Low",
                },
            ],
            "history": [],
        },
    }
    resp = client.post("/import/json", json=data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported_tasks"] == 2

    tasks = {t["id"]: t for t in client.get("/tasks/").json()}
    assert tasks[existing_id]["title"] == "updated existing"
    assert tasks[existing_id]["priority"] == "High"
    assert tasks[999]["title"] == "new task"


def test_import_merge_skips_duplicate_history(client, make_task):
    task = make_task("dup history")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    history = client.get("/history/").json()
    completed_at = history[0]["tasks"][0]["completed_at"]

    data = {
        "mode": "merge",
        "data": {
            "tasks": [],
            "history": [
                {
                    "id": 1,
                    "task_id": task["id"],
                    "title": "dup history",
                    "description": None,
                    "priority": "Medium",
                    "created_at": completed_at,
                    "completed_at": completed_at,
                }
            ],
        },
    }
    resp = client.post("/import/json", json=data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported_history"] == 0
    assert body["skipped"] == 1

    history = client.get("/history/").json()
    assert len(history) == 1  # still one, no duplicate


def test_import_invalid_mode(client):
    data = {"mode": "invalid", "data": {"tasks": [], "history": []}}
    resp = client.post("/import/json", json=data)
    assert resp.status_code == 422


def test_export_import_roundtrip(client, make_task):
    task = make_task("roundtrip", description="note", priority="High")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    exported = _export_json(client)
    assert len(exported["tasks"]) == 1
    assert len(exported["history"]) == 1

    # Clear and re-import
    client.post("/import/json", json={"mode": "replace", "data": {"tasks": [], "history": []}})
    assert client.get("/tasks/").json() == []

    resp = client.post("/import/json", json={"mode": "replace", "data": exported})
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported_tasks"] == 1
    assert body["imported_history"] == 1

    tasks = client.get("/tasks/").json()
    assert len(tasks) == 1
    assert tasks[0]["title"] == "roundtrip"
    assert tasks[0]["priority"] == "High"
