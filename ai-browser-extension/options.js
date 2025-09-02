'use strict';

const DEFAULTS = {
  providerType: 'openai',
  apiBaseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2
};

const els = {
  providerType: document.getElementById('providerType'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  temperature: document.getElementById('temperature'),
  save: document.getElementById('save'),
  test: document.getElementById('test'),
  status: document.getElementById('status')
};

function showStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? '#a00' : '#0a0';
}

async function loadSettings() {
  const { providerConfig } = await chrome.storage.local.get({ providerConfig: DEFAULTS });
  const cfg = { ...DEFAULTS, ...(providerConfig || {}) };
  els.providerType.value = cfg.providerType;
  els.apiBaseUrl.value = cfg.apiBaseUrl;
  els.apiKey.value = cfg.apiKey;
  els.model.value = cfg.model;
  els.temperature.value = String(cfg.temperature);
}

async function saveSettings() {
  const cfg = {
    providerType: els.providerType.value,
    apiBaseUrl: els.apiBaseUrl.value.trim(),
    apiKey: els.apiKey.value.trim(),
    model: els.model.value.trim(),
    temperature: parseFloat(els.temperature.value) || 0.2
  };
  await chrome.storage.local.set({ providerConfig: cfg });
  showStatus('Saved');
}

async function testProvider() {
  showStatus('Testing...', false);
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'testProvider' });
    if (!resp?.ok) throw new Error(resp?.error || 'Unknown error');
    showStatus('Test OK: ' + String(resp.content).slice(0, 64));
  } catch (e) {
    showStatus('Test failed: ' + (e?.message || String(e)), true);
  }
}

els.save.addEventListener('click', saveSettings);
els.test.addEventListener('click', testProvider);

loadSettings();

