import os
import asyncio
from pathlib import Path

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from src.database import (
    init_db,
    get_all_applications,
    get_application,
    update_status,
    get_due_reminders,
    get_notes,
    save_note,
    update_note,
    delete_note,
    get_note_by_id,
    get_export_data,
)
from src.models import ExtractRequest, StatusUpdateRequest, NoteCreate, NoteUpdate
from src.pipeline import run_pipeline

app = FastAPI(title="Job Intel — AgentX Powered", version="1.0.0")

dashboard_dist = Path(__file__).resolve().parent.parent / "dashboard" / "dist"
if dashboard_dist.exists():
    app.mount("/dashboard", StaticFiles(directory=str(dashboard_dist), html=True), name="dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    print("[AgentX] Job Intel API running")


@app.get("/")
def root():
    return {
        "status": "running",
        "agent": "Job Intel — AgentX Powered",
        "version": "1.0.0",
        "agents": ["extractor", "analyst", "tracker", "reviewer"]
    }


@app.post("/track")
async def track_job(request: ExtractRequest):
    """
    Main endpoint — receives page text + URL from Chrome extension.
    Runs full AgentX 4-agent pipeline and returns result.
    """
    result = await run_pipeline(
        page_url=request.page_url,
        page_text=request.page_text,
        page_title=request.page_title or ""
    )
    return result


@app.post("/track-url")
async def track_url(body: dict):
    """
    Track a job by URL only — AgentX scrapes it automatically.
    Body: { "url": "https://..." }
    """
    url = body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    result = await run_pipeline(page_url=url)
    return result


@app.get("/applications")
def list_applications(
    status: Optional[str] = None,
    company: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    visa_risk: Optional[str] = None,
    fit_score_min: Optional[int] = None,
    fit_score_max: Optional[int] = None,
):
    """Get all tracked applications with optional filtering."""
    return get_all_applications(status=status, company=company, date_from=date_from,
                                date_to=date_to, visa_risk=visa_risk,
                                fit_score_min=fit_score_min, fit_score_max=fit_score_max)


@app.get("/applications/view")
def applications_view():
    """Redirect to the dashboard UI for applications."""
    return RedirectResponse(url="/dashboard/")


@app.get("/applications/{application_id}")
def get_single(application_id: str):
    """Get single application by ID."""
    app = get_application(application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@app.patch("/applications/{application_id}/status")
def update_application_status(application_id: str, request: StatusUpdateRequest):
    """Update application status."""
    valid = ["applied", "phone_screen", "interview", "offer", "accepted", "rejected", "ghosted"]
    if request.new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
    result = update_status(application_id, request.new_status, request.timestamp)
    if not result:
        raise HTTPException(status_code=400, detail="Could not update — invalid transition or ID not found")
    return {"success": True, "application_id": application_id, **result}


@app.get("/applications/{application_id}/notes")
def list_application_notes(application_id: str):
    app_data = get_application(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")
    return get_notes(application_id)


@app.post("/applications/{application_id}/notes")
def create_application_note(application_id: str, note: NoteCreate):
    app_data = get_application(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")
    note_id = save_note(application_id, note.text)
    created = get_note_by_id(note_id)
    return created


@app.patch("/applications/{application_id}/notes/{note_id}")
def edit_application_note(application_id: str, note_id: str, note: NoteUpdate):
    app_data = get_application(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")
    updated = update_note(note_id, note.text)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found")
    return get_note_by_id(note_id)


@app.delete("/applications/{application_id}/notes/{note_id}")
def delete_application_note(application_id: str, note_id: str):
    app_data = get_application(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")
    deleted = delete_note(note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "note_id": note_id}


@app.get("/export")
def export_data():
    return get_export_data()


@app.get("/reminders")
def reminders():
    """Get applications with follow-ups due today."""
    return get_due_reminders()


@app.get("/stats")
def stats():
    """Get application statistics."""
    apps = get_all_applications()
    total = len(apps)
    by_status = {}
    by_recommendation = {}
    visa_risks = {"high": 0, "medium": 0, "low": 0}

    for app in apps:
        s = app.get("status", "unknown")
        by_status[s] = by_status.get(s, 0) + 1

        r = app.get("recommendation")
        if r:
            by_recommendation[r] = by_recommendation.get(r, 0) + 1

        v = app.get("visa_risk")
        if v in visa_risks:
            visa_risks[v] += 1

    return {
        "total": total,
        "by_status": by_status,
        "by_recommendation": by_recommendation,
        "visa_risks": visa_risks
    }