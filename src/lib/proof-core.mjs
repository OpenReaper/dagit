import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { keccak256, stringToHex, verifyTypedData } from 'viem';

export const RECEIPT_SCHEMA = 'dagit-proof/v3';
export const PREVIOUS_RECEIPT_SCHEMA = 'dagit-proof/v2';
export const LEGACY_RECEIPT_SCHEMA = 'dagit-proof/v1';
export const HASH_ALGORITHM = 'sha-256';
export const RECORD_KINDS = ['original', 'revision', 'final', 'evidence'];
const MAX_PORTABLE_RECEIPT_BYTES = 12_000;

export function normaliseDigest(digest) {
  const value = String(digest).toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('A SHA-256 digest must be 32 bytes encoded as hex.');
  return `0x${value}`;
}

function normaliseAddress(address) {
  const value = String(address).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(value)) throw new Error('A wallet address must be a 20-byte hex address.');
  return value;
}

function normaliseLabel(label) {
  if (label === undefined || label === null || label === '') return '';
  const value = String(label).trim();
  if (value.length > 120 || /[\r\n]/.test(value)) throw new Error('A proof label must be one line and 120 characters or fewer.');
  return value;
}

function normaliseRecord(record = {}) {
  const kind = record.kind ?? 'original';
  if (!RECORD_KINDS.includes(kind)) throw new Error('Choose an available proof type.');
  const label = normaliseLabel(record.label);
  if (!record.parent) return { kind, label, parent: null };
  const parent = { digest: normaliseDigest(record.parent.digest), manifestDigest: normaliseDigest(record.parent.manifestDigest) };
  if (kind === 'original') throw new Error('An original proof cannot have a previous version.');
  return { kind, label, parent };
}

function normaliseWorkflow(workflow = {}) {
  const normaliseField = (value, name) => {
    if (value === undefined || value === null || value === '') return '';
    const normalised = String(value).trim();
    if (normalised.length > 120 || /[\r\n]/.test(normalised)) throw new Error(`${name} must be one line and 120 characters or fewer.`);
    return normalised;
  };
  return {
    documentRole: normaliseField(workflow.documentRole, 'Document role'),
    signingProvider: normaliseField(workflow.signingProvider, 'Signing provider'),
    signingReference: normaliseField(workflow.signingReference, 'Signing reference')
  };
}

export function digestBytes(bytes) { return `0x${bytesToHex(sha256(bytes))}`; }

/** The exact string whose keccak hash is committed by the registry. */
export function canonicalManifest({ digest, byteLength, schema = RECEIPT_SCHEMA, record, workflow }) {
  const normalisedDigest = normaliseDigest(digest);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error('byteLength must be a non-negative safe integer.');
  if (schema === LEGACY_RECEIPT_SCHEMA) return `${LEGACY_RECEIPT_SCHEMA}\n${HASH_ALGORITHM}\n${normalisedDigest}\n${byteLength}`;
  if (schema === PREVIOUS_RECEIPT_SCHEMA) {
    const normalisedRecord = normaliseRecord(record);
    return [PREVIOUS_RECEIPT_SCHEMA, HASH_ALGORITHM, normalisedDigest, byteLength, normalisedRecord.kind, normalisedRecord.parent?.digest ?? '', normalisedRecord.parent?.manifestDigest ?? '', JSON.stringify(normalisedRecord.label)].join('\n');
  }
  if (schema !== RECEIPT_SCHEMA) throw new Error('Unsupported receipt schema.');
  const normalisedRecord = normaliseRecord(record);
  // Deliberately excludes file name, type, EXIF, and contents.
  const normalisedWorkflow = normaliseWorkflow(workflow);
  return [RECEIPT_SCHEMA, HASH_ALGORITHM, normalisedDigest, byteLength, normalisedRecord.kind, normalisedRecord.parent?.digest ?? '', normalisedRecord.parent?.manifestDigest ?? '', JSON.stringify(normalisedRecord.label), JSON.stringify(normalisedWorkflow)].join('\n');
}

export function manifestDigest(manifest) { return keccak256(stringToHex(canonicalManifest(manifest))); }

export function createUnsignedReceipt({ digest, byteLength, record, workflow }) {
  const normalisedDigest = normaliseDigest(digest);
  const normalisedRecord = normaliseRecord(record);
  const normalisedWorkflow = normaliseWorkflow(workflow);
  return { schema: RECEIPT_SCHEMA, hashing: { algorithm: HASH_ALGORITHM, digest: normalisedDigest, byteLength }, record: normalisedRecord, workflow: normalisedWorkflow, manifestDigest: manifestDigest({ digest: normalisedDigest, byteLength, record: normalisedRecord, workflow: normalisedWorkflow }) };
}

