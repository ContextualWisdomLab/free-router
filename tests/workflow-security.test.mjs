import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";


function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}


function jobBlock(workflow, jobName) {
  const marker = `\n  ${jobName}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `missing ${jobName} job`);
  const remainder = workflow.slice(start + marker.length);
  const nextJob = /\n  \S[^\n]*:\n/.exec(remainder);
  const end = nextJob ? start + marker.length + nextJob.index : workflow.length;
  return workflow.slice(start, end);
}


test("workflow write permissions are limited to the jobs that need them", () => {
  const release = readRepositoryFile(".github/workflows/release.yml");
  const modelSync = readRepositoryFile(".github/workflows/model-catalog-sync.yml");

  assert.match(release, /^permissions:\n  contents: read$/m);
  assert.match(jobBlock(release, "publish-cli"), /^    permissions:\n      contents: write$/m);
  assert.match(jobBlock(release, "release-site"), /^    permissions:\n      contents: write$/m);

  assert.match(modelSync, /^permissions:\n  contents: read$/m);
  assert.match(
    jobBlock(modelSync, "sync"),
    /^    permissions:\n      contents: write\n      pull-requests: write$/m,
  );
});


test("the repository publishes a private vulnerability reporting policy", () => {
  const policy = readRepositoryFile("SECURITY.md");

  assert.match(policy, /security\/advisories\/new/);
  assert.match(policy, /Do not open a public issue/i);
  assert.match(policy, /Supported Versions/);
});
