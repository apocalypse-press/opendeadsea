-- ARCH-DSS-2026-CF-FREE trust store
-- D1 holds contributor identity, trust state, suggestions, comments, reviews,
-- and public desk events. Corpus text stays in Git. Official plates are
-- outbound links only.

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

-- Desk: comments, proposed readings, and site-side edition events.
-- Corpus text still lives in Git. These rows are the public work queue
-- until a GitHub pull request exists for a proposal.

CREATE TABLE IF NOT EXISTS proposals (
  id              TEXT PRIMARY KEY,
  mss_id          TEXT NOT NULL,
  mss_label       TEXT,
  line_ref        TEXT,
  current_form    TEXT,
  proposed_form   TEXT NOT NULL,
  reason          TEXT NOT NULL,
  author_user_id  TEXT NOT NULL,
  author_login    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  github_pr       INTEGER,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id              TEXT PRIMARY KEY,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  line_ref        TEXT,
  parent_id       TEXT,
  body            TEXT NOT NULL,
  author_user_id  TEXT NOT NULL,
  author_login    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS proposal_votes (
  proposal_id   TEXT NOT NULL,
  voter_user_id TEXT NOT NULL,
  voter_login   TEXT,
  vote_value    INTEGER NOT NULL,
  comment       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (proposal_id, voter_user_id)
);

CREATE TABLE IF NOT EXISTS edition_events (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  mss_id      TEXT,
  title       TEXT NOT NULL,
  href        TEXT,
  login       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON edition_events(created_at DESC);
