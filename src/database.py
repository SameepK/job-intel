import sqlite3
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional, List

DB_PATH = Path("data/applications.db")


def get_connection():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT,
            salary TEXT,
            job_url TEXT NOT NULL,
            posted_date TEXT,
            job_description TEXT,
            sponsorship_signal TEXT DEFAULT 'unknown',
            ats_type TEXT,
            status TEXT DEFAULT 'applied',
            applied_date TEXT,
            last_updated TEXT
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            fit_score INTEGER,
            skills_match INTEGER,
            experience_match INTEGER,
            stack_overlap INTEGER,
            skill_gaps TEXT,
            strengths TEXT,
            recommendation TEXT,
            reasoning TEXT,
            visa_risk TEXT,
            FOREIGN KEY (application_id) REFERENCES applications(id)
        );

        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            first_followup TEXT,
            second_followup TEXT,
            ghost_date TEXT,
            FOREIGN KEY (application_id) REFERENCES applications(id)
        );

        CREATE TABLE IF NOT EXISTS status_history (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            changed_at TEXT,
            FOREIGN KEY (application_id) REFERENCES applications(id)
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            text TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (application_id) REFERENCES applications(id)
        );
    """)
    conn.commit()
    conn.close()
    print("[DB] Tables initialized")


def is_duplicate(job_url: str, company: str, title: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM applications WHERE job_url = ?", (job_url,))
    if cur.fetchone():
        conn.close()
        return True
    cur.execute(
        "SELECT id FROM applications WHERE LOWER(company) = LOWER(?) AND LOWER(title) = LOWER(?)",
        (company, title)
    )
    result = cur.fetchone()
    conn.close()
    return result is not None


def save_application(app: dict) -> str:
    conn = get_connection()
    app_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    status = app.get("status", "applied")
    applied_date_val = app.get("applied_date") or now
    conn.execute("""
        INSERT INTO applications (
            id, title, company, location, salary, job_url,
            posted_date, job_description, sponsorship_signal,
            ats_type, status, applied_date, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        app_id,
        app.get("title"),
        app.get("company"),
        app.get("location"),
        app.get("salary"),
        app.get("job_url"),
        app.get("posted_date"),
        app.get("job_description"),
        app.get("sponsorship_signal", "unknown"),
        app.get("ats_type"),
        status,
        applied_date_val,
        now
    ))
    conn.execute("""
        INSERT INTO status_history (id, application_id, old_status, new_status, changed_at)
        VALUES (?, ?, ?, ?, ?)
    """, (str(uuid.uuid4())[:8], app_id, None, status, now))
    conn.commit()
    conn.close()
    return app_id


def save_analysis(analysis: dict):
    conn = get_connection()
    analysis_id = str(uuid.uuid4())[:8]
    conn.execute("""
        INSERT INTO analyses (
            id, application_id, fit_score, skills_match,
            experience_match, stack_overlap, skill_gaps,
            strengths, recommendation, reasoning, visa_risk
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis_id,
        analysis.get("application_id"),
        analysis.get("fit_score"),
        analysis.get("skills_match"),
        analysis.get("experience_match"),
        analysis.get("stack_overlap"),
        json.dumps(analysis.get("skill_gaps", [])),
        json.dumps(analysis.get("strengths", [])),
        analysis.get("recommendation"),
        analysis.get("reasoning"),
        analysis.get("visa_risk")
    ))
    conn.commit()
    conn.close()


def save_reminders(application_id: str, dates: dict):
    conn = get_connection()
    conn.execute("""
        INSERT INTO reminders (id, application_id, first_followup, second_followup, ghost_date)
        VALUES (?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4())[:8],
        application_id,
        dates.get("first"),
        dates.get("second"),
        dates.get("ghost_date")
    ))
    conn.commit()
    conn.close()


def update_status(application_id: str, new_status: str, timestamp: Optional[str] = None) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT status FROM applications WHERE id = ?", (application_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    old_status = row["status"]
    order = ["applied", "phone_screen", "interview", "offer", "accepted", "rejected", "ghosted"]

    if new_status not in order:
        conn.close()
        return None

    now = timestamp or datetime.now().isoformat()
    conn.execute(
        "UPDATE applications SET status = ?, last_updated = ? WHERE id = ?",
        (new_status, now, application_id)
    )
    conn.execute("""
        INSERT INTO status_history (id, application_id, old_status, new_status, changed_at)
        VALUES (?, ?, ?, ?, ?)
    """, (str(uuid.uuid4())[:8], application_id, old_status, new_status, now))
    conn.commit()
    conn.close()
    return {"old_status": old_status, "new_status": new_status, "changed_at": now}


