'use strict';

/**
 * Extracts readable text from the page.
 * Returns at most maxChars characters after whitespace normalization.
 */
function extractPageText(maxChars) {
  try {
    const raw = (document.body && document.body.innerText) || document.documentElement.innerText || '';
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (typeof maxChars === 'number' && maxChars > 0) {
      return normalized.slice(0, maxChars);
    }
    return normalized;
  } catch (e) {
    return '';
  }
}

/**
 * Ensure there is only a single overlay at a time.
 */
function removeExistingOverlay() {
  const existing = document.getElementById('ai-assistant-overlay');
  if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
}

/**
 * Create and show an overlay with content.
 */
function showOverlay(title, content) {
  removeExistingOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'ai-assistant-overlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '16px';
  overlay.style.bottom = '16px';
  overlay.style.maxWidth = '480px';
  overlay.style.maxHeight = '60vh';
  overlay.style.overflow = 'auto';
  overlay.style.background = 'white';
  overlay.style.color = '#111';
  overlay.style.border = '1px solid rgba(0,0,0,0.15)';
  overlay.style.borderRadius = '12px';
  overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
  overlay.style.padding = '12px 12px 8px 12px';
  overlay.style.zIndex = '2147483647';
  overlay.style.font = '14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '8px';

  const titleEl = document.createElement('div');
  titleEl.textContent = title || 'AI Assistant';
  titleEl.style.fontWeight = '600';
  titleEl.style.fontSize = '14px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.lineHeight = '16px';
  closeBtn.style.padding = '2px 6px';
  closeBtn.onclick = () => removeExistingOverlay();

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const contentEl = document.createElement('div');
  contentEl.style.whiteSpace = 'pre-wrap';
  contentEl.style.wordBreak = 'break-word';
  contentEl.textContent = content || '';

  overlay.appendChild(header);
  overlay.appendChild(contentEl);

  document.documentElement.appendChild(overlay);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message && message.type === 'extractPageText') {
      const text = extractPageText(message.maxChars || 8000);
      sendResponse({ text });
      return true;
    }
    if (message && message.type === 'displayOverlay') {
      showOverlay(message.title, message.content);
      sendResponse({ ok: true });
      return true;
    }
  } catch (e) {
    sendResponse({ error: String(e) });
  }
  return true;
});

