import assert from "node:assert/strict";
import test from "node:test";

import {
  applyModelPingResult,
  assertModelMetricsInvariant,
  filterBySearch,
  filterByTier,
  findBestModel,
  getAvg,
  getUptime,
  getVerdict,
  sortModels,
  truncAnsiToWidth,
} from "../dist/lib/utils.js";

function model(overrides = {}) {
  return {
    id: "openrouter/test",
    displayName: "Test Model",
    context: 128000,
    providerKey: "openrouter",
    sweScore: null,
    tier: "A",
    aaBenchmarkScore: null,
    aaBenchmarkName: null,
    aaCodingIndex: null,
    aaIntelligence: null,
    aaSpeedTps: null,
    opencodeSupported: null,
    opencodeCompatibilityReason: null,
    pings: [],
    status: "pending",
    httpCode: null,
    ...overrides,
  };
}

test("model ping metrics treat successful and auth-challenged pings as reachable", () => {
  const candidate = model({
    pings: [
      { code: "200", ms: 240 },
      { code: "401", ms: 360 },
      { code: "500", ms: 50 },
    ],
    status: "up",
  });

  assert.equal(getAvg(candidate), 300);
  assert.equal(getUptime(candidate), 67);
  assert.match(getVerdict(candidate), /Perfect/);
});

test("model ping metrics update when old pings are evicted", () => {
  const candidate = model({ status: "up" });

  applyModelPingResult(candidate, { code: "200", ms: 900 }, 2);
  applyModelPingResult(candidate, { code: "429", ms: 100 }, 2);
  applyModelPingResult(candidate, { code: "401", ms: 300 }, 2);

  assert.deepEqual(candidate.pings, [
    { code: "429", ms: 100 },
    { code: "401", ms: 300 },
  ]);
  assert.equal(getAvg(candidate), 300);
  assert.equal(getUptime(candidate), 50);
  assert.deepEqual(assertModelMetricsInvariant(candidate), { ok: true });
});

test("model filters match tier and search text without mutating the source list", () => {
  const alpha = model({
    id: "nim/alpha",
    displayName: "Alpha",
    providerKey: "nim",
    tier: "S",
  });
  const beta = model({
    id: "openrouter/beta",
    displayName: "Beta",
    tier: "B",
  });
  const models = [alpha, beta];

  assert.deepEqual(filterByTier(models, "S"), [alpha]);
  assert.deepEqual(filterBySearch(models, "router/beta"), [beta]);
  assert.equal(filterByTier(models, "All"), models);
});

test("model priority prefers reachable high-tier models before faster lower-tier models", () => {
  const alpha = model({
    id: "nim/alpha",
    displayName: "Alpha",
    providerKey: "nim",
    tier: "S",
    pings: [{ code: "200", ms: 500 }],
    status: "up",
  });
  const beta = model({
    id: "openrouter/beta",
    displayName: "Beta",
    providerKey: "openrouter",
    tier: "B",
    pings: [{ code: "200", ms: 250 }],
    status: "up",
  });
  const pending = model({
    id: "openrouter/pending",
    displayName: "Pending",
    tier: "A",
    status: "pending",
  });

  assert.equal(findBestModel([pending, beta, alpha]), alpha);
  assert.deepEqual(sortModels([beta, pending, alpha], "priority").map((m) => m.id), [
    "nim/alpha",
    "openrouter/beta",
    "openrouter/pending",
  ]);
});

test("terminal width truncation preserves ANSI reset while limiting visible text", () => {
  assert.equal(
    truncAnsiToWidth("\x1b[32mfast\x1b[0m model", 4),
    "\x1b[32mfast\x1b[0m",
  );
});
