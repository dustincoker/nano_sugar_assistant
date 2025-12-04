# Nano Sugar Assistant  
AI-powered SugarCRM helper using **Gemini Nano** + **DOM tools** — runs entirely in the browser console.

Use a Chrome-hosted on-device LLM to:

* Extract all fields from the current SugarCRM record.
* Ask questions about the record in natural language.
* Highlight or flash any field label via LLM tool-calling.
* Display a floating draggable assistant UI inside SugarCRM.

> ⚠️ Runs fully client-side. No API keys. No server. No data leaves the browser.

---

## Quickstart

1. Open any **record view** in SugarCRM (e.g., Account, Contact, Lead).
2. Open **DevTools → Console** (`Cmd+Option+I` on Mac).
3. Paste the contents of:

```
src/nano_sugar_assistant.js
```

4. A popup titled **“SugarCRM Nano Agent”** appears.
5. Ask questions or toggle **Agent Mode** to let the LLM control UI actions.

### Example (Chat Mode)

```
What is the account type and status?
```

### Example (Agent Mode)

```
Highlight the billing address field in yellow.
Flash the status field.
Scroll to the email address field.
```

---

## Project Structure

```
nano_sugar_assistant/
├─ src/
│  └─ nano_sugar_assistant.js   # main script (paste into console)
├─ demo/
│  └─ nano_sugar_demo.mp4       # optional demo video
├─ screenshots/                 # optional images for README
├─ LICENSE
└─ README.md
```

---

## Requirements

* Google Chrome with **Gemini Nano** enabled  
  (`chrome://flags` → “Enable optimization guide on device model”)
* SugarCRM instance (any recent version with Sidecar)
* No build step, no dependencies — 100% browser-side JavaScript

---

## Usage

### **Modes**

**Chat Mode**  
The assistant answers questions about the current record using the text extracted from the SugarCRM model.

**Agent Mode**  
The assistant attempts to interpret your request and call one of its tools:

* `highlightField`
* `unhighlightField`
* `flashField`
* `startFlashField`
* `stopFlashField`

All tools operate on **field labels only**, ensuring safe UI interaction.

---

## Behind the Scenes (What Happens)

1. **Extract Record Data**  
   Reads `App.controller.context.get("model")` and all `model.fields`, building a clean text summary (“story of record”).

2. **Popup UI**  
   Creates a draggable, resizable chat panel injected into the DOM.

3. **Gemini Nano Session**  
   Uses Chrome’s `window.ai` API:
   ```js
   const session = await ai.languageModel.create();
   ```

4. **Two Execution Paths**  
   *Chat Mode* → LLM answers using the record summary.  
   *Agent Mode* → LLM returns a JSON plan like:
   ```json
   { "action": "highlightField", "params": { "target": "status" } }
   ```

5. **DOM Tools**  
   The script locates the appropriate label element and applies one of:
   * soft highlight  
   * strong highlight  
   * finite flash  
   * continuous flash  

6. **Safety**  
   The LLM can only call predefined tools; it cannot modify arbitrary DOM elements.

---

## Demo Video

```
![Demo of Nano Sugar Assistant](./demo/nano_sugar_demo.gif)
```

---

## Troubleshooting

* **“session is undefined”**  
  Ensure Gemini Nano is enabled in Chrome flags.

* **Popup doesn't appear**  
  Verify no CSP blocks inline scripts (most SugarCRM instances allow console scripts).

* **Agent Mode does nothing**  
  Some UI elements may have unusual label selectors. Open an issue with the field name.

---

## Roadmap (Optional)

* Add support for subpanel scanning  
* Add conversation memory  
* Add UI commands (collapse panels, scroll to subpanels)  
* Convert into a Chrome extension  
* Bookmarklet version

---

## License

MIT License — see `LICENSE`.

---

## Notes

This pattern (LLM → tool → DOM → CRM data extraction) can generalize to other CRMs or internal admin tools.  
This repo showcases how lightweight browser-side AI agents can meaningfully enhance enterprise UX without modifying backend code.
