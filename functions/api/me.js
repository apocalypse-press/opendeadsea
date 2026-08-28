import { configured, json } from "../_lib/http.js";
import { capabilitiesFor, publicUser, readSession } from "../_lib/session.js";
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
        tier_level: 1,
        academic_verified: 0,
      },
    );
  }

  return json({
    configured: configured(env),
    mock: env.AUTH_ALLOW_MOCK === "1",
    user,
    capabilities: capabilitiesFor(user),
  });
}
