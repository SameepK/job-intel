import asyncio
import json
import os
import subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv

from src.models import JobApplication, JobAnalysis, TrackerResult, ReviewResult, PipelineResult
from src.database import is_duplicate, save_application, save_analysis, save_reminders
from src.tools import load_cv, load_agent, parse_json_response, check_sponsorship_signal, detect_ats_type, format_date, save_brief
from src.scraper import scrape_page

load_dotenv()


def call_claude(system_prompt: str, user_prompt: str) -> str:
    prompt = f"{system_prompt}\n\n{user_prompt}"
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    result = subprocess.run(
        ["claude", "--print"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=60,
        env=env
    )
    if result.returncode != 0:
        print(f"[call_claude] stderr: {result.stderr}")
        print(f"[call_claude] stdout: {result.stdout}")
        raise Exception(f"Claude Code error (rc={result.returncode}): {result.stderr}")
    return result.stdout.strip()


# --- AGENT 1: EXTRACTOR ---
def extractor_agent(page_text: str, page_url: str, page_title: str = "") -> dict:
    """Uses extractor.agent.md to extract structured job data."""
    print("[AgentX: Extractor] Running...")

    agent_system = load_agent("extractor")
    sponsorship = check_sponsorship_signal(page_text)
    ats_type = detect_ats_type(page_url)

    user_prompt = f"""
Extract structured job data from this page.

PAGE URL: {page_url}
PAGE TITLE: {page_title}
DETECTED ATS: {ats_type}
DETECTED SPONSORSHIP SIGNAL: {sponsorship}

PAGE TEXT:
{page_text[:6000]}

Return ONLY valid JSON. No markdown. No explanation.
"""
    raw = call_claude(system_prompt=agent_system, user_prompt=user_prompt)
    data = parse_json_response(raw)

    # Fallbacks
    if not data.get("title") and page_title:
        data["title"] = page_title
    if not data.get("job_url"):
        data["job_url"] = page_url
    if not data.get("sponsorship_signal"):
        data["sponsorship_signal"] = sponsorship
    if not data.get("ats_type"):
        data["ats_type"] = ats_type
    if not data.get("status"):
        data["status"] = "applied"

    print(f"[AgentX: Extractor] {data.get('title')} at {data.get('company')} | Sponsorship: {data.get('sponsorship_signal')}")
    return data


# --- AGENT 2: ANALYST ---
def analyst_agent(job_data: dict, application_id: str) -> dict:
    """Uses analyst.agent.md to score job fit against cv.md."""
    print("[AgentX: Analyst] Running...")

    agent_system = load_agent("analyst")
    cv_text = load_cv()

    user_prompt = f"""
Analyse this job against the candidate CV.

JOB DATA:
{json.dumps(job_data, indent=2)}

CANDIDATE CV:
{cv_text[:3000]}

Return ONLY valid JSON. No markdown. No explanation.
"""
    raw = call_claude(system_prompt=agent_system, user_prompt=user_prompt)
    data = parse_json_response(raw)
    data["application_id"] = application_id
    data.setdefault("fit_score", 0)
    data.setdefault("skills_match", 0)
    data.setdefault("experience_match", 0)
    data.setdefault("stack_overlap", 0)
    data.setdefault("skill_gaps", [])
    data.setdefault("strengths", [])
    data.setdefault("recommendation", "cautious")
    data.setdefault("reasoning", "")
    data.setdefault("visa_risk", "unknown")

    print(f"[AgentX: Analyst] Fit: {data.get('fit_score')}/10 | Recommendation: {data.get('recommendation')} | Visa risk: {data.get('visa_risk')}")
    return data


# --- AGENT 3: TRACKER ---
def tracker_agent(application_id: str) -> dict:
    """Uses tracker.agent.md to set follow-up reminders."""
    print("[AgentX: Tracker] Running...")

    follow_up_dates = {
        "first": format_date(7),
        "second": format_date(14),
        "ghost_date": format_date(21)
    }

    save_reminders(application_id, follow_up_dates)

    print(f"[AgentX: Tracker] Reminders set → {follow_up_dates['first']} | {follow_up_dates['second']} | {follow_up_dates['ghost_date']}")
    return {
        "saved": True,
        "duplicate": False,
        "application_id": application_id,
        "follow_up_dates": follow_up_dates,
        "status": "applied"
    }


# --- AGENT 4: REVIEWER ---
def reviewer_agent(job_data: dict, analysis: dict, tracker: dict) -> dict:
    """Uses reviewer.agent.md as final quality gate."""
    print("[AgentX: Reviewer] Running...")

    agent_system = load_agent("reviewer")

    user_prompt = f"""
Review this full pipeline output.

EXTRACTOR OUTPUT:
{json.dumps(job_data, indent=2)}

ANALYST OUTPUT:
{json.dumps(analysis, indent=2)}

TRACKER OUTPUT:
{json.dumps(tracker, indent=2)}

Return ONLY valid JSON. No markdown. No explanation.
"""
    raw = call_claude(system_prompt=agent_system, user_prompt=user_prompt)
    data = parse_json_response(raw) or {}
    data.setdefault("approved", True)
    data.setdefault("blocks", [])
    data.setdefault("warnings", [])
    data.setdefault("final_recommendation", "cautious")
    data.setdefault("review_notes", "")

    if not isinstance(data["blocks"], list):
        data["blocks"] = [data["blocks"]] if data["blocks"] else []
    if not isinstance(data["warnings"], list):
        data["warnings"] = [data["warnings"]] if data["warnings"] else []

    # Hard OPT block
    if (job_data.get("sponsorship_signal") == "unlikely" and
            analysis.get("visa_risk") == "high"):
        data["approved"] = False
        data["blocks"] = data.get("blocks", []) + [
            "HARD BLOCK: Sponsorship unlikely + high visa risk. Not safe for OPT."
        ]
        data["final_recommendation"] = "skip"

    print(f"[AgentX: Reviewer] Approved: {data.get('approved')} | Final: {data.get('final_recommendation')}")
    return data


# --- PREP BRIEF GENERATOR ---
def generate_prep_brief(job_data: dict, analysis: dict, cv_text: str) -> str:
    """Generate a markdown interview prep brief."""
    print("[AgentX: Prep Brief] Generating...")

    prompt = f"""
Generate a structured interview prep brief for this job.

JOB: {job_data.get('title')} at {job_data.get('company')}
FIT SCORE: {analysis.get('fit_score')}/10
SKILL GAPS: {', '.join(analysis.get('skill_gaps', []))}
STRENGTHS: {', '.join(analysis.get('strengths', []))}

JOB DESCRIPTION:
{job_data.get('job_description', '')[:3000]}

CANDIDATE CV:
{cv_text[:2000]}

Write a prep brief with these sections:
1. Company Overview
2. Role Breakdown
3. Your Strengths for this Role
4. Skill Gaps to Address
5. Likely Interview Questions (8 questions)
6. STAR Story Suggestions (3 stories mapped to candidate experience)
7. Questions to Ask the Interviewer

Be specific and honest. Do not invent experience.
"""
    return call_claude(
        system_prompt="You are an expert interview coach. Write clear, honest, specific prep briefs.",
        user_prompt=prompt
    )


# --- MAIN PIPELINE ---
async def run_pipeline(page_url: str, page_text: str = "", page_title: str = "") -> PipelineResult:
    """
    Full AgentX 4-agent pipeline:
    Extractor → Analyst → Tracker → Reviewer
    """
    print(f"\n[AgentX Pipeline] Starting for: {page_url}")
    print("=" * 50)

    try:
        # Scrape if no text provided
        if not page_text:
            print("[AgentX Pipeline] Scraping page...")
            scraped = await scrape_page(page_url)
            page_text = scraped.get("text", "")
            page_title = scraped.get("title", "")
            if not page_text and scraped.get("error"):
                return PipelineResult(
                    application=JobApplication(title="Unknown", company="Unknown", job_url=page_url),
                    pipeline_status="blocked",
                    error=f"Unable to scrape URL: {scraped.get('error')}"
                )

        # Agent 1: Extract
        job_data = extractor_agent(page_text, page_url, page_title)

        if not job_data.get("title") or not job_data.get("company"):
            return PipelineResult(
                application=JobApplication(title="Unknown", company="Unknown", job_url=page_url),
                pipeline_status="blocked",
                error="Could not extract job title or company from page."
            )

        # Dedup check
        if is_duplicate(page_url, job_data.get("company", ""), job_data.get("title", "")):
            return PipelineResult(
                application=JobApplication(
                    title=job_data.get("title", "Unknown"),
                    company=job_data.get("company", "Unknown"),
                    job_url=page_url
                ),
                pipeline_status="blocked",
                error="Duplicate — this job is already in your tracker."
            )

        # Save application
        application_id = save_application(job_data)
        job_data["id"] = application_id
        print(f"[AgentX Pipeline] Saved with ID: {application_id}")

        # Agent 2: Analyse
        analysis_data = analyst_agent(job_data, application_id)
        save_analysis(analysis_data)

        # Agent 3: Track
        tracker_data = tracker_agent(application_id)

        # Agent 4: Review
        review_data = reviewer_agent(job_data, analysis_data, tracker_data)

        # Generate prep brief
        cv_text = load_cv()
        brief_content = generate_prep_brief(job_data, analysis_data, cv_text)
        brief_path = save_brief(job_data.get("company", "unknown"), brief_content)
        print(f"[AgentX Pipeline] Brief saved: {brief_path}")

        # Build result
        app = JobApplication(**{
            k: job_data.get(k)
            for k in JobApplication.model_fields
            if k in job_data
        })
        app.id = application_id

        analysis = JobAnalysis(**{
            k: analysis_data.get(k)
            for k in JobAnalysis.model_fields
            if k in analysis_data
        })

        tracker = TrackerResult(**tracker_data)

        review = ReviewResult(**{
            k: review_data.get(k)
            for k in ReviewResult.model_fields
            if k in review_data
        })

        print("=" * 50)
        print(f"[AgentX Pipeline] Done. Recommendation: {review_data.get('final_recommendation')}")

        return PipelineResult(
            application=app,
            analysis=analysis,
            tracker=tracker,
            review=review,
            pipeline_status="done"
        )

    except Exception as e:
        print(f"[AgentX Pipeline Error] {e}")
        return PipelineResult(
            application=JobApplication(
                title="Unknown",
                company="Unknown",
                job_url=page_url
            ),
            pipeline_status="blocked",
            error=str(e)
        )


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        url = sys.argv[1]
        result = asyncio.run(run_pipeline(url))
        print(f"\nResult: {result.pipeline_status}")
        if result.error:
            print(f"Error: {result.error}")
        else:
            print(f"Company: {result.application.company}")
            print(f"Fit Score: {result.analysis.fit_score}/10")
            print(f"Recommendation: {result.review.final_recommendation}")