---
Epic: #1
Title: ADR — Job Intel Tracker Architecture
Date: 2026-05-20
Status: Proposed
---

# ADR: Job Intel Job Application Tracker Architecture

**Epic**: #1
**Status**: Proposed
**Author**: Architect Agent
**Date**: 2026-05-20
**Affected Components**: React dashboard, Chrome extension, FastAPI backend, SQLite database

---

## Context

### Problem
Job Intel requires four major architectural additions to fulfill the PRD:
1. **React dashboard at localhost:3000** — Full-featured UI for job tracking, filtering, and status management outside the extension.
2. **My Applications view in Chrome extension** — Tracker accessible directly from the browser without leaving the current tab.
3. **Notes per application** — Free-text context attached to applications, synchronized between extension and dashboard.
4. **Status history logging** — Track status transitions with timestamps as applications progress through lifecycle (applied → interview → offer → accepted/rejected).

### Current State
- FastAPI backend (localhost:8000) with 7 endpoints; SQLite database with tables: `applications`, `analyses`, `reminders`, `status_history`.
- TypeScript Chrome extension with background worker and popup.
- AgentX 4-agent pipeline (extractor, analyst, tracker, reviewer) feeds extracted job data into the tracker.
- Status field exists on applications; status_history table exists but may not be fully integrated into the save/update flow.

### Requirements from PRD
- **Application list view**: Both extension and dashboard show all saved applications with title, company, location, date applied, status, visa_risk, fit_score.
- **Status lifecycle**: applied → phone screen → interview → offer → accepted | rejected | ghosted. Manual status updates with timestamp logging.
- **Status history**: Every status change logged with timestamp; users view full history.
- **Filtering**: By status (multi-select), company, date range, visa_risk, fit_score; cumulative filters.
- **Follow-up tracking**: UI shows which applications need follow-up at 7/14/21 days.
- **Stage summary**: Dashboard shows counts by stage (Applied, Phone Screen, Interview, Offer, Accepted, Rejected, Ghosted).
- **Notes**: Create, edit, delete free-text notes per application; synced across extension and dashboard.
- **Export**: `GET /export` returns JSON with all applications, status_history, and notes.

---

## Options

### Option 1: Decoupled React App + HTTP API (RECOMMENDED)

**Description**: React dashboard as a standalone Vite app at localhost:3000. Extension is a separate frontend that communicates with the same FastAPI backend via HTTP. Notes and status updates go through REST endpoints. No shared state except SQLite backend.

**Pros**:
- Clean separation of concerns: extension and dashboard are independent frontends.
- Easier to develop and test each UI in isolation.
- Dashboard can scale independently (e.g., future hosted version).
- Simple stateless HTTP API; no WebSocket complexity.
- Familiar pattern (2-frontend, 1-backend architecture).

**Cons**:
- Extension must poll for updates (or call sync endpoint) to stay in sync with dashboard changes.
- Slightly more latency than shared state.
- Two separate build/deploy artifacts for the frontends.

**Complexity**: Medium
**Technology Stack**: Vite + React (dashboard), TypeScript extension, FastAPI backend, SQLite.

---

### Option 2: Shared React Components + Extension Packaging

**Description**: Build React components once, use them in both a dashboard app (Vite at localhost:3000) and the Chrome extension popup (as a bundled React app). Both frontends share the same component library and communicate with the FastAPI backend.

**Pros**:
- Code reuse: components built once, used in two places.
- Consistent UI and behavior across extension and dashboard.
- Monorepo or shared package simplifies maintenance.

**Cons**:
- More complex build setup (two separate bundles from shared source).
- Extension packaging is more complex (bundling React into the popup is heavier than vanilla TS).
- Shared component library can become a bottleneck if the two contexts diverge.

**Complexity**: Medium-High
**Technology Stack**: Monorepo (npm workspaces or Lerna), shared React component library, Vite + webpack, FastAPI, SQLite.

---

### Option 3: WebSocket-Driven Real-Time Sync

**Description**: Add WebSocket support to FastAPI backend. Extension and dashboard both connect to the WebSocket and receive real-time updates when any client updates data (status, notes, etc.). Centralized state on the backend; clients are thin.

