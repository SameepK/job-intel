import asyncio
import json

import pytest
from src import database, pipeline


@pytest.fixture(autouse=True)
def temp_db_path(tmp_path, monkeypatch):
    db_path = tmp_path / "applications.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()
    return db_path


def fake_call_claude(system: str, user: str, max_tokens: int = 2000) -> str:
    if "Extract structured job data" in user:
        return json.dumps({
            "title": "Research Engineer",
            "company": "OpenAI",
            "location": "Remote",
            "salary": "$180k",
            "job_url": "https://jobs.lever.co/openai/research-engineer",
            "posted_date": "2026-05-10",
            "job_description": "Work on AI research. Visa sponsorship available.",
            "sponsorship_signal": "likely",
            "ats_type": "lever",
            "status": "applied"
        })
    if "Analyse this job" in user:
        return json.dumps({
            "fit_score": 8,
            "skills_match": 9,
            "experience_match": 7,
            "stack_overlap": 8,
            "skill_gaps": ["Rust", "Large language models"],
            "strengths": ["Python", "ML research"],
            "recommendation": "apply",
            "reasoning": "The candidate has strong ML research experience and a good skills overlap.",
            "visa_risk": "medium"
        })
    if "Review this full pipeline output" in user:
        return json.dumps({
            "approved": True,
            "blocks": [],
            "warnings": [],
            "final_recommendation": "apply",
            "review_notes": "Application looks good for tracking."
        })
    return json.dumps({})


async def fake_scrape_page(url: str) -> dict:
    return {
        "url": url,
        "title": "OpenAI Research Engineer",
        "text": "OpenAI Research Engineer job posting. Visa sponsorship available.",
        "error": None
    }


def test_run_pipeline_tracks_job_from_url(monkeypatch):
    monkeypatch.setattr(pipeline, "call_claude", fake_call_claude)
    monkeypatch.setattr(pipeline, "scrape_page", fake_scrape_page)

    result = asyncio.run(pipeline.run_pipeline("https://jobs.lever.co/openai/research-engineer"))

    assert result.pipeline_status == "done"
    assert result.application.title == "Research Engineer"
    assert result.application.company == "OpenAI"
    assert result.analysis.fit_score == 8
    assert result.tracker.saved is True
    assert result.review.final_recommendation == "apply"


def test_run_pipeline_returns_blocked_for_invalid_page(monkeypatch):
    async def bad_scrape(url: str) -> dict:
        return {"url": url, "title": "", "text": "", "error": "Page not found"}

    monkeypatch.setattr(pipeline, "call_claude", fake_call_claude)
    monkeypatch.setattr(pipeline, "scrape_page", bad_scrape)

    result = asyncio.run(pipeline.run_pipeline("https://jobs.lever.co/openai/bad-job"))

    assert result.pipeline_status == "blocked"
    assert "Unable to scrape URL" in result.error
