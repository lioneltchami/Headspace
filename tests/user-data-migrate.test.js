const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  resolveUserDataPath,
  USER_DATA_MIGRATION_SENTINEL,
} = require("../main-services");

const names = { productName: "Headspace", legacyName: "Dynamic Panel" };

function makeAppData(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headspace-migrate-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("copies the legacy profile once into an empty target", (t) => {
  const appDataPath = makeAppData(t);
  const legacy = path.join(appDataPath, "Dynamic Panel");
  fs.mkdirSync(path.join(legacy, "Local Storage"), { recursive: true });
  fs.writeFileSync(path.join(legacy, "Local Storage", "data"), "notes");
  fs.writeFileSync(path.join(legacy, "SingletonLock"), "pid");

  const target = resolveUserDataPath({ appDataPath, ...names });

  assert.equal(target, path.join(appDataPath, "Headspace"));
  assert.equal(
    fs.readFileSync(path.join(target, "Local Storage", "data"), "utf8"),
    "notes",
  );
  assert.ok(fs.existsSync(path.join(target, USER_DATA_MIGRATION_SENTINEL)));
  assert.ok(!fs.existsSync(path.join(target, "SingletonLock")));
  assert.ok(!fs.existsSync(`${target}.migrating`));
  assert.ok(fs.existsSync(path.join(legacy, "Local Storage", "data")));
});

test("never overwrites an existing target profile", (t) => {
  const appDataPath = makeAppData(t);
  fs.mkdirSync(path.join(appDataPath, "Dynamic Panel"));
  fs.writeFileSync(path.join(appDataPath, "Dynamic Panel", "data"), "old");
  fs.mkdirSync(path.join(appDataPath, "Headspace"));
  fs.writeFileSync(path.join(appDataPath, "Headspace", "data"), "new");

  const target = resolveUserDataPath({ appDataPath, ...names });

  assert.equal(fs.readFileSync(path.join(target, "data"), "utf8"), "new");
  assert.ok(!fs.existsSync(path.join(target, USER_DATA_MIGRATION_SENTINEL)));
});

test("an explicit user-data-dir bypasses migration", (t) => {
  const appDataPath = makeAppData(t);
  fs.mkdirSync(path.join(appDataPath, "Dynamic Panel"));
  const explicitPath = path.join(appDataPath, "isolated");

  assert.equal(
    resolveUserDataPath({ appDataPath, explicitPath, ...names }),
    explicitPath,
  );
  assert.ok(!fs.existsSync(path.join(appDataPath, "Headspace")));
});
