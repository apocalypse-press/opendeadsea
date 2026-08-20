export const SESSION_COOKIE = "ods_session";
export const OAUTH_COOKIE = "ods_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const OAUTH_MAX_AGE = 60 * 10;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

export function redirect(location, cookies = []) {
  const headers = new Headers({
    location,
    "cache-control": "no-store",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    out[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
  }
  return out;
}

export function cookie(name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

export function originOf(request) {
  const url = new URL(request.url);
  return url.origin;
}

export function safeNext(value, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

export function configured(env) {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

export function sessionSecret(env) {
  return env.SESSION_SECRET || env.GITHUB_CLIENT_SECRET || "";
}
