import { json } from "../../../_lib/http.js";
import { capabilitiesFor, requireUser } from "../../../_lib/session.js";
import { insertEvent, nid, nowIso, updateProposalStatus } from "../../../_lib/review.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Sign in to approve." }, 401);
  const cap = capabilitiesFor({ tier: user.tier });
  if (!cap.maintain) {
    return json({ error: "Recording approval is for an editor." }, 403);
  }

  const id = String(params.id || "");
  if (!id) return json({ error: "Missing proposal." }, 400);

  try {
    const row = await env.DB.prepare(`SELECT id, mss_id, mss_label FROM proposals WHERE id = ?`).bind(id).first();
    if (!row) return json({ error: "That proposal is not on the server yet." }, 404);
    await updateProposalStatus(env, id, "approved");
    const at = nowIso();
    await insertEvent(env, {
      id: nid("e"),
      kind: "approved",
      mss_id: row.mss_id,
      title: `${user.login} recorded approval on ${row.mss_label || row.mss_id}`,
      href: `/proposal/?id=${encodeURIComponent(id)}`,
      login: user.login,
      created_at: at,
    });
    return json({ id, status: "approved" });
  } catch (err) {
    console.error("proposal approval failed", err);
    return json({ error: "The approval could not be saved. Please try again." }, 503);
  }
}
