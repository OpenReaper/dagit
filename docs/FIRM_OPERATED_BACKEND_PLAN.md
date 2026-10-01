# DAGIT firm-operated backend plan

Status: proposed — not implemented or connected to a firm's identity system.  
Last reviewed: 2026-10-01

## What exists today

`/admin/matter` is protected by Cloudflare Access for `nic@macula.co.za`. It is a browser-local firm tool: it creates proof receipts and downloads a local matter record/evidence pack. It does **not** yet provide firm user accounts, tenant isolation, server-side matter records, staff permissions, retention, or an application audit trail.

Do not describe the present workspace as a firm case-management system.

## Target operating model

DAGIT remains the integrity layer around the firm's normal signing provider.

| System | Owns | Must not own |
| --- | --- | --- |
| DAGIT public verifier | Local file comparison and Chain 1404 proof check | Client identity, signing, files, case records |
| DAGIT firm backend | Minimal proof/matter metadata, permissions, activity ledger, evidence-pack export | Original documents, signing credentials, client passwords, private keys |
| Firm identity provider | Staff email identity, MFA, joiner/mover/leaver lifecycle, group membership | DAGIT case data |
| Firm signing provider | Signer identity, signing ceremony, execution and provider audit certificate | DAGIT wallet/proof registry |
| Firm case system | Original documents, client identity/authority evidence, substantive legal record | DAGIT authentication decisions |

## Authentication and access: staff use their firm email accounts

### Recommended identity pattern

Use the firm's existing **Google Workspace** or **Microsoft Entra ID** as the source of staff identity. Cloudflare Access is the front door; the DAGIT API independently verifies the signed Cloudflare Access JWT on every request, then checks DAGIT's own membership and matter permissions.

Do not use a generic Google login as the normal production control. It can prove control of an email address, but does not give the firm reliable staff lifecycle or group governance. One-time PIN can be retained only as an emergency break-glass method for named users, never as “all valid email addresses”.

### Access applications

Keep three boundaries separate:

| Route | Audience | Cloudflare Access policy | Application rule |
| --- | --- | --- | --- |
| `dagit.macula.co.za/verify/*` | Public clients | None | No account, no firm metadata returned |
| `firm.dagit.macula.co.za/*` | Firm staff | Named firm IdP group + MFA | Worker validates Access JWT and enforces tenant/matter role |
| `dagit.macula.co.za/admin/deploy/*` | Platform deployment authority | Named platform operators only | Never shares firm data or backend administration |

The current broad `/admin/*` policy must be split before the firm backend is launched. The firm workspace should live on the distinct `firm.` host so a policy change cannot accidentally widen deployment control.

### Roles

Cloudflare groups answer **who may reach the firm application**. DAGIT roles answer **what they may do after entry**.

| Role | Typical holder | Can do |
| --- | --- | --- |
| Firm administrator | Two nominated partners/operations owners | Manage firm membership and role assignments; export firm audit reports; no automatic access to every case |
| Matter manager | Responsible lawyer/paralegal | Create matter, add/remove matter members, create pre-sign/final proofs, export evidence pack |
| Matter contributor | Assigned legal staff | Create drafts/proofs for assigned matters; cannot alter membership or retention |
| Matter reader | Compliance/reviewer | Read assigned matter proof metadata and export packs; no create/finalise action |
| Platform operator | DAGIT operations | Operate availability and identity configuration; no routine access to a firm's matter metadata |

Every matter starts with its creator as Matter manager. There is no firm-wide “view all matters” role by default. A firm may designate a compliance group explicitly, and that elevation must generate an audit event.

## Backend design

### Runtime and data boundary

Use a Cloudflare Worker behind the firm Access application and a relational metadata store (Cloudflare D1 is the proposed first implementation). No R2 bucket, IPFS pinning, or document upload endpoint is part of this design.

The Worker must verify `Cf-Access-Jwt-Assertion` against Cloudflare's JWKS and require the expected issuer and application audience. It must never trust an email, firm ID, role, or matter ID supplied by the browser without independently looking up the authenticated member and checking the requested action.

Only store the minimum needed to operate DAGIT:

| Data class | Store? | Notes |
| --- | --- | --- |
| Original file, filename, MIME type, document contents | No | Never accepted by API or database |
| Wallet private key or signing-provider credential | No | Wallet stays self-custodied; signing provider stays external |
| Firm ID, immutable IdP subject, verified email, role | Yes | Needed for membership and audit; email is not the primary identity key |
| Matter reference | Yes, optional | The firm should use a non-sensitive internal alias where possible |
| Receipt/proof metadata, hashes, registry/transaction/block | Yes | Needed for shared team evidence and evidence packs |
| Provider name/reference, audit-certificate hash | Yes, optional | No provider API token or audit-document file |
| Append-only application audit event | Yes | Actor, action, timestamp, matter UUID, request ID, before/after data digests |

### Minimum data model

```
firms(id, legal_name, status, retention_policy_version, created_at)
members(id, firm_id, idp_subject, email, status, created_at, disabled_at)
firm_roles(member_id, role)
matters(id_random, firm_id, reference_alias, status, created_by, opened_at, closed_at)
matter_members(matter_id, member_id, role, granted_by, granted_at, revoked_at)
proofs(id_random, matter_id, stage, receipt_json, digest, manifest_digest, chain_tx, created_by, created_at)
evidence_packs(id_random, matter_id, final_proof_id, pack_digest, exported_by, exported_at)
audit_events(id_random, firm_id, matter_id_nullable, actor_member_id, action, occurred_at, request_id, previous_event_digest, event_digest)
```

