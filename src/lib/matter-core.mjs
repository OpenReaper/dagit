import { receiptIsValid } from './proof-core.mjs';

export const MATTER_SCHEMA = 'dagit-matter/v1';
export const EVIDENCE_PACK_SCHEMA = 'dagit-evidence-pack/v1';

function oneLine(value, field, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${field} is required.`);
  if (text.length > 160 || /[\r\n]/.test(text)) throw new Error(`${field} must be one line and 160 characters or fewer.`);
  return text;
}

function proofSummary(receipt) {
  if (!receiptIsValid(receipt) || !receipt.chain) throw new Error('Use an anchored, valid DAGIT proof.');
  return receipt;
}

export function createMatterRecord({ matterReference, documentRole, signingProvider, signingReference, preSignProof }) {
  return {
    schema: MATTER_SCHEMA,
    matterReference: oneLine(matterReference, 'Matter reference', true),
    documentRole: oneLine(documentRole, 'Document role', true),
    signingProvider: oneLine(signingProvider, 'Signing provider'),
    signingReference: oneLine(signingReference, 'Signing reference'),
    preSignProof: proofSummary(preSignProof)
  };
}

export function matterRecordIsValid(record) {
  try {
    return record?.schema === MATTER_SCHEMA && Boolean(oneLine(record.matterReference, 'Matter reference', true)) && Boolean(oneLine(record.documentRole, 'Document role', true)) && receiptIsValid(record.preSignProof) && Boolean(record.preSignProof.chain);
  } catch { return false; }
}

export function createEvidencePack({ matter, finalProof, auditCertificate }) {
  if (!matterRecordIsValid(matter)) throw new Error('The firm matter record is not valid.');
  if (!receiptIsValid(finalProof) || !finalProof.chain) throw new Error('Use an anchored final proof.');
  const parent = finalProof.record?.parent;
  const pre = matter.preSignProof;
  if (parent?.digest !== pre.hashing.digest || parent?.manifestDigest !== pre.manifestDigest) throw new Error('The final proof must link to the recorded pre-sign version.');
  const certificate = auditCertificate ? {
    digest: String(auditCertificate.digest),
    byteLength: Number(auditCertificate.byteLength)
  } : null;
  return {
    schema: EVIDENCE_PACK_SCHEMA,
    createdAt: new Date().toISOString(),
    matter: {
      matterReference: matter.matterReference,
      documentRole: matter.documentRole,
      signingProvider: matter.signingProvider,
      signingReference: matter.signingReference
    },
    preSignProof: pre,
    finalProof,
    auditCertificate: certificate,
    limitation: 'DAGIT verifies that the selected file matches a recorded fingerprint. It does not establish identity, authority, consent, delivery, legal execution, or the truth of a document.'
  };
}
