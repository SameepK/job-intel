# Job Intel

Job Intel is an AI-powered job application tracker built with AgentX-style agents and a Python backend. It is designed for F-1 OPT job seekers who need to paste a job URL, extract structured job details automatically, score fit against a CV, check visa sponsorship signals, save tracked applications to a database, and schedule follow-up reminders.

## Features

- Extract structured job details from a job posting URL
- Score job fit against `cv.md`
- Detect visa sponsorship signals for OPT candidates
- Save applications to SQLite tracker database
- Set follow-up reminders for first follow-up, second follow-up, and ghost date
- Generate a prep brief for tracked applications
- Backend API powered by FastAPI
- Chrome extension integration for one-click tracking

## Architecture

- `src/main.py` — FastAPI application exposing tracking endpoints and application views
- `src/pipeline.py` — 4-agent pipeline: Extractor → Analyst → Tracker → Reviewer
- `src/database.py` — SQLite persistence for applications, analyses, reminders, and status history
- `src/scraper.py` — page scraping utility using Playwright and BeautifulSoup
- `src/tools.py` — helper utilities for CV loading, agent prompt loading, sponsorship detection, and brief saving
- `src/models.py` — Pydantic models for application, analysis, tracker, review, and pipeline results
- `.github/agents/` — Agent prompt definitions used by the pipeline for extractor, analyst, tracker, and reviewer behavior

## Setup

1. Create and activate a Python virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install the required Python packages:

```bash
pip install fastapi uvicorn anthropic playwright beautifulsoup4 python-dotenv httpx pydantic
```

3. Install Playwright browsers:

```bash
python -m playwright install chromium
```

4. Set your Anthropic API key in a `.env` file or environment variable:

```bash
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
```

5. Initialize the SQLite database:

```bash
python -c "from src.database import init_db; init_db()"
```

## Running

Start the API server:

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The backend exposes these endpoints:

- `POST /track` — track a job by supplying `page_url`, `page_text`, and optional `page_title`
- `POST /track-url` — track a job by URL only; the backend scrapes the page automatically
- `GET /applications` — list all tracked applications
- `GET /applications/{application_id}` — retrieve a single application record
- `PATCH /applications/{application_id}/status` — update application status
- `GET /reminders` — list applications with follow-up reminders due today
- `GET /stats` — view aggregate application statistics

## Testing

Run the unit tests:

```bash
./venv/bin/python -m pytest -q
```

## Data & Output

- Database file: `data/applications.db`
- Generated prep briefs: `output/`

## Notes

- The pipeline is designed for job applicants using F-1 OPT visa rules.
- Visa risk and sponsorship detection are handled by `src/tools.py` and reviewed by the pipeline.
- The repository includes Chrome extension support in `extension/` for browser-side tracking.
