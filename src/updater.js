"use strict";

// Auto-updates via electron-updater against the GitHub Releases feed configured
// in package.json build.publish. Safe no-op when unpackaged or when no release
// feed is reachable (e.g. before the first GitHub release is published).

const { dialog } = require("electron");

let autoUpdater = null;
function getUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch (e) {
    autoUpdater = null;
  }
  return autoUpdater;
}

// Background check on launch — quiet about failures, prompts to restart once a
// new version has been downloaded.
function initAutoUpdates(app) {
  if (!app.isPackaged) return;
  const u = getUpdater();
  if (!u) return;

  u.removeAllListeners("update-downloaded");
  u.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: "Project Hub " + info.version + " has been downloaded.",
        detail: "Restart to apply the update. Your projects are kept."
      })
      .then((r) => {
        if (r.response === 0) u.quitAndInstall();
      });
  });

  u.checkForUpdates().catch(() => {});
}

// Help > Check for Updates… — interactive, reports every outcome.
async function checkForUpdatesInteractive(app, win) {
  if (!app.isPackaged) {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Check for Updates",
      message: "Updates are only checked in the installed app.",
      detail: "You're running an unpackaged/dev build."
    });
    return;
  }
  const u = getUpdater();
  if (!u) {
    dialog.showErrorBox("Check for Updates", "The updater is unavailable in this build.");
    return;
  }
  try {
    const result = await u.checkForUpdates();
    const latest = result && result.updateInfo ? result.updateInfo.version : null;
    if (latest && latest !== app.getVersion()) {
      dialog.showMessageBox(win, {
        type: "info",
        title: "Update available",
        message: "Version " + latest + " is available.",
        detail: "It's downloading in the background; you'll be prompted to restart when it's ready."
      });
    } else {
      dialog.showMessageBox(win, {
        type: "info",
        title: "You're up to date",
        message: "Project Hub " + app.getVersion() + " is the latest version."
      });
    }
  } catch (e) {
    dialog.showMessageBox(win, {
      type: "warning",
      title: "Could not check for updates",
      message: "Update check failed.",
      detail: String((e && e.message) || e)
    });
  }
}

module.exports = { initAutoUpdates, checkForUpdatesInteractive };
