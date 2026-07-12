import { copyFile, mkdir } from "node:fs/promises";

const files = ["model-rankings.json", "model-support.json"];

await mkdir("dist", { recursive: true });
await Promise.all(files.map((file) => copyFile(`data/${file}`, `dist/${file}`)));
