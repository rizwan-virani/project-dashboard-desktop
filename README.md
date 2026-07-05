# Project Hub — Desktop Edition

## What this is

The desktop edition of my personal Project Hub dashboard: a single installable Windows app that wraps the dashboard in an Electron shell with durable local storage, so it runs natively and keeps its data across sessions and reinstalls.

## What this is not

This is not a hosted or multi-user service. It is a personal, single-user desktop tool. It is not a cross-platform release; the current build target is Windows.

## At a glance

- Platform: Windows desktop (Electron), packaged with electron-builder.
- Wraps my personal Project Hub dashboard with durable local storage.
- Offline, single-user, installable app.

## Features

- The Project Hub dashboard as a native Windows app.
- Durable local storage that survives reinstalls.
- A build and release pipeline for the Windows installer.

## How to use it

Install the app from the released Windows installer and launch it. It runs locally and stores its data on the machine.

## Run it locally

```
# from the repository root:
npm install
npm start        # syncs the app, then launches it in Electron
```

## Project structure

- `src/` the Electron main and preload code and the app shell; `scripts/` the app-sync, icon, and release tooling; `assets/` icons and resources; `build/` and `release/` the packaging output.

## Building and releasing

- `npm run dist` builds the Windows installer with electron-builder.
- `npm run pack` builds an unpacked directory for testing.
- `npm run release` builds and publishes.

## License

Dual-licensed: the application code under the MIT License, and the bundled content and layout under Creative Commons Attribution-NonCommercial-ShareAlike 4.0. See LICENSE.
