import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('the local file hashing worker has no network transport or file-name persistence', () => {
  const worker = fs.readFileSync(path.join(root, 'src/hash-worker.ts'), 'utf8');
  assert.match(worker, /data\.file\.stream\(\)/);
  assert.doesNotMatch(worker, /fetch\(|XMLHttpRequest|WebSocket|FormData|\.name/);
});

test('the proof manifest deliberately excludes filename and content fields', () => {
  const core = fs.readFileSync(path.join(root, 'src/lib/proof-core.mjs'), 'utf8');
  assert.match(core, /Deliberately excludes file name, type, EXIF, and contents/);
  assert.doesNotMatch(core, /fileName|fileContent/);
});
