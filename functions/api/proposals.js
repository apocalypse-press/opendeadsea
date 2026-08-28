import { json } from "../_lib/http.js";
import { capabilitiesFor, requireUser } from "../_lib/session.js";
import { insertEvent, insertProposal, nid, nowIso } from "../_lib/review.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Sign in to suggest a translation." }, 401);
  const cap = capabilitiesFor({ tier: user.tier });
  if (!cap.suggest) return json({ error: "Translation suggestions are for signed-in contributors." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  const proposed = String(body.proposed_form || "").trim();
  const reason = String(body.reason || "").trim() || "Submitted a translation suggestion.";
  const mssId = String(body.mss_id || "").trim();
  if (!mssId) return json({ error: "Name the manuscript." }, 400);
  if (mssId.length > 120) return json({ error: "That manuscript id is too long." }, 400);
  if (!proposed) return json({ error: "Enter your suggested translation." }, 400);
  if (proposed.length > 2000) return json({ error: "Keep the suggested translation under 2,000 characters." }, 400);
  if (reason.length > 2000) return json({ error: "Keep the note under 2,000 characters." }, 400);

  const rec = {
    id: nid("p"),
    mss_id: mssId,
    mss_label: String(body.mss_label || mssId).trim().slice(0, 240),
    line_ref: String(body.line_ref || "").trim().slice(0, 240),
    current_form: String(body.current_form || "").trim().slice(0, 2000),
    proposed_form: proposed,
    reason,
    author_user_id: user.id,
    author_login: user.login,
    status: "open",
    votes: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  try {
    await insertProposal(env, rec);
    await insertEvent(env, {
      id: nid("e"),
      kind: "proposal",
      mss_id: mssId,
      title: `${user.login} suggested a translation on ${rec.mss_label}`,
      href: `/proposal/?id=${encodeURIComponent(rec.id)}`,
      login: user.login,
      created_at: rec.created_at,
    });
  } catch (err) {
    console.error("proposal insert failed", err);
    return json({ error: "The suggestion could not be saved. Please try again." }, 503);
  }
  return json({ proposal: rec }, 201);
}
