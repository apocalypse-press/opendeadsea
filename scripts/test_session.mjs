import { signPayload, verifyPayload } from "../functions/_lib/session.js";
import { safeNext } from "../functions/_lib/http.js";

const secret = "test-secret";
const payload = { sub: "1", login: "nate", exp: Math.floor(Date.now() / 1000) + 60 };
const token = await signPayload(secret, payload);
const back = await verifyPayload(secret, token);
if (!back || back.login !== "nate") throw new Error("round trip failed");

const bad = await verifyPayload("other", token);
if (bad) throw new Error("forged secret accepted");

const expired = await signPayload(secret, { sub: "1", login: "x", exp: 1 });
if (await verifyPayload(secret, expired)) throw new Error("expired accepted");

if (safeNext("/edit/") !== "/edit/") throw new Error("safe path rejected");
if (safeNext("//evil.example") !== "/") throw new Error("protocol-relative accepted");
if (safeNext("https://evil.example") !== "/") throw new Error("absolute accepted");

console.log("session helpers: pass");
