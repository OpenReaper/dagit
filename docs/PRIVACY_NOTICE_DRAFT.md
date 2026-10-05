# DAGIT privacy and data notice

**Status:** Published product notice
**Effective date:** 5 October 2026
**Service contact:** support@macula.co.za

DAGIT is presented by Macula. This notice describes the information handled by the current DAGIT product. It should be read with the service terms and is deliberately narrow because DAGIT is not a document repository or identity/signing service.

## The short version

DAGIT is designed so the file selected for a proof or verification remains on the user's device. DAGIT creates a cryptographic fingerprint in the browser. It does not intentionally upload or store the file, file name, file content, or file metadata.

When a user anchors a proof, a fingerprint and related proof commitment are written to the public BlockDAG Chain 1404 by the user's wallet. Public blockchain records are not realistically erasable. Do not use a fingerprint as a substitute for a document store and do not assume it can be deleted later.

## Information DAGIT processes

| Category | Purpose | Stored by DAGIT? |
| --- | --- | --- |
| Selected file bytes, file name, MIME type and file metadata | Local hashing or local comparison in the browser | No — not intentionally sent to or stored by DAGIT |
| File fingerprint, receipt/manifest commitment, transaction, block and wallet address | Produce and check the technical proof | Written to the public blockchain when the wallet owner approves an anchor; receipt may be retained by the user |
| Firm staff email address and immutable identity-provider subject | Authenticate authorised workspace staff and apply workspace permissions | Yes, in the firm metadata service where that workspace feature is enabled |
| Firm/matter alias, proof receipt metadata, action audit data and request identifiers | Operate the firm workspace, restrict access, create evidence records and investigate misuse | Yes, only to the minimum necessary extent |
| Browser, device and network information | Deliver and protect the service, diagnose faults and prevent abuse | Hosting and security providers may process this information; optional public-site analytics are loaded only after a visitor chooses to allow them. DAGIT application events exclude file and client data. |

## Why we process it

The provider processes the limited service information needed to:

- provide local proof and verification functions;
- process proof records chosen and approved by a wallet owner;
- authenticate authorised firm staff and enforce matter permissions;
- maintain security, audit activity, prevent misuse, and resolve technical incidents; and
- meet legal obligations that apply to the provider.

The current public product processes this limited information only to provide the requested proof or workspace function, keep the service secure, and respond to a support or rights request. Where a law gives a user additional privacy rights, requests can be sent to support@macula.co.za.

## Public blockchain records

An approved anchor creates a public blockchain transaction. It can expose the proof fingerprint, associated commitment, wallet address, transaction identifier, block information, and timestamp. These data can be copied by others and may remain available indefinitely. A fingerprint is not intended to reveal a readable document, but it can confirm that a person who has a candidate file possesses the same byte sequence.

Users must not place personal data, client names, passwords, confidential text, or other sensitive material directly in a matter alias, receipt label, transaction memo, or any other public or shared field.

## Firm workspaces

The firm workspace is a metadata service, not a document repository or e-signature provider. It is intended to hold only the minimum account, matter-alias, proof-receipt, and audit information necessary for the workflow. The firm remains responsible for its own client relationship, case system, document retention, signing provider, and legal obligations.

## Optional analytics

On the public DAGIT pages, a visitor may choose to allow anonymous product-use analytics. The public interface does not load the analytics container until that choice is made. The events measure broad actions such as beginning a proof, completing a local fingerprint, recording a proof, creating a receipt, or matching a file during verification. DAGIT does not intentionally include selected-file data, filenames, hashes, receipts, wallet addresses, email addresses, matter aliases, signing references, or document metadata in those events.

Analytics does not run in the protected firm workspace. Firm operational records and access logs are governed by the firm-workspace service arrangement rather than public-site marketing analytics.

## Retention and deletion

Selected files are not retained by DAGIT. Portable receipts remain with the person who saves them. Public blockchain anchors cannot generally be deleted or altered.

For the public wallet-owned workspace, DAGIT retains the organisation name, wallet address, workspace aliases, anchored proof-receipt metadata and operational audit records while the workspace remains active. A workspace owner may request deletion of its off-chain workspace metadata through support@macula.co.za. DAGIT will action a valid request within 30 days unless it needs limited information for security, fraud prevention, dispute handling, or a legal obligation. Deletion does not erase the public Chain 1404 transaction or a receipt another person holds.

The protected firm workflow is separate: the firm sets its own matter retention and legal-hold rules and remains responsible for its case and signing records.

## Security

DAGIT uses local browser hashing, self-custody wallet approval, access controls for protected firm routes, and server-side checks for authorised workspace requests. No system can promise absolute security. Users must keep their wallet and account credentials secure and promptly report suspected compromise.

## Providers and subprocessors

The current product uses the following provider categories:

| Provider | Purpose | Data boundary |
| --- | --- | --- |
| Vercel | Public web application hosting | Standard web request data; no selected file content is intentionally sent by DAGIT. |
| Cloudflare | DNS, edge security, protected workspace access and metadata Worker/D1 service | Request/security data and only the protected-workspace metadata described above. |
| Google Analytics and Google Tag Manager | Optional public product analytics, only after the visitor allows analytics | Zero-parameter product events; no files, filenames, hashes, receipts, wallets, emails or workspace identifiers. |
| Chain 1404 and user-selected wallet software | User-approved proof anchoring and verification | Public transaction and proof commitment data; DAGIT does not hold wallet keys. |

The product may update these providers as it changes. Material changes to this notice will be posted on the DAGIT service-notices page with an updated effective date.

## Contact

For privacy, deletion, security or support requests, email [support@macula.co.za](mailto:support@macula.co.za). Do not include a file, private key, password, seed phrase, identity document or other sensitive document content in an email request.
