export const STATUSES = ["open", "changes", "ready", "approved", "withdrawn"];

export function nid(prefix) {
  const raw = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${raw}`;
}

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function reviewerApprovals(votes) {
  return (votes || []).filter((v) => Number(v.vote_value) === 1).length;
}

export function statusAfterVotes(votes, maintainerApprove) {
  if (maintainerApprove) return "approved";
  const yes = reviewerApprovals(votes);
  const no = (votes || []).some((v) => Number(v.vote_value) === -1);
  if (yes >= 2) return "ready";
  if (no) return "changes";
  return "open";
}

export async function loadDesk(env) {
  if (!env.DB) return emptyDesk();
  try {
    const proposals = await env.DB.prepare(
      `SELECT id, mss_id, mss_label, line_ref, current_form, proposed_form, reason,
              author_user_id, author_login, status, github_pr, created_at, updated_at
       FROM proposals ORDER BY created_at DESC LIMIT 200`,
    ).all();
    const comments = await env.DB.prepare(
      `SELECT id, target_type, target_id, line_ref, parent_id, body,
              author_user_id, author_login, created_at
       FROM comments ORDER BY created_at DESC LIMIT 400`,
    ).all();
    const votes = await env.DB.prepare(
      `SELECT proposal_id, voter_user_id, voter_login, vote_value, comment, created_at FROM proposal_votes`,
    ).all();
    const events = await env.DB.prepare(
      `SELECT id, kind, mss_id, title, href, login, created_at
       FROM edition_events ORDER BY created_at DESC LIMIT 100`,
    ).all();
    const voteRows = votes.results || [];
    const mapped = (proposals.results || []).map((p) => ({
      ...p,
      votes: voteRows
        .filter((v) => v.proposal_id === p.id)
        .map((v) => ({
          voter_user_id: v.voter_user_id,
          voter_login: v.voter_login,
          vote_value: v.vote_value,
          comment: v.comment,
          created_at: v.created_at,
        })),
    }));
    return {
      proposals: mapped,
      comments: comments.results || [],
      events: events.results || [],
      source: "d1",
    };
  } catch {
    return emptyDesk();
  }
}

export function emptyDesk() {
  return { proposals: [], comments: [], events: [], source: "empty" };
}

export async function insertComment(env, rec) {
  if (!env.DB) return rec;
  await env.DB.prepare(
    `INSERT INTO comments (id, target_type, target_id, line_ref, parent_id, body, author_user_id, author_login, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      rec.id,
      rec.target_type,
      rec.target_id,
      rec.line_ref || "",
      rec.parent_id || null,
      rec.body,
      rec.author_user_id,
      rec.author_login,
      rec.created_at,
    )
    .run();
  return rec;
}

export async function insertProposal(env, rec) {
  if (!env.DB) return rec;
  await env.DB.prepare(
    `INSERT INTO proposals (id, mss_id, mss_label, line_ref, current_form, proposed_form, reason, author_user_id, author_login, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      rec.id,
      rec.mss_id,
      rec.mss_label || rec.mss_id,
      rec.line_ref || "",
      rec.current_form || "",
      rec.proposed_form,
      rec.reason,
      rec.author_user_id,
      rec.author_login,
      rec.status,
      rec.created_at,
      rec.updated_at,
    )
    .run();
  return rec;
}

export async function upsertVote(env, rec) {
  if (!env.DB) return rec;
  await env.DB.prepare(
    `INSERT INTO proposal_votes (proposal_id, voter_user_id, voter_login, vote_value, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(proposal_id, voter_user_id) DO UPDATE SET
       vote_value = excluded.vote_value,
       comment = excluded.comment,
       created_at = excluded.created_at`,
  )
    .bind(rec.proposal_id, rec.voter_user_id, rec.voter_login || "", rec.vote_value, rec.comment || "", rec.created_at)
    .run();
  return rec;
}

export async function updateProposalStatus(env, id, status) {
  if (!env.DB) return;
  await env.DB.prepare(
    `UPDATE proposals SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  )
    .bind(status, id)
    .run();
}

export async function insertEvent(env, rec) {
  if (!env.DB) return rec;
  try {
    await env.DB.prepare(
      `INSERT INTO edition_events (id, kind, mss_id, title, href, login, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(rec.id, rec.kind, rec.mss_id || "", rec.title, rec.href || "", rec.login || "", rec.created_at)
      .run();
  } catch {
    // table may not exist yet
  }
  return rec;
}

export async function loadGithubHistory() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/apocalypse-press/opendeadsea/commits?per_page=30",
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "OpenDeadSea",
          "x-github-api-version": "2022-11-28",
        },
      },
    );
    if (!response.ok) return [];
    const rows = await response.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      sha: row.sha,
      short: String(row.sha || "").slice(0, 7),
      message: String((row.commit && row.commit.message) || "").split("\n")[0],
      at: row.commit && row.commit.author && row.commit.author.date,
      login: (row.author && row.author.login) || (row.commit && row.commit.author && row.commit.author.name) || "",
      href: row.html_url,
      source: "git",
    }));
  } catch {
    return [];
  }
}
