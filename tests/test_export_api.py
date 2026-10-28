"""Export endpoint tests: JSON and CSV dumps."""
from datetime import datetime, timedelta

from version import __version__


def test_export_json_empty(client):
    resp = client.get("/export/json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == __version__
    assert "exported_at" in body
    assert body["tasks"] == []
    assert body["history"] == []


def test_export_json_with_data(client, make_task):
    task = make_task("export me", description="note", priority="High")
    client.put(f"/tasks/{task['id']}", json={"completed": True})

    resp = client.get("/export/json")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) == 1
    assert body["tasks"][0]["title"] == "export me"
    assert body["tasks"][0]["priority"] == "High"
    assert body["tasks"][0]["completed"] is True
    assert len(body["history"]) == 1
    assert body["history"][0]["title"] == "export me"


def test_export_csv(client, make_task):
    make_task("csv task", priority="Low")
    resp = client.get("/export/csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    content = resp.text
    assert "tasks" in content
    assert "csv task" in content
    assert "Low" in content


def test_export_csv_history_section(client, make_task):
    task = make_task("hist csv", priority="High")
    client.put(f"/tasks/{task['id']}", json={"completed": True})
    resp = client.get("/export/csv")
    content = resp.text
    assert "history" in content
    assert "hist csv" in content
