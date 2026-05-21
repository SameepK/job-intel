import { useEffect, useMemo, useState } from 'react';
import {
  fetchApplications,
  fetchApplication,
  updateApplicationStatus,
  createNote,
  updateNote,
  deleteNote,
  exportData
} from './api';

const statusOptions = ['applied', 'phone_screen', 'interview', 'offer', 'accepted', 'rejected', 'ghosted'];
const visaOptions = ['low', 'medium', 'high'];

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function getStageSummary(applications: any[]) {
  return applications.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export default function App() {
  const [applications, setApplications] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    company: '',
    date_from: '',
    date_to: '',
    visa_risk: '',
    fit_score_min: ''
  });
  const [selected, setSelected] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApplications(filters);
      setApplications(data);
      if (selected) {
        setSelected(data.find((item: any) => item.id === selected.id) || null);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadApplicationDetails = async (applicationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApplication(applicationId);
      setSelected(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load application details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = async () => {
    await loadApplications();
  };

  const handleSelect = async (app: any) => {
    setSelected(app);
    await loadApplicationDetails(app.id);
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await updateApplicationStatus(selected.id, status);
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createNote(selected.id, noteText.trim());
      setNoteText('');
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to add note');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditNote = async (noteId: string) => {
    if (!selected || !editingNoteText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updateNote(selected.id, noteId, editingNoteText.trim());
      setEditingNoteId(null);
      setEditingNoteText('');
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to save note');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleStartEditNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await deleteNote(selected.id, noteId);
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to delete note');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-intel-export-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.message || 'Unable to export data');
    } finally {
      setLoading(false);
    }
  };

  const stageSummary = useMemo(() => getStageSummary(applications), [applications]);

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Job Intel Dashboard</h1>
          <p>Manage applications, notes, and status history.</p>
        </div>
        <button onClick={handleExport} className="primary">Export JSON</button>
      </header>

      <section className="filters">
        <div className="filter-row">
          <label>Status</label>
          <input type="text" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} placeholder="applied,interview" />
        </div>
        <div className="filter-row">
          <label>Company</label>
          <input type="text" value={filters.company} onChange={e => handleFilterChange('company', e.target.value)} />
        </div>
        <div className="filter-row">
          <label>Date from</label>
          <input type="date" value={filters.date_from} onChange={e => handleFilterChange('date_from', e.target.value)} />
        </div>
        <div className="filter-row">
          <label>Date to</label>
          <input type="date" value={filters.date_to} onChange={e => handleFilterChange('date_to', e.target.value)} />
        </div>
        <div className="filter-row">
          <label>Visa risk</label>
          <input type="text" value={filters.visa_risk} onChange={e => handleFilterChange('visa_risk', e.target.value)} placeholder="low,medium" />
        </div>
        <div className="filter-row">
          <label>Fit min</label>
          <input type="number" min="0" max="100" value={filters.fit_score_min} onChange={e => handleFilterChange('fit_score_min', e.target.value)} />
        </div>
        <button onClick={applyFilters} className="secondary">Apply filters</button>
      </section>

      <section className="summary">
        {statusOptions.map(status => (
          <div key={status} className="summary-card">
            <strong>{stageSummary[status] || 0}</strong>
            <span>{status.replace('_', ' ')}</span>
          </div>
        ))}
      </section>

      <main className="layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Applications</h2>
            <span>{applications.length} items</span>
          </div>
          <div className="table">
            {applications.map(app => (
              <button key={app.id} className={`table-row ${selected?.id === app.id ? 'selected' : ''}`} onClick={() => handleSelect(app)}>
                <div>{app.title}</div>
                <div>{app.company}</div>
                <div>{app.status}</div>
                <div>{app.visa_risk}</div>
                <div>{app.fit_score}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel detail-panel">
          {selected ? (
            <>
              <div className="panel-header">
                <h2>{selected.title}</h2>
                <span>{selected.company}</span>
              </div>
              <div className="detail-row">
                <strong>Status</strong>
                <select value={selected.status} onChange={e => handleStatusChange(e.target.value)}>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="detail-row">
                <strong>Follow-up</strong>
                <span>{selected.follow_up_stage ? `Due after ${selected.follow_up_stage}` : 'Not due'}</span>
              </div>
              <div className="detail-row">
                <strong>Visa Risk</strong>
                <span>{selected.visa_risk}</span>
              </div>
              <div className="detail-row">
                <strong>Fit Score</strong>
                <span>{selected.fit_score}</span>
              </div>
              <div className="detail-row">
                <strong>Applied</strong>
                <span>{formatDate(selected.applied_date)}</span>
              </div>
              <section className="notes-section">
                <h3>Notes</h3>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." />
                <button onClick={handleAddNote} className="primary">Add note</button>
                <div className="note-list">
                  {(selected.notes || []).map((note: any) => (
                    <div key={note.id} className="note-card">
                      {editingNoteId === note.id ? (
                        <>
                          <textarea
                            value={editingNoteText}
                            onChange={e => setEditingNoteText(e.target.value)}
                            rows={3}
                          />
                          <div className="note-actions">
                            <button onClick={() => handleSaveEditNote(note.id)}>Save</button>
                            <button onClick={handleCancelEditNote}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>{note.text}</p>
                          <small>{formatDate(note.created_at)}</small>
                          <div className="note-actions">
                            <button onClick={() => handleStartEditNote(note)}>Edit</button>
                            <button onClick={() => handleDeleteNote(note.id)}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section className="history-section">
                <h3>Status History</h3>
                <div className="history-list">
                  {(selected.status_history || []).map((history: any) => (
                    <div key={history.id} className="history-item">
                      <span>{history.old_status || 'none'} → {history.new_status}</span>
                      <small>{formatDate(history.changed_at)}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">Select an application to view notes and history.</div>
          )}
        </div>
      </main>

      {loading && <div className="loading-banner">Loading...</div>}
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
