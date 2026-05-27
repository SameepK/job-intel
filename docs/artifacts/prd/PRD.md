---
Epic: #1
Title: Job Intel — OPT Student Job Application Tracker
Author: Product Manager Agent
Date: 2026-05-19
Updated: 2026-05-27
Priority: p1
Status: Active
---

# PRD: Job Intel — OPT Student Job Application Tracker

**Epic**: #1
**Status**: Active
**Author**: Product Manager Agent
**Date**: 2026-05-19
**Last Updated**: 2026-05-27
**Stakeholders**: Founder / Engineer (Sameep), Student users (OPT), Reviewer agent
**Priority**: p1

---

## Table of Contents

1. Problem Statement
2. Target Users
3. Goals & Success Metrics
4. Requirements
5. User Stories & Features
6. User Flows
7. Dependencies & Constraints
8. Risks & Mitigations
9. Timeline & Milestones
10. Out of Scope
11. Open Questions
12. Appendix (Research & Council)

---

## 1. Problem Statement

### What problem are we solving?
 Students applying to roles face high application volume and unclear visa signals; they need a lightweight tracker that collects job postings quickly, scores fit against their CV, surfaces a concise `visa_risk` signal (Analyst-agent derived from job requirements), schedules follow-ups, and prepares interview briefs. The product will not attempt to detect sponsorship directly.

### Why is this important?
- Reduces wasted effort applying to non-sponsoring roles.
- Increases signal-to-noise when managing many applications.
- Improves interview preparedness via generated briefs.

### What happens if we don't solve this?
Users will continue to waste time on unsuitable applications, miss timely follow-ups, and lose interview opportunities due to poor organization.

---

## 2. Target Users

### Primary Users
**OPT SWE Candidate (Primary persona)**
- Demographics: International student on OPT in the US applying for entry-level SWE roles; comfortable with Chrome and a web workflow.
- Goals: Track and prioritize job applications, avoid roles that won't sponsor visa, get interview prep quickly.
- Pain Points: High candidate churn across job sites, unclear sponsorship info, forgetting to follow up.
- Behaviors: Uses job boards (LinkedIn, Indeed), applies rapidly, expects one-click tooling.

### Secondary Users
- Friends/mentors who help review applications.
- Recruiters (view read-only briefs).

---

## 3. Goals & Success Metrics

### Business Goals
1. Enable users to manage their entire job application lifecycle in one place: capture, track status, manage follow-ups, and view progress.
2. Increase follow-up rate (user-initiated follow-up actions) to 60% of saved applications by surfacing follow-ups due today.
3. Reduce time-to-action by providing fast filtering and stage-based prioritization (e.g., focus on pending interviews, upcoming offers).
4. Surface visa_risk signal to help users avoid roles unlikely to sponsor, reducing wasted applications on non-sponsoring roles by 30%.

### Success Metrics (KPIs)
| Metric | Current | Target | Timeline |
|---|---:|---:|---:|
| Time to save an application | ~1 click (chrome extension) | < 30s end-to-end | 4 weeks |
| Follow-up scheduled (7/14/21) | baseline TBD | 60% of saved apps | 8 weeks |
| Proportion of applications flagged high visa risk | baseline TBD | reduce applications to high-risk jobs by 30% | 12 weeks |
| Retention (returning weekly active users) | baseline TBD | 30% after 8 weeks | 12 weeks |

