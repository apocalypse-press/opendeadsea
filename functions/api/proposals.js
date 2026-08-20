import { json } from "../_lib/http.js";
import { capabilitiesFor, requireUser } from "../_lib/session.js";
import { insertEvent, insertProposal, nid, nowIso } from "../_lib/review.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Sign in to propose a reading." }, 401);
  const cap = capabilitiesFor({ tier: user.tier });
  if (!cap.suggest) return json({ error: "Proposing a reading is for signed-in contributors." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  const proposed = String(body.proposed_form || "").trim();
  const reason = String(body.reason || "").trim();
  const mssId = String(body.mss_id || "").trim();
  if (!mssId) return json({ error: "Name the manuscript." }, 400);
  if (!proposed) return json({ error: "Enter the reading you are proposing." }, 400);
  if (reason.length < 12) {
    return json({ error: "Give a short reason. A dozen characters is enough to start." }, 400);
  }

  const rec = {
    id: nid("p"),
    mss_id: mssId,
    mss_label: String(body.mss_label || mssId),
    line_ref: String(body.line_ref || "").trim(),
    current_form: String(body.current_form || "").trim(),
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
      title: `${user.login} proposed a reading on ${rec.mss_label}`,
      href: `/proposal/?id=${encodeURIComponent(rec.id)}`,
      login: user.login,
      created_at: rec.created_at,
    });
  } catch (err) {
    return json({ error: "Could not store the proposal yet.", detail: String(err && err.message) }, 503);
  }
  return json({ proposal: rec }, 201);
}
