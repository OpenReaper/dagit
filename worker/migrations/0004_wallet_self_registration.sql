-- Public organisation onboarding is wallet-owned and self-service.  A wallet
-- signature proves control of the workspace owner without requiring an email
-- provider, a manual approval queue, or a document upload.
CREATE TABLE IF NOT EXISTS organisation_wallet_registration_challenges (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL CHECK(length(wallet_address) = 42),
  message TEXT NOT NULL CHECK(length(message) <= 1024),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS organisation_wallet_registration_challenges_wallet_idx
  ON organisation_wallet_registration_challenges(wallet_address, expires_at DESC);

-- Wallet identities use a deliberately non-deliverable internal handle. It is
-- not an email address supplied by, or asserted for, the wallet owner.
CREATE INDEX IF NOT EXISTS identities_wallet_subject_idx ON identities(idp_subject);
