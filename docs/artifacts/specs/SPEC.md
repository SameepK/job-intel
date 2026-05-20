---
Epic: #1
Title: SPEC — Job Intel Tracker Implementation
Date: 2026-05-20
Status: Proposed
---

# Technical Specification: Job Intel Job Application Tracker

**Epic**: #1
**Status**: Proposed
**Author**: Architect Agent
**Date**: 2026-05-20
**Architecture Decision**: ADR.md (Option 1: Decoupled React + HTTP API)

---

## 1. Overview

This specification details the implementation of the Job Intel Job Application Tracker — a job search lifecycle management system with a Chrome extension UI and a React dashboard, both backed by a FastAPI REST API and SQLite database.

**In Scope for MVP**:
- Core Tracker (list, filter, status updates, status history)
- Notes per application
- JSON export endpoint
- Integration with existing AgentX pipeline
- Chrome extension "My Applications" view
- React dashboard at localhost:3000

**Out of Scope for MVP**:
- Real-time multi-client sync (WebSocket)
- Notification delivery (deferred to Phase 2)
- Bulk actions, CSV export (P1, post-MVP)

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌──────────────────────────────────────────────────────┐
│ Chrome Extension (TypeScript)                        │
│  ├─ Background Worker: API calls, state mgmt       │
│  └─ Popup: React app (My Applications view)         │
└──────────────┬───────────────────────────────────────┘
               │ HTTP REST API
               ↓
┌──────────────────────────────────────────────────────┐
│ FastAPI Backend (Python) — localhost:8000           │
│  ├─ /applications (GET, PATCH status)               │
│  ├─ /applications/{id}/notes (GET, POST, DELETE)    │
│  ├─ /export (GET)                                   │
│  └─ /track, /track-url (AgentX pipeline entry)      │
└──────────────┬───────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│ SQLite Database (data/applications.db)              │
│  ├─ applications (id, title, company, status, ...) │
│  ├─ analyses (fit_score, visa_risk, ...)           │
│  ├─ notes (id, application_id, text, timestamp)    │
│  ├─ status_history (app_id, old_status, new_status,│
│  │                  changed_at)                     │
│  └─ reminders (follow-up dates)                     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ React Dashboard (Vite) — localhost:3000             │
│  ├─ Tracker page (list, filter, status)             │
│  ├─ Details page (notes, history, brief)            │
│  └─ Settings page                                   │
└──────────────┬───────────────────────────────────────┘
               │ HTTP REST API
               └──────────────────────────────────────>│
```

---

## 3. Data Model

### 3.1 Database Schema Updates

#### `applications` table (EXISTING — ADD FIELDS)
```sql
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    salary TEXT,
    job_url TEXT NOT NULL,
    posted_date TEXT,
    job_description TEXT,
    ats_type TEXT,
    status TEXT DEFAULT 'applied',  -- applied, phone_screen, interview, offer, accepted, rejected, ghosted
    applied_date TEXT,
    last_updated TEXT,  -- ISO 8601 timestamp; update on every write
    needs_review BOOLEAN DEFAULT 0  -- AgentX extraction confidence < 75%
);
```

#### `notes` table (NEW)
```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    text TEXT,
    created_at TEXT,  -- ISO 8601
    updated_at TEXT,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
