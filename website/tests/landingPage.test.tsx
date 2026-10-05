import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const moduleUrl = new URL("../app/LandingPage.tsx", import.meta.url);

test("signal strip landing exposes dual downloads and section map", async () => {
  const { default: LandingPage } = await import(`${moduleUrl.href}?t=${Date.now()}`);
  const html = renderToStaticMarkup(createElement(LandingPage));

  assert.deepEqual(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
    ["hero", "trust", "workspace", "alerts", "get-it", "footer"],
  );
  assert.equal((html.match(/data-primary-action=/g) || []).length, 2);
  assert.equal((html.match(/data-direct-download=/g) || []).length, 2);
  assert.match(html, /Download macOS/);
  assert.match(html, /Download Windows/);
  assert.equal((html.match(/data-nav-github=/g) || []).length, 1);
  assert.doesNotMatch(html, /Dynamic Island|WORK IN FLOW|BACK TO FLOW|prism-container|echo-text/);
});

test("hero uses brand strip assets without donor Mac lifestyle photos", async () => {
  const { default: LandingPage } = await import(`${moduleUrl.href}?t=${Date.now()}`);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const hero = html.slice(html.indexOf('data-section="hero"'), html.indexOf('data-section="trust"'));

  assert.match(hero, /A top-edge workspace for Mac and Windows/);
  assert.match(hero, /class="signal-strip"/);
  assert.match(hero, /\/brand\/home\.jpg/);
  assert.doesNotMatch(hero, /\/hero\/mac-scene-hq\.jpg|\/hero\/mac-wallpaper/);
  assert.ok(existsSync(new URL("../public/brand/home.jpg", import.meta.url)));
  assert.ok(existsSync(new URL("../public/brand/mark.png", import.meta.url)));
  assert.ok(existsSync(new URL("../public/brand/panel-collapsed.png", import.meta.url)));
});

test("workspace ships six real brand captures", async () => {
  const { workspace } = await import("../app/content/en.ts");
  assert.equal(workspace.jobs.length, 6);
  for (const job of workspace.jobs) {
    assert.ok(
      existsSync(new URL(`../public${job.image}`, import.meta.url)),
      `${job.image} missing`,
    );
  }
});
