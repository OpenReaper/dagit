# DAGIT

DAGIT (Digital Asset Guarantee & Integrity Tool) is a privacy-first proof-of-existence and integrity application for the BlockDAG community chain (Chain 1404).

It hashes the exact file bytes in the browser, asks the user's wallet to write only a SHA-256 digest and receipt-manifest digest to a minimal registry contract, and later verifies the original file locally. The application never uploads the selected file, its filename, or its metadata.

## What a DAGIT proof means

A proof shows that a wallet registered a supplied digest in an identifiable Chain 1404 transaction and confirmed block. It does **not** prove who authored a file, owns its rights, signed a legal agreement, or whether the contents are true. It is not an electronic-signature service or legal advice.

## Documentation and policy pack

The following documents are maintained with the product. The public service notices are available at `https://dagit.macula.co.za/legal`; they set out DAGIT's narrow technical boundaries, privacy/data position, receipt wording, retention/deletion route, providers, support and incident process.

- [User guide](docs/USER_GUIDE.md) — the practical firm and recipient workflow.
- [Terms of use — draft](docs/TERMS_OF_USE_DRAFT.md) — service boundary, acceptable use, and liability positions to be completed by counsel.
- [Privacy notice — draft](docs/PRIVACY_NOTICE_DRAFT.md) — what DAGIT processes, what it does not receive, and the limits of an immutable blockchain record.
- [Firm data handling and retention standard](docs/FIRM_DATA_HANDLING_AND_RETENTION_STANDARD.md) — operating controls for the firm workspace.
- [Security and incident response standard](docs/SECURITY_AND_INCIDENT_RESPONSE.md) — access, incident, and recovery procedure.

No document in this repository is legal advice or a substitute for the firm's own client terms, retention policy, signing-provider terms, or professional obligations.

## Local development

```sh
pnpm install
pnpm check
pnpm dev --host 127.0.0.1 --port 4173
```

`pnpm demo` deploys the registry to an ephemeral local EVM configured with chain ID 1404, records a deterministic file digest, builds a receipt, and verifies the result. It cannot contact or write to mainnet.

## Architecture

- `contracts/DAGITRegistry.sol` and `contracts/DAGITRegistryProxy.sol` — OpenZeppelin UUPS implementation plus ERC-1967 proxy. The proxy is the public registry address; only the configured owner can authorize an upgrade. It has no token, NFT, payment flow, or external call.
- `src/hash-worker.ts` — streams the original local `File` through SHA-256 in a Web Worker.
- `src/lib/proof-core.mjs` — canonical receipt-manifest binding and local receipt verification.
- `src/lib/chain.ts` — canonical Chain 1404 read quorum. It excludes bdagscan and blockdag.works.
- `src/lib/wallet.ts` — injected-wallet connection and self-custody proof registration. The production build is configured with the live registry address; local development uses `VITE_DAGIT_REGISTRY_ADDRESS`.

## Read quorum

Wallet configuration uses `https://rpc.blockdag.engineering/`. Verification uses Engineering, CapeDAG, and BDAG-US East and requires two nodes to agree at a fixed-height checkpoint. A disagreement returns unavailable rather than a false verification result.

## Release boundary

`pnpm release:preflight` runs local build, receipt tests, contract tests, local transaction demo, and a live read-only RPC quorum check. It never deploys a contract or sends a mainnet transaction. See [docs/RELEASE-GATES.md](docs/RELEASE-GATES.md).

## Production registry

The production UUPS proxy is `0xe878c8daae03cab17026d298e907547718893e31` on Chain 1404. Proof registration is self-custodied: every anchor requires the user to connect a compatible wallet and approve the BDAG network fee.

The configured upgrade authority is a separate, high-risk administrative control. Any upgrade must be independently reviewed, approved through the owner wallet, and verified on-chain before it is announced.
