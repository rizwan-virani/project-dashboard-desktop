"use strict";

/**
 * Direct file storage. No server, no ports, no HTTP — the main process reads and
 * writes ONE JSON file (userData/data.json) and hands the data to the window over
 * IPC. This is the whole database: a plain file loaded straight from disk.
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { app } = require("electron");

function dataFile() {
  return path.join(app.getPath("userData"), "data.json");
}
function stripBom(s) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; // JSON.parse throws on a BOM
}

// Synchronous read — used at load time so the window gets data immediately.
function readSync() {
  try {
    const raw = fs.readFileSync(dataFile(), "utf8");
    const state = JSON.parse(stripBom(raw));
    return state && Array.isArray(state.projects) ? state : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

function writeSync(state) {
  const f = dataFile();
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); // atomic-ish: never a half-written file
  fs.renameSync(tmp, f);
}

async function write(state) {
  const f = dataFile();
  const tmp = f + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
  await fsp.rename(tmp, f);
}

function pad(n) { return String(n).padStart(2, "0"); }

// Rolling snapshot into a "backups" folder (last `keep`) — belt and suspenders.
async function backup(keep = 20) {
  try {
    const f = dataFile();
    if (!fs.existsSync(f)) return;
    const dir = path.join(path.dirname(f), "backups");
    await fsp.mkdir(dir, { recursive: true });
    const d = new Date();
    const stamp =
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    await fsp.copyFile(f, path.join(dir, "data-" + stamp + ".json"));
    const files = (await fsp.readdir(dir)).filter((x) => x.startsWith("data-") && x.endsWith(".json")).sort();
    while (files.length > keep) { const x = files.shift(); await fsp.unlink(path.join(dir, x)).catch(() => {}); }
  } catch { /* best effort */ }
}

// Save with a guard: if this write would empty a file that currently has
// projects, snapshot it first so nothing is ever unrecoverably lost.
async function saveGuarded(state) {
  const incoming = state && Array.isArray(state.projects) ? state.projects.length : 0;
  if (incoming === 0) {
    const cur = readSync();
    if (cur.projects && cur.projects.length > 0) await backup();
  }
  await write(state);
  return true;
}

module.exports = { readSync, writeSync, saveGuarded, backup, dataFile };
