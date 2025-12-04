(async () => {
  /************ 1) Helpers & Context ************/
  function getSugarRecordContext() {
    try {
      const model = App.controller?.context?.get("model");
      if (!model) return "No record loaded.";
      const { fields, attributes } = model;
      const lines = [];
      for (const fieldName in fields) {
        if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) continue;
        const def = fields[fieldName] || {};
        const label =
          App.lang.get(def.vname, model.module) ||
          def.label ||
          fieldName;

        let value = attributes[fieldName];
        if (Array.isArray(value)) {
          value = value
            .map(item =>
              typeof item === "object" && item !== null
                ? item.email_address || item.name || JSON.stringify(item)
                : item
            )
            .join(", ");
        } else if (typeof value === "object" && value !== null) {
          value = JSON.stringify(value);
        }
        // Include BOTH label and field name so you can ask by either
        lines.push(`${label} (${fieldName}): ${value}`);
      }
      return lines.sort().join("\n");
    } catch {
      return "Error retrieving SugarCRM record data.";
    }
  }
  const recordContext = getSugarRecordContext();

  // Build a quick lookup to resolve label -> fieldName (case-insensitive)
  function buildFieldLookup() {
    const model = App.controller?.context?.get("model");
    const map = { byName: {}, byLabel: {} };
    if (!model) return map;
    const { fields } = model;
    for (const fieldName in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) continue;
      const def = fields[fieldName] || {};
      const label = (
        App.lang.get(def.vname, model.module) ||
        def.label ||
        fieldName
      ).trim();
      map.byName[fieldName.toLowerCase()] = fieldName;
      map.byLabel[label.toLowerCase()] = fieldName;
    }
    return map;
  }
  const fieldLookup = buildFieldLookup();

  function resolveField(query) {
    if (!query) return null;
    const q = String(query).trim().toLowerCase();
    return fieldLookup.byName[q] || fieldLookup.byLabel[q] || null;
  }

  /************ 2) Create / replace popup ************/
  const POPUP_ID = "nano-text-agent";
  document.getElementById(POPUP_ID)?.remove();

  const popup = document.createElement("div");
  popup.id = POPUP_ID;
  popup.style.cssText = `
    position:fixed;bottom:20px;right:20px;width:460px;max-height:640px;
    background:#fff;border:1px solid #ccc;border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;
    display:flex;flex-direction:column;font-family:sans-serif;overflow:hidden;`;

  const header = document.createElement("div");
  header.style.cssText = `
    background:#0078d4;color:#fff;padding:10px 8px;cursor:move;
    display:flex;align-items:center;gap:10px;font-weight:bold;`;
  header.innerHTML = `<span>SugarCRM&nbsp;Nano&nbsp;Agent</span>`;

  const modeToggle = document.createElement("button");
  modeToggle.textContent = "Agent";
  modeToggle.title = "Toggle agent planning (tool use)";
  modeToggle.style.cssText =
    "margin-left:auto;background:#004d94;border:none;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;";
  header.appendChild(modeToggle);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText =
    "background:none;border:none;color:#fff;font-size:18px;cursor:pointer;margin-left:6px;";
  closeBtn.onclick = () => popup.remove();
  header.appendChild(closeBtn);

  const messages = document.createElement("div");
  messages.style.cssText = `
    flex:1;padding:12px;background:#fafafa;overflow-y:auto;display:flex;
    flex-direction:column;gap:10px;`;

  const inputWrap = document.createElement("div");
  inputWrap.style.cssText =
    "display:flex;padding:10px;border-top:1px solid #ddd;background:#fff;gap:8px;";

  const input = document.createElement("input");
  Object.assign(input, {
    type: "text",
    placeholder: "Ask… e.g. start flashing Status / highlight account_type yellow",
    style:
      "flex:1;padding:8px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
  });

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  sendBtn.style.cssText =
    "padding:8px 12px;background:#0078d4;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;";

  inputWrap.append(input, sendBtn);
  popup.append(header, messages, inputWrap);
  document.body.appendChild(popup);
  input.focus();

  /************ 3) Drag support ************/
  let drag = false, offsetX = 0, offsetY = 0;
  header.onmousedown = e => {
    drag = true;
    const rect = popup.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  };
  document.onmousemove = e => {
    if (!drag) return;
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
    popup.style.right = "auto";
    popup.style.bottom = "auto";
  };
  document.onmouseup = () => (drag = false);

  /************ 4) Styles (label-only highlight + flashing) ************/
  const STYLE_ID = "nano-agent-styles";
  document.getElementById(STYLE_ID)?.remove();
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    /* Label-only highlight (applied to .record-label/.label) */
    .nano-highlight {
      outline: 2px solid #f5c542;
      background: rgba(245, 197, 66, 0.15);
      border-radius: 6px;
      transition: background 200ms ease, outline-color 200ms ease;
      padding: 2px 4px;
      display: inline-block;
    }
    .nano-highlight-strong {
      outline: 3px solid #ff6a00;
      background: rgba(255, 106, 0, 0.18);
    }
    @keyframes nano-flash {
      0% { outline-color: #ff6a00; background: rgba(255,106,0,0.25); }
      50% { outline-color: #0078d4; background: rgba(0,120,212,0.20); }
      100% { outline-color: #ff6a00; background: rgba(255,106,0,0.25); }
    }
    .nano-flash-once {
      animation: nano-flash 0.6s ease-in-out 3;
    }
    .nano-flash-infinite {
      animation: nano-flash 0.6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(styleEl);

  /************ 5) Field DOM helpers (LABEL ONLY) ************/
  function findFieldNode(fieldName) {
    if (!fieldName) return null;

    // Find the cell for this field
    const selectors = [
      `.record-cell[data-name="${fieldName}"]`,
      `.fld_${fieldName}`,
      `[data-fieldname="${fieldName}"]`,
      `.record div[data-name="${fieldName}"]`,
    ];
    let cellEl = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { cellEl = el; break; }
    }

    // Prefer the label inside the cell (label-only targeting)
    if (cellEl) {
      const labelEl =
        cellEl.querySelector(".record-label") ||
        cellEl.querySelector(".label");
      if (labelEl) return labelEl;
    }

    // Fallback: try matching label text globally
    const labels = Array.from(document.querySelectorAll(".record-label, .label"));
    const hit = labels.find(
      l => l.textContent?.trim().toLowerCase() === fieldName.toLowerCase()
    );
    return hit || null;
  }

  function applyHighlight(el, color, strong=false) {
    if (!el) return false;
    el.classList.add('nano-highlight');
    if (strong) el.classList.add('nano-highlight-strong');
    if (color) {
      el.style.setProperty('--nano-color', color);
      el.style.outlineColor = color;
      el.style.backgroundColor = hexOrNamedToRgba(color, 0.15) || el.style.backgroundColor;
    }
    return true;
  }

  function removeHighlight(el) {
    if (!el) return false;
    el.classList.remove('nano-highlight', 'nano-highlight-strong', 'nano-flash-once', 'nano-flash-infinite');
    el.style.outlineColor = '';
    el.style.backgroundColor = '';
    return true;
  }

  function flashOnce(el, ms=1800) {
    if (!el) return false;
    el.classList.add('nano-flash-once');
    setTimeout(() => el.classList.remove('nano-flash-once'), ms);
    return true;
  }

  function startFlashing(el) {
    if (!el) return false;
    el.classList.add('nano-flash-infinite');
    return true;
  }

  function stopFlashing(el) {
    if (!el) return false;
    el.classList.remove('nano-flash-infinite');
    return true;
  }

  function hexOrNamedToRgba(color, alpha) {
    const c = color.trim();
    if (!c.startsWith('#')) return null; // let browser handle named colors
    let r, g, b;
    if (c.length === 4) {
      r = parseInt(c[1] + c[1], 16);
      g = parseInt(c[2] + c[2], 16);
      b = parseInt(c[3] + c[3], 16);
    } else if (c.length === 7) {
      r = parseInt(c.slice(1, 3), 16);
      g = parseInt(c.slice(3, 5), 16);
      b = parseInt(c.slice(5, 7), 16);
    } else {
      return null;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /************ 6) Tools (Agent-Callable) ************/
  const Tools = {
    // params: { target: "<label or field_name>", color?: "<css color>", strong?: boolean }
    highlightField: async (params = {}) => {
      const fieldResolved = resolveField(params.target);
      if (!fieldResolved) return { ok: false, error: `Field not found for '${params.target}'` };
      const el = findFieldNode(fieldResolved);
      if (!el) return { ok: false, error: `Label node not found for '${fieldResolved}'` };
      applyHighlight(el, params.color, !!params.strong);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return { ok: true, field: fieldResolved };
    },

    // params: { target: "<label or field_name>" }
    unhighlightField: async (params = {}) => {
      const fieldResolved = resolveField(params.target);
      if (!fieldResolved) return { ok: false, error: `Field not found for '${params.target}'` };
      const el = findFieldNode(fieldResolved);
      if (!el) return { ok: false, error: `Label node not found for '${fieldResolved}'` };
      removeHighlight(el);
      return { ok: true, field: fieldResolved };
    },

    // params: { target: "<label or field_name>", ms?: number }
    flashField: async (params = {}) => {
      const fieldResolved = resolveField(params.target);
      if (!fieldResolved) return { ok: false, error: `Field not found for '${params.target}'` };
      const el = findFieldNode(fieldResolved);
      if (!el) return { ok: false, error: `Label node not found for '${fieldResolved}` };
      // ensure highlight so the flash is visible
      applyHighlight(el, params.color, !!params.strong);
      flashOnce(el, Number(params.ms) || 1800);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return { ok: true, field: fieldResolved };
    },

    // params: { target: "<label or field_name>", color?: "<css color>", strong?: boolean }
    startFlashField: async (params = {}) => {
      const fieldResolved = resolveField(params.target);
      if (!fieldResolved) return { ok: false, error: `Field not found for '${params.target}'` };
      const el = findFieldNode(fieldResolved);
      if (!el) return { ok: false, error: `Label node not found for '${fieldResolved}` };
      applyHighlight(el, params.color, !!params.strong);
      startFlashing(el);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return { ok: true, field: fieldResolved };
    },

    // params: { target: "<label or field_name>" }
    stopFlashField: async (params = {}) => {
      const fieldResolved = resolveField(params.target);
      if (!fieldResolved) return { ok: false, error: `Field not found for '${params.target}'` };
      const el = findFieldNode(fieldResolved);
      if (!el) return { ok: false, error: `Label node not found for '${fieldResolved}` };
      stopFlashing(el);
      return { ok: true, field: fieldResolved };
    },
  };

  /************ 7) Gemini-Nano session ************/
  let session;
  try {
    session = await LanguageModel.create(); // Chrome's on-device model
  } catch (e) {
    appendMsg("Gemini-Nano not available. Enable on-device model in Chrome.", "bot");
    console.error(e);
    return;
  }

  /************ 8) Planner: decide tool or just answer ************/
  let agentEnabled = true;
  modeToggle.onclick = () => {
    agentEnabled = !agentEnabled;
    modeToggle.textContent = agentEnabled ? "Agent" : "Chat";
  };

  async function plan(question) {
    const toolList = Object.keys(Tools).join(", ");
    const planPrompt = `
You are a local page agent for SugarCRM. You can call tools by returning ONLY JSON.
Tools you can use: ${toolList}

Context about the current record (read-only):
${recordContext}

Rules:
- If the user asks to highlight/unhighlight/flash/start flashing/stop flashing a field label, plan the appropriate tool call.
- "target" may be a field label or a field name; use the string that best matches the user's intent.
- If no tool is needed, return {"action":"none","params":{}} only.

Examples:
User: "highlight account_type yellow"
Return: {"action":"highlightField","params":{"target":"account_type","color":"yellow"}}

User: "make the Billing Address label stand out"
Return: {"action":"highlightField","params":{"target":"Billing Address","strong":true}}

User: "flash the Status label"
Return: {"action":"flashField","params":{"target":"Status","ms":2000}}

User: "start flashing Description"
Return: {"action":"startFlashField","params":{"target":"Description"}}

User: "stop flashing description"
Return: {"action":"stopFlashField","params":{"target":"description"}}

Now respond for the user query, ONLY JSON, no extra text:
Question: ${question}
`.trim();

    const out = await session.prompt(planPrompt);
    return String(out || "").trim();
  }

  async function tryParseJson(jsonText) {
    try {
      const firstBrace = jsonText.indexOf("{");
      const lastBrace = jsonText.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) return null;
      return JSON.parse(jsonText.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  /************ 9) Chat + Agent flow ************/
  async function handleUser(question) {
    if (!question.trim()) return;
    appendMsg(question, "user");
    const botNode = appendMsg("Thinking…", "bot");

    try {
      if (agentEnabled) {
        const planText = await plan(question);
        const planJson = await tryParseJson(planText);

        if (planJson && planJson.action && planJson.action !== "none") {
          const { action, params } = planJson;
          if (Tools[action]) {
            const res = await Tools[action](params || {});
            if (res?.ok) {
              botNode.textContent = `Done: ${action} on ${res.field || params?.target || "field"}.`;
            } else {
              botNode.textContent = `Error running ${action}: ${res?.error || "Unknown error"}`;
              botNode.style.color = "red";
            }
            return;
          } else {
            botNode.textContent = `Unknown action: ${action}`;
            botNode.style.color = "red";
            return;
          }
        }
      }

      // Fallback: regular Q&A about the record
      const qaPrompt =
        `${recordContext}\n\n` +
        `Question:\n${question}\n\n` +
        `- Do not use markdown.\n` +
        `- Be friendly like a secretary.\n` +
        `- Answer in a single complete sentence.`;

      const stream = session.promptStreaming(qaPrompt);
      let full = "", prev = "";
      for await (const chunk of stream) {
        const add = chunk.startsWith(prev) ? chunk.slice(prev.length) : chunk;
        full += add;
        prev = chunk;
        botNode.textContent = full;
        messages.scrollTop = messages.scrollHeight;
      }
    } catch (err) {
      botNode.textContent = `Error: ${err.message}`;
      botNode.style.color = "red";
    }
  }

  /************ 10) UI events ************/
  sendBtn.onclick = () => handleUser(input.value);
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") handleUser(input.value);
  });

  /************ 11) UI helper ************/
  function appendMsg(text, who) {
    const node = document.createElement("div");
    node.style.cssText = `
      align-self:${who === "user" ? "flex-end" : "flex-start"};
      background:${who === "user" ? "#dcf8c6" : "#eee"};
      padding:10px;border-radius:8px;max-width:80%;white-space:pre-wrap;`;
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    if (who === "user") input.value = "";
    return node;
  }
})();