### User Success Criteria
- Users have a single, organized view of all job applications from applied through offer/rejection.
- Users can quickly see which applications need follow-up today.
- Users can filter applications by status, company, date applied, visa_risk, and fit_score to prioritize work.
- Users can update application status and see a timeline of when each status change occurred.
- Users can capture context-rich notes for each application.
- Users can save a job from the browser in one click and see it immediately appear in the Tracker.
- Reminder notifications are deferred to Phase 2; the UI will surface scheduled reminders in the dashboard once implemented.

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)
1. **Job Application Tracker (Primary)**: Core lifecycle management for all applications across extension and dashboard.
 - User Story: As an OPT candidate, I want to see all my job applications in one place, track their status from applied through offer/rejection, and filter them to prioritize my follow-ups.
 - Acceptance Criteria:
   - [ ] **Application list view**: Both extension (My Applications) and dashboard display all saved applications with title, company, location, date applied, current status, visa risk, and fit score.
   - [ ] **Status lifecycle**: Applications support status transitions: applied → phone screen → interview → offer → accepted OR rejected OR ghosted. Users can manually update status at any time.
   - [ ] **Status history**: Every status change is logged with timestamp. Users can view full history of each application.
   - [ ] **Follow-up tracking**: UI surfaces which applications are due for follow-up today based on 7/14/21 day schedule (visual indicator or "Follow-ups Due" section).
   - [ ] **Comprehensive filtering**: Both views support filtering by status (multi-select), company name, date range applied, visa_risk (low/medium/high/unknown), and fit score range. Filters work cumulatively.
   - [ ] **Stage summary**: Dashboard displays at-a-glance counts: Applied, Phone Screen, Interview, Offer, Accepted, Rejected, Ghosted.
   - [ ] **Primary navigation**: Tracker is the default/primary view when opening extension or dashboard; all other views (notes, briefs, settings) are accessible from the tracker.
   - [ ] **Quick actions**: From tracker list, user can: open source job URL, add/edit notes, view interview brief, update status, mark as reviewed.

2. **Notes per application**: Users can create, edit, and delete free-text notes attached to an application; notes are synced to the backend DB.
 - User Story: As an OPT candidate, I want to add context-rich notes to each application so I remember key details before interviews.
 - Acceptance Criteria:
   - [ ] Notes UI accessible from tracker (in-line or modal) in both extension and dashboard.
   - [ ] Notes persist in SQLite and surface in both views.
   - [ ] Each note is timestamped and associated with the application.

3. **JSON export endpoint (`GET /export`)**: Provide a simple data backup endpoint that returns all saved applications and related notes in JSON format.
 - User Story: As an OPT candidate, I want an export endpoint so I can back up my data outside the app.
 - Acceptance Criteria:
   - [ ] `GET /export` returns HTTP 200 and valid JSON array of application objects.
   - [ ] Each application object includes id, title, company, location, date_applied, status, status_history (array with timestamps), visa_risk, fit_score, notes (array), and raw_source_url.
   - [ ] Endpoint is local-only by default (no external auth) and documented in README.

4. **Existing capabilities preserved**: The current one-click Chrome capture, 4-agent AgentX pipeline (Extractor → Analyst → Tracker → Reviewer) plus a Prep Brief Generator step, FastAPI backend, and existing tests must remain functional. Sponsorship signal detection (`sponsorship_signal`) is active: the pipeline captures it from page text and the Reviewer enforces a hard block when `sponsorship_signal = "unlikely"` combined with `visa_risk = "high"` (OPT safety rule).
 - User Story: As a developer, I want the AgentX pipeline to continue feeding extracted job data into the Tracker so the system remains end-to-end functional.
 - Acceptance Criteria:
   - [ ] All 14 FastAPI endpoints still respond to current tests.
   - [ ] All current tests continue to pass after changes.
   - [ ] New tracker features integrate cleanly with AgentX extraction (no breaking changes to data model).

#### Should Have (P1)
1. **Bulk actions**: Allow selecting multiple applications to change status or add notes.
2. **CSV export**: Export saved applications with notes and visa risk.

#### Could Have (P2)
1. **Smart prioritization**: Rank applications by fit score and visa likelihood.
2. **Calendar integration**: Add follow-ups to Google Calendar.

### 4.2 AI/ML Requirements
- Technology Classification: Hybrid — AgentX multi-agent pipeline with rule-based checks and scoring using resume matching (embedding or heuristics).

