// Copy the single source-of-truth dashboard into the desktop build folder.
// The browser version at ../project-dashboard/index.html stays canonical; the
// desktop app just bundles a copy so both stay identical.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const src = resolve(projectRoot, "..", "project-dashboard", "index.html");
const outDir = resolve(projectRoot, "build", "app");

if (!existsSync(src)) {
  console.error("Source dashboard not found at: " + src);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(src, resolve(outDir, "index.html"));
console.log("Synced dashboard -> build/app/index.html");
