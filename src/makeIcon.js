"use strict";

// Renders the Project Hub "P" brand mark into assets/icon.ico.
// Invoked via: PROJECTHUB_MKICON=1 electron .
//
// Loads the (known-good) projecthub:// home page, swaps the document for the
// brand mark via injected JS, then captures it. The .ico container is written
// by hand (one PNG-compressed 256px entry, valid on Vista+).

const { BrowserWindow } = require("electron");
const proto = require("./protocol");
const fs = require("fs");
const path = require("path");

const SIZE = 256;

const INJECT = `
  document.documentElement.innerHTML =
    '<body style="margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#3b6cff"/><stop offset="1" stop-color="#7c5bff"/>' +
    '</linearGradient></defs>' +
    '<rect width="512" height="512" rx="110" fill="url(#g)"/>' +
    '<text x="256" y="368" font-family="Segoe UI,Arial,sans-serif" font-size="320" ' +
    'font-weight="800" text-anchor="middle" fill="#ffffff">P</text>' +
    '</svg></body>';
  true;
`;

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // 0 => 256px
  entry.writeUInt8(0, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

async function run() {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    frame: false,
    backgroundColor: "#3b6cff",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const wc = win.webContents;
  const ready = new Promise((resolve) => {
    wc.once("dom-ready", resolve);
    setTimeout(resolve, 8000);
  });
  wc.loadURL(proto.homeUrl).catch(() => {});
  await ready;
  await wc.executeJavaScript(INJECT);
  await new Promise((r) => setTimeout(r, 300));
  const img = await wc.capturePage();
  const outDir = path.join(__dirname, "..", "assets");
  fs.mkdirSync(outDir, { recursive: true });
  const outIco = path.join(outDir, "icon.ico");
  fs.writeFileSync(outIco, pngToIco(img.toPNG()));
  console.log("ICON_OK " + outIco + " (" + img.getSize().width + "px)");
  win.destroy();
}

module.exports = { run };