```

#### `status_history` table (EXISTING — ENSURE INTEGRATION)
```sql
CREATE TABLE status_history (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_at TEXT,  -- ISO 8601 timestamp
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
```

### 3.2 API Request/Response Schemas

#### GET /applications
**Query Parameters**:
- `status` (optional, comma-separated): "applied,phone_screen,interview"
- `company` (optional, substring search): "Google"
- `date_from` (optional, ISO 8601): "2026-05-01"
- `date_to` (optional, ISO 8601): "2026-05-31"
- `visa_risk` (optional, comma-separated): "high,medium"
- `fit_score_min` (optional, int): 70
- `fit_score_max` (optional, int): 100

**Response**:
```json
[
  {
    "id": "uuid1",
    "title": "Software Engineer",
    "company": "Google",
    "location": "Mountain View, CA",
    "salary": "$200k-250k",
    "job_url": "https://...",
    "status": "interview",
    "applied_date": "2026-05-01T10:00:00Z",
    "last_updated": "2026-05-15T14:30:00Z",
    "visa_risk": "low",
    "fit_score": 85,
    "job_description": "...",
    "needs_review": false
  }
]
```

#### GET /applications/{application_id}
**Response**:
```json
{
  "id": "uuid1",
  "title": "Software Engineer",
  "company": "Google",
  "status": "interview",
  "applied_date": "2026-05-01T10:00:00Z",
  "last_updated": "2026-05-15T14:30:00Z",
  "visa_risk": "low",
  "fit_score": 85,
  "status_history": [
    { "old_status": null, "new_status": "applied", "changed_at": "2026-05-01T10:00:00Z" },
    { "old_status": "applied", "new_status": "phone_screen", "changed_at": "2026-05-10T09:00:00Z" },
    { "old_status": "phone_screen", "new_status": "interview", "changed_at": "2026-05-14T15:00:00Z" }
  ],
  "notes": [
    { "id": "note1", "text": "Positive initial call...", "created_at": "2026-05-10T09:30:00Z", "updated_at": "2026-05-10T09:30:00Z" }
  ]
}
```

#### PATCH /applications/{application_id}/status
**Request**:
```json
{
  "new_status": "interview",
  "timestamp": "2026-05-14T15:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "application_id": "uuid1",
  "old_status": "phone_screen",
  "new_status": "interview",
  "changed_at": "2026-05-14T15:00:00Z"
}
```

#### GET /applications/{application_id}/notes
**Response**:
```json
[
  { "id": "note1", "text": "...", "created_at": "...", "updated_at": "..." },
  { "id": "note2", "text": "...", "created_at": "...", "updated_at": "..." }
]
```

#### POST /applications/{application_id}/notes
**Request**:
```json
{
  "text": "Positive initial call, asked about visa sponsorship..."
}
```

**Response**:
```json
{
  "id": "note_uuid",
  "application_id": "uuid1",
  "text": "...",
  "created_at": "2026-05-10T09:30:00Z",
  "updated_at": "2026-05-10T09:30:00Z"
}
```

#### DELETE /applications/{application_id}/notes/{note_id}
**Response**:
```json
{
  "success": true,
  "note_id": "note_uuid"
}
```

#### GET /export
**Response**:
```json
{
  "exported_at": "2026-05-20T12:00:00Z",
  "applications": [
    {
      "id": "uuid1",
      "title": "Software Engineer",
      "company": "Google",
      "status": "interview",
      "applied_date": "2026-05-01T10:00:00Z",
      "last_updated": "2026-05-15T14:30:00Z",
      "visa_risk": "low",
      "fit_score": 85,
      "status_history": [
        { "old_status": null, "new_status": "applied", "changed_at": "2026-05-01T10:00:00Z" },
        { ... }
      ],
      "notes": [
        { "id": "note1", "text": "...", "created_at": "...", "updated_at": "..." }
      ]
    }
  ],
  "total_count": 25
}
```

---

## 4. Frontend Architecture

### 4.1 Chrome Extension

**Structure**:
```
extension/
├── src/
│   ├── background.ts           // API client, messaging hub
│   ├── popup.tsx               // React app entry
│   ├── pages/
│   │   ├── MyApplications.tsx   // Main tracker list + filters
│   │   ├── ApplicationDetail.tsx // Status history, notes
│   │   └─ Settings.tsx          // Configuration
│   ├── components/
│   │   ├── TrackerList.tsx      // Application list with filtering
│   │   ├── StatusBadge.tsx
│   │   ├── NotesEditor.tsx      // Note creation/edit
│   │   └─ FollowUpIndicator.tsx // 7/14/21 day highlighting
│   ├── styles/
│   │   └─ popup.css            // Popup-specific styles (small viewport)
│   └── types.ts                 // TypeScript types
├── public/
│   ├── manifest.json           // v3 manifest: popup.html, background.ts
│   └─ popup.html               // React DOM mount point
└─ webpack.config.js            // Bundle popup.tsx + background.ts
```

**Key Components**:
- **MyApplications.tsx**: Tracker list view; filters by status, company, date, visa_risk, fit_score; sorts by date/stage; shows follow-ups due today.
- **NotesEditor.tsx**: Modal/drawer for adding/editing notes per application.
- **StatusBadge.tsx**: Color-coded status indicator (applied=gray, interview=blue, offer=green, rejected=red, etc.).
- **FollowUpIndicator.tsx**: Visual indicator (badge or highlight) for applications due at 7, 14, 21 days.

**API Sync Strategy**:
- On popup open: call `GET /applications?last_7_days=true` to fetch recent apps + starred.
- On full list load: call `GET /applications` with filters; cache in memory.
- When user updates status: PATCH immediately; optimistically update UI; if PATCH fails, show error and revert.
- Optional: add pull-to-refresh or manual refresh button.

### 4.2 React Dashboard

**Structure**:
```
src/
├── pages/
│   ├── Tracker.tsx        // Main list view with filtering, stage summary
│   ├── ApplicationDetail.tsx // Full details, notes, history, brief
│   ├── Settings.tsx       // User preferences, data export
│   └─ Export.tsx          // Data download UI
├── components/
│   ├── TrackerGrid.tsx    // Data table/grid with inline editing
│   ├── FilterPanel.tsx    // Multi-select filters
│   ├── StageSummary.tsx   // Stage counts (Applied, Interview, etc.)
│   ├── StatusHistoryView.tsx // Timeline of status changes
│   ├── NotesSection.tsx   // Notes display + editor
│   ├── FollowUpList.tsx   // Applications due for follow-up today
│   └─ BriefViewer.tsx     // Display interview brief (if available)
├── hooks/
│   ├── useApplications.ts // Fetch + filter applications
│   ├── useNotes.ts        // CRUD notes
│   └─ useStatusUpdate.ts  // Update status + sync history
├── api/
│   └─ client.ts           // Fetch wrapper with error handling
├── styles/
│   └─ tailwind.css        // TailwindCSS (recommended for MVP)
└─ App.tsx                 // Router + layout
```

**Key Views**:
- **Tracker page**: Default view; lists all applications; allows inline status update; shows stage summary (counts by status); highlights follow-ups due today.
- **Application Detail page**: Full context for a single application (notes, status history, brief, job description snippet).
- **Settings page**: Export data, preferences, clear data.

---

## 5. Backend Implementation Details

### 5.1 New Endpoints

#### POST /applications/{application_id}/notes
```python
@app.post("/applications/{application_id}/notes")
async def create_note(application_id: str, body: dict):
    """Create a new note for an application."""
    note_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute(
        "INSERT INTO notes (id, application_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (note_id, application_id, body['text'], datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
    )
    conn.commit()
    return {"id": note_id, "application_id": application_id, "text": body['text'], "created_at": datetime.utcnow().isoformat()}
```

#### GET /export
```python
@app.get("/export")
async def export_data():
    """Export all applications, notes, and status history as JSON."""
    conn = get_connection()
    apps = conn.execute("SELECT * FROM applications").fetchall()
    result = {
        "exported_at": datetime.utcnow().isoformat(),
        "applications": []
    }
    for app in apps:
        app_id = app['id']
        notes = conn.execute("SELECT * FROM notes WHERE application_id = ?", (app_id,)).fetchall()
        history = conn.execute("SELECT * FROM status_history WHERE application_id = ?", (app_id,)).fetchall()
        result["applications"].append({
            "id": app_id,
            "title": app['title'],
            "company": app['company'],
            "status": app['status'],
            "visa_risk": (conn.execute("SELECT visa_risk FROM analyses WHERE application_id = ?", (app_id,)).fetchone() or {}).get('visa_risk', 'unknown'),
            "notes": [dict(note) for note in notes],
            "status_history": [dict(h) for h in history]
        })
    return result
```

#### PATCH /applications/{application_id}/status
```python
@app.patch("/applications/{application_id}/status")
async def update_status(application_id: str, request: StatusUpdateRequest):
    """Update application status and log to status_history."""
    conn = get_connection()
    app = conn.execute("SELECT status FROM applications WHERE id = ?", (application_id,)).fetchone()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    old_status = app['status']
    new_status = request.new_status
    timestamp = request.timestamp or datetime.utcnow().isoformat()
    
    # Update applications table
    conn.execute(
        "UPDATE applications SET status = ?, last_updated = ? WHERE id = ?",
        (new_status, timestamp, application_id)
    )
    
    # Log to status_history
    history_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO status_history (id, application_id, old_status, new_status, changed_at) VALUES (?, ?, ?, ?, ?)",
        (history_id, application_id, old_status, new_status, timestamp)
    )
    conn.commit()
    
    return {"success": True, "application_id": application_id, "old_status": old_status, "new_status": new_status, "changed_at": timestamp}
