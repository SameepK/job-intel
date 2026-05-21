from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from src import database
from src.main import app

client = TestClient(app)


def create_sample_application(status="applied", company="Alpha", title="Engineer", visa_risk="low", fit_score=70, applied_date=None):
    if applied_date is None:
        applied_date = datetime.utcnow().isoformat()
    app_id = database.save_application({
        "title": title,
        "company": company,
        "location": "Remote",
        "salary": "$120k",
        "job_url": f"https://example.com/{company}/{title}",
        "posted_date": applied_date[:10],
        "applied_date": applied_date,
        "job_description": "Example job posting.",
        "sponsorship_signal": "unknown",
        "ats_type": "other",
        "status": status,
    })
    database.save_analysis({
        "application_id": app_id,
        "fit_score": fit_score,
        "skills_match": 5,
        "experience_match": 5,
        "stack_overlap": 5,
        "skill_gaps": ["Go"],
        "strengths": ["Python"],
        "recommendation": "apply",
        "reasoning": "Good fit.",
        "visa_risk": visa_risk,
    })
    return app_id


def test_list_applications_filters():
    create_sample_application(status="applied", company="Alpha", title="Engineer", visa_risk="low", fit_score=85)
    create_sample_application(status="interview", company="Alpha", title="Developer", visa_risk="medium", fit_score=75)
    create_sample_application(status="offer", company="Beta", title="Manager", visa_risk="high", fit_score=90)

    response = client.get("/applications", params={
        "status": "applied,interview",
        "company": "Alpha",
        "visa_risk": "low,medium",
        "fit_score_min": 70,
    })

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    assert all(item["company"] == "Alpha" for item in items)
    assert all(item["status"] in ["applied", "interview"] for item in items)
    assert all(item["fit_score"] >= 70 for item in items)


def test_update_status_creates_status_history_entry():
    app_id = create_sample_application(status="applied")

    response = client.patch(f"/applications/{app_id}/status", json={"new_status": "phone_screen"})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["new_status"] == "phone_screen"
    assert body["old_status"] == "applied"
    assert "changed_at" in body

    details = client.get(f"/applications/{app_id}").json()
    assert details["status"] == "phone_screen"
    assert len(details["status_history"]) >= 2
    assert details["status_history"][-1]["new_status"] == "phone_screen"


def test_notes_crud_lifecycle():
    app_id = create_sample_application()

    create_response = client.post(f"/applications/{app_id}/notes", json={"text": "First note"})
    assert create_response.status_code == 200
    created_note = create_response.json()
    assert created_note["application_id"] == app_id
    assert created_note["text"] == "First note"
    assert "created_at" in created_note
    assert "updated_at" in created_note

    list_response = client.get(f"/applications/{app_id}/notes")
    assert list_response.status_code == 200
    notes = list_response.json()
    assert len(notes) == 1
    note_id = notes[0]["id"]

    edit_response = client.patch(f"/applications/{app_id}/notes/{note_id}", json={"text": "Updated note"})
    assert edit_response.status_code == 200
    assert edit_response.json()["text"] == "Updated note"

    delete_response = client.delete(f"/applications/{app_id}/notes/{note_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["success"] is True

    list_after_delete = client.get(f"/applications/{app_id}/notes")
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_export_endpoint_includes_notes_and_history():
    app_id = create_sample_application(status="applied", company="ExportCo", title="Exporter", visa_risk="medium", fit_score=80)
    client.post(f"/applications/{app_id}/notes", json={"text": "Export note"})
    client.patch(f"/applications/{app_id}/status", json={"new_status": "interview"})

    response = client.get("/export")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] == 1
    assert payload["applications"][0]["id"] == app_id
    assert len(payload["applications"][0]["notes"]) == 1
    assert len(payload["applications"][0]["status_history"]) >= 2


def test_save_application_records_initial_status_history():
    app_id = create_sample_application(status="applied")
    details = client.get(f"/applications/{app_id}").json()
    assert len(details["status_history"]) == 1
    initial = details["status_history"][0]
    assert initial["old_status"] is None
    assert initial["new_status"] == "applied"
    assert "changed_at" in initial


def test_follow_up_due_and_reminders_endpoint():
    # Related: issue #1 - Phase 2 follow-up tracking (TC-04)
    # Create an application with an applied_date 15 days ago -> should be at 14 days follow-up
    from datetime import datetime, timedelta
    applied_date = (datetime.utcnow() - timedelta(days=15)).isoformat()
    app_id = create_sample_application(applied_date=applied_date)

    details = client.get(f"/applications/{app_id}").json()
    assert details["follow_up_due"] is True
    assert details["follow_up_stage"] == "14 days"

    # Now set a reminder for today and verify /reminders returns it
    from src import database
    today = datetime.utcnow().date().isoformat()
    database.save_reminders(app_id, {"first": today, "second": None, "ghost_date": None})

    resp = client.get("/reminders")
    assert resp.status_code == 200
    items = resp.json()
    assert any(item["id"] == app_id for item in items)
