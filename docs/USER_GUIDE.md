# DAGIT user guide

## What DAGIT is for

DAGIT — Digital Asset Guarantee & Integrity Tool — helps people confirm that they are looking at the exact same private file version.

It creates a SHA-256 fingerprint of a file in the browser, records that fingerprint on BlockDAG Chain 1404 when the wallet owner approves the transaction, and produces a portable receipt. A recipient can select their own copy of the file and check it against that receipt. The selected file is not uploaded to DAGIT.

The BDAG network fee is shown in the wallet before the anchor transaction is approved. DAGIT does not take custody of the wallet or pay the fee for the user.

## Before a firm starts

1. Keep the original document in the firm's normal document or case-management system.
2. Use the firm's existing signing provider for identity checks, signing invitations, execution, and its signing audit record.
3. Use a firm-controlled Chain 1404 wallet for proof transactions. Keep its recovery material and transaction approval controls under the firm's own custody.
4. Use a non-sensitive matter alias in the workspace. Do not put client names, file names, document contents, passwords, or provider credentials into DAGIT.
5. Confirm the firm has approved the applicable privacy notice, terms, retention schedule, access list, and incident contact.

## Firm workflow: confirm a version before signing

1. Open the firm workspace using the approved firm email account.
2. Select the correct matter and choose the file from the local device.
3. Check the fingerprint summary. The file has not left the device.
4. Connect the firm wallet and approve the BDAG transaction only after checking the wallet's network and fee prompt.
5. Save the generated proof receipt and share its verification link or QR code with the recipient using the firm's normal communication channel.
6. Send the signing invitation through the firm's signing provider as usual. DAGIT does not send, sign, or authenticate that invitation.

## Recipient workflow: check before signing

1. Open the DAGIT verification link or scan the QR code supplied with the document.
2. Select the file received from the firm. The file is checked in the browser and is not uploaded.
3. Read the result:
   - **Match:** the selected file matches the proof receipt and available Chain 1404 record.
   - **Does not match:** stop and ask the firm for a new document and receipt. Do not treat the document as the recorded version.
   - **Unavailable:** DAGIT could not obtain the required on-chain verification result. Ask the firm to verify later; do not treat this as a match.
4. Continue to the signing provider only after the firm’s normal process tells the recipient to do so.

The recipient does not need a DAGIT account or wallet to verify a file.

## Firm workflow: record the final version

1. When execution has completed in the signing provider, select the final executed file locally.
2. Create a linked final proof with the firm wallet.
3. Keep the proof receipts, the signing-provider reference, and the provider's audit record together in the firm’s normal matter file.
4. Export the DAGIT evidence pack where the workspace provides it. Treat it as technical evidence of version integrity, not as the authoritative legal or signing record.

## What the proof confirms — and does not confirm

A successful check confirms that the selected file matches the fingerprint recorded in the receipt and, where available, the Chain 1404 proof.

It does **not** prove:

- who created, sent, received, or approved a file;
- who owns rights in it;
- that its contents are accurate, complete, lawful, or enforceable;
- the identity, authority, capacity, consent, or intent of a signer; or
- legal execution, delivery, notice, or service.

Use the firm's normal processes and signing provider for those questions.

## If something goes wrong

| Situation | What to do |
| --- | --- |
| The result says the file does not match | Stop. Do not edit the file to make it match. Obtain the intended version and a new proof from the firm. |
| The wallet displays an unexpected network, account, or fee | Reject the request. Check the wallet and retry only when the firm wallet controller confirms the details. |
| The proof cannot be checked because the network is unavailable | Keep the receipt and try later. An unavailable result is not a match. |
| A staff member leaves or may have lost control of their account | Disable their identity-provider account, revoke workspace access, and follow the security standard. |
| The firm suspects a receipt or account was mishandled | Preserve the available receipts and signing-provider audit records; do not overwrite them. Follow the incident procedure. |

## Support boundary

DAGIT support can help explain technical proof status and service operation. It cannot interpret a document, advise whether to sign, recover a wallet, reverse an on-chain transaction, access a firm's signing-provider account, or make a legal determination.
