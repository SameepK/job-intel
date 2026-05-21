import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

const API_BASE = 'http://localhost:8000';

interface Note {
  id: string;
  text: string;
  created_at: string;
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
}

interface Application {
  id: string;
  title: string;
  company: string;
  status: string;
  visa_risk: string;
  fit_score: number;
  applied_date?: string;
  notes?: Note[];
  status_history?: StatusHistory[];
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function App() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/applications`);
      if (!response.ok) throw new Error('Unable to fetch applications');
      const data = await response.json();
      setApplications(data);
      if (selected) {
        const updated = data.find((app: Application) => app.id === selected.id);
        if (updated) {
          setSelected(prev => prev ? { ...prev, ...updated } : updated);
        }
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
      const response = await fetch(`${API_BASE}/applications/${applicationId}`);
      if (!response.ok) throw new Error('Unable to fetch application details');
      const data = await response.json();
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

  const handleSelect = async (app: Application) => {
    setSelected(app);
    await loadApplicationDetails(app.id);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/applications/${selected.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: newStatus })
      });
      if (!response.ok) throw new Error('Unable to update status');
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
      const response = await fetch(`${API_BASE}/applications/${selected.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText.trim() })
      });
      if (!response.ok) throw new Error('Unable to add note');
      setNoteText('');
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to add note');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/applications/${selected.id}/notes/${noteId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Unable to delete note');
      await loadApplications();
      await loadApplicationDetails(selected.id);
    } catch (err: any) {
      setError(err.message || 'Unable to delete note');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleSaveEditNote = async () => {
    if (!selected || !editingNoteId || !editingNoteText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/applications/${selected.id}/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editingNoteText.trim() })
      });
      if (!response.ok) throw new Error('Unable to save note');
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

  return (
    <div style={{ width: 360, padding: 16, background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>Job Intel</h1>
      </div>

      <button
        style={{ width: '100%', padding: 12, background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
        onClick={() => chrome.tabs.create({ url: 'http://localhost:8000/applications/view' })}
      >
        View applications dashboard
      </button>

      <div style={{ marginTop: 18, gap: 8, display: 'flex', flexDirection: 'column' }}>
        {loading && <div>Loading…</div>}
        {error && <div style={{ color: '#f87171' }}>{error}</div>}
      </div>

      <div style={{ marginTop: 16, background: '#111827', borderRadius: 12, padding: 10, minHeight: 300 }}>
        <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>My Applications</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {applications.map(app => (
            <button
              key={app.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                background: selected?.id === app.id ? '#1f2937' : '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                textAlign: 'left'
              }}
              onClick={() => handleSelect(app)}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{app.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{app.company}</div>
                  {/** Follow-up badge */}
                  { (app as any).follow_up_due ? (
                    <div style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: '#f59e0b', color: '#0f172a' }}>
                      {(app as any).follow_up_stage || 'follow-up'}
                    </div>
                  ) : null }
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>{app.status}</div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 16, background: '#111827', borderRadius: 12, padding: 14 }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>{selected.title} · {selected.company}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              Status
              <select
                value={selected.status}
                onChange={e => handleStatusUpdate(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
              >
                <option value="applied">applied</option>
                <option value="phone_screen">phone_screen</option>
                <option value="interview">interview</option>
                <option value="offer">offer</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="ghosted">ghosted</option>
              </select>
            </label>
            <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <strong>Follow-up</strong>
              <div style={{ color: '#94a3b8' }}>{(selected as any).follow_up_stage ? `Due after ${(selected as any).follow_up_stage}` : 'Not due'}</div>
            </div>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              Note
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
                style={{ resize: 'vertical', padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
              />
            </label>
            <button
              style={{ width: '100%', padding: 12, background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              onClick={handleAddNote}
            >
              Save note
            </button>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Notes and application details refresh when selected.</div>
          </div>

          {selected.notes && selected.notes.length > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Notes</div>
              {selected.notes.map(note => (
                <div key={note.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 10 }}>
                  {editingNoteId === note.id ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <textarea
                        value={editingNoteText}
                        onChange={e => setEditingNoteText(e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{ flex: 1, padding: 10, borderRadius: 10, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}
                          onClick={handleSaveEditNote}
                        >
                          Save
                        </button>
                        <button
                          style={{ flex: 1, padding: 10, borderRadius: 10, background: '#111827', color: '#e2e8f0', border: '1px solid #334155', cursor: 'pointer' }}
                          onClick={handleCancelEditNote}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 6, fontSize: 13 }}>{note.text}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <small style={{ color: '#94a3b8' }}>{formatDate(note.created_at)}</small>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#111827', color: '#e2e8f0', cursor: 'pointer' }}
                            onClick={() => handleStartEditNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#111827', color: '#e2e8f0', cursor: 'pointer' }}
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {selected.status_history && selected.status_history.length > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Status History</div>
              {selected.status_history.slice().reverse().map(history => (
                <div key={history.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: '#e2e8f0' }}>{history.old_status || 'none'} → {history.new_status}</span>
                    <small style={{ color: '#94a3b8' }}>{formatDate(history.changed_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
