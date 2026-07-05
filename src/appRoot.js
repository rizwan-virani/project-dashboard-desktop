"use strict";

/**
 * Resolve where the dashboard's index.html is served FROM.
 *
 * Precedence (first existing wins) — "embedded with external override":
 *   1. PROJECTHUB_APP env var (explicit override, handy for dev)
 *   2. an "app" folder next to the installed .exe        (portable override)
 *   3. an "app" folder in the app's userData directory   (per-user override)
 *   4. the copy bundled into the installer (resources/app)
 *   5. the dev build folder (./build/app) after `npm run sync`
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function firstExisting(candidates) {
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function resolveAppRoot() {
  const exeDir = path.dirname(app.getPath("exe"));
  const candidates = [
    process.env.PROJECTHUB_APP,
    path.join(exeDir, "app"),
    path.join(app.getPath("userData"), "app"),
    path.join(process.resourcesPath || "", "app"),
    path.join(app.getAppPath(), "build", "app")
  ];
  const root = firstExisting(candidates);
  if (!root) {
    throw new Error(
      "Could not locate the dashboard (index.html). Run `npm run sync` for dev, " +
        "or reinstall the app. Checked:\n" + candidates.filter(Boolean).join("\n")
    );
  }
  return root;
}

module.exports = { resolveAppRoot };
