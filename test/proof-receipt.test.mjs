import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsignedReceipt, digestBytes, manifestDigest, portableProofFragment, receiptFromPortableFragment, verifyReceiptAgainstDigest } from '../src/lib/proof-core.mjs';

test('Proof Pack receipt binds exact bytes and a deliberately supplied version context without a file name', () => {
  const first = new TextEncoder().encode('DAGIT exact byte proof\n');
  const digest = digestBytes(first);
  const receipt = createUnsignedReceipt({ digest, byteLength: first.byteLength, record: { kind: 'original', label: 'Agreement — review copy' } });
  assert.equal(receipt.hashing.algorithm, 'sha-256');
  assert.equal(receipt.manifestDigest, manifestDigest({ digest, byteLength: first.byteLength, record: receipt.record }));
  assert.deepEqual(verifyReceiptAgainstDigest(receipt, digest, first.byteLength), { ok: true, manifestDigest: receipt.manifestDigest });
  assert.equal('fileName' in receipt, false);
  assert.equal('type' in receipt.hashing, false);
});

test('a private revision relationship is bound by the manifest but not published as a contract field', () => {
  const original = new TextEncoder().encode('original agreement');
  const parent = createUnsignedReceipt({ digest: digestBytes(original), byteLength: original.byteLength });
  const revised = new TextEncoder().encode('revised agreement');
  const receipt = createUnsignedReceipt({ digest: digestBytes(revised), byteLength: revised.byteLength, record: { kind: 'revision', parent: { digest: parent.hashing.digest, manifestDigest: parent.manifestDigest } } });
  assert.deepEqual(receipt.record.parent, { digest: parent.hashing.digest, manifestDigest: parent.manifestDigest });
  assert.equal(verifyReceiptAgainstDigest(receipt, receipt.hashing.digest, receipt.hashing.byteLength).ok, true);
});

test('a portable QR fragment round-trips a receipt without a hosted proof record', () => {
  const bytes = new TextEncoder().encode('portable proof');
  const receipt = createUnsignedReceipt({ digest: digestBytes(bytes), byteLength: bytes.byteLength });
  const recovered = receiptFromPortableFragment(`#${portableProofFragment(receipt)}`);
  assert.deepEqual(recovered, receipt);
});

test('a one-byte modification fails receipt verification', () => {
  const original = new TextEncoder().encode('unchanged evidence');
  const receipt = createUnsignedReceipt({ digest: digestBytes(original), byteLength: original.byteLength });
  const changed = new TextEncoder().encode('unchanged evidencE');
  assert.equal(verifyReceiptAgainstDigest(receipt, digestBytes(changed), changed.byteLength).ok, false);
});
