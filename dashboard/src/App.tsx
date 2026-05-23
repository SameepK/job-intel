import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fetchApplications,
  fetchApplication,
  updateApplicationStatus,
  createNote,
  updateNote,
  deleteNote,
  exportData
} from './api';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#f87171', fontFamily: 'monospace' }}>
          <strong>Something went wrong:</strong> {this.state.error}
          <br />
          <button style={{ marginTop: 16 }} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  applied:      { label: 'Applied',       color: '#3b82f6', icon: '📤' },
  phone_screen: { label: 'Phone Screen',  color: '#f59e0b', icon: '📞' },
  interview:    { label: 'Interview',     color: '#8b5cf6', icon: '🎯' },
  accepted:     { label: 'Accepted',      color: '#059669', icon: '✅' },
  rejected:     { label: 'Rejected',      color: '#ef4444', icon: '❌' },
  ghosted:      { label: 'Ghosted',       color: '#6b7280', icon: '👻' },
  offer:        { label: 'Offer',         color: '#10b981', icon: '🎉' }
};

const VISA_CONFIG: Record<string, { color: string; bg: string }> = {
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

function toArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

const EMPTY_FILTERS = {
  status: '',
  company: '',
  date_from: '',
  date_to: '',
  visa_risk: '',
  fit_score_min: '',
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStageSummary(apps: any[]) {
  return apps.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'none') {
    return <span className="badge" style={{ color: '#6b7280', background: 'rgba(107,114,128,0.1)' }}>none</span>;
  }
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6b7280' };
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.color + '1a', border: `1px solid ${cfg.color}33` }}>
      {cfg.label}
    </span>
  );
}

function VisaBadge({ risk }: { risk?: string }) {
  if (!risk) return <span className="muted">—</span>;
  const cfg = VISA_CONFIG[risk] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      {risk}
    </span>
  );
}

function FitBar({ score }: { score?: number }) {
  if (score == null) return <span className="muted">—</span>;
  const pct = Math.max(0, Math.min(10, score));
  const color = pct >= 7 ? '#10b981' : pct >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="fit-bar-wrap">
      <div className="fit-bar-track">
        <div className="fit-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="fit-label" style={{ color }}>{pct}</span>
    </div>
  );
}

