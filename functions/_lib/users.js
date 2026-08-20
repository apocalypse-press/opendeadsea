export async function upsertUser(env, { id, login }) {
  if (!env.DB) return fallbackRow(id, login);
  try {
    await env.DB.prepare(
      `INSERT INTO users (user_id, github_username, last_active)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(user_id) DO UPDATE SET
         github_username = excluded.github_username,
         last_active = excluded.last_active`,
    )
      .bind(id, login)
      .run();
    const row = await env.DB.prepare(
      `SELECT user_id, github_username, reputation_score, tier_level, academic_verified
       FROM users WHERE user_id = ?`,
    )
      .bind(id)
      .first();
    return row || fallbackRow(id, login);
  } catch {
    return fallbackRow(id, login);
  }
}

export async function loadUser(env, id) {
  if (!env.DB || !id) return null;
  try {
    return await env.DB.prepare(
      `SELECT user_id, github_username, reputation_score, tier_level, academic_verified
       FROM users WHERE user_id = ?`,
    )
      .bind(id)
      .first();
  } catch {
    return null;
  }
}

function fallbackRow(id, login) {
  return {
    user_id: id,
    github_username: login,
    reputation_score: 0,
    tier_level: 1,
    academic_verified: 0,
  };
}
