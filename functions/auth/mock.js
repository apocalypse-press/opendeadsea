import { configured, redirect } from "../_lib/http.js";
import { setSessionCookie } from "../_lib/session.js";
import { upsertUser } from "../_lib/users.js";

const TIERS = {
  contributor: { id: "mock-1", login: "preview-contributor", tier: 1 },
  reviewer: { id: "mock-2", login: "preview-reviewer", tier: 2 },
  editor: { id: "mock-3", login: "preview-editor", tier: 3 },
};

export async function onRequestGet(context) {
  const { request, env } = context;
  if (env.AUTH_ALLOW_MOCK !== "1") {
    return new Response("Mock sign-in is off.", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("as") || "contributor";
  const persona = TIERS[key];
  if (!persona) {
    return new Response("Unknown preview persona.", { status: 400 });
  }

  if (configured(env) && env.DB) {
    await upsertUser(env, persona);
  }

  const cookie = await setSessionCookie(env, persona);
  return redirect("/account/?preview=1", [cookie]);
}