Product-Facing AI Contract:
- Primary AI Job: Extract structured job fields from a job page (including `sponsorship_signal` detected from page text), score fit against user's CV, produce a `visa_risk` signal (Analyst agent), enforce OPT safety rules (hard block when `sponsorship_signal = "unlikely"` + `visa_risk = "high"`), and generate an interview prep brief.
- Grounding Sources: job page content (scraped), user's `cv.md`, internal heuristics and past analyses in `data/`.
- Tool Boundaries: AgentX pipeline may read job pages, write to the app DB, and generate briefs; it must NOT auto-apply or share PII externally.
- Response Contract: Structured JSON for job records (title, company, location, salary, visa_risk), plus markdown interview briefs.
- Fallback Behavior: If extraction confidence is low, mark record `needs_review=true` and notify user to confirm fields.

AI Acceptance Criteria:
- [ ] Extraction confidence threshold and `needs_review` flag — **not yet implemented**; flagged for future work.
- [ ] Generated briefs include sections: Role summary, Key skills, Sample questions, Suggested examples from CV.

### 4.3 Non-Functional Requirements
- Response Time: Dashboard list queries return < 500ms for up to 500 records.
- Security: Data stored locally in `data/applications.db` (SQLite). No external PII sharing without explicit user opt-in.
- Usability: Extension and dashboard must be responsive and accessible on Chrome (latest stable) and desktop browsers.

---

## 5. User Stories & Features

### Feature 1: Job Application Tracker (Primary P0)
**Description**: Comprehensive application lifecycle management with status transitions, follow-up tracking, filtering, and stage visibility.
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|---|---|---|---|---|---:|---:|
| US-1.1 | OPT Candidate | See all applications in one list | I have a single source of truth for my job search | - [ ] Extension & dashboard show complete list - [ ] Pagination works for 100+ apps | P0 | 5d |
| US-1.2 | OPT Candidate | Update application status manually | I keep my tracker in sync with reality | - [ ] Status dropdown works - [ ] Change is logged with timestamp | P0 | 2d |
| US-1.3 | OPT Candidate | View status change history | I understand the timeline of each application | - [ ] History view shows all transitions + timestamps | P0 | 2d |
| US-1.4 | OPT Candidate | Filter applications by status, company, date, visa risk, fit score | I can prioritize and focus on high-value applications | - [ ] All 5 filter types work - [ ] Multi-select for status/visa_risk - [ ] Cumulative filters apply | P0 | 4d |
| US-1.5 | OPT Candidate | See which applications need follow-up today | I never miss a follow-up opportunity | - [ ] UI highlights apps due at 7/14/21 days - [ ] Follow-up indicator visible in list | P0 | 2d |
| US-1.6 | OPT Candidate | See a summary of applications by stage | I can understand my pipeline at a glance | - [ ] Dashboard shows counts: Applied, Phone Screen, Interview, Offer, Accepted, Rejected, Ghosted | P0 | 1d |

### Feature 2: Notes per Application
**Description**: Contextual notes for each application.
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|---|---|---|---|---|---:|---:|
| US-2.1 | OPT Candidate | Add notes to an application | I capture context and talking points before interviews | - [ ] Notes UI accessible from tracker - [ ] Notes persist - [ ] Synced across views | P0 | 2d |

### Feature 3: JSON export endpoint (`GET /export`)
**Description**: Data backup export.
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|---|---|---|---|---|---:|---:|
| US-3.1 | OPT Candidate | Export all applications to JSON | I have a backup of my data outside the app | - [ ] `GET /export` works - [ ] Includes full status history & notes - [ ] Valid JSON | P0 | 1d |

### Feature 4: Reminder Notifications (Deferred to Phase 2)
**Description**: Deliver notifications at 7/14/21 days with actions. (Deferred to Phase 2; included for visibility but not required for initial MVP acceptance.)
**Priority**: Deferred (Phase 2)

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|---|---|---|---|---|---:|---:|
| US-4.1 | OPT Candidate | Receive reminders | I remember to follow up | - [ ] Notifications delivered - [ ] Open detail on click | Deferred | 4d |

