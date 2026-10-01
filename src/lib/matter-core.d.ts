import type { Receipt } from './proof-core';
export const MATTER_SCHEMA: 'dagit-matter/v1';
export const EVIDENCE_PACK_SCHEMA: 'dagit-evidence-pack/v1';
export type MatterRecord = { schema: 'dagit-matter/v1'; matterReference: string; documentRole: string; signingProvider: string; signingReference: string; preSignProof: Receipt };
export function createMatterRecord(value: { matterReference: string; documentRole: string; signingProvider?: string; signingReference?: string; preSignProof: Receipt }): MatterRecord;
export function matterRecordIsValid(value: unknown): value is MatterRecord;
export function createEvidencePack(value: { matter: MatterRecord; finalProof: Receipt; auditCertificate?: { digest: string; byteLength: number } }): unknown;
