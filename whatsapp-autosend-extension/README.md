# UrbanNaari WhatsApp Auto-Send (Chrome Extension)

A tiny Chrome extension that auto-clicks the **Send** button whenever a `web.whatsapp.com/send?phone=...&text=...` tab is opened by the Order Tracker, so fulfill-and-track becomes fully hands-free.

## Install (one-time)

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Pick this folder: `whatsapp-autosend-extension/`
5. You're done. The extension now lives in your profile and starts automatically with Chrome.

## Prerequisites

- You must be logged into WhatsApp Web in the same Chrome profile where the extension is loaded.
- QR-scan once via `https://web.whatsapp.com/` if you haven't already.

## How it behaves

- Runs **only** on URLs matching `https://web.whatsapp.com/send?phone=...&text=...`. On a normal WhatsApp Web session (`web.whatsapp.com/`), it does nothing.
- Waits up to ~20 seconds for WhatsApp Web to render the Send button (the chat loads asynchronously), then clicks it.
- After ~1.5 seconds (to let the send request flush), it closes the tab.
- A per-tab `__urbanNaariAutoSent` guard prevents double-firing.

## Troubleshooting

- **Nothing happens** → check that you're logged into WhatsApp Web in this profile, and that the tab URL contains both `phone` and `text` params.
- **"Send" button not clicked** → WhatsApp Web may have changed its DOM. Update the selector list at the top of `content.js` (look for `button[aria-label="Send"]`, or inspect the button in DevTools).
- **Developer-mode nag banner** on Chrome startup → dismiss it, or publish this extension privately to the Chrome Web Store (one-time $5 developer fee) to silence it permanently.

## Files

- `manifest.json` — Manifest V3, content script targeting `web.whatsapp.com`
- `content.js` — the auto-click logic
