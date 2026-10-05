# DAGIT multi-organisation workspace

Status: two deliberately separate paths — updated 2026-10-05.

## Choose the right organisation path

### Live self-service workspace

Any person or business can use the public **Register company** route now. The owner connects a self-custody wallet, signs a one-time activation message, and receives an active organisation with a general workspace. That owner can then create a project, matter, contractor, property, or personal workspace and save already-anchored DAGIT receipt metadata to it.

- There is no approval queue, email login, identity check, domain verification, billing step, or file upload.
- The wallet proves control of the workspace only. It does not prove a company, legal authority, domain ownership, or real-world identity.
- The live self-service model is a one-owner-wallet workspace. It is not a staff collaboration, verified-company, SSO, or employee-offboarding system.

### Future managed organisation workspace

The `/firm/api/v2` model described below is retained for a future multi-staff organisation product. It is not exposed through the public company registration journey and must not be described as active enterprise onboarding.

## Future managed-workspace foundation

The Worker now has an additive `/firm/api/v2` organisation/workspace API and `0002_organisation_workspaces.sql` migration. It leaves the current `/firm/api/v1` Chauncey Law pilot unchanged.

The v2 model is sector-neutral:

```
identity → organisation membership → workspace membership → proof metadata
```

- An **identity** is a verified Cloudflare Access subject/email.
- An **organisation** is a company, firm, contractor, property business, or other customer.
- A **workspace** is a context for proofs. Its type may be `general`, `legal`, `contractor`, `property`, or `personal`.
- A **proof** is an already-anchored DAGIT receipt. Documents, filenames, wallet keys, signing-provider credentials, and client identity documents are rejected.

## Implemented API controls

| Capability | Route | Control |
| --- | --- | --- |
| Platform organisation provisioning | `POST /firm/api/v2/platform/organisations` | Exact configured platform operator after Access JWT verification |
| Organisation session selection | `GET /firm/api/v2/session` | Lists only active memberships |
| Workspace create/list/delete | `/organisations/:id/workspaces` | Organisation membership plus workspace-manager rule |
| Save proof metadata | `POST .../workspaces/:id/proofs` | Contributor/manager and open workspace only |
| Invite creation/acceptance | `/organisations/:id/invitations`, `/invitations/accept` | Administrator creates; exact verified invite email accepts |
| Workspace role grant | `POST .../workspaces/:id/members` | Manager only; target must already be an organisation member |
| Audit export | `GET /organisations/:id/audit` | Administrator/auditor only; hash-linked events |
| Usage and plan status | `GET /organisations/:id/usage` | Active organisation membership only |

The current usage endpoint reports workspaces/proofs, plan code, and retention setting. It is deliberately **not** a payment integration. Billing, tax, invoices, and payment collection need an approved merchant/provider and commercial terms before activation.

## Future managed-workspace enablement gates

Do not invite staff or represent this managed path as available until all of these are completed:

1. Apply the v2 migration to a backup-verified production D1 database.
2. Create a dedicated organisation-workspace Cloudflare Access application and audience. The current firm preview policy must not be widened to admit arbitrary organisations.
3. Replace the temporary exact platform-operator email configuration with a dedicated platform-operator Access group/audience.
4. Provision the organisation with its verified domain, two administrators, retention term, plan, and permitted workspace types.
5. Configure corporate SSO/MFA for that organisation (Google Workspace or Microsoft Entra ID), then exercise onboarding, a denied request, a revoked user, export, and deletion in a non-sensitive pilot.
6. Add a billing provider only after the product catalogue, prices, tax owner, refund policy, and support process are approved.

## Scaling approach

Start with a single tenant-scoped D1 database and strict server-side organisation/workspace checks. Monitor request volume, D1 queue/overload errors, query latency, proof-save failures, audit failures, and Chain 1404 quorum failures. Move a large or contractually isolated organisation to its own D1 database when measured load, data-location commitments, or incident containment require it.

The public verifier remains account-free and does not query organisation records. Direct on-chain anchors remain the normal proof route. Merkle batching is a later, explicit cost tier—not an implicit change to proof timing or verification.
