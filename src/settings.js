"use strict";

/**
 * Tiny persisted-settings helper (userData/settings.json).
 * Currently just tracks the "open at login" preference so the menu toggle
 * and the startup reconciliation agree.
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function file() {
  return path.join(app.getPath("userData"), "settings.json");
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8"));
  } catch {
    return {};
  }
}

function write(obj) {
  try {
    fs.writeFileSync(file(), JSON.stringify(obj, null, 2));
  } catch {
    /* best effort */
  }
}

function get(key, fallback) {
  const v = read()[key];
  return v === undefined ? fallback : v;
}

function set(key, value) {
  const obj = read();
  obj[key] = value;
  write(obj);
}

module.exports = { get, set };
