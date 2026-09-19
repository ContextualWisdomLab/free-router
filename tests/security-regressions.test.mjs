import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function source(path) {
  return readFile(resolve(ROOT, path), "utf8");
}

test("percent parsing removes every percent marker", async () => {
  const code = await source("scripts/update-models.ts");
  assert.match(code, /input\.replaceAll\("%", ""\)/);
  assert.doesNotMatch(code, /input\.replace\("%", ""\)/);
});

test("process launches never opt into a command shell", async () => {
  for (const path of [
    "site/scripts/build-site.mjs",
    "src/bin/free-router.ts",
    "src/lib/targets.ts",
  ]) {
    const code = await source(path);
    assert.doesNotMatch(code, /shell\s*:\s*true/);
    assert.doesNotMatch(code, /shell\s*:\s*process\.platform/);
  }
});

test("OpenCode installation refuses unrecognized command text", async () => {
  const { installOpenCode } = await import("../dist/lib/targets.js");
  const result = installOpenCode({ command: "definitely-not-a-supported-installer" });
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported installer/i);
});

test("dynamic configuration keys are matched without dynamic RegExp construction", async () => {
  const code = await source("src/lib/targets.ts");
  assert.doesNotMatch(code, /new RegExp\(`/);
});

test("generated and template HTML do not load unverified third-party stylesheets", async () => {
  for (const path of ["site/index.html", "site/index.template.html"]) {
    const html = await source(path);
    const stylesheetLinks = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)].map(
      ([tag]) => tag,
    );
    for (const tag of stylesheetLinks) {
      assert.doesNotMatch(tag, /https?:\/\//i);
    }
  }
});

test("site ships local glyph fallbacks for every icon used by the template", async () => {
  const html = await source("site/index.template.html");
  const css = await source("site/src/style.css");
  const iconNames = new Set(
    [...html.matchAll(/\bph-(?!bold\b)([a-z0-9-]+)/g)].map((match) => match[1]),
  );
  assert.ok(iconNames.size > 0);
  for (const iconName of iconNames) {
    assert.match(css, new RegExp(`\\.ph-${iconName}::before\\s*\\{`));
  }
});
