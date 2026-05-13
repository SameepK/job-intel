// Content script — runs on job board pages
// Extracts page text and sends to background service worker

interface JobPageData {
  url: string;
  title: string;
  text: string;
}

function extractPageText(): JobPageData {
  // Remove noise elements
  const noiseSelectors = [
    "script", "style", "nav", "footer",
    "header", "aside", "iframe", "noscript"
  ];

  // Clone body to avoid modifying the page
  const clone = document.body.cloneNode(true) as HTMLElement;

  noiseSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Get clean text
  const rawText = clone.innerText || clone.textContent || "";
  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const cleanText = lines.join("\n").slice(0, 8000);

  return {
    url: window.location.href,
    title: document.title,
    text: cleanText
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    const data = extractPageText();
    sendResponse(data);
  }
  return true; // Keep channel open for async response
});

// Auto-signal that content script is ready
chrome.runtime.sendMessage({ type: "CONTENT_READY", url: window.location.href });