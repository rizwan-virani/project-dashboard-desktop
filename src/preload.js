"use strict";

// Minimal, safe bridge: exposes only an AI-draft call to the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projecthubAI", {
  draft: (title, category) => ipcRenderer.invoke("ai:draft", { title, category }),
  focusWindow: () => ipcRenderer.invoke("win:focus")
});

// The data store: read/write the single JSON file directly (no server/port).
contextBridge.exposeInMainWorld("projecthubStore", {
  load: () => ipcRenderer.invoke("store:load"),
  save: (state) => ipcRenderer.invoke("store:save", state),
  saveSync: (state) => ipcRenderer.sendSync("store:save-sync", state)
});
