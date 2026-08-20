import { SESSION_COOKIE, clearCookie, redirect, safeNext } from "../_lib/http.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const next = safeNext(url.searchParams.get("next"), "/");
  return redirect(next, [clearCookie(SESSION_COOKIE)]);
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
