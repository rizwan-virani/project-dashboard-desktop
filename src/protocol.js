"use strict";

/**
 * The projecthub:// protocol.
 *
 * The dashboard is served from a single privileged origin (projecthub://app/…)
 * rather than file://. That gives it a STABLE, SECURE origin, which is what
 * makes localStorage durable: the app's data lives in the app's own userData
 * partition and is never touched by clearing a browser's cookies/site-data.
 */

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { protocol } = require("electron");

const SCHEME = "projecthub";
const HOST = "app";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain"
};

function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        allowServiceWorkers: false,
        stream: true
      }
    }
  ]);
}

function withinRoot(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

function registerHandler(appRoot) {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== HOST) {
      return new Response("Not found", { status: 404 });
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    if (pathname === "" || pathname === "/") pathname = "/index.html";

    const filePath = path.normalize(path.join(appRoot, pathname));
    if (!withinRoot(appRoot, filePath)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      if (!fsSync.existsSync(filePath)) {
        return new Response("Not found: " + pathname, { status: 404 });
      }
      const data = await fs.readFile(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          "content-type": mimeFor(filePath),
          "cache-control": "no-store"
        }
      });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  });
}

module.exports = {
  SCHEME,
  HOST,
  homeUrl: `${SCHEME}://${HOST}/index.html`,
  registerScheme,
  registerHandler
};
