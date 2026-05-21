const API_BASE = 'http://localhost:8000';

export async function fetchApplications(params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${API_BASE}/applications`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Unable to fetch applications');
  return response.json();
}

export async function fetchApplication(applicationId: string) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}`);
  if (!response.ok) throw new Error('Unable to fetch application details');
  return response.json();
}

export async function updateApplicationStatus(applicationId: string, newStatus: string) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_status: newStatus })
  });
  if (!response.ok) throw new Error('Unable to update status');
  return response.json();
}

export async function createNote(applicationId: string, text: string) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error('Unable to create note');
  return response.json();
}

export async function updateNote(applicationId: string, noteId: string, text: string) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error('Unable to update note');
  return response.json();
}

export async function deleteNote(applicationId: string, noteId: string) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}/notes/${noteId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Unable to delete note');
  return response.json();
}

export async function exportData() {
  const response = await fetch(`${API_BASE}/export`);
  if (!response.ok) throw new Error('Unable to export data');
  return response.json();
}
