import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsignedReceipt, digestBytes, manifestDigest, verifyReceiptAgainstDigest } from '../src/lib/proof-core.mjs';

test('DAGIT receipt binds an exact byte sequence without recording a file name', () => {
  const first = new TextEncoder().encode('DAGIT exact byte proof\n');
  const digest = digestBytes(first);
  const receipt = createUnsignedReceipt({ digest, byteLength: first.byteLength });
  assert.equal(receipt.hashing.algorithm, 'sha-256');
  assert.equal(receipt.manifestDigest, manifestDigest({ digest, byteLength: first.byteLength }));
  assert.deepEqual(verifyReceiptAgainstDigest(receipt, digest, first.byteLength), { ok: true, manifestDigest: receipt.manifestDigest });
  assert.equal('fileName' in receipt, false);
});

test('a one-byte modification fails receipt verification', () => {
  const original = new TextEncoder().encode('unchanged evidence');
  const receipt = createUnsignedReceipt({ digest: digestBytes(original), byteLength: original.byteLength });
  const changed = new TextEncoder().encode('unchanged evidencE');
  assert.equal(verifyReceiptAgainstDigest(receipt, digestBytes(changed), changed.byteLength).ok, false);
});
