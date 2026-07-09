"use strict";

/**
 * Direct file storage — the whole "database" is ONE JSON file.
 *
 * The data lives at a FIXED, machine-wide path (C:\ProgramData\Project Hub), NOT
 * app.getPath('userData'). That path is identical no matter which executable or
 * context launches the app (installed exe, dev binary, login auto-start), so the
 * data can never "disappear" just because a different copy resolved a different
 * per-user folder. No server, no ports — the main process reads/writes this file
 * and hands the data to the window over IPC.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.env.ProgramData || "C:\\ProgramData", "Project Hub");
const DATA_FILE = path.join(DATA_DIR, "data.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const LOG_FILE = path.join(DATA_DIR, "load-log.txt");

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {} }
function dataFile() { return DATA_FILE; }
function logFile() { return LOG_FILE; }
function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

function readSync() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const state = JSON.parse(stripBom(raw));
    return state && Array.isArray(state.projects) ? state : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

function writeSync(state) {
  ensureDir();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); // atomic-ish: never a half-written file
  fs.renameSync(tmp, DATA_FILE);
}

function pad(n) { return String(n).padStart(2, "0"); }

// Rolling snapshot into a "backups" folder (last `keep`) — belt and suspenders.
function backup(keep = 20) {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const d = new Date();
    const stamp =
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    fs.copyFileSync(DATA_FILE, path.join(BACKUPS_DIR, "data-" + stamp + ".json"));
    const files = fs.readdirSync(BACKUPS_DIR).filter((x) => x.startsWith("data-") && x.endsWith(".json")).sort();
    while (files.length > keep) { const x = files.shift(); try { fs.unlinkSync(path.join(BACKUPS_DIR, x)); } catch {} }
  } catch { /* best effort */ }
}

// Save; if this write would empty a file that currently has projects, snapshot
// it first so nothing is ever unrecoverably lost.
function saveGuarded(state) {
  const incoming = state && Array.isArray(state.projects) ? state.projects.length : 0;
  if (incoming === 0) {
    const cur = readSync();
    if (cur.projects && cur.projects.length > 0) backup();
  }
  writeSync(state);
  return true;
}

// Newest backup that actually has projects (with its mtime).
function latestNonEmptyBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs.readdirSync(BACKUPS_DIR).filter((x) => x.startsWith("data-") && x.endsWith(".json")).sort().reverse();
    for (const name of files) {
      const p = path.join(BACKUPS_DIR, name);
      try {
        const st = JSON.parse(stripBom(fs.readFileSync(p, "utf8")));
        if (st && Array.isArray(st.projects) && st.projects.length > 0) return { state: st, mtime: fs.statSync(p).mtimeMs, name };
      } catch {}
    }
  } catch {}
  return null;
}

// Robust startup load: retry the read, and if the file reads empty/locked while
// a non-empty backup exists, recover from the backup so the window is NEVER blank
// when data actually exists. Respects a genuine "delete all".
// Returns { state, source, count, tries, file, err } for logging.
function loadRobust() {
  let state = null, err = null, tries = 0, readOk = false;
  for (let i = 0; i < 6; i++) {
    tries = i + 1;
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const st = JSON.parse(stripBom(raw));
      if (st && Array.isArray(st.projects)) { state = st; readOk = true; break; }
    } catch (e) {
      err = String((e && e.message) || e);
      const t = Date.now(); while (Date.now() - t < 100) {} // brief sync backoff before retry
    }
  }
  if (readOk && state.projects.length > 0) return { state, source: "file", count: state.projects.length, tries, file: DATA_FILE, err };
  const b = latestNonEmptyBackup();
  if (b) {
    if (!readOk) return { state: b.state, source: "recover:read-failed", count: b.state.projects.length, tries, file: DATA_FILE, err };
    let fMtime = 0; try { fMtime = fs.statSync(DATA_FILE).mtimeMs; } catch {}
    if (fMtime > b.mtime + 2000) return { state, source: "file-empty:fresh-delete", count: 0, tries, file: DATA_FILE, err };
    return { state: b.state, source: "recover:file-empty-stale", count: b.state.projects.length, tries, file: DATA_FILE, err };
  }
  return { state: state || { projects: [] }, source: readOk ? "file-empty:no-backup" : "empty:no-backup", count: 0, tries, file: DATA_FILE, err };
}

module.exports = { readSync, writeSync, saveGuarded, backup, dataFile, logFile, loadRobust, DATA_DIR };
