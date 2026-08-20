import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookie,
  parseCookies,
  sessionSecret,
} from "./http.js";

function b64urlEncode(bytes) {
  let bin = "";
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  for (const byte of view) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signPayload(secret, payload) {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `v1.${body}.${b64urlEncode(mac)}`;
}

export async function verifyPayload(secret, token) {
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, sig] = parts;
  const key = await hmacKey(secret);
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const got = b64urlDecode(sig);
  const want = new Uint8Array(expected);
  if (got.length !== want.length) return null;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) diff |= got[i] ^ want[i];
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readSession(request, env) {
  const secret = sessionSecret(env);
  const token = parseCookies(request)[SESSION_COOKIE];
  return verifyPayload(secret, token);
}

export async function sessionCookieValue(env, user) {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(sessionSecret(env), {
    sub: String(user.id),
    login: user.login,
    tier: Number.isFinite(user.tier) ? user.tier : 1,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  });
}

export async function setSessionCookie(env, user) {
  const value = await sessionCookieValue(env, user);
  return cookie(SESSION_COOKIE, value, { maxAge: SESSION_MAX_AGE });
}

export function capabilitiesFor(user) {
  const tier = user && Number.isFinite(user.tier) ? user.tier : 0;
  return {
    read: true,
    suggest: tier >= 1,
    review: tier >= 2,
    maintain: tier >= 3,
  };
}

export async function requireUser(request, env) {
  const session = await readSession(request, env);
  if (!session || !session.sub) return null;
  return {
    id: String(session.sub),
    login: String(session.login || "user"),
    tier: Number.isFinite(session.tier) ? session.tier : 1,
  };
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    login: row.github_username,
    tier: row.tier_level,
    reputation: row.reputation_score,
    academicVerified: Boolean(row.academic_verified),
  };
}
