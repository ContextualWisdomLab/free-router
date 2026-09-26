import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dependabotSource = await readFile(
  new URL('../.github/dependabot.yml', import.meta.url),
  'utf8',
);

function dependabotUpdateBlocks(source) {
  return source
    .split(/\n(?=  - package-ecosystem:)/)
    .filter((block) => /^  - package-ecosystem:/m.test(block));
}

test('Dependabot opens every routine update against dev', () => {
  const updateBlocks = dependabotUpdateBlocks(dependabotSource);
  assert.ok(updateBlocks.length > 0, 'expected at least one Dependabot update block');

  for (const block of updateBlocks) {
    const ecosystem = block.match(/^  - package-ecosystem:\s*(\S+)\s*$/m)?.[1] ?? 'unknown';
    assert.match(
      block,
      /^    target-branch:\s*dev\s*$/m,
      `${ecosystem} updates must target the protected development branch`,
    );
  }
});
