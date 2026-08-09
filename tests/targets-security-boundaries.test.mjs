import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const targetsSource = await readFile(
  new URL("../src/lib/targets.ts", import.meta.url),
  "utf8",
);
const cliSource = await readFile(
  new URL("../src/bin/free-router.ts", import.meta.url),
  "utf8",
);
const modelUpdateSource = await readFile(
  new URL("../scripts/update-models.ts", import.meta.url),
  "utf8",
);

test("OpenCode installation never delegates a command string to a shell", () => {
  assert.doesNotMatch(targetsSource, /shell:\s*true/);
});

test("OpenCode launch never delegates executable resolution to a shell", () => {
  assert.doesNotMatch(cliSource, /shell:\s*true/);
});

test("config key matching does not construct runtime regular expressions", () => {
  assert.equal((targetsSource.match(/new RegExp\(/g) ?? []).length, 0);
});

test("percent parsing removes every percent marker deterministically", () => {
  assert.equal(modelUpdateSource.includes('.replace("%", "")'), false);
  assert.match(modelUpdateSource, /\.replaceAll\("%",\s*""\)/);
});
