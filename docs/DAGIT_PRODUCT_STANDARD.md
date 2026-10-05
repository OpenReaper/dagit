# DAGIT product standard

## Product promise

DAGIT lets people independently confirm that they hold the same exact private file version. It records a cryptographic fingerprint, not the file. A match proves byte-for-byte equivalence with the recorded proof; it does not prove identity, authority, ownership, legal execution, or truth.

## The ten non-negotiables

| Standard | Delivered behaviour | Boundary |
| --- | --- | --- |
| 1. Private files | Hashing and verification run in the browser. No file bytes, filename, or document metadata are uploaded or put on-chain. | A user can voluntarily save a proof receipt's metadata to their company workspace; this is not a file upload. |
| 2. Simple proof | Choose a file, create its local fingerprint, and approve the Chain 1404 anchor in a self-custody wallet. | The wallet shows the native-network transaction fee before approval. |
| 3. Simple verification | A recipient selects their copy and receives a clear `MATCH`, `NO MATCH`, or `CHECK NOT COMPLETE` result. | A matching file still requires a separately confirmed on-chain proof. |
| 4. No recipient account | Proof links and QR codes carry the portable receipt; a recipient needs neither a DAGIT account nor a wallet to check their copy. | The recipient still needs the receipt/link and their own file. |
| 5. Retainable receipt | The portable receipt contains the digest commitment, transaction, block, wallet, Chain 1404 record and version context. | A receipt is integrity evidence, not a legal certificate. |
| 6. Pre-sign and final-sign | The firm workspace records a pre-sign file and a completed-file proof as two separate anchors. | Signing identity and legal validity stay with the signing process and firm records. |
| 7. Linked proofs | Final receipts bind their predecessor digest and manifest commitment, and workspaces label linked earlier proofs. | The relationship is private receipt context, not a public content disclosure. |
| 8. Organisation history | A wallet-owned organisation can create project, matter, property, contractor or personal workspaces and retain anchored proof receipts by workspace. | Only the owner wallet can list or save metadata in its workspace flow today. |
| 9. Plain failures | The verifier distinguishes mismatch from an unconfirmed chain check and tells the user what not to rely on. | DAGIT does not yet compare documents or explain textual changes. TURBO is not a dependency for this release. |
| 10. No blockchain learning curve | The default flow speaks in files, copies, receipts and workspaces. Network mechanics are only shown where a wallet must approve a transaction. | A wallet is required only for someone creating an on-chain proof. |

## Operating rules

- Never treat a hash match as proof of authorship, ownership, identity, consent, delivery, truth or legal enforceability.
- Never add a token, file store, custodial wallet, mandatory recipient account, or server-side document analysis to the core flow.
- Keep Turbo optional until a separately approved, local-first comparison capability has a defined privacy and production posture.
