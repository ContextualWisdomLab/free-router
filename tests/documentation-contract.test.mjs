import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

test("contextual-orchestrator pairing stays release-bound and fail-closed", () => {
  const guide = readRepositoryFile("docs/contextual-orchestrator.md");

  assert.match(guide, /Status: Proposed/);
  assert.match(guide, /released API, client, and schema/);
  assert.match(guide, /sole production authority for provider discovery, capability verification, routing, and fallback/);
  assert.match(guide, /`orchestrator\/free`/);
  assert.match(guide, /gateway token only/);
  assert.match(guide, /no immutable, license-accepted contextual-orchestrator release/i);
  assert.doesNotMatch(guide, /git\+https:/);
  assert.doesNotMatch(guide, /NVIDIA_(?:NIM_)?API_KEY|OPENROUTER_API_KEY|BYTEZ_API_KEY|OPENAI_API_KEY/);
  assert.doesNotMatch(guide, /retain their existing independent GitHub Models credential/i);
});

test("public READMEs distinguish upstream package provenance from this fork", () => {
  const english = readRepositoryFile("README.md");
  const korean = readRepositoryFile("README.ko.md");

  assert.match(english, /@bytonylee\/free-router is the upstream npm distribution/);
  assert.match(english, /not evidence of a ContextualWisdomLab release/);
  assert.match(korean, /@bytonylee\/free-router.*upstream npm 배포본/);
  assert.match(korean, /ContextualWisdomLab release의 증거가 아닙니다/);
  assert.match(english, /github\.com\/ContextualWisdomLab\/free-router\/actions\/workflows\/ci\.yml/);
  assert.match(korean, /github\.com\/ContextualWisdomLab\/free-router\/actions\/workflows\/ci\.yml/);
  assert.doesNotMatch(english, /github\.com\/bytonylee\/free-router\/actions\/workflows\/ci\.yml/);
  assert.doesNotMatch(korean, /github\.com\/bytonylee\/free-router\/actions\/workflows\/ci\.yml/);
});
