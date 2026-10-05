# DAGIT release gates

## Verified implementation and deployment facts

- The registry compiles with pinned `solc 0.8.30`, optimizer enabled, and Paris EVM target.
- The local EVM test covers first registration, record retrieval, duplicate prevention, and zero-digest rejection.
- The local demonstration performs hash → local-chain registration → receipt creation → exact-byte verification.
- The browser flow handles self-custody wallet connection, local registration, portable receipt generation, local receipt verification, and changed-file rejection.
- The production UUPS proxy is `0xe878c8daae03cab17026d298e907547718893e31` on Chain 1404. It was verified through the configured public RPC quorum on 2026-10-01.
- The production proxy owner is the configured upgrade authority `0xEe104e82c5C999aD08ED657eB2dd1Bb2E94747e5`.
- The firm metadata backend validates the Cloudflare Access JWT for protected API calls and rejects document data, filenames, and signing-provider credentials.

## Not proven, not complete, and not claimed

- Independent audit, external penetration testing, and legal review are optional future assurance work; they are not launch gates for DAGIT.
- The policy documents in `docs/` are drafts for legal/privacy review and are not yet effective public terms or a privacy notice.
- DAGIT does not prove legal execution, identity, authority, consent, delivery, authorship, ownership, enforceability, or truth.
- A production signing-provider integration has not been configured. Firms continue to use their existing provider manually.
- The firm workspace is a limited proof-metadata service, not a document repository, e-signature service, or complete case-management system.
- No independent smart-contract security audit, external penetration test, backup/recovery test, or privacy/legal review has been completed for the current production configuration. This is disclosed as current assurance status, not a blocker to the product release.

## Required before broader firm onboarding

1. Approve and publish the terms, privacy notice, receipt wording, service limits, and a jurisdictional/sector use matrix.
2. Configure each firm’s managed identity provider, MFA, named administrators, tenant access rules, retention schedule, and legal-hold process.
3. Test onboarding, staff removal, denied cross-matter access, evidence export, deletion, backup/recovery, and incident escalation with non-sensitive pilot matters.
4. Publish verified service contacts, subprocessors, data-location/transfer information, support process, and change-notice procedure.
5. Re-run the Chain 1404 fixed-height comparison and document the confirmation/finality policy before any material contract upgrade or change to the verification quorum.
6. Re-verify the deployed origin after every release: CSP, no file bytes in network requests, wallet connect/add/switch/reject states, registration, receipt/QR, changed-file rejection, protected workspace access, and quorum-disagreement behaviour.

## Upgrade authority

- The registry is intentionally upgradeable by `0xEe104e82c5C999aD08ED657eB2dd1Bb2E94747e5`. Keep control of that wallet; its use is required only when an approved registry change is intentionally deployed. No additional operational control is required for ordinary proof creation or verification.
