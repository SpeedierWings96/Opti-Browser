'use strict';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const openOptionsEl = document.getElementById('openOptions');

/**
 * Chat state local to this popup window.
 */
const conversation = [
  { role: 'system', content: 'You are a helpful, concise assistant inside a browser extension popup.' }
];

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'user' : 'assistant'}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendPrompt() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });
  sendBtn.disabled = true;
  sendBtn.textContent = '...';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'chat', messages: conversation });
    if (!response || !response.ok) throw new Error(response?.error || 'Unknown error');
    appendMessage('assistant', response.content);
    conversation.push({ role: 'assistant', content: response.content });
  } catch (e) {
    appendMessage('assistant', `Error: ${e?.message || String(e)}`);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    inputEl.focus();
  }
}

sendBtn.addEventListener('click', sendPrompt);
inputEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    sendPrompt();
  }
});

openOptionsEl.addEventListener('click', async (ev) => {
  ev.preventDefault();
  await chrome.runtime.openOptionsPage();
});

