PRAGMA foreign_keys = ON;

-- V2 is additive. The existing firms/matters pilot remains readable while
-- organisations onboard onto an explicit multi-tenant model.
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  idp_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL CHECK(length(legal_name) BETWEEN 1 AND 160),
  slug TEXT NOT NULL UNIQUE CHECK(slug GLOB '[a-z0-9-]*' AND length(slug) BETWEEN 3 AND 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','offboarded')),
  plan_code TEXT NOT NULL DEFAULT 'pilot' CHECK(plan_code IN ('pilot','standard','enterprise')),
  retention_days INTEGER NOT NULL DEFAULT 365 CHECK(retention_days BETWEEN 30 AND 3650),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS organisation_domains (
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  domain TEXT NOT NULL UNIQUE CHECK(length(domain) BETWEEN 3 AND 253),
  verified_at TEXT,
  PRIMARY KEY (organisation_id, domain)
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  identity_id TEXT NOT NULL REFERENCES identities(id),
  role TEXT NOT NULL CHECK(role IN ('administrator','member','billing','auditor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  disabled_at TEXT,
  PRIMARY KEY (organisation_id, identity_id)
);
CREATE INDEX IF NOT EXISTS organisation_memberships_identity_idx ON organisation_memberships(identity_id, status);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  workspace_type TEXT NOT NULL CHECK(workspace_type IN ('general','legal','contractor','property','personal')),
  reference_alias TEXT NOT NULL CHECK(length(reference_alias) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','deleted')),
  created_by TEXT NOT NULL REFERENCES identities(id),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS workspaces_organisation_created_idx ON workspaces(organisation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  identity_id TEXT NOT NULL REFERENCES identities(id),
  role TEXT NOT NULL CHECK(role IN ('manager','contributor','reader')),
  granted_by TEXT NOT NULL REFERENCES identities(id),
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (workspace_id, identity_id)
);

CREATE TABLE IF NOT EXISTS workspace_proofs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  stage TEXT NOT NULL CHECK(stage IN ('recorded','revision','final','handover','inspection','delivery')),
  receipt_json TEXT NOT NULL CHECK(length(receipt_json) <= 65536),
  digest TEXT NOT NULL CHECK(length(digest) = 66),
  manifest_digest TEXT NOT NULL CHECK(length(manifest_digest) = 66),
  chain_tx TEXT NOT NULL CHECK(length(chain_tx) = 66),
  created_by TEXT NOT NULL REFERENCES identities(id),
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, stage, manifest_digest)
);

CREATE TABLE IF NOT EXISTS organisation_invitations (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  workspace_id TEXT REFERENCES workspaces(id),
  email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
  organisation_role TEXT NOT NULL CHECK(organisation_role IN ('administrator','member','billing','auditor')),
  workspace_role TEXT CHECK(workspace_role IN ('manager','contributor','reader')),
  token_digest TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL REFERENCES identities(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organisation_audit_events (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  workspace_id TEXT REFERENCES workspaces(id),
  actor_identity_id TEXT NOT NULL REFERENCES identities(id),
  action TEXT NOT NULL CHECK(length(action) <= 96),
  request_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  previous_event_digest TEXT,
  event_digest TEXT NOT NULL CHECK(length(event_digest) = 64)
);
CREATE INDEX IF NOT EXISTS organisation_audit_events_org_idx ON organisation_audit_events(organisation_id, occurred_at DESC);
