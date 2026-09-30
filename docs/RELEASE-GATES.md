# DAGIT release gates

## Proven locally

- The registry compiles with pinned `solc 0.8.30`, optimizer enabled, and Paris EVM target.
- The local EVM test covers first registration, record retrieval, duplicate prevention, and zero-digest rejection.
- The local demonstration performs hash → local-chain registration → receipt creation → exact-byte verification.
- The browser preview renders the registration and verification journeys without a configured production registry.

## Not proven and not claimed

- No contract is deployed to Chain 1404.
- No wallet transaction has been signed for Chain 1404.
- No wallet-connect provider/project ID is configured.
- No independent audit or legal approval exists.
- No production registry address is configured and no Chain 1404 registry has been deployed.

## Required before a public deployment

1. Approve the contract source and commission an independent Solidity audit.
2. Approve legal copy, terms, privacy notice, receipt wording, and jurisdictional limitations.
3. Name the deployment multisig/approved signer and fund a controlled rehearsal wallet.
4. Re-run the canonical fixed-height chain comparison and set the confirmation/finality policy.
5. Deploy only after explicit approval; record the verified address, ABI, source, bytecode, transaction, and block.
6. Configure the production registry address in hosting environment configuration—not source control.
7. Verify the deployed origin: CSP, no file bytes in network requests, wallet connect/add/switch/reject states, register flow, receipt/QR, changed-file rejection, and quorum disagreement behaviour.
