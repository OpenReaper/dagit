# DAGIT measurement plan

**Status:** Implementation-ready. Do not activate analytics until a dedicated DAGIT GTM container, GA4 destination and published privacy notice have been approved.

## Purpose

Measure whether people can complete DAGIT's core task: create a private proof, send a receipt and independently verify the same file. This is product measurement, not document or client surveillance.

## Public routes only

GTM may run only on `/` and `/verify`. It must not run on `/firm`, `/firm/api/*`, `/admin`, or `/admin/matter`.

## Consent

The application loads GTM only after a visitor chooses **Allow analytics**. A refusal is stored locally and does not load GTM. Do not add a non-consented tag through Vercel, Cloudflare or an external script manager.

## Events

| Event | Meaning |
| --- | --- |
| `proof_started` | A visitor selected a local file to begin a proof. |
| `file_hash_started`, `file_hash_completed`, `file_hash_failed` | Private browser-side fingerprinting lifecycle. |
| `wallet_connect_requested`, `wallet_connected`, `wallet_connect_failed` | Wallet connection lifecycle. |
| `proof_anchor_requested`, `proof_recorded`, `proof_anchor_failed` | A wallet was asked to approve a proof, and the client observed the result. |
| `receipt_downloaded`, `proof_link_copied`, `proof_qr_created`, `certificate_printed` | Proof hand-off actions. |
| `verification_started`, `verification_matched`, `verification_mismatched`, `verification_chain_unavailable` | Recipient verification lifecycle. |

## Strict exclusions

No tag, event, custom dimension or debug log may include file bytes, filename, MIME type, size, fingerprint/hash, receipt or URL fragment, wallet address, transaction hash, email, identity-provider subject, matter alias, signing provider/reference, IP address collected by application code, or any client/document metadata.

GTM's own platform processing remains subject to the approved privacy notice and Google configuration. The firm workspace has its own operational audit trail and Cloudflare access logs; it must not use marketing analytics.

## GTM configuration

1. Create a dedicated **DAGIT** web container and GA4 web data stream. Do not reuse the `macula.co.za` container or property.
2. Set `VITE_GTM_CONTAINER_ID` in the Vercel production environment to that container ID and redeploy.
3. Add a GA4 Configuration / Google tag that fires on the custom events above, with no event parameters.
4. Configure default consent as denied and require `analytics_storage` for the GA4 tag.
5. Test each event through GTM Preview and GA4 DebugView after consenting. Test a declined session separately and confirm no GTM request is made.
6. Review the data after 24 hours, then record the GTM version and GA4 stream identifier in the private operations register (not in public source).

## Success measures

- Proof journey: `proof_started` → `file_hash_completed` → `proof_recorded` → receipt action.
- Recipient journey: `verification_started` → `verification_matched`.
- Reliability: rate of hashing, wallet, anchoring and chain-verification failures.

These are directional product measures. A wallet connection or file selection is not a legal signing, a successful anchor, or a completed client matter.
