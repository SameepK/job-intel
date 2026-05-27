---
Epic: #1
Title: Test Plan — Job Intel Tracker
Date: 2026-05-20
Status: Proposed
---

# Test Plan — Job Intel Tracker

Purpose
- Capture deterministic test scenarios for the Job Intel tracker before implementation work begins.
- Provide acceptance criteria that map to the PRD (docs/artifacts/prd/PRD.md) and Tech Spec (docs/artifacts/specs/SPEC.md).

Scope (MVP)
- Job application tracker list view
- Status update and status history logging
- Filtering by status, company, date range, visa_risk, fit_score
- Follow-up tracking at 7/14/21 days
- Notes: create, edit, delete
- JSON export endpoint GET /export
- AgentX pipeline compatibility after schema/endpoint changes
- Verify existing automated tests still pass (13 tests currently)

Test Types
- Unit tests: business logic, DB helpers, model validation (pytest)
- Integration tests: API endpoints (FastAPI + SQLite), DB migrations, status history logging
- E2E / Manual test scenarios: extension popup flows, dashboard flows, AgentX pipeline end-to-end capture
- Regression tests: run existing suite and new tests as PR gate

General Test Environment & Commands
- Start backend: python -m src.main (serves on localhost:8000)
- Run unit/integration tests: pytest -q
- Run only existing tests: pytest -q tests (or pytest -q and confirm 7 tests pass)
- Manual E2E: open extension in Chrome (unpacked) and dashboard at http://localhost:8000/dashboard

Test Data Guidelines
- Use deterministic UUIDs where possible in unit tests.
- Use an ephemeral SQLite DB copy for tests (in-memory or a :memory: DB) to avoid corrupting user data.
- Seed the DB with representative sample rows: varied statuses, visa_risk levels (low/medium/high), fit_score distribution, and notes.

Acceptance Criteria (overall)
- All new endpoints behave as specified in SPEC.md and return documented JSON shapes.
- Status updates always create a status_history entry with ISO8601 timestamp.
- Notes CRUD persists and is returned by GET applications and GET applications/{id}/notes.
- GET /export returns all applications with embedded status_history and notes.
- Filters applied in GET /applications return correct subsets and respect multiple filters combined.
- Follow-up indicators (7/14/21) computed from applied_date and visible in UI flows.
- AgentX pipeline can save new applications and analyses without schema errors.
- Existing automated tests (13) pass unchanged.

Test Matrix (feature -> test type)
- Tracker list view: unit, integration, manual E2E
- Status update & history: unit, integration
- Filtering: unit, integration
- Follow-up tracking: unit, integration, manual UI
- Notes CRUD: unit, integration
- Export endpoint: integration
- AgentX pipeline: integration (pipeline smoke test) and manual end-to-end
- Existing tests: regression (pytest)

Detailed Test Scenarios

TC-01: Tracker List View - Basic Load
- Objective: Tracker list returns saved applications and required fields.
- Preconditions: DB seeded with 5 applications across statuses.
- Steps:
 1. Start backend.
 2. Call GET /applications with no params.
- Expected:
 - HTTP 200; JSON array length equals seeded count.
 - Each object contains id, title, company, status, applied_date, last_updated, visa_risk, fit_score.
 - Order is by applied_date DESC.
- Test type: Integration (automatable)

TC-02: Status Update & Status History Logging
- Objective: Changing an application's status updates applications.status and inserts a status_history row.
- Preconditions: One application exists with status = applied.
- Steps:
 1. Call PATCH /applications/{id}/status with JSON { new_status: phone_screen }.
 2. Query GET /applications/{id} and query the status_history table for application_id.
- Expected:
 - PATCH returns success payload with old_status and new_status and ISO changed_at.
 - applications.status == phone_screen and last_updated updated.
 - status_history contains one new row with correct old_status, new_status, and changed_at matching response.
- Test type: Integration + Unit for DB helper

TC-03: Filtering (status, company, date range, visa_risk, fit_score)
- Objective: Verify combined filters return expected subset.
- Preconditions: Seed DB with diverse rows:
 - Company: Alpha, Beta
 - Status: applied, interview, offer
 - Applied dates spanning 2026-04-01..2026-05-20
 - Visa risk: low, medium, high
 - Fit scores: 40, 70, 90
- Steps:
 1. Call GET /applications?status=applied,interview&company=Alpha&date_from=2026-05-01&fit_score_min=60&visa_risk=low,medium.
- Expected:
 - Only applications matching all criteria are returned.
 - Response fields include visa_risk and fit_score values used for filtering.
- Test type: Integration (automatable)

