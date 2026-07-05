"use strict";

/**
 * Local AI description generation via Ollama (http://localhost:11434).
 * Runs in the MAIN process, so there is no browser CORS to satisfy and no
 * secret ever reaches the renderer. Returns { ok, text } or { ok:false, error }.
 */

const OLLAMA = "http://localhost:11434";
let cachedModel = null;

async function pickModel() {
  if (cachedModel) return cachedModel;
  const r = await fetch(OLLAMA + "/api/tags", { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error("ollama tags " + r.status);
  const j = await r.json();
  cachedModel = (j.models && j.models[0] && j.models[0].name) || "gemma4:latest";
  return cachedModel;
}

function buildPrompt(title, catName) {
  return (
    "Write a concise, practical description for a project in a personal task " +
    "dashboard. Two to three sentences, specific and action-oriented. Output " +
    "ONLY the description text — no title, headings, quotes, bullet lists, or " +
    "preamble.\n\nCategory: " + (catName || "General") +
    "\nProject title: " + title + "\n\nDescription:"
  );
}

function clean(s) {
  return String(s || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*["'`]+|["'`]+\s*$/g, "")
    .trim();
}

async function draft(title, catName) {
  try {
    if (!title || !title.trim()) return { ok: false, error: "no title" };
    const model = await pickModel();
    const r = await fetch(OLLAMA + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(title, catName),
        stream: false,
        think: false,                                  // skip the model's "thinking" phase: faster + non-empty
        keep_alive: "1h",                              // keep the model warm between drafts
        options: { temperature: 0.7, num_predict: 180 } // cap length so it doesn't over-generate
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) return { ok: false, error: "ollama " + r.status };
    const j = await r.json();
    const text = clean(j.response);
    return text ? { ok: true, text } : { ok: false, error: "empty response" };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Preload the model into memory at app start so the first real draft is fast,
// not a 20s cold start. Fire-and-forget; failure is harmless (Ollama may be off).
async function warmup() {
  try {
    const model = await pickModel();
    await fetch(OLLAMA + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "ok", stream: false, think: false, keep_alive: "1h", options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(90000)
    });
  } catch {
    /* ignore — model just won't be pre-warmed */
  }
}

module.exports = { draft, warmup };