def get_notes(application_id: str) -> List[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, application_id, text, created_at, updated_at FROM notes WHERE application_id = ? ORDER BY created_at ASC",
        (application_id,)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_status_history(application_id: str) -> List[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, application_id, old_status, new_status, changed_at FROM status_history WHERE application_id = ? ORDER BY changed_at ASC",
        (application_id,)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def compute_follow_up_state(applied_date: Optional[str], status: str) -> dict:
    if not applied_date or status != 'applied':
        return {
            "follow_up_due": False,
            "follow_up_days": None,
            "follow_up_stage": None,
        }

    try:
        applied_date_only = datetime.fromisoformat(applied_date).date()
    except ValueError:
        return {
            "follow_up_due": False,
            "follow_up_days": None,
            "follow_up_stage": None,
        }

    days = (datetime.now().date() - applied_date_only).days
    if days >= 21:
        stage = "21 days"
    elif days >= 14:
        stage = "14 days"
    elif days >= 7:
        stage = "7 days"
    else:
        stage = None

    return {
        "follow_up_due": stage is not None,
        "follow_up_days": days if stage is not None else None,
        "follow_up_stage": stage,
    }


def get_all_applications(status: Optional[str] = None, company: Optional[str] = None,
                         date_from: Optional[str] = None, date_to: Optional[str] = None,
                         visa_risk: Optional[str] = None, fit_score_min: Optional[int] = None,
                         fit_score_max: Optional[int] = None) -> List[dict]:
    conn = get_connection()
    query = """
        SELECT a.*, COALESCE(an.fit_score, 0) as fit_score, COALESCE(an.recommendation, '') as recommendation,
               COALESCE(an.visa_risk, 'unknown') as visa_risk, an.reasoning,
               r.first_followup, r.second_followup, r.ghost_date
        FROM applications a
        LEFT JOIN analyses an ON a.id = an.application_id
        LEFT JOIN reminders r ON a.id = r.application_id
        WHERE 1=1
    """
    params = []

    if status:
        statuses = status.split(',')
        query += f" AND a.status IN ({','.join(['?'] * len(statuses))})"
        params.extend(statuses)
    if company:
        query += " AND LOWER(a.company) LIKE LOWER(?)"
        params.append(f"%{company}%")
    if date_from:
        query += " AND a.applied_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND a.applied_date <= ?"
        params.append(date_to)
    if visa_risk:
        risks = visa_risk.split(',')
        query += f" AND COALESCE(an.visa_risk, 'unknown') IN ({','.join(['?'] * len(risks))})"
        params.extend(risks)
    if fit_score_min is not None:
        query += " AND COALESCE(an.fit_score, 0) >= ?"
        params.append(fit_score_min)
    if fit_score_max is not None:
        query += " AND COALESCE(an.fit_score, 0) <= ?"
        params.append(fit_score_max)

    query += " ORDER BY a.applied_date DESC"
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    applications = []
    for row in rows:
        app_dict = dict(row)
        follow_up = compute_follow_up_state(app_dict.get("applied_date"), app_dict.get("status", ""))
        app_dict.update(follow_up)
        applications.append(app_dict)
    return applications


def get_note_by_id(note_id: str) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, application_id, text, created_at, updated_at FROM notes WHERE id = ?", (note_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def save_note(application_id: str, text: str) -> str:
    conn = get_connection()
    note_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    conn.execute(
        "INSERT INTO notes (id, application_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (note_id, application_id, text, now, now)
    )
    conn.commit()
    conn.close()
    return note_id


def update_note(note_id: str, text: str) -> bool:
    conn = get_connection()
    now = datetime.now().isoformat()
    cur = conn.cursor()
    cur.execute("UPDATE notes SET text = ?, updated_at = ? WHERE id = ?", (text, now, note_id))
    conn.commit()
    updated = cur.rowcount > 0
    conn.close()
    return updated


def delete_note(note_id: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_export_data() -> dict:
    conn = get_connection()
    apps = conn.execute("SELECT * FROM applications").fetchall()
    result = {
        "exported_at": datetime.now().isoformat(),
        "applications": [],
        "total_count": len(apps)
    }

    for app in apps:
        app_id = app["id"]
        notes = get_notes(app_id)
        status_history = get_status_history(app_id)
        analysis = conn.execute("SELECT fit_score, visa_risk FROM analyses WHERE application_id = ?", (app_id,)).fetchone()
        app_dict = dict(app)
        app_dict["visa_risk"] = analysis["visa_risk"] if analysis else "unknown"
        app_dict["fit_score"] = analysis["fit_score"] if analysis else 0
        app_dict["notes"] = notes
        app_dict["status_history"] = status_history
        result["applications"].append(app_dict)

    conn.close()
    return result


def get_application(application_id: str) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.*, an.fit_score, an.recommendation, an.visa_risk,
               an.skill_gaps, an.strengths, an.reasoning,
               r.first_followup, r.second_followup, r.ghost_date
        FROM applications a
        LEFT JOIN analyses an ON a.id = an.application_id
        LEFT JOIN reminders r ON a.id = r.application_id
        WHERE a.id = ?
    """, (application_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    result = dict(row)
    for field in ("skill_gaps", "strengths"):
        val = result.get(field)
        if isinstance(val, str):
            try:
                result[field] = json.loads(val)
            except (json.JSONDecodeError, ValueError):
                result[field] = []
        elif val is None:
            result[field] = []
    result["notes"] = get_notes(application_id)
    result["status_history"] = get_status_history(application_id)
    follow_up = compute_follow_up_state(result.get("applied_date"), result.get("status", ""))
    result.update(follow_up)
    conn.close()
    return result


def get_due_reminders() -> List[dict]:
    today = datetime.now().date().isoformat()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.title, a.company, a.status,
               r.first_followup, r.second_followup, r.ghost_date
        FROM applications a
        JOIN reminders r ON a.id = r.application_id
        WHERE (r.first_followup = ? OR r.second_followup = ? OR r.ghost_date = ?)
        AND a.status = 'applied'
    """, (today, today, today))
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]