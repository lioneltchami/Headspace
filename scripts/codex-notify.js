#!/usr/bin/env node

const http = require("node:http");
const { spawn } = require("node:child_process");

// Computer Use client path is derived from CODEX_HOME (script ships in the DMG).
// If Computer Use is missing, the spawn fails silently — only that notify path is affected.
const path = require("node:path");
const os = require("node:os");

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const SKY_CLIENT =
  process.env.CODEX_COMPUTER_USE_CLIENT ||
  path.join(
    CODEX_HOME,
    "computer-use",
    "Codex Computer Use.app",
    "Contents",
    "SharedSupport",
    "SkyComputerUseClient.app",
    "Contents",
    "MacOS",
    "SkyComputerUseClient",
  );
const NOTCH_HOST = "127.0.0.1";
const NOTCH_PORT = 43821;
const REQUEST_TIMEOUT_MS = 900;

const rawPayload =
  process.argv.length > 2 ? process.argv[process.argv.length - 1] : "{}";

// Keep Codex's original Computer Use notify; do not change that behavior.
try {
  const child = spawn(SKY_CLIENT, ["turn-ended", rawPayload], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {});
  child.unref();
} catch (error) {
  // Notify hooks must fail silently so Codex turn-end is never blocked.
}

let payload;
try {
  payload = JSON.parse(rawPayload);
} catch (error) {
  payload = { title: "Codex finished a task", detail: String(rawPayload || "") };
}
if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
  payload = { title: "Codex finished a task" };
}

const body = Buffer.from(JSON.stringify(payload));
const request = http.request(
  {
    hostname: NOTCH_HOST,
    port: NOTCH_PORT,
    path: "/notify/codex",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": body.length,
    },
  },
  (response) => response.resume(),
);

request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy());
request.on("error", () => {});
request.end(body);
