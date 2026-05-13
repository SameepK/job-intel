---
description: Job Intel — AI-powered job application tracker and analyser
applyTo: "**"
---

# Job Intel — AgentX Workspace

## What this project does
Tracks job applications, scores fit against candidate CV, flags visa risks,
and generates interview prep briefs — all orchestrated by AgentX agents.

## Agent Roster
| Agent | File | Role |
|-------|------|------|
| AgentX Auto | agent-x.agent.md | Orchestrator — routes all tasks |
| Extractor | extractor.agent.md | Extracts job data from any URL |
| Analyst | analyst.agent.md | Scores fit against cv.md |
| Tracker | tracker.agent.md | Saves to DB, sets reminders |
| Reviewer | reviewer.agent.md | Final quality gate |

## Quick Reference
- Candidate CV: `cv.md`
- Database: `data/applications.db`
- Output briefs: `output/`
- Source tools: `src/`

## How to run
Tell AgentX Auto:
> "Track this job: {URL}"
> "Analyse all applied jobs"
> "Show me jobs due for follow-up"
> "Generate prep brief for {company}"

## Retrieval-Led Reasoning
Always read `cv.md` before scoring any job.
Always check `data/applications.db` for duplicates before saving.
Never invent skills or experience not present in `cv.md`.