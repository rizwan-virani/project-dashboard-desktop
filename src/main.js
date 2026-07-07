"use strict";

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require("electron");
const path = require("path");

const { resolveAppRoot } = require("./appRoot");
const proto = require("./protocol");
const { buildMenu } = require("./menu");
const settings = require("./settings");
const ai = require("./ai");
const updater = require("./updater");
const dataServer = require("./server");

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
let tray = null;
let isQuitting = false;
let appOrigin = "";

const ICON = path.join(__dirname, "..", "assets", "icon.ico");

async function startServer(appRoot) {
  const dataFile = path.join(app.getPath("userData"), "data.json");
  // Snapshot existing data before this session touches it (rolling backups).
  await dataServer.backup(dataFile);
  const preferred = settings.get("serverPort", 8770);
  const tries = [preferred, 8770, 8771, 8772, 8773, 8774, 8775, 8776, 8777, 8778, 8779]
    .filter((v, i, a) => a.indexOf(v) === i);
  for (const port of tries) {
    try {
      const { port: bound } = await dataServer.start({ appRoot, dataFile, port });
      settings.set("serverPort", bound);
      return bound;
    } catch (e) {
      if (!(e && e.code === "EADDRINUSE")) throw e;
    }
  }
  throw new Error("No free port for the data server (8770-8779).");
}

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

  // Links to OTHER sites open in the OS browser; the app's own origin stays in-app.
  const isExternal = (url) => (url.startsWith("http:") || url.startsWith("https:")) && !url.startsWith(appOrigin);
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

function buildTray(appUrl) {
  try {
    tray = new Tray(nativeImage.createFromPath(ICON));
    tray.setToolTip("Project Hub");
    const menu = Menu.buildFromTemplate([
      { label: "Open Project Hub", click: () => showWindow(appUrl) },
      { type: "separator" },
      { label: "Quit Project Hub", click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => showWindow(appUrl));
    tray.on("double-click", () => showWindow(appUrl));
  } catch (e) {
    /* tray is a convenience; ignore if it fails */
  }
}

function reconcileLoginItem() {
  const want = settings.get("openAtLogin", true);
  try { app.setLoginItemSettings({ openAtLogin: want }); } catch { /* ignore */ }
}

app.on("second-instance", () => showWindow(appOrigin + "/index.html"));
app.on("before-quit", () => { isQuitting = true; });

app.whenReady().then(async () => {
  const appRoot = resolveAppRoot();

  // Dev helper: generate assets/icon.ico from the brand mark, then quit.
  if (process.env.PROJECTHUB_MKICON) {
    proto.registerHandler(appRoot);
    require("./makeIcon").run(appRoot).then(() => app.exit(0));
    return;
  }

  const port = await startServer(appRoot);
  appOrigin = "http://127.0.0.1:" + port;
  const appUrl = appOrigin + "/index.html";

  reconcileLoginItem();
  createWindow(appUrl);
  ai.warmup(); // preload the local model so the first AI draft isn't a cold start
  updater.initAutoUpdates(app); // check GitHub for a newer version, download in background

  app.on("activate", () => showWindow(appUrl));
});

// Closing the window quits the app (standard desktop behavior).
app.on("window-all-closed", () => { app.quit(); });