Constraints: all primary/public IDs are random UUIDs or ULIDs; every matter query includes `firm_id`; role checks happen in the same transaction as state changes; receipt digest + manifest digest is unique within a matter/stage; state-changing requests require an idempotency key.

### API surface

```
GET  /v1/session                         authenticated user and firm memberships
GET  /v1/matters                         matters visible to that member only
POST /v1/matters                         create matter alias and member set
POST /v1/matters/:id/proofs/pre-sign     save already-anchored receipt metadata
POST /v1/matters/:id/proofs/final        save linked final receipt and audit hash
GET  /v1/matters/:id/evidence-pack       create/download structured evidence export
POST /v1/matters/:id/members             manager grants a scoped role
DELETE /v1/matters/:id/members/:memberId manager revokes access
GET  /v1/audit                           firm admin, scoped and paginated
```

The browser hashes files and asks the wallet to anchor as it does today. It submits only the completed receipt/proof metadata after the user approves the wallet transaction. The API must reject a receipt that is malformed, unanchored, not linked correctly, belongs to another firm, or does not pass Chain 1404 quorum verification.

## Firm operating process

### Firm onboarding (one-time)

1. Firm names two administrators, an identity-provider owner, a data/retention owner, and an incident contact.
2. Confirm the firm's verified email domain and choose Google Workspace or Entra ID.
3. Create firm IdP groups: `DAGIT-FIRM-ADMINS`, `DAGIT-MATTER-USERS`, and optionally `DAGIT-COMPLIANCE-READERS`.
4. Configure Cloudflare Access to allow only the selected group, require MFA, and use a short application session appropriate to the firm's policy.
5. Create the DAGIT firm tenant and map the two initial administrators by immutable IdP subject.
6. Test: staff login, non-member denial, MFA failure, user disablement in the IdP, matter permission denial, and audit-log export.
7. Approve the firm's retention/deletion schedule before any central metadata is stored.

### Every matter

1. Matter manager opens a matter using a non-sensitive reference alias and assigns only the required colleagues.
2. A contributor creates the pre-sign proof locally, approves the BDAG network fee in the firm wallet, and saves the anchored receipt to the matter.
3. The signing invitation is sent through the firm's normal provider, alongside the DAGIT client verifier link/QR.
4. The client checks the received file locally. DAGIT never receives their file or requires their wallet.
5. Once completed in the signing provider, a permitted staff member creates the linked final proof, stores the provider reference and optional audit-certificate hash, and exports the evidence pack to the firm's case system.
6. Matter manager closes the DAGIT matter. The backend preserves only the approved metadata for the approved retention term; the firm case system remains the authoritative document store.

### Leaver, incident, and recovery process

- Disable the user in the firm's IdP first; Access then blocks new sessions. Revoke their DAGIT membership and matter roles, recording both events.
- A suspected account compromise disables the member, expires/re-authenticates their Access session, reviews Access authentication logs and DAGIT audit events, and preserves the evidence pack/audit ledger.
- No single platform operator can grant themselves case access. Emergency access needs two-person approval, a time limit, and an immutable audit event; this is a build requirement, not a current capability.
- Export all firm data in structured JSON/CSV evidence before tenant offboarding; delete according to the approved retention policy and retain a deletion certificate/audit record.

## Security and release gates

Do not build this as a wider version of the current static `/admin` page. The following must pass before any firm matter metadata is centrally stored:

1. Firm selects its IdP, verified domain, two administrators, and retention policy.
2. Separate `firm.` Access application is live; no `Everyone`, `all valid emails`, or broad domain-only production rule exists.
3. Worker validates Access JWT signature, issuer, expiry, and audience; direct-origin/API requests fail closed.
4. Database migration has tenant constraints, member/matter authorization tests, idempotency, backup/recovery test, and an export/delete test.
5. API rejects document bytes, file names, provider credentials, client identity material, and unverified receipt data.
6. Audit events cover authentication-to-application, membership changes, matter access denials, proof creation/finalisation, evidence export, retention action, and emergency access.
7. Independent application-security and legal/privacy review approves the data minimisation, retention, firm terms, and jurisdictional use.
8. Pilot with one firm, two matters, a normal leaver, and a deliberate denied-access test before wider onboarding.

## Delivery sequence

| Phase | Outcome | Requires firm decision |
| --- | --- | --- |
| 0 — current | Protected browser-local tool | None |
| 1 — identity foundation | Firm IdP + Access groups/MFA + tenant bootstrap | IdP and verified email domain |
| 2 — secure backend | Worker, JWT validation, D1 schema/RLS-equivalent application checks, audit ledger | Retention policy and firm data authority |
| 3 — team workspace | Matter list, membership, shared proof metadata, export | Role matrix approval |
| 4 — pilot | Real team operation with measured failure/recovery paths | Pilot firm and non-sensitive matters |

## Decision required before implementation

1. Which system owns staff email identity: Google Workspace or Microsoft Entra ID?
2. What is the firm's verified email domain (or domains)?
3. Who are the two initial firm administrators?
4. Which roles may see all matters, if any?
5. What metadata retention period and deletion/legal-hold rules apply?
6. Should a matter reference be stored centrally, or must the firm use a non-sensitive alias only?

## Sources consulted

- Cloudflare Access policies: <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>
- Cloudflare identity providers: <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/>
- Cloudflare Access JWT validation: <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>
- Cloudflare Access audit logs: <https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/access-authentication-logs/>
- Current DAGIT workflow: `docs/MANUAL_SIGNING_WORKFLOW_PLAN.md`
