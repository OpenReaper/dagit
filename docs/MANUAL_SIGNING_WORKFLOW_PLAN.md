# DAGIT manual signing workflow — build plan

## Objective

Deliver a client-facing document-confirmation workflow for law firms. DAGIT will prove that the client selected the same file version the firm recorded before the client continues through the firm's existing signing platform. DAGIT will not replace that provider or claim legal execution.

## Product boundary

**DAGIT does:** local file hashing, Chain 1404 proof anchoring paid in BDAG, portable proof receipt, client file confirmation, firm matter evidence, and an exportable evidence pack.

**The firm's signing platform does:** identity, authentication, signing ceremony, signature legality, signing status, completed agreement, and its audit certificate.

**Out of scope for this build:** document hosting, private-key custody, client wallets, a new token, or a live provider API integration. A future provider adapter may attach provider references and audit documents, but must not be presented as live until its account integration is configured and tested.

## User journeys

### 1. Firm records the version to send

1. Firm user creates a matter record with a private matter reference and document role.
2. DAGIT hashes the selected file locally and anchors its digest/manifest through the firm's Chain 1404 wallet.
3. DAGIT produces a receipt and client verification link/QR.
4. The firm sends the document through its normal signature platform and sends the DAGIT link with it.

### 2. Client checks before signing

1. Client opens the DAGIT link and selects the file they received.
2. DAGIT calculates the file hash locally and verifies it against the receipt and Chain 1404 quorum.
3. The result is plain: `This file matches the version recorded by the firm` or `This file does not match. Do not sign this version.`
4. On a match, DAGIT displays the firm-provided signing-platform destination/reference; it does not authenticate or sign for the client.

### 3. Firm closes the evidence record

1. Firm adds the signing-platform agreement/reference and its audit certificate or audit-certificate hash.
2. Firm selects the final signed PDF locally; DAGIT anchors a final-version proof linked privately to the pre-sign version.
3. DAGIT creates a matter evidence pack containing both receipts, transaction/block data, verification status, provider reference, and file hashes.

## Build slices

### Slice A — firm and matter model

- Add a protected firm workspace distinct from the public client verifier.
- Add local/private matter reference, document role, client verification link, provider name, and provider agreement/reference fields.
- Keep file bytes and file names out of Chain 1404 and public links.
- Define a storage boundary before persistence: initially browser-local draft state only; any server-backed matter records require firm authentication, tenant isolation, retention policy, and processor terms.

### Slice B — client confirmation page

- Replace the generic verifier result with a firm-branded pre-sign confirmation screen.
- Show exact status, proof date, registry, and the firm-supplied signing destination/reference only after a successful local match and chain quorum check.
- Add negative states: missing receipt, corrupt receipt, changed file, unavailable quorum, unanchored proof, and no signing destination.

### Slice C — evidence pack

- Generate a printable/downloadable evidence package from structured data, not a marketing certificate.
- Include receipt schema/version, file digest/length, manifest digest, Chain 1404 registry/transaction/block, quorum result, provider reference, final-version linkage, and explicit limitations.
- Never represent the package as legal advice, legal execution, proof of identity, proof of delivery, or proof of truth.

### Slice D — final signed version

- Let the firm create a final proof using the executed PDF and link it to the pre-sign receipt.
- Store the provider audit-certificate digest/reference in the private evidence record.
- Verify that an amended or different final PDF fails the original-file check and creates a distinct final-version proof.

### Slice E — production controls

- Add firm-only access protection, audit events, matter access boundaries, retention/export rules, and an incident/recovery path before storing any matter metadata centrally.
- Run browser verification on desktop and phone, privacy tests, receipt/version-link tests, final-proof local demo, and live Chain 1404 quorum.

## Acceptance criteria

The build is complete only when all are true:

1. A firm can create a pre-sign proof and share a client verification link without uploading the document.
2. A client can verify the exact received file on a phone and gets a clear pass/fail result.
3. A changed file fails local and receipt verification.
4. A firm can create and link a final signed-file proof, and export an evidence pack with both proof records.
5. The public client path requires no crypto wallet and makes no legal-signature claim.
6. Build, type-check, proof/privacy/unit tests, contract tests, local proof demonstration, and three-RPC quorum pass; the mobile client and firm paths are visually checked.

## Authority gates

- No live e-sign provider calls, user identity processing, or signing-platform credentials are needed for the manual-mode build.
- Do not activate central matter storage or provider integration without a configured firm tenant, access model, retention decision, and independently tested connection.
- No mainnet proof is created by tests; a firm wallet must explicitly approve each BDAG transaction.
