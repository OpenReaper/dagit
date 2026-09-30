import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { keccak256, stringToHex } from 'viem';

export const RECEIPT_SCHEMA = 'dagit-proof/v1';
export const HASH_ALGORITHM = 'sha-256';

export function normaliseDigest(digest) {
  const value = digest.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('A SHA-256 digest must be 32 bytes encoded as hex.');
  return `0x${value}`;
}

export function digestBytes(bytes) {
  return `0x${bytesToHex(sha256(bytes))}`;
}

export function canonicalManifest({ digest, byteLength }) {
  const normalisedDigest = normaliseDigest(digest);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error('byteLength must be a non-negative safe integer.');
  // Deliberately excludes file name, type, EXIF, and contents.
  return `${RECEIPT_SCHEMA}\n${HASH_ALGORITHM}\n${normalisedDigest}\n${byteLength}`;
}

export function manifestDigest(manifest) {
  return keccak256(stringToHex(canonicalManifest(manifest)));
}

export function createUnsignedReceipt({ digest, byteLength }) {
  const normalisedDigest = normaliseDigest(digest);
  return {
    schema: RECEIPT_SCHEMA,
    hashing: { algorithm: HASH_ALGORITHM, digest: normalisedDigest, byteLength },
    manifestDigest: manifestDigest({ digest: normalisedDigest, byteLength })
  };
}

export function verifyReceiptAgainstDigest(receipt, digest, byteLength) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.hashing?.algorithm !== HASH_ALGORITHM) return { ok: false, reason: 'Unsupported receipt schema.' };
  const localDigest = normaliseDigest(digest);
  if (receipt.hashing.digest !== localDigest) return { ok: false, reason: 'The selected file has a different digest.' };
  if (receipt.hashing.byteLength !== byteLength) return { ok: false, reason: 'The selected file has a different byte length.' };
  const expectedManifestDigest = manifestDigest({ digest: localDigest, byteLength });
  if (receipt.manifestDigest !== expectedManifestDigest) return { ok: false, reason: 'The receipt manifest does not bind this exact file.' };
  return { ok: true, manifestDigest: expectedManifestDigest };
}
