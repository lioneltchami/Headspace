const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "index.html"),
  "utf8",
);
const appScripts = [
  "ui-shared.js",
  "todo-ui.js",
  "notes-ui.js",
  "home-ui.js",
  "clipboard-ui.js",
  "app.js",
];
const appJs = appScripts
  .map((file) =>
    fs.readFileSync(path.join(__dirname, "..", "renderer", file), "utf8"),
  )
  .join("\n");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(
  (match) => match[1],
);
const workspaceScripts = scripts.slice(
  scripts.indexOf("workspace-shared.js"),
  scripts.indexOf("workspace.js") + 1,
);
const workspaceJs = workspaceScripts
  .map((src) =>
    fs.readFileSync(path.join(__dirname, "..", "renderer", src), "utf8"),
  )
  .join("\n");
const effectsJs = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "effects.js"),
  "utf8",
);

test("workspace modules load after app.js, between the shared kit and the workspace.js orchestrator", () => {
  assert.ok(scripts.indexOf("app.js") < scripts.indexOf("workspace-shared.js"));
  assert.deepEqual(workspaceScripts, [
    "workspace-shared.js",
    "commands-ui.js",
    "links-ui.js",
    "recordings-ui.js",
    "settings-ui.js",
    "windows-music-ui.js",
    "credentials-ui.js",
    "workspace.js",
  ]);
});

test("clipboard rows define both favorite icons before rendering entries", () => {
  assert.match(appJs, /const starOutlineSvg\s*=/);
  assert.match(appJs, /const starFilledSvg\s*=/);
});

test("notes have a dedicated top-level tab and management panel", () => {
  assert.match(html, /data-tab="notes"/);
  assert.match(html, /id="tab-notes"/);
  assert.match(html, /id="notes-search"/);
  assert.match(html, /id="notes-list"/);
  assert.match(html, /id="notes-detail"/);
});

test("home scratch note keeps only the save action", () => {
  const homeNote =
    html.match(/<section\s+class="tile home-note"[\s\S]*?<\/section>/)?.[0] ||
    "";
  assert.match(homeNote, /id="note-save-btn"/);
  assert.doesNotMatch(homeNote, /id="note-library-btn"/);
  assert.doesNotMatch(homeNote, /id="note-library"/);
});

test("recordings expose in-page API settings and create a live draft while recording", () => {
  assert.match(html, /id="recording-configure"/);
  assert.match(workspaceJs, /function beginRecordingDraft\(\)/);
  assert.match(workspaceJs, /recordingLiveTranscript/);
  assert.match(workspaceJs, /configure-transcription/);
});

test("a live recording can be paused, resumed, and stopped from the recordings tab", () => {
  assert.match(workspaceJs, /recording-live-pause/);
  assert.match(workspaceJs, /recording-live-stop/);
  assert.match(workspaceJs, /togglePauseRecording/);
  assert.match(workspaceJs, /stopRecording/);
});

test("homepage visibility has one storage key, exact validation, and lifecycle events", () => {
  assert.match(appJs, /notch-home-hidden-modules-v1/);
  assert.match(appJs, /validateHomeWidgetLayout/);
  assert.match(appJs, /window\.NotchHome\s*=/);
  assert.match(appJs, /notch:home-modules-changed/);
  assert.match(appJs, /notch:home-layout-error/);
  assert.match(appJs, /stopMirror\(\)/);
  assert.match(
    appJs,
    /new Set\(homeTiles\.map\(\(tile\) => tile\.dataset\.homeModule\)\)/,
  );
});

test("settings exposes exactly one switch for every homepage widget", () => {
  const switches = [
    ...html.matchAll(/data-settings-home-module="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(switches, [
    "music",
    "pomodoro",
    "recorder",
    "windows",
    "mirror",
    "note",
    "commands",
  ]);
  assert.match(workspaceJs, /isRecordingActive/);
  assert.match(workspaceJs, /recording_active/);
  assert.match(workspaceJs, /at_least_one_required/);
});

test("settings exposes every panel tab as a possible default opening page", () => {
  const select =
    html.match(/<select\s+id="settings-default-tab"[\s\S]*?<\/select>/)?.[0] ||
    "";
  const options = [...select.matchAll(/<option value="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(options, [
    "home",
    "todo",
    "notes",
    "links",
    "recordings",
    "credentials",
    "clip",
    "settings",
  ]);
  assert.match(workspaceJs, /setDefaultTab/);
});

test("hidden visual widgets stop presentation-only background work", () => {
  assert.match(effectsJs, /setEnabled/);
  assert.match(effectsJs, /notch:home-modules-changed/);
  assert.match(workspaceJs, /NotchHome\?\.isVisible/);
});
