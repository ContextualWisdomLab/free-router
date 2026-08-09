import assert from "node:assert/strict";
import test from "node:test";

import { viteCommandForPlatform } from "../site/scripts/process-command.mjs";

test("vite command invokes npx directly without a shell on POSIX", () => {
  assert.deepEqual(viteCommandForPlatform("linux"), {
    command: "npx",
    args: ["vite", "build"],
    shell: false,
  });
});

test("vite command uses the Windows shim directly without enabling a shell", () => {
  assert.deepEqual(viteCommandForPlatform("win32"), {
    command: "npx.cmd",
    args: ["vite", "build"],
    shell: false,
  });
});
