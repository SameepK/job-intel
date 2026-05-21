---
Issue: #1
Title: Phase 2 Delivery Learnings — Job Intel Tracker
Date: 2026-05-21
Status: Completed
---

# Phase 2 Delivery Learnings — Job Intel Tracker

## What was built
- Implemented Phase 2 follow-up tracking support for the Job Intel tracker.
- Added server-side follow-up computation for 7/14/21 day reminders in `src/database.py` and surfaced it through application detail payloads.
- Added note edit support in the Chrome extension UI (`extension/src/popup.tsx`) and ensured notes CRUD remains fully supported by the backend.
- Added remediation coverage for TC-04 in `tests/test_main.py`, including follow-up metadata and `/reminders` endpoint validation.
- Maintained and expanded automation coverage across dashboard, extension, and backend integration behaviors.

## Key architectural decisions
- Kept follow-up state computation on the backend by extending `get_all_applications` and `get_application` with `compute_follow_up_state`.
- Stored reminders in a dedicated `reminders` table and exposed `/reminders` so follow-up flows can be implemented both in the UI and external automation.
- Kept notes lifecycle logic centralized in `src/database.py` and the FastAPI endpoints in `src/main.py` to preserve consistent behavior between dashboard and extension clients.
- Used the existing FastAPI TestClient approach and SQLite ephemeral DB fixture patterns already present in the repo to validate new behavior without adding new test infrastructure.

## What worked well
- The existing test architecture made it easy to add TC-04 coverage quickly, and the whole suite passed with `13 passed`.
- Backend data modeling was already aligned to support new reminder metadata, so follow-up tracking could be added without schema refactoring.
- The extension UI already had notes CRUD paths and a clean component state model, so adding edit support was a targeted enhancement rather than a large refactor.
- The `AgentX` pipeline integration remained stable, showing that Phase 2 changes did not break the core tracker flow.

## What was hard
- Coordinating follow-up indication across server metadata and UI required careful verification because the existing tracker list did not previously expose follow-up fields.
- The extension popup is a compact UI with inline state handling, so adding edit-mode note behavior needed extra state variables and refresh logic to avoid stale selection state.
- Ensuring deterministic test coverage for 7/14/21 day follow-up required explicit control over `applied_date` in the test helper and the database save path.

## Future engineers should know
- Follow-up logic is computed dynamically in `src/database.py` via `compute_follow_up_state`; you can extend this to support custom reminder windows or status-based suppression.
- Reminders are persisted in `reminders` and queried by `/reminders`; this endpoint is the source of truth for due-today follow-up workflows.
- The extension and dashboard both use the same backend APIs for notes; the extension now supports `PATCH /applications/{id}/notes/{note_id}` for edits.
- When changing the UI state in `extension/src/popup.tsx`, refresh selected application details after note or status transitions to keep client state consistent.
- If you add new follow-up or reminder behavior, verify both API and UI flows: `/applications`, `/applications/{id}`, and `/reminders`.

## Link back to issue
- This capture is linked to **issue #1** and documents the Phase 2 delivery for Job Intel.
