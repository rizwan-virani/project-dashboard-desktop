"use strict";

/**
 * Tiny localhost server: serves the dashboard AND a single-file data API to
 * the app's own Electron window (http://127.0.0.1:PORT), reading/writing
 * data.json via /api/state. Internal plumbing only — bound to 127.0.0.1, never
 * exposed to the network, and no external browser is involved.
 */

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json"
};
function mimeFor(f) { return MIME[path.extname(f).toLowerCase()] || "application/octet-stream"; }

// Strip a leading UTF-8 BOM (U+FEFF) — JSON.parse throws on it, and a BOM can
// sneak in if data.json is ever hand-edited or restored by a tool that adds one.
function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

async function readState(dataFile) {
  try {
    const raw = await fsp.readFile(dataFile, "utf8");
    const state = JSON.parse(stripBom(raw));
    const stat = await fsp.stat(dataFile);
    return { version: Math.round(stat.mtimeMs), state };
  } catch (e) {
    return { version: 0, state: { projects: [] } };
  }
}
async function writeState(dataFile, state) {
  const tmp = dataFile + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
  await fsp.rename(tmp, dataFile); // atomic-ish: never leave a half-written file
  const stat = await fsp.stat(dataFile);
  return Math.round(stat.mtimeMs);
}

function pad(n) { return String(n).padStart(2, "0"); }

// Safety net: snapshot data.json into a "backups" folder on each launch, keeping
// the most recent `keep`. A bad update or corrupt write can always be rolled back.
async function backup(dataFile, keep = 20) {
  try {
    if (!fs.existsSync(dataFile)) return;
    const dir = path.join(path.dirname(dataFile), "backups");
    await fsp.mkdir(dir, { recursive: true });
    const d = new Date();
    const stamp =
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    await fsp.copyFile(dataFile, path.join(dir, "data-" + stamp + ".json"));
    const files = (await fsp.readdir(dir))
      .filter((f) => f.startsWith("data-") && f.endsWith(".json"))
      .sort();
    while (files.length > keep) {
      const f = files.shift();
      await fsp.unlink(path.join(dir, f)).catch(() => {});
    }
  } catch {
    /* best effort — never block startup on a backup failure */
  }
}

function start({ appRoot, dataFile, port = 8770, host = "127.0.0.1" }) {
  const rootNorm = path.normalize(appRoot);
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, "http://" + host + ":" + port);

        if (u.pathname === "/api/state") {
          if (req.method === "GET") {
            const data = await readState(dataFile);
            res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            res.end(JSON.stringify(data));
            return;
          }
          if (req.method === "PUT") {
            let body = "";
            req.on("data", (c) => { body += c; if (body.length > 32 * 1024 * 1024) req.destroy(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(stripBom(body || "{}"));
                const state = parsed.state || parsed;
                // Safety: if this write would empty a file that currently has
                // projects, snapshot it first so the data is always recoverable.
                const incoming = (state && Array.isArray(state.projects)) ? state.projects.length : 0;
                if (incoming === 0) {
                  const cur = await readState(dataFile);
                  if (cur.state && cur.state.projects && cur.state.projects.length > 0) await backup(dataFile);
                }
                const version = await writeState(dataFile, state);
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, version }));
              } catch (e) {
                res.writeHead(400, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
              }
            });
            return;
          }
          res.writeHead(405); res.end(); return;
        }

        // Static files
        let pathname = decodeURIComponent(u.pathname);
        if (pathname === "/" || pathname === "") pathname = "/index.html";
        const filePath = path.normalize(path.join(rootNorm, pathname));
        if (!filePath.startsWith(rootNorm)) { res.writeHead(403); res.end("Forbidden"); return; }
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
        const data = await fsp.readFile(filePath);
        res.writeHead(200, { "content-type": mimeFor(filePath), "cache-control": "no-store" });
        res.end(data);
      } catch (err) {
        res.writeHead(500); res.end(String((err && err.message) || err));
      }
    });
    server.on("error", reject);
    server.listen(port, host, () => resolve({ server, port }));
  });
}

module.exports = { start, backup };