TC-04: Follow-Up Tracking (7/14/21 days)
- Objective: Applications show follow-up indicators when time from applied_date reaches 7, 14, or 21 days.
- Preconditions: Seed DB with applied_date values at today-7, today-14, today-21, and today-1.
- Steps:
 1. Call GET /applications.
 2. For each returned application compute days since applied_date.
- Expected:
 - Applications >= 7 days old are flagged at "7 days"; >= 14 days at "14 days"; >= 21 days at "21 days". Logic uses threshold (>=), not exact match. Server returns `follow_up_due`, `follow_up_days`, and `follow_up_stage` fields on each application.
 - Acceptance: server returns applied_date and last_updated; UI component uses those to render follow-up highlights. For integration test, verify server includes dates; for UI test, verify highlight rendered.
- Test type: Unit (date utility), Integration (API provides dates), Manual E2E (UI highlight)

TC-05: Notes - Create, Edit, Delete
- Objective: Notes CRUD works and is surfaced via application endpoints.
- Preconditions: Application exists.
- Steps:
 1. POST /applications/{id}/notes with { text: first note }. Expect created note id and timestamps.
 2. GET /applications/{id}/notes - new note present.
 3. Update note (if PATCH exists) or delete and re-create to simulate edit.
 4. DELETE /applications/{id}/notes/{note_id}.
 5. Confirm GET no longer returns the deleted note.
- Expected:
 - Create returns note object with id, created_at, updated_at.
 - Edit updates updated_at and text.
 - Delete removes note from notes table and from GET /applications/{id} notes array.
- Test type: Integration (automatable)

TC-06: JSON Export Endpoint GET /export
- Objective: Export returns all applications with embedded status_history and notes.
- Preconditions: DB seeded with at least 3 applications, each with notes and history.
- Steps:
 1. Call GET /export.
- Expected:
 - HTTP 200; response includes exported_at, applications array, and total_count.
 - Each application object contains status_history array and notes array.
 - Schema matches SPEC.md examples.
- Test type: Integration (automatable)

TC-07: AgentX Pipeline Smoke Test (End-to-End)
- Objective: Confirm AgentX pipeline (extractor -> analyst -> tracker -> reviewer) can still create new application records and analyses after schema changes.
- Preconditions: AgentX pipeline runnable locally and backend running.
- Steps:
 1. Use extension or POST /track with a known job URL/text.
 2. Wait for pipeline to complete or poll GET /applications?company=... for new record.
 3. Verify created applications row, analyses row exists for that application, and initial status_history entry (applied) exists.
- Expected:
 - Application created with status=applied, applied_date present.
 - Analysis contains fit_score and visa_risk fields.
 - No pipeline exception; API returns success.
- Test type: Integration / Manual E2E

TC-08: Regression - Existing 13 Tests Still Pass
- Objective: Ensure current test suite continues to pass after changes.
- Steps:
 1. Run pytest -q against repository.
 2. Confirm total tests includes all 13 tests and they all pass.
- Expected:
 - All previously-existing tests (13) pass. Any failures must be triaged and filed as bugs.
- Test type: Regression (automatable)

Test Implementation Notes
- Automatable tests should be added under tests/ and follow repository patterns (existing tests: tests/test_pipeline.py, tests/test_tools.py).
- Use pytest fixtures to seed and tear down an ephemeral DB per test module.
- For API tests, use FastAPI TestClient to exercise endpoints without network.
- For AgentX pipeline smoke tests, capture logs and surface failures as actionable issues.

Quality Gates (PR Checks)
- All unit and integration tests must pass locally: pytest -q.
- New tests added for the new endpoints and features must achieve 100% pass locally before PR.
- Code changes that modify DB schema must include migration steps and a migration test that verifies backward-compatibility of existing records.

Defect Reporting
- For each failing test: create a type:bug issue referencing Epic #1 and the failing test ID (e.g., TC-03). Include:
 - Steps to reproduce
 - Expected and actual results
 - Stack traces and failing assertions

Ownership
- Primary: Engineer (Sameep)
- Reviewer: Tester (this agent) - review test coverage and run the test suite before handoff

Delivery & Verification
- Save this test plan to docs/artifacts/test-plan.md and reference Epic #1 in frontmatter.
- Before merging any implementation PR, run pytest -q and record result in PR checks.

Appendix: Quick Run Commands

- Start backend: python -m src.main
- Run all Python tests: pytest -q
- Run a single test file: pytest -q tests/test_pipeline.py
- Manual: build dashboard with npm run build:dashboard (served at http://localhost:8000/dashboard) and build/load extension with npm run build:extension

---

File location: docs/artifacts/test-plan.md
