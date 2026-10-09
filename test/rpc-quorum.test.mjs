import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const chainClient = fs.readFileSync(path.join(root, 'src/lib/chain.ts'), 'utf8');

test('the verification client has three approved quorum members and excludes known divergent endpoints', () => {
  for (const endpoint of ['https://rpc.macula.co.za/', 'https://rpc.blockdag.engineering/', 'https://rpc.capedag.com/']) assert.match(chainClient, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(chainClient, /rpc\.bdagscan\.com/);
  assert.doesNotMatch(chainClient, /rpc\.blockdag\.works/);
});
