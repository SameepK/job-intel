function $(id: string) {
  return document.getElementById(id) as HTMLElement;
}

function showLoading(show: boolean) {
  $("loading").classList.toggle("visible", show);
  ($("track-btn") as HTMLButtonElement).disabled = show;
}

function showError(message: string) {
  const box = $("error-box");
  box.textContent = message;
  box.classList.add("visible");
}

function hideError() {
  $("error-box").classList.remove("visible");
}

function showResult(data: any) {
  const app = data.application;
  const analysis = data.analysis;
  const review = data.review;

  if (!app) return;

  $("result-title").textContent = app.title || "—";
  $("result-company").textContent = app.company || "—";

  if (analysis) {
    const score = analysis.fit_score || 0;
    $("result-score").textContent = `${score}/10`;
    ($("score-fill") as HTMLElement).style.width = `${score * 10}%`;

    const visaEl = $("result-visa");
    visaEl.textContent = analysis.visa_risk || "—";
    visaEl.style.color =
      analysis.visa_risk === "high" ? "#f87171" :
      analysis.visa_risk === "low" ? "#34d399" : "#fbbf24";
  }

  const sponsorEl = $("result-sponsorship");
  const signal = app.sponsorship_signal || "unknown";
  sponsorEl.textContent = signal;
  sponsorEl.className = `pill ${signal}`;

  if (review) {
    const recEl = $("result-recommendation");
    const rec = review.final_recommendation || "cautious";
    recEl.textContent = rec;
    recEl.className = `pill ${rec}`;
  }

  $("status-box").classList.add("visible");
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractAndTrack() {
  hideError();
  showLoading(true);
  $("status-box").classList.remove("visible");

  try {
    const tab = await getCurrentTab();

    if (!tab.id || !tab.url) {
      showError("Cannot access this page.");
      showLoading(false);
      return;
    }

    try {
      const url = new URL(tab.url);
      $("page-host").textContent = url.hostname;
    } catch (_) {}

    const pageData: any = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_PAGE"
    });

    if (!pageData || !pageData.text) {
      showError("Could not extract page content. Make sure you are on a job posting page.");
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
  $("track-btn").addEventListener("click", extractAndTrack);

  $("view-all").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:8000/applications" });
  });

  try {
    const tab = await getCurrentTab();
    if (tab.url) {
      const url = new URL(tab.url);
      $("page-host").textContent = url.hostname;
    }
  } catch (_) {}
});