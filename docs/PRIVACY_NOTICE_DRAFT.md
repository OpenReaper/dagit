# DAGIT privacy notice — draft for legal review

**Status:** Draft only. This is a review package, not an effective public privacy notice. Product owner and privacy counsel must complete the bracketed fields, approve the text, assign an effective date, and publish it at a stable public URL before production use by clients.

**Controller / provider:** [legal entity name, registration details, address and contact email]

**Effective date:** [to be approved]

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

The legal bases, processor details, transfer mechanism, retention periods, and rights-contact route must be completed by privacy counsel for each launched service model and jurisdiction.

## Public blockchain records

An approved anchor creates a public blockchain transaction. It can expose the proof fingerprint, associated commitment, wallet address, transaction identifier, block information, and timestamp. These data can be copied by others and may remain available indefinitely. A fingerprint is not intended to reveal a readable document, but it can confirm that a person who has a candidate file possesses the same byte sequence.

Users must not place personal data, client names, passwords, confidential text, or other sensitive material directly in a matter alias, receipt label, transaction memo, or any other public or shared field.

## Firm workspaces

The firm workspace is a metadata service, not a document repository or e-signature provider. It is intended to hold only the minimum account, matter-alias, proof-receipt, and audit information necessary for the workflow. The firm remains responsible for its own client relationship, case system, document retention, signing provider, and legal obligations.

## Optional analytics

On the public DAGIT pages, a visitor may choose to allow anonymous product-use analytics. The public interface does not load the analytics container until that choice is made. The events measure broad actions such as beginning a proof, completing a local fingerprint, recording a proof, creating a receipt, or matching a file during verification. DAGIT does not intentionally include selected-file data, filenames, hashes, receipts, wallet addresses, email addresses, matter aliases, signing references, or document metadata in those events.

Analytics does not run in the protected firm workspace. Firm operational records and access logs are governed by the firm-workspace service arrangement rather than public-site marketing analytics.

## Retention and deletion

The provider must set and publish its service retention schedule before storing firm workspace metadata. A firm must configure its own approved matter retention and legal-hold process. Requests to delete off-chain account or workspace metadata will be assessed under the applicable law and contract. Public blockchain entries cannot generally be deleted or altered.

## Security

DAGIT uses local browser hashing, self-custody wallet approval, access controls for protected firm routes, and server-side checks for authorised workspace requests. No system can promise absolute security. Users must keep their wallet and account credentials secure and promptly report suspected compromise.

## Changes and contact

Before publication, complete:

- privacy contact: [email/address];
- data protection officer or representative, where required: [details];
- list of hosting, identity, blockchain, and support subprocessors: [details];
- cross-border transfer information: [details];
- rights request method and complaints authority: [details]; and
- version history and material-change notice process: [details].
