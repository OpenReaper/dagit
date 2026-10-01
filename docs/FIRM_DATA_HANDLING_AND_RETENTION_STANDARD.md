# DAGIT firm data handling and retention standard

**Owner:** Firm data/retention owner

**Status:** Operational baseline. Each firm must approve its own retention schedule, legal-hold process, and access list before storing workspace metadata.

## Purpose

This standard keeps DAGIT in its intended role: a private file-version integrity layer around the firm’s existing document, case-management, identity, and signing systems.

## System of record

| Record | System that owns it |
| --- | --- |
| Original document and final executed document | Firm document/case-management system |
| Client identity, authority and advice | Firm’s normal client and matter systems |
| Signing ceremony and signing audit certificate | Firm’s chosen signing provider |
| Wallet keys and approval authority | Firm-controlled self-custody wallet process |
| File fingerprint, proof receipt, linked transaction/block and limited workspace audit data | DAGIT |

## Data that must never be entered into DAGIT

- original files or file contents;
- filenames, document titles, client names, addresses, identity documents, financial data, special-category personal data, passwords, or signing-provider credentials;
- private keys, seed phrases, recovery codes, API tokens, or authentication secrets; and
- a substantive matter description when a non-sensitive internal alias will do.

## Required roles

Each firm must name:

- two firm administrators;
- an identity-provider owner;
- a data/retention owner;
- a wallet-control owner; and
- an incident contact.

The firm grants access on least privilege. Matter access is limited to the staff assigned to that matter. No person receives access to all matters merely because they administer the platform, unless the firm makes and records a specific compliance decision.

## Access lifecycle

1. Authorise staff through the firm’s identity provider and protected workspace route.
2. Grant a DAGIT role and matter access only when it is needed.
3. Review membership and active matter access at least every [period to be approved].
4. On a role change, remove unnecessary matter access promptly.
5. On a departure or suspected compromise, disable identity-provider access first, revoke DAGIT membership and matter access, preserve audit evidence, and review affected matters.

## Retention schedule

Before operational use, the firm must complete and approve:

| Data | Retention period | Deletion owner | Legal hold handling |
| --- | --- | --- | --- |
| Active matter proof metadata | [approved period] | [role] | [process] |
| Closed matter proof metadata | [approved period] | [role] | [process] |
| Audit events | [approved period] | [role] | [process] |
| Evidence-pack exports in firm systems | [approved period] | [role] | [process] |

Deletion applies to off-chain workspace metadata. A public blockchain anchor cannot generally be altered or deleted. If a matter is under legal hold, do not delete relevant off-chain records until the hold is released by the authorised owner.

## Evidence pack procedure

1. Export the proof receipts and associated chain information.
2. Place the pack with the signing-provider audit record in the firm’s authoritative matter system.
3. Record the export in the matter activity history.
4. Do not alter the exported technical receipt. If a new version is required, create a new proof and preserve the earlier evidence.

## Monthly control check

- Confirm protected workspace access is limited to approved staff.
- Confirm former staff are disabled and removed.
- Review failed-access and administrative events.
- Test a non-sensitive file match and changed-file failure.
- Confirm the firm can export a sample evidence pack.
- Check the retention schedule and any legal holds.

## Records of approval

Keep the approved access list, retention schedule, legal-hold decisions, and monthly check evidence in the firm’s normal governance system, not in an individual’s email or wallet notes.
