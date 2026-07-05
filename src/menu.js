"use strict";

/**
 * Application menu. Kept lean — Backup/Import already live inside the dashboard
 * itself. This adds desktop-only conveniences: reload, a "start at login"
 * toggle, and quick access to the data folder.
 */

const { Menu, shell, dialog, app } = require("electron");
const settings = require("./settings");
const updater = require("./updater");

function setOpenAtLogin(on) {
  settings.set("openAtLogin", on);
  app.setLoginItemSettings({ openAtLogin: on });
}

function buildMenu({ win, homeUrl }) {
  const openAtLogin = settings.get("openAtLogin", true);

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+H",
          click: () => win.loadURL(homeUrl)
        },
        {
          label: "Open automatically at login",
          type: "checkbox",
          checked: openAtLogin,
          click: (item) => setOpenAtLogin(item.checked)
        },
        { type: "separator" },
        {
          label: "Open data folder…",
          click: () => shell.openPath(app.getPath("userData"))
        },
        {
          label: "About backups",
          click: () => {
            dialog.showMessageBox(win, {
              type: "info",
              title: "Backing up your projects",
              message: "Your projects are stored on this computer",
              detail:
                "Data lives in this app's own storage (durable — a browser " +
                '"clear data" cannot touch it).\n\nTo make a portable copy or ' +
                "move to another machine, use the sidebar's ⭳ Backup button " +
                "to save a .json file, and ⭱ Import to load one."
            });
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win.webContents.reloadIgnoringCache() },
        { role: "togglefullscreen" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "toggleDevTools" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates…",
          click: () => updater.checkForUpdatesInteractive(app, win)
        },
        { type: "separator" },
        {
          label: "About Project Hub",
          click: () => {
            dialog.showMessageBox(win, {
              type: "info",
              title: "About",
              message: "Project Hub — Desktop Edition",
              detail:
                "Version " +
                app.getVersion() +
                "\nA personal project & task dashboard.\n\n" +
                "Your data stays on this computer."
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu, setOpenAtLogin };
