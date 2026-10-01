# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who need a private, independently checkable record that a particular digital file existed in a particular form at the time their wallet placed a proof on Chain 1404.

## Product Purpose

DAGIT creates an exact-byte fingerprint on the user's own device and lets their self-custody wallet anchor that fingerprint on Chain 1404. The file is never uploaded to DAGIT.

## Positioning

The user controls both the original file and the wallet transaction. DAGIT is not a file host, custodian, account platform, or intermediary for the BDAG network fee.

## Operating Context

The consumer journey is: choose a local file, create a local fingerprint, choose optional version context, connect a Chain 1404 wallet, review the wallet's BDAG network fee, anchor the proof, and save a portable Proof Pack receipt. A second person opens a QR or private proof link, supplies their own copy of the original file, and can optionally add a wallet acknowledgement to that same receipt.

## Capabilities and Constraints

- Exact file bytes are hashed locally in a Web Worker.
- No file, filename, file metadata, private key, or seed phrase enters a DAGIT service.
- The consumer must use a compatible self-custody wallet and hold sufficient BDAG for the network fee.
- DAGIT takes no separate product fee in the planned direct-proof flow; the final network fee is shown by the wallet before approval.
- The live production registry proxy is `0xe878c8daae03cab17026d298e907547718893e31` on Chain 1404. A user must still approve every proof transaction in their own wallet.
- A proof records a digest anchoring event only; it does not establish authorship, ownership, legal execution, or truth.

## Brand Commitments

Name: DAGIT. Voice: plain, calm, privacy-first, and direct. The user explicitly requested no internal or implementation-facing product copy.

## Evidence on Hand

- `/Users/dreamreaper/Documents/BDAG/dagit/src/hash-worker.ts` — browser-local hashing implementation.
- `/Users/dreamreaper/Documents/BDAG/dagit/src/lib/wallet.ts` — injected self-custody wallet integration.
- `/Users/dreamreaper/Documents/BDAG/dagit/docs/RELEASE-GATES.md` — records the verified deployment boundary and remaining firm-onboarding gates.

## Product Principles

1. The file stays private.
2. The user approves every wallet action.
3. Payment is only the BDAG network fee shown by the wallet.
4. A receipt must remain useful without a DAGIT account.
5. The portable QR receipt stays in the URL fragment; it is not stored by DAGIT.
6. A wallet acknowledgement is cryptographic confirmation of a receipt, not a legal signature, identity check, ownership claim, or statement that the file is true.
