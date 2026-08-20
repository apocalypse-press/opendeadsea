import { json } from "../../../_lib/http.js";
import { capabilitiesFor, requireUser } from "../../../_lib/session.js";
import { insertEvent, nid, nowIso, statusAfterVotes, updateProposalStatus, upsertVote } from "../../../_lib/review.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Sign in to vote." }, 401);
  const cap = capabilitiesFor({ tier: user.tier });
  if (!cap.review) return json({ error: "Voting is for peer reviewers." }, 403);

  const id = String(params.id || "");
  if (!id) return json({ error: "Missing proposal." }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  const value = Number(body.vote_value);
  if (value !== 1 && value !== -1) return json({ error: "Vote must be approve or request changes." }, 400);

  const rec = {
    proposal_id: id,
    voter_user_id: user.id,
    voter_login: user.login,
    vote_value: value,
    comment: String(body.comment || "").trim(),
    created_at: nowIso(),
  };
  try {
    await upsertVote(env, rec);
    const row = await env.DB.prepare(`SELECT id FROM proposals WHERE id = ?`).bind(id).first();
    if (!row) return json({ error: "That proposal is not on the server yet." }, 404);
    const votes = await env.DB.prepare(
      `SELECT vote_value FROM proposal_votes WHERE proposal_id = ?`,
    )
      .bind(id)
      .all();
    const status = statusAfterVotes(votes.results || [], false);
    await updateProposalStatus(env, id, status);
    await insertEvent(env, {
      id: nid("e"),
      kind: value === 1 ? "vote-approve" : "vote-changes",
      mss_id: "",
      title: `${user.login} ${value === 1 ? "approved" : "asked for changes on"} a proposed reading`,
      href: `/proposal/?id=${encodeURIComponent(id)}`,
      login: user.login,
      created_at: rec.created_at,
    });
    return json({ vote: rec, status });
  } catch (err) {
    return json({ error: "Could not store the vote yet.", detail: String(err && err.message) }, 503);
  }
}