```

### 5.2 Enhanced GET /applications
```python
@app.get("/applications")
def list_applications(status: Optional[str] = None, company: Optional[str] = None, 
                      date_from: Optional[str] = None, date_to: Optional[str] = None,
                      visa_risk: Optional[str] = None, fit_score_min: Optional[int] = None):
    """Get all applications with optional filtering."""
    conn = get_connection()
    query = """
    SELECT a.*, 
           COALESCE(an.fit_score, 0) as fit_score,
           COALESCE(an.visa_risk, 'unknown') as visa_risk
    FROM applications a
    LEFT JOIN analyses an ON a.id = an.application_id
    WHERE 1=1
    """
    params = []
    
    if status:
        statuses = status.split(',')
        query += f" AND a.status IN ({','.join(['?'] * len(statuses))})"
        params.extend(statuses)
    if company:
        query += " AND a.company LIKE ?"
        params.append(f"%{company}%")
    if date_from:
        query += " AND a.applied_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND a.applied_date <= ?"
        params.append(date_to)
    if visa_risk:
        risks = visa_risk.split(',')
        query += f" AND an.visa_risk IN ({','.join(['?'] * len(risks))})"
        params.extend(risks)
    if fit_score_min:
        query += " AND an.fit_score >= ?"
        params.append(fit_score_min)
    
    query += " ORDER BY a.applied_date DESC"
    
    apps = conn.execute(query, params).fetchall()
    return [dict(app) for app in apps]
