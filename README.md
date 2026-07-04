# Project Hub — Desktop Edition

A native Windows app wrapper around my personal Project Hub dashboard. Same
single-file dashboard as the browser version, but in its own window with
**durable local storage** (a browser "clear data" can't wipe it) and
**auto-start on login**.

The dashboard itself is canonical at `../project-dashboard/index.html`; this
project bundles a copy so both stay identical.

## Develop

```
npm install
npm start        # sync the dashboard, then launch in Electron
```

## Build the installer

```
npm run make-icon   # regenerate assets/icon.ico from the brand mark (optional)
npm run dist        # produces release/Project Hub Setup <version>.exe (NSIS)
```

- `npm run pack` makes an unpacked build in `release/win-unpacked` (no installer).
- Storage lives in the app's `userData` folder. Use the dashboard's **⭳ Backup /
  ⭱ Import** buttons to move data between machines.
- Architecture mirrors the Certification Launchpad: a privileged `projecthub://`
  scheme serves the app from one stable, secure origin.
