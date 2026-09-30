# DAGIT

DAGIT (Digital Asset Guarantee & Integrity Tool) is a privacy-first proof-of-existence and integrity application for the BlockDAG community chain (Chain 1404).

It hashes the exact file bytes in the browser, asks the user's wallet to write only a SHA-256 digest and receipt-manifest digest to a minimal registry contract, and later verifies the original file locally. The application never uploads the selected file, its filename, or its metadata.

## What a DAGIT proof means

A proof shows that a wallet registered a supplied digest in an identifiable Chain 1404 transaction and confirmed block. It does **not** prove who authored a file, owns its rights, signed a legal agreement, or whether the contents are true. It is not an electronic-signature service or legal advice.

## Local development

```sh
pnpm install
pnpm check
pnpm dev --host 127.0.0.1 --port 4173
```

`pnpm demo` deploys the registry to an ephemeral local EVM configured with chain ID 1404, records a deterministic file digest, builds a receipt, and verifies the result. It cannot contact or write to mainnet.

## Architecture

- `contracts/DAGITRegistry.sol` — non-upgradeable first-proof registry. It has no owner, token, NFT, payment flow, or external call.
- `src/hash-worker.ts` — streams the original local `File` through SHA-256 in a Web Worker.
- `src/lib/proof-core.mjs` — canonical receipt-manifest binding and local receipt verification.
- `src/lib/chain.ts` — canonical Chain 1404 read quorum. It excludes bdagscan and blockdag.works.
- `src/lib/wallet.ts` — injected-wallet registration. It is intentionally unavailable until an approved deployed registry address is supplied through `VITE_DAGIT_REGISTRY_ADDRESS`.

## Read quorum

Wallet configuration uses `https://rpc.blockdag.engineering/`. Verification uses Engineering, CapeDAG, and BDAG-US East and requires two nodes to agree at a fixed-height checkpoint. A disagreement returns unavailable rather than a false verification result.

## Release boundary

`pnpm release:preflight` runs local build, receipt tests, contract tests, local transaction demo, and a live read-only RPC quorum check. It never deploys a contract or sends a mainnet transaction. See [docs/RELEASE-GATES.md](docs/RELEASE-GATES.md).
