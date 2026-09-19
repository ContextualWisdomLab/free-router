import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("child processes never interpolate commands through a shell", () => {
  for (const path of [
    "site/scripts/build-site.mjs",
    "src/bin/free-router.ts",
    "src/lib/targets.ts",
  ]) {
    const source = readRepositoryFile(path);
    assert.doesNotMatch(source, /shell:\s*(?:true|process\.platform)/, path);
  }
});

test("configuration matching and percent parsing avoid dynamic patterns", () => {
  const targets = readRepositoryFile("src/lib/targets.ts");
  const modelSync = readRepositoryFile("scripts/update-models.ts");

  assert.doesNotMatch(targets, /new RegExp\(/);
  assert.doesNotMatch(modelSync, /\.replace\(["']%["']/);
});

test("the generated site does not execute externally hosted stylesheets", () => {
  for (const path of ["site/index.template.html", "site/index.html"]) {
    const html = readRepositoryFile(path);
    const externalStylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter(
        (tag) =>
          /\brel=["']stylesheet["']/.test(tag) &&
          /\bhref=["']https:\/\//.test(tag),
      );
    assert.deepEqual(externalStylesheets, [], path);
  }
});
