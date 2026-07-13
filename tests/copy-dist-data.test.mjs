import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const distDataFiles = ["model-rankings.json", "model-support.json"];

test("copy-dist-data mirrors published data files", async () => {
  await import(`../scripts/copy-dist-data.mjs?coverage=${Date.now()}`);

  await Promise.all(
    distDataFiles.map(async (dataFileName) => {
      const sourceData = await readFile(`data/${dataFileName}`, "utf8");
      const distData = await readFile(`dist/${dataFileName}`, "utf8");

      assert.equal(distData, sourceData);
    }),
  );
});