function receiptManifest(receipt) {
  if (!receipt || typeof receipt !== 'object' || !receipt.hashing || typeof receipt.hashing !== 'object') throw new Error('Unsupported receipt schema.');
  if (receipt.schema === LEGACY_RECEIPT_SCHEMA) return { digest: receipt.hashing.digest, byteLength: receipt.hashing.byteLength, schema: LEGACY_RECEIPT_SCHEMA };
  if (receipt.schema === PREVIOUS_RECEIPT_SCHEMA) return { digest: receipt.hashing.digest, byteLength: receipt.hashing.byteLength, schema: PREVIOUS_RECEIPT_SCHEMA, record: receipt.record };
  if (receipt.schema === RECEIPT_SCHEMA) return { digest: receipt.hashing.digest, byteLength: receipt.hashing.byteLength, schema: RECEIPT_SCHEMA, record: receipt.record, workflow: receipt.workflow };
  throw new Error('Unsupported receipt schema.');
}

export function verifyReceiptAgainstDigest(receipt, digest, byteLength) {
  try {
    if (!receipt || receipt.hashing?.algorithm !== HASH_ALGORITHM) return { ok: false, reason: 'Unsupported receipt schema.' };
    const localDigest = normaliseDigest(digest);
    if (normaliseDigest(receipt.hashing.digest) !== localDigest) return { ok: false, reason: 'The selected file has a different digest.' };
    if (receipt.hashing.byteLength !== byteLength) return { ok: false, reason: 'The selected file has a different byte length.' };
    const expectedManifestDigest = manifestDigest(receiptManifest(receipt));
    if (normaliseDigest(receipt.manifestDigest) !== expectedManifestDigest) return { ok: false, reason: 'The receipt manifest does not bind this exact file.' };
    return { ok: true, manifestDigest: expectedManifestDigest };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'The receipt is not valid.' }; }
}

export function receiptIsValid(receipt) {
  try { const manifest = receiptManifest(receipt); return receipt?.hashing?.algorithm === HASH_ALGORITHM && normaliseDigest(receipt.manifestDigest) === manifestDigest(manifest); } catch { return false; }
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value); let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8_192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_PORTABLE_RECEIPT_BYTES * 2) throw new Error('This proof link is not valid.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  if (binary.length > MAX_PORTABLE_RECEIPT_BYTES) throw new Error('This proof link is too large.');
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

/** Encodes a valid receipt only. URL fragments are never included in server requests. */
export function portableProofFragment(receipt) {
  if (!receiptIsValid(receipt)) throw new Error('Only a valid DAGIT receipt can be shared.');
  return `proof=${base64UrlEncode(JSON.stringify(receipt))}`;
}

export function receiptFromPortableFragment(fragment) {
  const value = String(fragment).replace(/^#/, '');
  if (!value.startsWith('proof=')) return null;
  try { const receipt = JSON.parse(base64UrlDecode(value.slice('proof='.length))); if (!receiptIsValid(receipt)) throw new Error('This proof receipt is not valid.'); return receipt; }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'This proof receipt is not valid.'); }
}

export function acknowledgementTypedData(receipt, signer, signedAt) {
  if (!receipt?.chain) throw new Error('Anchor the proof before asking for acknowledgement.');
  if (Number(receipt.chain.chainId) !== 1404) throw new Error('Wallet acknowledgement is available only for a Chain 1404 proof.');
  const verified = verifyReceiptAgainstDigest(receipt, receipt.hashing?.digest, receipt.hashing?.byteLength);
  if (!verified.ok) throw new Error('Only a valid receipt can be acknowledged.');
  const timestamp = String(signedAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)) throw new Error('Acknowledgement time is not valid.');
  const registry = normaliseAddress(receipt.chain.registry); const transactionHash = normaliseDigest(receipt.chain.transactionHash);
  return { domain: { name: 'DAGIT Proof Pack', version: '1', chainId: Number(receipt.chain.chainId), verifyingContract: registry }, types: { ProofAcknowledgement: [{ name: 'manifestDigest', type: 'bytes32' }, { name: 'transactionHash', type: 'bytes32' }, { name: 'signedAt', type: 'string' }] }, primaryType: 'ProofAcknowledgement', message: { manifestDigest: verified.manifestDigest, transactionHash, signedAt: timestamp }, signer: normaliseAddress(signer) };
}

export async function verifyReceiptAcknowledgement(receipt) {
  const acknowledgement = receipt?.acknowledgement;
  if (!acknowledgement) return { ok: false, reason: 'No wallet acknowledgement is attached.' };
  try { const typed = acknowledgementTypedData(receipt, acknowledgement.signer, acknowledgement.signedAt); const valid = await verifyTypedData({ ...typed, address: typed.signer, signature: acknowledgement.signature }); return valid ? { ok: true, signer: typed.signer } : { ok: false, reason: 'The wallet acknowledgement signature is not valid.' }; }
  catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'The wallet acknowledgement is not valid.' }; }
}