export default function App() {
  const [applications, setApplications] = useState<any[]>([]);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'history'>('details');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragAppRef = useRef<{ id: string; fromStatus: string } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadStats = async () => {
    try {
      const data = await fetchApplications(EMPTY_FILTERS);
      setAllApplications(data);
    } catch { /* stats are best-effort */ }
  };

  const loadApplications = async (filterOverrides?: typeof filters) => {
    const activeFilters = filterOverrides ?? filters;
    setLoading(true);
    setError(null);
    try {
      const [data] = await Promise.all([fetchApplications(activeFilters), loadStats()]);
      setApplications(data);
      setSelected((prev: any) => prev ? (data.find((item: any) => item.id === prev.id) ?? null) : null);
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

  useEffect(() => { loadApplications(); }, []);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    loadApplications(EMPTY_FILTERS);
  };

  const handleStatClick = (status: string) => {
    const newFilters = { ...EMPTY_FILTERS, status };
    setFilters(newFilters);
    loadApplications(newFilters);
  };

  const handleSelect = async (app: any) => {
    setSelected(app);
    setActiveTab('details');
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

  const handleDragStart = (app: any) => {
    dragAppRef.current = { id: app.id, fromStatus: app.status };
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const drag = dragAppRef.current;
    dragAppRef.current = null;
    if (!drag || drag.fromStatus === toStatus) return;
    setLoading(true);
    setError(null);
    try {
      await updateApplicationStatus(drag.id, toStatus);
      await loadApplications();
      if (selected?.id === drag.id) await loadApplicationDetails(drag.id);
    } catch (err: any) {
      setError(err.message || 'Unable to move card');
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

  const stageSummary = useMemo(() => getStageSummary(allApplications), [allApplications]);

  const kanbanGroups = useMemo(() =>
    STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = applications.filter(app => app.status === status);
      return acc;
    }, {} as Record<string, any[]>),
    [applications]
  );

  const totalApps = allApplications.length;

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1>Job Intel</h1>
            <p>{totalApps} application{totalApps !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="secondary" onClick={handleExport}>Export JSON</button>
        </div>
      </header>

      {/* ── Stats Cards ── */}
      <section className="stats-grid">
        {STATUS_OPTIONS.map(status => {
          const cfg = STATUS_CONFIG[status];
          const count = stageSummary[status] || 0;
          const barPct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
          return (
            <div
              key={status}
              className="stat-card"
              style={{ '--accent-color': cfg.color } as React.CSSProperties}
              onClick={() => handleStatClick(status)}
              title={`Filter by ${cfg.label}`}
            >
              <span className="stat-icon">{cfg.icon}</span>
              <div className="stat-count">{count}</div>
              <div className="stat-label">{cfg.label}</div>
              <div className="stat-bar" style={{ width: `${barPct}%`, background: cfg.color }} />
            </div>
          );
        })}
      </section>

      {/* ── Controls ── */}
      <div className="controls-bar">
        <div className="view-toggle">
          <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
            ≡ List
          </button>
          <button className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>
            ⊞ Kanban
          </button>
        </div>
        <button
          className={`secondary ${filtersOpen ? 'active' : ''}`}
          onClick={() => setFiltersOpen(o => !o)}
        >
          ⚙ Filters {filtersOpen ? '▲' : '▼'}
        </button>
        <button className="secondary" onClick={clearFilters}>Clear</button>
      </div>

      {/* ── Filter Panel ── */}
      {filtersOpen && (
        <section className="filters">
          <div className="filter-row">
            <label>Status</label>
            <input
              type="text"
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              placeholder="applied,interview"
            />
          </div>
          <div className="filter-row">
            <label>Company</label>
            <input
              type="text"
              value={filters.company}
              onChange={e => handleFilterChange('company', e.target.value)}
            />
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
            <select value={filters.visa_risk} onChange={e => handleFilterChange('visa_risk', e.target.value)}>
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="filter-row">
            <label>Min fit score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.fit_score_min}
              onChange={e => handleFilterChange('fit_score_min', e.target.value)}
            />
          </div>
          <button onClick={() => loadApplications(filters)} className="primary">Apply</button>
        </section>
      )}

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' ? (
        <div className="kanban-board">
          {STATUS_OPTIONS.map(status => {
            const cfg = STATUS_CONFIG[status];
            const cards = kanbanGroups[status] || [];
            return (
              <div
                key={status}
                className={`kanban-col ${dragOverCol === status ? 'drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}
              >
                <div className="kanban-col-header" style={{ borderTopColor: cfg.color }}>
                  <span>{cfg.icon} {cfg.label}</span>
                  <span
                    className="kanban-count"
                    style={{ background: cfg.color + '2a', color: cfg.color }}
                  >
                    {cards.length}
                  </span>
                </div>
                <div className="kanban-cards">
                  {cards.length === 0
                    ? <div className="kanban-empty">Drop here</div>
                    : cards.map(app => (
                      <button
                        key={app.id}
                        draggable
                        className={`kanban-card ${selected?.id === app.id ? 'selected' : ''}`}
                        style={{ '--col-color': cfg.color } as React.CSSProperties}
                        onDragStart={() => handleDragStart(app)}
                        onClick={() => handleSelect(app)}
                      >
                        <div className="kanban-title">{app.title}</div>
                        <div className="kanban-company">{app.company}</div>
                        <div className="kanban-meta">
                          <VisaBadge risk={app.visa_risk} />
                          {app.fit_score != null && (
                            <span className="fit-chip">{app.fit_score}</span>
                          )}
                        </div>
                      </button>
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List View ── */
        <main className="layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Applications</h2>
              <span className="panel-count">{totalApps}</span>
            </div>
            <div className="table-header">
              <span>Title</span>
              <span>Company</span>
              <span>Status</span>
              <span>Visa</span>
              <span>Fit</span>
            </div>
            <div className="table">
              {!loading && applications.length === 0 && (
                <div className="empty-state">No applications found. Track your first job!</div>
              )}
              {applications.map(app => (
                <button
                  key={app.id}
                  className={`table-row ${selected?.id === app.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(app)}
                >
                  <div className="row-title">{app.title}</div>
                  <div className="row-company">{app.company}</div>
                  <div><StatusBadge status={app.status} /></div>
                  <div><VisaBadge risk={app.visa_risk} /></div>
                  <div><FitBar score={app.fit_score} /></div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Detail Panel ── */}
          <ErrorBoundary>
          <div className={`panel detail-panel ${selected ? 'has-content' : ''}`}>
            {selected ? (
              <>
                <div className="detail-header">
                  <div>
                    <div className="detail-title">{selected.title}</div>
                    <div className="detail-company">{selected.company}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setSelected(null)} title="Close">✕</button>
                </div>

                <div className="detail-tabs">
                  {(['details', 'notes', 'history'] as const).map(tab => {
                    const count =
                      tab === 'notes' ? selected.notes?.length :
                      tab === 'history' ? selected.status_history?.length : null;
                    return (
                      <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {count ? ` (${count})` : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="detail-content">
                    <div className="detail-field">
                      <label>Status</label>
                      <select value={selected.status} onChange={e => handleStatusChange(e.target.value)}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="detail-row-grid">
                      <div className="detail-stat">
                        <label>Fit Score</label>
                        <FitBar score={selected.fit_score} />
                      </div>
                      <div className="detail-stat">
                        <label>Visa Risk</label>
                        <VisaBadge risk={selected.visa_risk} />
                      </div>
                      <div className="detail-stat">
                        <label>Applied</label>
                        <span>{formatDate(selected.applied_date)}</span>
                      </div>
                      <div className="detail-stat">
                        <label>Follow-up</label>
                        <span>{selected.follow_up_stage ? `After ${selected.follow_up_stage}` : '—'}</span>
                      </div>
                    </div>

                    {selected.salary && (
                      <div className="detail-field">
                        <label>Salary</label>
                        <span>{selected.salary}</span>
                      </div>
                    )}
                    {selected.location && (
                      <div className="detail-field">
                        <label>Location</label>
                        <span>{selected.location}</span>
                      </div>
                    )}
                    {selected.job_url && (
                      <div className="detail-field">
                        <label>Job Posting</label>
                        <a className="job-link" href={selected.job_url} target="_blank" rel="noopener noreferrer">
                          Open posting ↗
                        </a>
                      </div>
                    )}
                    {selected.recommendation && (
                      <div className="detail-field">
                        <label>Recommendation</label>
                        <span className={`recommendation recommendation-${selected.recommendation}`}>
                          {selected.recommendation}
                        </span>
                      </div>
                    )}
                    {toArray(selected.skill_gaps).length > 0 && (
                      <div className="detail-field">
                        <label>Skill Gaps</label>
                        <div className="tag-list">
                          {toArray(selected.skill_gaps).map((gap, i) => (
                            <span key={i} className="tag">{String(gap)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.visa_risk === 'high' && (
                      <div className="visa-warning">
                        ⚠️ High visa risk — OPT sponsorship unlikely. Recommendation is forced to skip.
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                  <div className="detail-content notes-section">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                    />
                    <button onClick={handleAddNote} className="primary" disabled={!noteText.trim()}>
                      Add note
                    </button>
                    <div className="note-list">
                      {(selected.notes || []).length === 0 && (
                        <div className="empty-state">No notes yet.</div>
                      )}
                      {(selected.notes || []).map((note: any) => (
                        <div key={note.id} className="note-card">
                          {editingNoteId === note.id ? (
                            <>
                              <textarea
                                value={editingNoteText}
                                onChange={e => setEditingNoteText(e.target.value)}
                                rows={3}
                              />
                              <div className="note-actions" style={{ marginTop: 8 }}>
                                <button className="primary" onClick={() => handleSaveEditNote(note.id)}>Save</button>
                                <button className="secondary" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="note-text">{note.text}</p>
                              <div className="note-footer">
                                <small className="note-date">{formatDate(note.created_at)}</small>
                                <div className="note-actions">
                                  <button
                                    className="ghost-btn"
                                    onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="ghost-btn danger"
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
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="detail-content">
                    <div className="history-list">
                      {(selected.status_history || []).length === 0 && (
                        <div className="empty-state">No history yet.</div>
                      )}
                      {(selected.status_history || []).map((h: any, i: number) => (
                        <div key={h.id ?? i} className="history-item">
                          <div className="history-transition">
                            <StatusBadge status={h.old_status} />
                            <span className="history-arrow">→</span>
                            <StatusBadge status={h.new_status} />
                          </div>
                          <small className="history-date">{formatDate(h.changed_at)}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-detail">
                <div className="empty-detail-icon">📋</div>
                <div>Select an application to view details</div>
              </div>
            )}
          </div>
          </ErrorBoundary>
        </main>
      )}

      {loading && (
        <div className="loading-banner">
          <span className="spinner" />
          Loading…
        </div>
      )}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
