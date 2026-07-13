import { copyFile, mkdir } from "node:fs/promises";

const distDataFiles = ["model-rankings.json", "model-support.json"];

await mkdir("dist", { recursive: true });
await Promise.all(
  distDataFiles.map((dataFileName) =>
    copyFile(`data/${dataFileName}`, `dist/${dataFileName}`),
  ),
);
