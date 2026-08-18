-- ARCH-DSS-2026-CF-FREE trust store
-- D1 holds reputation, tier, academic flags, and votes only.
-- Corpus text stays in Git. Official plates are outbound links only.

CREATE TABLE IF NOT EXISTS users (
  user_id           TEXT PRIMARY KEY,
  github_username   TEXT UNIQUE NOT NULL,
  reputation_score  INTEGER NOT NULL DEFAULT 0,
  tier_level        INTEGER NOT NULL DEFAULT 1,
  academic_verified INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_active       TEXT
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  points      INTEGER NOT NULL,
  related_pr  INTEGER,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS pr_votes (
  pr_number     INTEGER NOT NULL,
  voter_user_id TEXT NOT NULL,
  vote_value    INTEGER NOT NULL,
  comment       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (pr_number, voter_user_id),
  FOREIGN KEY (voter_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_events_user ON reputation_events(user_id);

-- Event types (application-enforced):
--   pr_merged (+10)
--   comment_accepted (+2)
--   review_approved
--   academic_verified
-- Vote values: +1 approve, -1 request changes
-- tier_level: 1 contributor, 2 peer reviewer
-- Tier 3 maintainers live in CODEOWNERS, not this table.
