# DAGIT security and incident response standard

**Status:** Operational baseline. This document complements, and does not replace, the firm’s own information-security and incident-response policies.

## Security model

- Files are hashed and checked locally in the browser; they are not intentionally uploaded to DAGIT.
- Proof anchors require an explicit approval from a self-custody wallet.
- Firm workspace access uses the firm email identity path protected by Cloudflare Access.
- The firm workspace stores limited account, matter-alias, proof-receipt, and activity information; it is not a document store.
- The on-chain registry is public. Treat wallet addresses, transaction IDs, timestamps, and proof commitments as public information.

## Mandatory controls

1. Use the firm’s managed identity provider and multi-factor authentication for staff access.
2. Permit only named, authorised staff through the protected workspace route.
3. Separate wallet custody/transaction approval from ordinary workspace access where the firm’s policy requires it.
4. Keep private keys, seed phrases, access tokens, passwords, and signing-provider credentials out of DAGIT and out of proof receipts.
5. Use non-sensitive matter aliases.
6. Apply updates, browser security settings, and endpoint protection under the firm’s normal IT controls.
7. Review access and audit events regularly and after every material access change.

## Incident procedure

### 1. Contain

- For a staff-account concern, disable the identity-provider account and revoke workspace access.
- For a wallet concern, stop using the wallet for new proofs and follow the firm wallet-control procedure. DAGIT cannot recover or revoke an on-chain wallet.
- For a suspected file/receipt mismatch, stop the signing workflow and preserve the original receipt and available files.

### 2. Preserve evidence

- Keep proof receipts, transaction IDs, block references, signing-provider references, relevant workspace activity, and the time of discovery.
- Do not overwrite a receipt or replace an existing final proof. Create a new record for any later version.
- Record who took containment actions and when.

### 3. Assess

- Identify affected matter aliases, users, wallet addresses, proof transactions, and off-chain metadata.
- Determine whether the event concerns identity access, a wallet, a file-version mismatch, a signing-provider process, or service availability.
- Engage the firm’s legal, privacy, security, and client-notification owners where required.

### 4. Recover

- Restore authorised access only after the identity owner approves it.
- Use a new controlled wallet if the firm wallet process requires rotation.
- Reissue a proof only for the intended file version; do not represent the replacement as the original proof.
- Record remedial action, affected records, and follow-up controls.

## Service support boundary

DAGIT operations can investigate availability and product-security events in the service boundary. They cannot retrieve a file, reconstruct a wallet, authenticate a signer, access a firm’s signing-provider account, or determine a document’s legal effect.

## Test cadence

At least annually, and after a material workflow change, test: staff disablement, unauthorised matter access denial, a changed-file verification failure, evidence-pack preservation, wallet-incident escalation, and recovery of authorised staff access.
