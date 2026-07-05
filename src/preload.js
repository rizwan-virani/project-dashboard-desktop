"use strict";

// Minimal, safe bridge: exposes only an AI-draft call to the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projecthubAI", {
  draft: (title, category) => ipcRenderer.invoke("ai:draft", { title, category }),
  focusWindow: () => ipcRenderer.invoke("win:focus")
});
