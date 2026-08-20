import { json } from "../_lib/http.js";
import { capabilitiesFor, publicUser, readSession } from "../_lib/session.js";
import { loadDesk, loadGithubHistory } from "../_lib/review.js";
import { loadUser } from "../_lib/users.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await readSession(request, env);
  let user = null;
  if (session && session.sub) {
    const row = await loadUser(env, session.sub);
    user = publicUser(
      row || {
        user_id: session.sub,
        github_username: session.login,
        reputation_score: 0,
        tier_level: Number.isFinite(session.tier) ? session.tier : 1,
        academic_verified: 0,
      },
    );
  }
  const desk = await loadDesk(env);
  const git = await loadGithubHistory();
  return json({
    user,
    capabilities: capabilitiesFor(user),
    proposals: desk.proposals,
    comments: desk.comments,
    events: desk.events,
    git,
    source: desk.source,
  });
}
