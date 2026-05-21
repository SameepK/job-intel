# Build & Reload Instructions

## Extension Rebuild

After pulling latest changes, rebuild the Chrome extension:

```bash
cd extension
npm install
npm run build
```

This runs webpack and outputs to `extension/dist/`.

### What webpack produces

| Entry | Source | Output | Used by |
|-------|--------|--------|---------|
| `popup` | `src/popup.ts` | `dist/popup.js` | `popup.html` — Track This Job view |
| `apps` | `src/popup.tsx` | `dist/apps.js` | `apps.html` — My Applications React view |
| `content` | `src/content.ts` | `dist/content.js` | Content script |
| `background` | `src/background.ts` | `dist/background.js` | Service worker |

## Reload Extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/dist/` folder
   - (or click the refresh icon if already loaded)

## Dashboard Rebuild

```bash
cd dashboard
npm install
npm run build
```

Outputs to `dashboard/dist/`. FastAPI serves it at `/dashboard/`.

## Start Backend

```bash
cd ..
pip install -r requirements.txt
uvicorn src.main:app --reload
```

Backend runs at `http://localhost:8000`.

## Architecture

```
Extension popup (popup.html + popup.js)
  └── Track This Job button → POST /track → backend pipeline → AI analysis
  └── View My Applications → opens apps.html (chrome-extension://...)

Apps panel (apps.html + apps.js)
  └── React component → GET /applications → list all tracked jobs
  └── Status updates → PATCH /applications/:id/status
  └── Notes → POST/PATCH/DELETE /applications/:id/notes
  └── View dashboard → opens http://localhost:8000/dashboard/

Web Dashboard (dashboard/dist served at /dashboard/)
  └── Full React dashboard with filters, export, history
```
