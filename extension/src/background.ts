// Background service worker
// Handles communication between popup and content script

const API_BASE = "http://localhost:8000";

interface ExtractRequest {
  page_text: string;
  page_url: string;
  page_title: string;
}

interface TrackResult {
  pipeline_status: string;
  error?: string;
  application?: {
    id: string;
    title: string;
    company: string;
    sponsorship_signal: string;
    status: string;
  };
  analysis?: {
    fit_score: number;
    recommendation: string;
    visa_risk: string;
    reasoning: string;
    skill_gaps: string[];
    strengths: string[];
  };
  review?: {
    approved: boolean;
    final_recommendation: string;
    blocks: string[];
    warnings: string[];
  };
  tracker?: {
    follow_up_dates: {
      first: string;
      second: string;
      ghost_date: string;
    };
  };
}

// Track a job by sending page data to AgentX backend
async function trackJob(data: ExtractRequest): Promise<TrackResult> {
  const response = await fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Get all applications from backend
async function getApplications(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/applications`);
  if (!response.ok) throw new Error("Failed to fetch applications");
  return response.json();
}

// Update application status
async function updateStatus(applicationId: string, newStatus: string): Promise<void> {
  await fetch(`${API_BASE}/applications/${applicationId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      application_id: applicationId,
      new_status: newStatus
    })
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "TRACK_JOB") {
    trackJob(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_APPLICATIONS") {
    getApplications()
      .then(apps => sendResponse({ success: true, data: apps }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "UPDATE_STATUS") {
    updateStatus(message.applicationId, message.newStatus)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "CHECK_API") {
    fetch(`${API_BASE}/`)
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// On install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Job Intel] AgentX extension installed");
});