```

---

## 6. Integration with AgentX Pipeline

### 6.1 Data Flow
1. **User captures job**: Chrome extension sends `POST /track` with page URL/text.
2. **AgentX pipeline runs**: Extractor → Analyst → Tracker → Reviewer.
3. **Pipeline saves to DB**: Creates record in `applications` table with `status='applied'`, `applied_date=today`, and entry in `status_history` (initial transition).
4. **Analysis saved**: `analyses` table populated with `fit_score`, `visa_risk`, etc.
5. **Brief generated**: Saved to `output/` directory (existing behavior).
6. **Extension/Dashboard reflect new app**: On next load or refresh, new app appears in tracker list.

### 6.2 Schema Compatibility
- Existing `applications` table columns: OK as-is.
- Add `last_updated` and `needs_review` columns (non-breaking).
- `status_history` table: Ensure pipeline logs initial "applied" status on save (not currently done; MUST ADD).
- New `notes` table: Fully optional; doesn't affect existing pipeline.

---

## 7. Selected Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend (Extension)** | TypeScript, React (popup), Webpack | Familiar; React enables rich UI in constrained popup. |
| **Frontend (Dashboard)** | Vite, React, TailwindCSS | Fast HMR, modern build, styling simplicity. |
| **Backend** | FastAPI, Python | Existing; async-ready; JSON-native. |
| **Database** | SQLite | Existing; sufficient for MVP; no setup overhead. |
| **API** | REST + JSON | Simple, stateless, cacheable. |
| **Deployment** | Local (localhost:3000, localhost:8000) | MVP: single-machine development. |

---

## 8. Non-Functional Requirements

| Requirement | Target | Mechanism |
|-------------|--------|-----------|
| **Response Time** | < 500ms for filtered lists | Indexed queries on status, company, date; in-memory cache in extension. |
| **Concurrent Users** | 1 (single-machine MVP) | SQLite WAL mode for concurrent reads. Post-MVP: scale to N via cloud DB. |
| **Data Durability** | No loss on browser/app restart | SQLite on disk; persistent storage. |
| **Availability** | 99% uptime (MVP) | Local services; manual restart if needed. |
| **Security** | No external auth (MVP); local-only | All data stored locally. Extension/dashboard on localhost. |
| **Accessibility** | WCAG 2.1 AA (Dashboard) | Semantic HTML, ARIA labels, keyboard navigation. |

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **SQLite write contention** | Medium | WAL mode; optimistic locking on status updates; timestamp versioning. |
| **Extension popup constraints** | Medium | Design extension UI first (small viewport); adapt dashboard later. |
| **Notes sync lag** | Low | Eventual consistency acceptable for MVP; document. Manual refresh button. |
| **AgentX integration complexity** | Medium | Ensure new notes/status_history tables don't break existing pipeline; add smoke tests. |
| **Export endpoint performance** | Low | For MVP (~100 apps), JSON serialization is fast. Optimize post-launch if needed. |

---

## 10. Testing Strategy

### Unit Tests
- API endpoint logic (status update, note CRUD, filtering).
- Database operations (insert, update, delete, query).

### Integration Tests
- Full tracker flow: save job → appears in list → filter → update status → history logged.
- Notes sync: create in dashboard → verify in extension (manual refresh).
- Export: call endpoint → verify JSON schema.

### E2E Tests (Manual for MVP)
- Extension: open popup → see list → update status → close/reopen → verify persisted.
- Dashboard: load list → filter by status → click detail → add note → refresh.

---

## 11. Deployment & DevOps

**MVP (Single Machine)**:
```bash
# Backend
python -m src.main  # Runs on localhost:8000

# Extension
npm run build:extension
# Manually load dist/ as unpacked extension in Chrome

# Dashboard
npm run dev:dashboard  # Runs on localhost:3000
```

**Post-MVP (Cloud)**:
- Backend: Deploy to cloud (AWS Lambda, Heroku, DigitalOcean).
- Database: Migrate to PostgreSQL or managed SQLite (e.g., Turso).
- Extension: Publish to Chrome Web Store.
- Dashboard: Host on Vercel or Netlify.

---

## 12. Confidence & Caveats

**Confidence**: HIGH
- Decoupled architecture is proven.
- All required endpoints are straightforward CRUD + filtering.
- Integration with existing AgentX pipeline is non-breaking.

**Caveats**:
- **Notes sync eventual consistency**: Users must manually refresh extension after dashboard edits (acceptable for MVP).
- **Extension popup UX**: May be cramped; prioritize core tracker; notes/history can be deferred to dashboard (Phase 2).
- **SQLite scalability**: OK up to ~10K applications. Beyond that, migrate to PostgreSQL.

---

**References**:
- ADR: docs/artifacts/adr/ADR.md
- PRD: docs/artifacts/prd/PRD.md

