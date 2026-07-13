import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";


function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
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


function runBlocks(workflow) {
  return Array.from(
    workflow.matchAll(/\n\s+run:\s+\|\n(?:(?:\s{10,}|\s{8,}).*\n?)+/g),
    (match) => match[0],
  );
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


test("release workflow treats tag names as data behind protected release gates", () => {
  const release = readRepositoryFile(".github/workflows/release.yml");

  for (const block of runBlocks(release)) {
    assert.doesNotMatch(block, /\$\{\{\s*github\.ref_name\s*\}\}/);
  }

  assert.match(release, /REF_PROTECTED: \$\{\{ github\.ref_protected \}\}/);
  assert.match(release, /Release tags must be protected by repository rulesets/);
  assert.match(jobBlock(release, "publish-cli"), /environment:\n      name: npm-release/);
  assert.match(jobBlock(release, "release-site"), /environment:\n      name: site-release/);
  assert.match(release, /\bRELEASE_TAG\b/);
  assert.doesNotMatch(release, /gh release create "\$\{\{\s*github\.ref_name\s*\}\}"/);
});


test("model catalog sync does not expose secrets to manually selected refs", () => {
  const modelSync = readRepositoryFile(".github/workflows/model-catalog-sync.yml");

  assert.doesNotMatch(modelSync, /workflow_dispatch:/);
  assert.match(jobBlock(modelSync, "sync"), /if: github\.event_name == 'schedule'/);
  assert.match(
    modelSync,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
});


test("the repository publishes a private vulnerability reporting policy", () => {
  const policy = readRepositoryFile("SECURITY.md");

  assert.match(policy, /security\/advisories\/new/);
  assert.match(policy, /Do not open a public issue/i);
  assert.match(policy, /Supported Versions/);
});
