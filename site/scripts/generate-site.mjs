import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSite as generateBaseSite } from './generate-site-base.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const generatedIndexPath = path.join(siteRoot, 'index.html');
const generatedModelsPath = path.join(siteRoot, 'models');

const externalStylesheetPattern =
  /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https?:\/\/)[^>]*>\s*/gi;
const externalPreconnectPattern =
  /<link\b(?=[^>]*\brel=["']preconnect["'])(?=[^>]*\bhref=["']https?:\/\/)[^>]*>\s*/gi;

function removeExternalStyleLinks(html) {
  return html
    .replace(externalStylesheetPattern, '')
    .replace(externalPreconnectPattern, '');
}

async function sanitizeGeneratedHtml(filePath) {
  const before = await readFile(filePath, 'utf8');
  const after = removeExternalStyleLinks(before);
  if (after !== before) {
    await writeFile(filePath, after, 'utf8');
  }
}

async function sanitizeGeneratedSite() {
  await sanitizeGeneratedHtml(generatedIndexPath);
  const modelDirectories = await readdir(generatedModelsPath, {
    withFileTypes: true,
  });
  for (const entry of modelDirectories) {
    if (!entry.isDirectory()) continue;
    await sanitizeGeneratedHtml(
      path.join(generatedModelsPath, entry.name, 'index.html'),
    );
  }
}

export async function generateSite(options = {}) {
  // Remove the tracked template symlink before the base generator writes the
  // materialized homepage. Removing the symlink never mutates its target.
  await rm(generatedIndexPath, { force: true });
  const result = await generateBaseSite(options);
  await sanitizeGeneratedSite();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const writeManifest = process.argv.includes('--write-manifest');

  generateSite({ writeManifest })
    .then(() => {
      process.stdout.write('Generated crawlable site sources.\n');
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
