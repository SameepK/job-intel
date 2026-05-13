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
        app.get("status", "applied"),
        now,
        now
    ))
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


def update_status(application_id: str, new_status: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT status FROM applications WHERE id = ?", (application_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False

    old_status = row["status"]
    order = ["applied", "phone_screen", "interview", "offer", "accepted", "rejected", "ghosted"]

    if new_status not in order:
        conn.close()
        return False

    now = datetime.now().isoformat()
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
    return True


def get_all_applications() -> List[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.*, an.fit_score, an.recommendation, an.visa_risk, an.reasoning,
               r.first_followup, r.second_followup, r.ghost_date
        FROM applications a
        LEFT JOIN analyses an ON a.id = an.application_id
        LEFT JOIN reminders r ON a.id = r.application_id
        ORDER BY a.applied_date DESC
    """)
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


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
    conn.close()
    return dict(row) if row else None


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