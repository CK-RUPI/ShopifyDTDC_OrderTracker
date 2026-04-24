(() => {
  if (window.__urbanNaariAutoSendBooted) return;
  window.__urbanNaariAutoSendBooted = true;

  const params = new URLSearchParams(location.search);
  const isSendLink =
    location.pathname === "/send" && params.has("text") && params.has("phone");
  if (!isSendLink) return;

  // Caller can opt out of auto-send by setting autosend=0 in the URL.
  // Used by the abandoned-cart flow, where the operator pastes a photo first
  // and manually sends both the photo and the prefilled text.
  if (params.get("autosend") === "0") return;

  const SELECTORS = [
    'button[aria-label="Send"]',
    'button[data-tab="11"]',
    'span[data-icon="send"]',
    'span[data-icon="wds-ic-send-filled"]',
  ];

  const findSendButton = () => {
    for (const sel of SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      if (el.tagName === "BUTTON") return el;
      const btn = el.closest("button");
      if (btn) return btn;
    }
    return null;
  };

  const MAX_WAIT_MS = 20000;
  const POLL_MS = 500;
  const started = Date.now();

  const tick = () => {
    if (window.__urbanNaariAutoSent) return;
    if (Date.now() - started > MAX_WAIT_MS) return;

    const btn = findSendButton();
    if (!btn) {
      setTimeout(tick, POLL_MS);
      return;
    }

    window.__urbanNaariAutoSent = true;
    try {
      btn.click();
    } catch (e) {
      console.warn("[UrbanNaari auto-send] click failed", e);
      return;
    }

    setTimeout(() => {
      try {
        window.close();
      } catch (_) {}
    }, 1500);
  };

  setTimeout(tick, 1500);
})();
