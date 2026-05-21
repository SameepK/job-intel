from pydantic import BaseModel
from typing import Optional, List


class JobApplication(BaseModel):
    id: Optional[str] = None
    title: str
    company: str
    location: Optional[str] = None
    salary: Optional[str] = None
    job_url: str
    posted_date: Optional[str] = None
    job_description: Optional[str] = None
    sponsorship_signal: str = "unknown"
    ats_type: Optional[str] = None
    status: str = "applied"
    applied_date: Optional[str] = None
    last_updated: Optional[str] = None


class JobAnalysis(BaseModel):
    application_id: str
    fit_score: int
    skills_match: int
    experience_match: int
    stack_overlap: int
    skill_gaps: List[str] = []
    strengths: List[str] = []
    recommendation: str
    reasoning: str
    visa_risk: str


class TrackerResult(BaseModel):
    saved: bool
    duplicate: bool
    application_id: str
    follow_up_dates: dict
    status: str


class ReviewResult(BaseModel):
    approved: bool
    blocks: List[str] = []
    warnings: List[str] = []
    final_recommendation: str
    review_notes: str


class PipelineResult(BaseModel):
    application: JobApplication
    analysis: Optional[JobAnalysis] = None
    tracker: Optional[TrackerResult] = None
    review: Optional[ReviewResult] = None
    pipeline_status: str
    error: Optional[str] = None


class ExtractRequest(BaseModel):
    page_text: str
    page_url: str
    page_title: Optional[str] = None


class NoteBase(BaseModel):
    text: str


class NoteCreate(NoteBase):
    pass


class NoteUpdate(NoteBase):
    pass


class NoteResponse(NoteBase):
    id: str
    application_id: str
    created_at: str
    updated_at: str


class StatusUpdateRequest(BaseModel):
    new_status: str
    timestamp: Optional[str] = None