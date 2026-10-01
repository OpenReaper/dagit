PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL CHECK(length(legal_name) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  idp_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','contributor','reader','observer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  disabled_at TEXT
);
CREATE INDEX IF NOT EXISTS members_firm_idx ON members(firm_id, status);

CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  reference_alias TEXT NOT NULL CHECK(length(reference_alias) BETWEEN 1 AND 160),
  document_role TEXT NOT NULL CHECK(length(document_role) BETWEEN 1 AND 120),
  signing_provider TEXT NOT NULL DEFAULT '' CHECK(length(signing_provider) <= 120),
  signing_reference TEXT NOT NULL DEFAULT '' CHECK(length(signing_reference) <= 120),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS matters_firm_created_idx ON matters(firm_id, created_at DESC);

CREATE TABLE IF NOT EXISTS matter_members (
  matter_id TEXT NOT NULL REFERENCES matters(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL CHECK(role IN ('manager','contributor','reader')),
  granted_by TEXT NOT NULL REFERENCES members(id),
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY(matter_id, member_id)
);

CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  stage TEXT NOT NULL CHECK(stage IN ('pre-sign','final')),
  receipt_json TEXT NOT NULL CHECK(length(receipt_json) <= 65536),
  digest TEXT NOT NULL CHECK(length(digest) = 66),
  manifest_digest TEXT NOT NULL CHECK(length(manifest_digest) = 66),
  chain_tx TEXT NOT NULL CHECK(length(chain_tx) = 66),
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  UNIQUE(matter_id, stage)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  member_id TEXT NOT NULL REFERENCES members(id),
  key TEXT NOT NULL CHECK(length(key) BETWEEN 16 AND 200),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(member_id, key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  matter_id TEXT REFERENCES matters(id),
  actor_member_id TEXT NOT NULL REFERENCES members(id),
  action TEXT NOT NULL CHECK(length(action) <= 80),
  occurred_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  event_digest TEXT NOT NULL CHECK(length(event_digest) = 64)
);
CREATE INDEX IF NOT EXISTS audit_firm_occurred_idx ON audit_events(firm_id, occurred_at DESC);
