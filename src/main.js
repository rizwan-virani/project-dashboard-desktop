"use strict";

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require("electron");
const path = require("path");

const { resolveAppRoot } = require("./appRoot");
const proto = require("./protocol");
const { buildMenu } = require("./menu");
const settings = require("./settings");
const ai = require("./ai");
const updater = require("./updater");
const store = require("./store");

// Renderer <-> main: the data "database" is a single JSON file read/written here.
function loadLog(msg) {
  try {
    const fs = require("fs");
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.appendFileSync(store.logFile(), new Date().toISOString() + " " + msg + "\n");
  } catch {}
}
ipcMain.handle("store:load", () => {
  const r = store.loadRobust();
  loadLog("load source=" + r.source + " count=" + r.count + " tries=" + r.tries + " file=" + r.file + (r.err ? " err=" + r.err : ""));
  return r.state;
});
ipcMain.handle("store:save", (_evt, state) => store.saveGuarded(state));
// Synchronous save used on window close, so a last edit can't be lost on quit.
ipcMain.on("store:save-sync", (evt, state) => { try { store.writeSync(state); } catch {} evt.returnValue = true; });

// Renderer -> main: draft a description with the local model.
ipcMain.handle("ai:draft", (_evt, { title, category }) => ai.draft(title, category));

// Renderer -> main: make sure the window has real keyboard focus (called when a
// dialog opens, so typing always works even if focus drifted during an AI call).
ipcMain.handle("win:focus", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  // If the window doesn't already hold focus, force it to the foreground. The
  // alwaysOnTop toggle defeats Windows' foreground lock even if the system's
  // ForegroundLockTimeout is non-zero — so typing works regardless of that setting.
  if (!mainWindow.isFocused()) {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
  }
  mainWindow.webContents.focus();
});

// Single instance — re-launching focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Kept only so `npm run make-icon` can render the brand mark.
proto.registerScheme();

let mainWindow = null;
let isQuitting = false;

const ICON = path.join(__dirname, "..", "assets", "icon.ico");

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#f4f6fb",
    title: "Project Hub",
    icon: ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.once("ready-to-show", () => revealWindow(mainWindow));
  mainWindow.on("focus", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.focus();
  });

  buildMenu({ win: mainWindow, homeUrl: appUrl });
  mainWindow.loadURL(appUrl);

  // The app runs on projecthub://; any http(s) link is external -> OS browser.
  const isExternal = (url) => url.startsWith("http:") || url.startsWith("https:");
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternal(url)) { event.preventDefault(); shell.openExternal(url); }
  });

  // Closing the window quits the app. Every launch is then a clean start that
  // reloads data from disk — no lingering instance can sit showing stale/empty.
}

function showWindow(appUrl) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    revealWindow(mainWindow);
  } else {
    createWindow(appUrl);
  }
}

// Force the window to the foreground with real keyboard focus. On Windows a
// plain show()+focus() can leave the window visible but NOT keyboard-active
// (foreground lock), so clicks work but typing doesn't. Toggling alwaysOnTop
// yanks it to the front and gives it input focus.
function revealWindow(win) {
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.focus();
  win.setAlwaysOnTop(false);
  win.webContents.focus();
}

function reconcileLoginItem() {
  const want = settings.get("openAtLogin", true);
  try { app.setLoginItemSettings({ openAtLogin: want }); } catch { /* ignore */ }
}

app.on("second-instance", () => showWindow(proto.homeUrl));
app.on("before-quit", () => { isQuitting = true; });

app.whenReady().then(async () => {
  const appRoot = resolveAppRoot();
  proto.registerHandler(appRoot); // serve the app over projecthub:// (no HTTP server, no port)

  // Dev helper: generate assets/icon.ico from the brand mark, then quit.
  if (process.env.PROJECTHUB_MKICON) {
    require("./makeIcon").run(appRoot).then(() => app.exit(0));
    return;
  }

  store.backup(); // snapshot data.json before this session touches it

  reconcileLoginItem();
  createWindow(proto.homeUrl); // loads projecthub://app/index.html
  ai.warmup(); // preload the local model so the first AI draft isn't a cold start
  updater.initAutoUpdates(app); // check GitHub for a newer version, download in background

  app.on("activate", () => showWindow(proto.homeUrl));
});

// Closing the window quits the app (standard desktop behavior).
app.on("window-all-closed", () => { app.quit(); });
