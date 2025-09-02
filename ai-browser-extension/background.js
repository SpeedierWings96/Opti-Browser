/*
High-level: Background service worker for AI Assistant extension.
Creates context menus, handles user actions, communicates with content scripts,
and calls AI providers using settings from chrome.storage.local.
*/

'use strict';

// Context menu identifiers
const MENU_IDS = {
  SUMMARIZE_SELECTION: 'ai_summarize_selection',
  EXPLAIN_SELECTION: 'ai_explain_selection',
  REWRITE_SELECTION: 'ai_rewrite_selection',
  TRANSLATE_SELECTION: 'ai_translate_selection',
  SUMMARIZE_PAGE: 'ai_summarize_page'
};

/**
 * Default provider configuration used if user has not configured settings yet.
 */
const DEFAULT_PROVIDER_CONFIG = {
  providerType: 'openai',
  apiBaseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2
};

/**
 * Ensure context menus exist
 */
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_IDS.SUMMARIZE_SELECTION,
        title: 'AI: Summarize selection',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: MENU_IDS.EXPLAIN_SELECTION,
        title: 'AI: Explain selection',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: MENU_IDS.REWRITE_SELECTION,
        title: 'AI: Rewrite selection',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: MENU_IDS.TRANSLATE_SELECTION,
        title: 'AI: Translate selection to English',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: MENU_IDS.SUMMARIZE_PAGE,
        title: 'AI: Summarize this page',
        contexts: ['page']
      });
    });
  } catch (error) {
    console.warn('Failed to initialize context menus', error);
  }
});

/**
 * Helper to read provider config from storage.
 * @returns {Promise<typeof DEFAULT_PROVIDER_CONFIG>}
 */
async function getProviderConfig() {
  const stored = await chrome.storage.local.get({ providerConfig: DEFAULT_PROVIDER_CONFIG });
  const cfg = stored.providerConfig || DEFAULT_PROVIDER_CONFIG;
  // Fill any missing fields with defaults for forward compat
  return { ...DEFAULT_PROVIDER_CONFIG, ...cfg };
}

/**
 * Inject content script into a tab if not already present.
 * This is idempotent: we attempt to run a no-op function to check availability; if it fails, we inject.
 * @param {number} tabId
 */
async function ensureContentScriptInjected(tabId) {
  // Always attempt to inject; content script is idempotent
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

/**
 * Request page text content from content script
 * @param {number} tabId
 * @param {number} maxChars
 * @returns {Promise<string>}
 */
async function requestPageText(tabId, maxChars) {
  await ensureContentScriptInjected(tabId);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Timed out extracting page text')), 15000);
    chrome.tabs.sendMessage(
      tabId,
      { type: 'extractPageText', maxChars },
      (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve((response && response.text) || '');
      }
    );
  });
}

/**
 * Ask content script to display an overlay with the AI result.
 * @param {number} tabId
 * @param {string} title
 * @param {string} content
 */
async function showResultOnPage(tabId, title, content) {
  await ensureContentScriptInjected(tabId);
  chrome.tabs.sendMessage(tabId, { type: 'displayOverlay', title, content });
}

/**
 * Call an OpenAI-compatible Chat Completions endpoint.
 * @param {Array<{role: string, content: string}>} messages
 * @param {{apiBaseUrl: string, apiKey: string, model: string, temperature?: number}} config
 */
async function callChatCompletions(messages, config) {
  const url = `${config.apiBaseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        temperature: typeof config.temperature === 'number' ? config.temperature : 0.2,
        messages
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Provider error ${response.status}: ${text}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return content.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build messages array for a given action and input text.
 * @param {'summarize'|'explain'|'rewrite'|'translate'|'chat'} action
 * @param {string} text
 * @param {Array} conversation Optional conversation for chat action
 */
function buildMessages(action, text, conversation) {
  if (action === 'chat' && Array.isArray(conversation)) {
    return conversation;
  }
  const system = {
    role: 'system',
    content: 'You are a concise and helpful assistant. Respond clearly and avoid unnecessary verbosity.'
  };
  let userContent = '';
  switch (action) {
    case 'summarize':
      userContent = `Summarize the following text in 5-8 bullet points.\n\nTEXT:\n${text}`;
      break;
    case 'explain':
      userContent = `Explain the following text simply. Use short paragraphs and examples if helpful.\n\nTEXT:\n${text}`;
      break;
    case 'rewrite':
      userContent = `Rewrite the following text to be clearer and more concise while preserving meaning.\n\nTEXT:\n${text}`;
      break;
    case 'translate':
      userContent = `Translate the following text to English. Preserve names and code as-is.\n\nTEXT:\n${text}`;
      break;
    default:
      userContent = text;
  }
  return [system, { role: 'user', content: userContent }];
}

/**
 * Handle context menu interactions and route to provider
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab || typeof tab.id !== 'number') return;
    const cfg = await getProviderConfig();
    if (!cfg.apiBaseUrl) throw new Error('API base URL is not configured. Set it in the options.');

    let action = null;
    let sourceText = info.selectionText || '';

    if (info.menuItemId === MENU_IDS.SUMMARIZE_SELECTION) action = 'summarize';
    else if (info.menuItemId === MENU_IDS.EXPLAIN_SELECTION) action = 'explain';
    else if (info.menuItemId === MENU_IDS.REWRITE_SELECTION) action = 'rewrite';
    else if (info.menuItemId === MENU_IDS.TRANSLATE_SELECTION) action = 'translate';
    else if (info.menuItemId === MENU_IDS.SUMMARIZE_PAGE) action = 'summarize';

    if (!action) return;

    if (info.menuItemId === MENU_IDS.SUMMARIZE_PAGE) {
      sourceText = await requestPageText(tab.id, 8000);
    }
    if (!sourceText || sourceText.trim().length === 0) {
      await showResultOnPage(tab.id, 'AI Assistant', 'No text to process.');
      return;
    }

    const messages = buildMessages(action, sourceText);
    const output = await callChatCompletions(messages, cfg);
    const title = `AI ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    await showResultOnPage(tab.id, title, output);
  } catch (error) {
    const message = error?.message || String(error);
    if (tab && typeof tab.id === 'number') {
      await showResultOnPage(tab.id, 'AI Assistant Error', message);
    }
    console.error('AI context menu handler error', error);
  }
});

/**
 * Message router for popup and options
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'chat') {
      const cfg = await getProviderConfig();
      const content = await callChatCompletions(message.messages, cfg);
      sendResponse({ ok: true, content });
      return;
    }
    if (message?.type === 'testProvider') {
      const cfg = await getProviderConfig();
      const content = await callChatCompletions(
        [
          { role: 'system', content: 'You are a concise assistant.' },
          { role: 'user', content: 'Reply with a single word: ok' }
        ],
        cfg
      );
      sendResponse({ ok: true, content });
      return;
    }
    sendResponse({ ok: false, error: 'Unknown message type' });
  })().catch((err) => {
    sendResponse({ ok: false, error: err?.message || String(err) });
  });
  return true; // Keep the message channel open for async response
});

