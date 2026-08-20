import {
  OAUTH_COOKIE,
  OAUTH_MAX_AGE,
  configured,
  cookie,
  redirect,
  safeNext,
  sessionSecret,
} from "../_lib/http.js";
import { signPayload } from "../_lib/session.js";
import { authorizeUrl, redirectUri } from "../_lib/github.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"), "/account/");

  if (!configured(env) || !sessionSecret(env)) {
    return redirect(`/signin/?reason=oauth-pending&next=${encodeURIComponent(next)}`);
  }

  const state = crypto.randomUUID();
  const payload = await signPayload(sessionSecret(env), {
    state,
    next,
    exp: Math.floor(Date.now() / 1000) + OAUTH_MAX_AGE,
  });
  const target = authorizeUrl({
    clientId: env.GITHUB_CLIENT_ID,
    redirectUri: redirectUri(request, env),
    state,
  });
  return redirect(target, [
    cookie(OAUTH_COOKIE, payload, { maxAge: OAUTH_MAX_AGE }),
  ]);
}
