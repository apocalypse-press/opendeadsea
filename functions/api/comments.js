import { json } from "../_lib/http.js";
import { capabilitiesFor, requireUser } from "../_lib/session.js";
import { insertComment, insertEvent, nid, nowIso } from "../_lib/review.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Sign in to comment." }, 401);
  const cap = capabilitiesFor({ tier: user.tier });
  if (!cap.suggest) return json({ error: "Commenting is for signed-in contributors." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  const text = String(body.body || "").trim();
  if (text.length < 12) {
    return json({ error: "Give a short comment. A dozen characters is enough to start." }, 400);
  }
  const targetType = body.target_type === "proposal" ? "proposal" : "mss";
  const targetId = String(body.target_id || "").trim();
  if (!targetId) return json({ error: "Name the manuscript or proposal." }, 400);

  const rec = {
    id: nid("c"),
    target_type: targetType,
    target_id: targetId,
    line_ref: String(body.line_ref || "").trim(),
    parent_id: body.parent_id ? String(body.parent_id) : null,
    body: text,
    author_user_id: user.id,
    author_login: user.login,
    created_at: nowIso(),
  };
  try {
    await insertComment(env, rec);
    await insertEvent(env, {
      id: nid("e"),
      kind: "comment",
      mss_id: targetType === "mss" ? targetId : "",
      title: `${user.login} commented on ${targetId}`,
      href: targetType === "mss" ? `/m/${encodeURIComponent(targetId)}/` : `/proposal/?id=${encodeURIComponent(targetId)}`,
      login: user.login,
      created_at: rec.created_at,
    });
  } catch (err) {
    return json({ error: "Could not store the comment yet.", detail: String(err && err.message) }, 503);
  }
  return json({ comment: rec }, 201);
}
