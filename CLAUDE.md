# Job Intel — Claude Code Instructions

## Project Overview
Job Intel is an AgentX-powered job application tracker. It uses a 4-agent pipeline
to extract, analyse, track, and review job applications.

## Critical Rules
- ALWAYS read `cv.md` before scoring any job
- ALWAYS check for duplicates before saving to database
- NEVER invent skills or data not present in source material
- ALWAYS run Reviewer agent as final gate before returning output to user
- ALWAYS flag sponsorship_signal = "unlikely" as high visa risk for OPT candidates

## Project Structure
- AGENTS.md is the AgentX entry point
- cv.md is the candidate CV and single source of truth
- .github/agents/ contains all AgentX agent definitions
- src/ contains all Python tools the agents call
- data/ contains the SQLite database
- output/ contains generated prep briefs

## Agent Pipeline
- Step 1: Extractor Agent reads page text and returns structured job JSON
- Step 2: Analyst Agent reads cv.md and scores fit against the job
- Step 3: Tracker Agent saves to database and sets follow-up reminders
- Step 4: Reviewer Agent is the final gate and validates all outputs

## Database Tables
- applications: id, title, company, location, salary, job_url, sponsorship_signal, status, applied_date
- analyses: application_id, fit_score, recommendation, visa_risk, skill_gaps
- reminders: application_id, first_followup, second_followup, ghost_date
- status_history: application_id, old_status, new_status, changed_at

## Commands AgentX Understands
- Track this job: URL — runs full 4-agent pipeline
- Analyse all pending jobs — runs batch analysis
- Show follow-ups due today — checks reminders
- Generate prep brief for company — creates interview prep
- Update company status to interview — updates status
- Show my stats — returns application statistics

## Visa Safety Rules
- sponsorship_signal unlikely is a hard block and recommendation must be skip
- visa_risk high must always be shown prominently to user
- Never recommend apply for jobs that will not sponsor OPT