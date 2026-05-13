import httpx
import asyncio
from pathlib import Path
from datetime import datetime
import json
import re


def load_cv() -> str:
    """Load candidate CV from root directory."""
    try:
        return Path("cv.md").read_text()
    except FileNotFoundError:
        return "No CV found. Please create cv.md in the root directory."


def load_agent(agent_name: str) -> str:
    """Load AgentX agent definition file."""
    try:
        return Path(f".github/agents/{agent_name}.agent.md").read_text()
    except FileNotFoundError:
        return ""


def parse_json_response(raw: str) -> dict:
    """Safely parse JSON from Claude response — strips markdown if present."""
    try:
        clean = raw.strip()
        if clean.startswith("```"):
            parts = clean.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                try:
                    return json.loads(part)
                except Exception:
                    continue
        return json.loads(clean)
    except json.JSONDecodeError:
        return {}


def check_sponsorship_signal(text: str) -> str:
    """Check job text for OPT/visa sponsorship signals."""
    text_lower = text.lower()

    no_sponsorship = [
        "no sponsorship",
        "will not sponsor",
        "cannot sponsor",
        "unable to sponsor",
        "us citizen",
        "u.s. citizen",
        "permanent resident only",
        "green card",
        "security clearance",
        "clearance required",
        "must be authorized",
        "not eligible for sponsorship",
        "sponsorship not available",
        "authorization to work in the us"
    ]

    yes_sponsorship = [
        "visa sponsorship",
        "will sponsor",
        "sponsorship available",
        "sponsorship provided",
        "h1b",
        "h-1b",
        "opt",
        "stem opt",
        "work visa"
    ]

    for phrase in no_sponsorship:
        if phrase in text_lower:
            return "unlikely"

    for phrase in yes_sponsorship:
        if phrase in text_lower:
            return "likely"

    return "unknown"


def detect_ats_type(url: str) -> str:
    """Detect which ATS the job is posted on."""
    url_lower = url.lower()
    if "greenhouse.io" in url_lower or "boards.greenhouse" in url_lower:
        return "greenhouse"
    elif "lever.co" in url_lower:
        return "lever"
    elif "ashbyhq.com" in url_lower or "jobs.ashby" in url_lower:
        return "ashby"
    elif "linkedin.com" in url_lower:
        return "linkedin"
    elif "indeed.com" in url_lower:
        return "indeed"
    elif "wellfound.com" in url_lower or "angel.co" in url_lower:
        return "wellfound"
    elif "workday.com" in url_lower:
        return "workday"
    else:
        return "other"


def format_date(days_from_now: int) -> str:
    """Return a date string N days from today."""
    from datetime import timedelta
    return (datetime.now().date() + timedelta(days=days_from_now)).isoformat()


def save_brief(company: str, content: str) -> str:
    """Save a prep brief to output folder."""
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    filename = f"{company.lower().replace(' ', '-')}-brief-{datetime.now().date()}.md"
    path = output_dir / filename
    path.write_text(content)
    return str(path)


async def fetch_greenhouse_jobs(company: str) -> list:
    """Fetch jobs from Greenhouse public API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, timeout=10)
            if r.status_code == 200:
                return r.json().get("jobs", [])
        except Exception:
            pass
    return []


async def fetch_lever_jobs(company: str) -> list:
    """Fetch jobs from Lever public API."""
    url = f"https://api.lever.co/v0/postings/{company}?mode=json"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, timeout=10)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return []


async def fetch_ashby_jobs(company: str) -> list:
    """Fetch jobs from Ashby public GraphQL API."""
    url = "https://jobs.ashbyhq.com/api/non-user-graphql"
    query = {
        "operationName": "ApiJobBoardWithTeams",
        "variables": {"organizationHostedJobsPageName": company},
        "query": """
            query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
                jobBoard: jobBoardWithTeams(
                    organizationHostedJobsPageName: $organizationHostedJobsPageName
                ) {
                    jobPostings { id title locationName jobUrl }
                }
            }
        """
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json=query, timeout=10)
            if r.status_code == 200:
                data = r.json()
                return data.get("data", {}).get("jobBoard", {}).get("jobPostings", [])
        except Exception:
            pass
    return []