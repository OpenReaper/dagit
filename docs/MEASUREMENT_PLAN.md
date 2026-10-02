# DAGIT measurement plan

**Status:** Expansion planned. DAGIT uses its own GTM container (`GTM-KVBQQ32W`) and GA4 stream (`G-MHS56KTET8`) inside the Macula ZA account. This plan covers the public company registration and access journeys; it does not authorise tracking in protected firm/admin routes.

## Purpose

Measure whether people can complete DAGIT's core task: create a private proof, send a receipt and independently verify the same file. This is product measurement, not document or client surveillance.

## Public routes only

GTM may run only on `/`, `/verify`, `/register`, and `/access`. It must not run on `/firm`, `/firm/api/*`, `/admin`, or `/admin/matter`.

## Consent

The application loads GTM only after a visitor chooses **Allow analytics**. A refusal is stored locally and does not load GTM. The same banner must render on `/register` and `/access` before any form or navigation event is added. Do not add a non-consented tag through Vercel, Cloudflare or an external script manager.

## Events

| Event | Meaning |
| --- | --- |
| `proof_started` | A visitor selected a local file to begin a proof. |
| `file_hash_started`, `file_hash_completed`, `file_hash_failed` | Private browser-side fingerprinting lifecycle. |
| `wallet_connect_requested`, `wallet_connected`, `wallet_connect_failed` | Wallet connection lifecycle. |
| `proof_anchor_requested`, `proof_recorded`, `proof_anchor_failed` | A wallet was asked to approve a proof, and the client observed the result. |
| `receipt_downloaded`, `proof_link_copied`, `proof_qr_created`, `certificate_printed` | Proof hand-off actions. |
| `verification_started`, `verification_matched`, `verification_mismatched`, `verification_chain_unavailable` | Recipient verification lifecycle. |
| `company_access_selected`, `company_registration_selected` | A visitor selects the public company-access or registration route. |
| `company_registration_started`, `company_wallet_signature_requested`, `company_workspace_activated`, `company_registration_failed` | Registration funnel, without field values or wallet data. |
| `company_access_started`, `company_access_completed`, `company_access_empty`, `company_access_failed` | Owner-wallet access funnel, without workspace or organisation data. |

## Strict exclusions

No tag, event, custom dimension or debug log may include file bytes, filename, MIME type, size, fingerprint/hash, receipt or URL fragment, wallet address, signature, transaction hash, organisation name, domain, workspace ID, email, identity-provider subject, matter alias, signing provider/reference, IP address collected by application code, or any client/document metadata. Events have no parameters.

GTM's own platform processing remains subject to the approved privacy notice and Google configuration. The firm workspace has its own operational audit trail and Cloudflare access logs; it must not use marketing analytics.

## GTM configuration

1. Keep the separate DAGIT container and GA4 stream. Do not use the Macula main container/property for DAGIT product events.
2. Confirm production has `VITE_GTM_CONTAINER_ID=GTM-KVBQQ32W` and `VITE_GA_MEASUREMENT_ID=G-MHS56KTET8`; both are public identifiers, never credentials.
3. Extend the application consent banner to `/register` and `/access`, then add the allowlisted navigation and lifecycle events. Do not instrument field focus, values, submit payloads, signature text, or API responses.
4. The GTM Google tag owns consented public-page views. Application code sends allowlisted product events directly to GA4 with no parameters. Do not create GTM event tags from the same data-layer events: that would double-count them.
5. Keep Google Signals and ad-personalization disabled. Do not add Google Ads, remarketing, enhanced conversions, or lead-capture tags.
6. In GTM Preview, test: consent granted, consent declined, route navigation, a registration failure, an access failure, and a successful non-sensitive test workspace. In GA4 DebugView, confirm one event per action and zero event parameters.
7. After 24 hours, review event counts and mark only `company_workspace_activated` as a GA4 key event if the data is clean. Do not treat it as a lead, legal signing, payment, or verified business.

## Success measures

- Proof journey: `proof_started` → `file_hash_completed` → `proof_recorded` → receipt action.
- Recipient journey: `verification_started` → `verification_matched`.
- Reliability: rate of hashing, wallet, anchoring and chain-verification failures.
- Company activation: `company_registration_started` → `company_wallet_signature_requested` → `company_workspace_activated`.
- Owner access: `company_access_started` → `company_access_completed`; measure `company_access_empty` separately from technical failure.

These are directional product measures. A wallet connection or file selection is not a legal signing, a successful anchor, or a completed client matter.
