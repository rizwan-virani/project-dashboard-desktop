// Regenerate assets/icon.ico from the brand mark. Spawns the bundled Electron
// with PROJECTHUB_MKICON=1, which routes to src/makeIcon.js.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electron = require("electron");
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn(electron, [projectRoot], {
  stdio: "inherit",
  env: { ...process.env, PROJECTHUB_MKICON: "1" }
});
child.on("exit", (code) => process.exit(code ?? 0));
