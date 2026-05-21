// Safe element accessor - returns null if not found instead of crashing
function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setText(id: string, value: string) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setClass(id: string, className: string) {
  const el = $(id);
  if (el) el.className = className;
}

function setStyle(id: string, prop: string, value: string) {
  const el = $(id) as HTMLElement | null;
  if (el) el.style.setProperty(prop, value);
}

function showLoading(show: boolean) {
  $("loading")?.classList.toggle("visible", show);
  const btn = $("track-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = show;
}

function showError(message: string) {
  const box = $("error-box");
  if (!box) return;
  box.textContent = message;
  box.classList.add("visible");
}

function hideError() {
  $("error-box")?.classList.remove("visible");
}

function showResult(data: any) {
  const app = data.application;
  const analysis = data.analysis;
  const review = data.review;

  if (!app) return;

  setText("result-title", app.title || "\u2014");
  setText("result-company", app.company || "\u2014");

  if (analysis) {
    const score = analysis.fit_score || 0;
    setText("result-score", `${score}/10`);
    setStyle("score-fill", "width", `${score * 10}%`);

    const visaEl = $("result-visa");
    if (visaEl) {
      visaEl.textContent = analysis.visa_risk || "\u2014";
      visaEl.style.color =
        analysis.visa_risk === "high" ? "#f87171" :
        analysis.visa_risk === "low"  ? "#34d399" : "#fbbf24";
    }
  }

  const sponsorEl = $("result-sponsorship");
  if (sponsorEl) {
    const signal = app.sponsorship_signal || "unknown";
    sponsorEl.textContent = signal;
    sponsorEl.className = `pill ${signal}`;
  }

  if (review) {
    const recEl = $("result-recommendation");
    if (recEl) {
      const rec = review.final_recommendation || "cautious";
      recEl.textContent = rec;
      recEl.className = `pill ${rec}`;
    }
  }

  $("status-box")?.classList.add("visible");
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Extract page data from the active tab.
 * First tries sendMessage to the already-injected content script.
 * If the content script isn't loaded ("Receiving end does not exist"),
 * falls back to chrome.scripting.executeScript to inject on-demand.
 */
async function extractPageData(tabId: number): Promise<any> {
  // Attempt 1: message the content script if already injected
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE" });
    if (result && result.text) return result;
  } catch (_) {
    // Content script not yet injected - fall through to on-demand injection
  }

  // Attempt 2: inject content script on-demand via scripting API
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  // Small delay to let the script initialise
  await new Promise(resolve => setTimeout(resolve, 300));

  // Retry the message
  const result = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE" });
  return result;
}

async function extractAndTrack() {
  hideError();
  showLoading(true);
  $("status-box")?.classList.remove("visible");

  try {
    const tab = await getCurrentTab();
    if (!tab.id || !tab.url) {
      showError("Cannot access this page.");
      showLoading(false);
      return;
    }

    // Block extension pages, new-tab, etc.
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("about:")
    ) {
      showError("Navigate to a job posting page first, then click Track.");
      showLoading(false);
      return;
    }

    try {
      const url = new URL(tab.url);
      const hostEl = $("page-host");
      if (hostEl) hostEl.textContent = url.hostname;
    } catch (_) {}

    let pageData: any;
    try {
      pageData = await extractPageData(tab.id);
    } catch (err: any) {
      showError("Could not read the page. Try refreshing the job posting and clicking Track again.");
      showLoading(false);
      return;
    }

    if (!pageData || !pageData.text) {
      showError("Page content looks empty. Make sure you are on a job posting page.");
      showLoading(false);
      return;
    }

    const response = await fetch("http://localhost:8000/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_text: pageData.text,
        page_url: pageData.url,
        page_title: pageData.title
      })
    });

    const result = await response.json();

    if (result.pipeline_status === "blocked") {
      showError(result.error || "Already tracked or pipeline blocked.");
      showLoading(false);
      return;
    }

    showResult(result);
  } catch (err: any) {
    showError(err.message || "Something went wrong. Is the backend running?");
  } finally {
    showLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("track-btn")?.addEventListener("click", extractAndTrack);

  $("view-all")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("apps.html") });
  });

  try {
    const tab = await getCurrentTab();
    if (tab.url) {
      const url = new URL(tab.url);
      const hostEl = $("page-host");
      if (hostEl) hostEl.textContent = url.hostname;
    }
  } catch (_) {}
});
