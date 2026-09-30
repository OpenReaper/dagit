export const RECEIPT_SCHEMA: 'dagit-proof/v1';
export const HASH_ALGORITHM: 'sha-256';
export function normaliseDigest(digest: string): `0x${string}`;
export function digestBytes(bytes: Uint8Array): `0x${string}`;
export function canonicalManifest(value: { digest: string; byteLength: number }): string;
export function manifestDigest(value: { digest: string; byteLength: number }): `0x${string}`;
export function createUnsignedReceipt(value: { digest: string; byteLength: number }): { schema: 'dagit-proof/v1'; hashing: { algorithm: 'sha-256'; digest: `0x${string}`; byteLength: number }; manifestDigest: `0x${string}` };
export function verifyReceiptAgainstDigest(receipt: unknown, digest: string, byteLength: number): { ok: true; manifestDigest: `0x${string}` } | { ok: false; reason: string };