**Pros**:
- Real-time sync: if user updates status in dashboard, extension sees the change immediately without polling.
- Single source of truth on backend; no sync conflicts.
- Scales well if multiple users or devices need to stay in sync (future feature).

**Cons**:
- Adds WebSocket complexity to the backend.
- Requires WebSocket client library in both extension and dashboard.
- Potential issues with extension WebSocket lifecycle (especially when backgroundWorker goes dormant).
- Overengineered for MVP (polling is sufficient).

**Complexity**: High
**Technology Stack**: FastAPI + python-socketio, WebSocket client libraries, Vite + React, TypeScript extension, SQLite.

---

## Evaluation Matrix

| Criterion | Option 1 (Decoupled) | Option 2 (Shared Components) | Option 3 (WebSocket) |
|-----------|:---:|:---:|:---:|
| **Implementation Complexity** | 5/10 | 7/10 | 8/10 |
| **Maintenance Burden** | Low | Medium | Medium-High |
| **Code Reuse** | Minimal | High | Minimal |
| **Real-time Sync** | Polling (eventual consistency) | Polling (eventual consistency) | Real-time |
| **Scalability** | High | Medium | High |
| **MVP Fit** | Excellent | Good | Overkill |
| **Testing Difficulty** | Easy | Medium | Hard |

---

## Decision

**Chosen: Option 1 — Decoupled React App + HTTP API**

**Rationale**:
- Aligns with MVP timeline and minimal complexity.
- Clean separation of extension and dashboard logic.
- HTTP API is straightforward and testable.
- Polling (with optional `last_modified` timestamps) is sufficient for initial sync; users rarely update the same application simultaneously from both extension and dashboard during MVP.
- If real-time multi-client sync becomes critical post-MVP, it can be added without refactoring the dashboard/extension code (only backend changes needed).

**Implementation notes**:
- React dashboard is a standalone Vite app with `src/pages` for each view (Tracker, Details, Settings).
- Extension retains its TypeScript background worker; popup becomes a React app bundled separately (Webpack).
- Sync strategy: On application list load, extension calls `GET /applications` and caches in memory/local storage. When user returns to My Applications tab, refresh from API. Optional: add `last_updated` field to application object so extension can poll smartly.
- No shared component library for MVP; each frontend optimizes for its context (extension popup constraints vs. dashboard spaciousness).

---

## Consequences

### Benefits
- Fast initial implementation: clear, familiar architecture.
- Extension and dashboard can be developed/tested independently.
- Minimal backend changes (just add notes table, export endpoint, status history integration).

### Trade-offs
- Extension and dashboard may drift in UI if not carefully maintained (no shared components).
- Eventual consistency model (extension may show stale data briefly after dashboard update).
- Two separate build processes for frontends.

### Risks
- **Risk**: Extension popup constraints (height/width) may make same UI design unsuitable. **Mitigation**: Design extension UI first, then adapt for dashboard (not vice versa). Extension is the primary MVP deliverable.
- **Risk**: Notes sync lag if user edits in dashboard, then immediately checks extension. **Mitigation**: Polling-on-load is acceptable for MVP; document eventual consistency. Add manual refresh button if needed.
- **Risk**: SQLite write contention if both extension and dashboard send simultaneous updates. **Mitigation**: SQLite can handle concurrent writes with WAL mode; add `last_updated` timestamps and optimistic locking if conflicts arise.

---

## Related Decisions

- **Extension multi-view pattern**: Use tab-based router inside extension popup (no separate popup pages). Simplest given extension size constraints.
- **Notes storage**: New `notes` table in SQLite; synced via REST API (GET/POST notes per application).
- **Status history integration**: Ensure every `/patch/.../status` call logs to `status_history` table with timestamp before committing.
- **Export endpoint**: `GET /export` queries all tables and returns JSON; no filtering for MVP.

---

**References**: Tech Spec at `docs/artifacts/specs/SPEC.md` for implementation details.

**Confidence**: HIGH — Decoupled HTTP API is a proven pattern; no architectural risk.
