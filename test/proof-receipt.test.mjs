import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsignedReceipt, digestBytes, manifestDigest, portableProofFragment, receiptFromPortableFragment, receiptIsValid, verifyReceiptAgainstDigest } from '../src/lib/proof-core.mjs';
import { createEvidencePack, createMatterRecord, matterRecordIsValid } from '../src/lib/matter-core.mjs';

test('Proof Pack receipt binds exact bytes and a deliberately supplied version context without a file name', () => {
  const first = new TextEncoder().encode('DAGIT exact byte proof\n');
  const digest = digestBytes(first);
  const receipt = createUnsignedReceipt({ digest, byteLength: first.byteLength, record: { kind: 'original', label: 'Agreement — review copy' } });
  assert.equal(receipt.hashing.algorithm, 'sha-256');
  assert.equal(receipt.manifestDigest, manifestDigest({ digest, byteLength: first.byteLength, record: receipt.record, workflow: receipt.workflow }));
  assert.deepEqual(verifyReceiptAgainstDigest(receipt, digest, first.byteLength), { ok: true, manifestDigest: receipt.manifestDigest });
  assert.equal('fileName' in receipt, false);
  assert.equal('type' in receipt.hashing, false);
});

test('signing workflow details are bound in a v3 receipt without file metadata', () => {
  const bytes = new TextEncoder().encode('same private version');
  const receipt = createUnsignedReceipt({ digest: digestBytes(bytes), byteLength: bytes.byteLength, workflow: { documentRole: 'Agreement', signingProvider: 'ExampleSign', signingReference: 'ES-42' } });
  assert.equal(receiptIsValid(receipt), true);
  assert.equal(receipt.workflow.signingProvider, 'ExampleSign');
  const altered = { ...receipt, workflow: { ...receipt.workflow, signingReference: 'ES-43' } };
  assert.equal(receiptIsValid(altered), false);
  assert.equal('fileName' in receipt, false);
});

test('evidence pack requires a final proof linked to the pre-sign proof', () => {
  const preBytes = new TextEncoder().encode('pre-sign');
  const pre = { ...createUnsignedReceipt({ digest: digestBytes(preBytes), byteLength: preBytes.byteLength }), chain: { chainId: 1404, registry: '0x1111111111111111111111111111111111111111', transactionHash: '0x' + '2'.repeat(64), blockNumber: '1', blockHash: '0x' + '3'.repeat(64), registrant: '0x2222222222222222222222222222222222222222', confirmations: 1 } };
  const matter = createMatterRecord({ matterReference: 'FIRM-001', documentRole: 'Agreement', signingProvider: 'ExampleSign', signingReference: 'ES-42', preSignProof: pre });
  assert.equal(matterRecordIsValid(matter), true);
  const finalBytes = new TextEncoder().encode('signed final');
  const final = { ...createUnsignedReceipt({ digest: digestBytes(finalBytes), byteLength: finalBytes.byteLength, record: { kind: 'final', parent: { digest: pre.hashing.digest, manifestDigest: pre.manifestDigest } } }), chain: { ...pre.chain, transactionHash: '0x' + '4'.repeat(64) } };
  const pack = createEvidencePack({ matter, finalProof: final, auditCertificate: { digest: digestBytes(new TextEncoder().encode('audit')), byteLength: 5 } });
  assert.equal(pack.preSignProof.manifestDigest, pre.manifestDigest);
  assert.equal(pack.finalProof.record.parent.manifestDigest, pre.manifestDigest);
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
