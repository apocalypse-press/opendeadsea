import {
  OAUTH_COOKIE,
  clearCookie,
  configured,
  parseCookies,
  redirect,
  sessionSecret,
} from "../_lib/http.js";
import { setSessionCookie, verifyPayload } from "../_lib/session.js";
import { exchangeCode, fetchGithubUser, redirectUri } from "../_lib/github.js";
import { upsertUser } from "../_lib/users.js";

function fail(reason) {
  return redirect(`/signin/?reason=${encodeURIComponent(reason)}`);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return fail("denied");
  if (!configured(env) || !sessionSecret(env)) return fail("oauth-pending");
  if (!code || !state) return fail("state");

  const raw = parseCookies(request)[OAUTH_COOKIE];
  const saved = await verifyPayload(sessionSecret(env), raw);
  if (!saved || saved.state !== state) return fail("state");

  const accessToken = await exchangeCode({
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    code,
    redirectUri: redirectUri(request, env),
  });
  if (!accessToken) return fail("exchange");

  const githubUser = await fetchGithubUser(accessToken);
  if (!githubUser) return fail("user");

  await upsertUser(env, githubUser);
  const session = await setSessionCookie(env, githubUser);
  const next = typeof saved.next === "string" ? saved.next : "/account/";
  return redirect(next, [session, clearCookie(OAUTH_COOKIE)]);
}