---

## 6. User Flows

### Primary Flow 1: View and manage applications in the Tracker
**Trigger**: User opens the Job Intel extension or dashboard.
**Preconditions**: At least one application has been saved.

Steps:
1. User opens extension or navigates to dashboard (http://localhost:8000/dashboard).
2. Tracker list view displays all saved applications with title, company, date applied, status, visa_risk, fit_score.
3. User can:
   - See follow-ups due today (highlighted or in separate section based on 7/14/21 schedule).
   - See stage summary (Applied: 5, Phone Screen: 2, Interview: 1, Offer: 0, ...).
   - Filter applications by status, company, date range, visa_risk, fit_score.
4. User clicks on an application to see details: job URL, notes, full status history with timestamps, interview brief.
5. Success: User has a complete, filterable view of their job search pipeline.

**Alternative Flows**:
- **6a. Update status**: User selects "Mark as Rejected" or clicks status dropdown → status changes → backend logs timestamp → history updated.
- **6b. View history**: User clicks "Status History" → sees all transitions with timestamps (e.g., Applied on May 1, Phone Screen on May 5, Rejected on May 15).
- **6c. Filter and prioritize**: User clicks filters → selects Status=Interview, visa_risk=Low → sees 3 interviews to focus on.

### Flow 2: Capture a new job and feed into Tracker
**Trigger**: User clicks extension save button on a job posting page.
**Preconditions**: Extension installed, user on a job posting URL.

Steps:
1. User clicks extension Save button.
2. AgentX pipeline scrapes and extracts job fields (title, company, location, job description, requirements).
3. Analyst agent scores fit against cv.md and produces visa_risk signal.
4. Reviewer agent validates pipeline output and enforces OPT hard-block rules.
5. Prep Brief Generator (pipeline step after Reviewer) produces the interview prep brief.
6. Backend saves record to SQLite with status=applied, date_applied=today, timestamp.
7. UI shows toast: "Saved — View in My Applications".
7. Success: Application appears in Tracker with all extracted data, ready to be tracked.

**Alternative Flows**:
- **2a. Low confidence extraction**: If extraction confidence < 75%, mark `needs_review=true` and surface editable fields → user confirms/corrects → saved.
- **2b. Immediate note**: After save, user clicks "Add Note" → adds context → note saved and visible in tracker.

### Flow 3: Add and manage notes
**Trigger**: User clicks "Add Note" on an application or in detail view.
**Preconditions**: Application exists in Tracker.

Steps:
1. User clicks "Add Note" or "Edit Notes" button.
2. Modal/drawer opens showing existing notes (if any).
3. User types/edits free-text note with timestamp.
4. User clicks Save.
5. Note persists to SQLite and is immediately visible in both extension and dashboard.
6. Success: Note captured and synced across views.

### Flow 4: Export data for backup
**Trigger**: User requests a data export.
**Preconditions**: At least one application saved.

Steps:
1. User navigates to Settings or clicks "Export Data".
2. System calls GET /export endpoint.
3. User receives JSON file with all applications, status histories, and notes.
4. Success: User has a local backup of their data.


## 7. Dependencies & Constraints

### Technical Dependencies
| Dependency | Type | Status | Owner | Impact if Unavailable |
|---|---|---|---|---|
| AgentX multi-agent pipeline | Internal | In use | Project | High - core extraction fails |
| FastAPI backend | Internal | In use | Project | High - dashboard disconnected |
| Chrome extension APIs | External | Stable | Browser | Medium - feature-limited |

### Resource Constraints
- Development: 1-2 engineers (owner: Sameep)
- Timeline: 3-4 weeks for P0 scope

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|---|---|---|---|---|
| Sponsorship signal misclassification | Medium | Medium | `sponsorship_signal` is heuristic-based; Reviewer hard-blocks only when both `sponsorship_signal=unlikely` AND `visa_risk=high` to reduce false positives | Engineer |
| Notifications blocked by browser | High | Medium | Provide dashboard fallback and in-extension reminders; notifications deferred to Phase 2 | Engineer |
| Data loss in local DB | High | Low | `GET /export` endpoint + periodic export/backup option | Engineer |

---

## 9. Timeline & Milestones

### Phase 1 (Weeks 0-1): Job Application Tracker Foundation — Extension
**Goal**: Build tracker UX and core filtering logic in the extension.
**Stories**: US-1.1 (list view), US-1.4 (filtering), US-1.2 (status updates)
- Implement `My Applications` view in extension with complete application list (title, company, date applied, status, visa_risk, fit_score).
- Implement status dropdown and update logic (persist to SQLite with timestamp).
- Implement filtering UI (status multi-select, company search, date range, visa_risk, fit_score).
- Ensure API endpoints support filtering queries (`/applications?status=applied&visa_risk=low`).
- Ensure notes CRUD endpoints are ready for Phase 2 integration.

### Phase 2 (Weeks 1-2.5): Job Application Tracker Full Feature — Dashboard + Tracker Polish
**Goal**: Build React dashboard and add tracker features.
**Stories**: US-1.3 (status history), US-1.5 (follow-up tracking), US-1.6 (stage summary), US-2.1 (notes)
- Build dashboard list, filters, detail view with same functionality as extension.
- Implement status history view (show all transitions with timestamps).
- Implement follow-up tracking: UI highlights applications due at 7/14/21 days.
- Implement stage summary: dashboard shows counts by status.
- Implement notes creation/edit/delete and sync across extension & dashboard.

### Phase 3 (Weeks 2.5-3): Capture & Export — AgentX + Export
**Goal**: Wire AgentX extraction to tracker and add backup export.
**Stories**: US-3.1 (export endpoint), REQ-6 (AgentX integration)
- Add `GET /export` endpoint; ensure export includes full status_history array and notes.
- Verify AgentX pipeline writes to tracker database with correct schema (status=applied, date_applied, status_history initial entry).
- Verify brief generation and existing tests still pass.

### Phase 4 (Week 3.5+): Deferred — Notifications & Polish
**Stories**: US-4.1 (reminders deferred to Phase 2 means Phase 4 timing)
- Implement desktop/browser notifications at 7/14/21 days (deferred; not required for MVP launch).
- Add bulk actions (P1).
- UI polish and bug fixes.

Launch Criteria (End of Phase 3)
- All P0 stories for Job Application Tracker complete (US-1.1 through US-1.6, US-2.1, US-3.1).
- Extension and dashboard both show tracker with filtering, status updates, history, follow-up signals, and stage summary.
- Notes feature working in both views.
- Export endpoint tested and documented.
- AgentX pipeline integrates cleanly (all existing tests still pass).
- Manual testing of tracker workflows (save, update status, filter, view history, add notes).

---

## 10. Out of Scope
- Automatic application submission
- Calendar single-sign-on integrations for MVP

---

## 11. Open Questions
| Question | Owner | Status | Resolution |
|---|---|---|---|
| Should reminders be local-only or allow optional cloud-sync? | PM | Open | TBD |
| Which UI should handle note editing primarily (extension or dashboard)? | PM/Engineer | Open | TBD |

---

## 12. Appendix (Research & Council)

### Research Summary
- Codebase: Existing extension, AgentX pipeline, FastAPI backend, SQLite storage, and tests found in workspace root.
- Key files reviewed: `cv.md`, `AGENTS.md`, existing `output/` briefs.
- Prior art: Many job trackers exist but few focus on visa sponsorship for OPT students; leverage AgentX pipeline for rapid extraction and brief generation.
- Council file: docs/artifacts/prd/COUNCIL-1.md

### Related Documents
- PRD file: docs/artifacts/prd/PRD.md
- Model Council: docs/artifacts/prd/COUNCIL-1.md

---

**Generated by AgentX Product Manager Agent**
