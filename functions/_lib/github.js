export function authorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "OpenDeadSea",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.access_token) return null;
  return data.access_token;
}

export async function fetchGithubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "OpenDeadSea",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data || data.id == null || !data.login) return null;
  return { id: String(data.id), login: String(data.login) };
}

const CANONICAL_HOSTS = new Set(["opendeadsea.org", "www.opendeadsea.org"]);

export function redirectUri(request, env) {
  if (env.OAUTH_REDIRECT_URI) return env.OAUTH_REDIRECT_URI;
  const url = new URL(request.url);
  if (CANONICAL_HOSTS.has(url.hostname)) {
    return "https://opendeadsea.org/auth/callback";
  }
  return `${url.origin}/auth/callback`;
}
