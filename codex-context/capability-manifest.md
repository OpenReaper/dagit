# DAGIT capability manifest — 2026-09-30

- Canonical local source: `/Users/dreamreaper/Documents/BDAG/dagit`, Git branch `codex/dagit-v1`; isolated repository with no remote configured.
- Product layers: static React/Vite frontend; local Web Worker hashing; user-controlled injected wallet; Solidity registry; no database, account, file server, indexer, analytics, or custody service.
- Verified local runtime: Node 22.20.0, pnpm 11.19.0, solc 0.8.30, Ganache 7.9.2. Contract compilation, local transaction tests, receipt tests, and local proof demo pass.
- Verified live read-only capability: Engineering, CapeDAG, and BDAG-US East can form a current head quorum on Chain 1404. Endpoint availability and canonicality must be reverified before any deployment.
- Unavailable/not authorised: production registry address, deployment signer/multisig, wallet-connect project ID, hosting project, audit, legal approval, and mainnet deployment authority.
