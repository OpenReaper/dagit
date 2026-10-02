CREATE TABLE IF NOT EXISTS organisation_registration_requests (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL CHECK(length(legal_name) BETWEEN 1 AND 160),
  requested_domain TEXT NOT NULL CHECK(length(requested_domain) BETWEEN 3 AND 253),
  administrator_email TEXT NOT NULL CHECK(length(administrator_email) BETWEEN 3 AND 254),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','declined','expired')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  UNIQUE(requested_domain, administrator_email, status)
);
CREATE INDEX IF NOT EXISTS registration_requests_status_idx ON organisation_registration_requests(status, created_at DESC);
