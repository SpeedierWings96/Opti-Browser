# AI Assistant Browser Extension (MV3)

This extension adds AI-powered features to your browser:

- Context menu actions on selected text: Summarize, Explain, Rewrite, Translate
- Summarize entire page content
- Popup chat window
- Options page to configure provider, API key, model, temperature

By default it targets an OpenAI-compatible Chat Completions API.

## Install (Developer Mode)

1. Build step is not required. Load as an unpacked extension:
   - Chromium-based browsers: open `chrome://extensions`, enable Developer Mode, click "Load unpacked" and select this folder.
2. Open the extension Options to set your API base URL and key.

## Security Notes

- Your API key is stored with `chrome.storage.local`. It is not transmitted anywhere except to the configured provider when you invoke AI actions.
- Review the source code before use. Configure self-hosted or trusted providers if desired.

## Files

- `manifest.json`: MV3 manifest
- `background.js`: Service worker; context menus, messaging, provider calls
- `content.js`: Page integration for text extraction and overlay display
- `popup.html` / `popup.js`: Chat UI
- `options.html` / `options.js`: Provider configuration UI

## Provider Compatibility

Any provider implementing the OpenAI Chat Completions API should work by setting the base URL and model name (e.g., OpenAI, Groq, Mistral-compatible, local OpenAI-compatible servers).