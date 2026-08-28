# GitHub OAuth framework

Reading stays public. Sign-in lets a contributor suggest a translation as
themselves. GitHub OAuth and the production Pages secrets are live.

## Routes

| Path | Kind | What it does now |
|---|---|---|
| `/signin/` | Page | Explains GitHub. Button hits `/auth/login`. |
| `/auth/login` | Function | If secrets are missing, sends you back to `/signin/?reason=oauth-pending`. If present, starts GitHub OAuth with a signed state cookie. |
| `/auth/callback` | Function | Exchanges the code, loads the GitHub user, upserts D1 `users`, sets `ods_session`. |
| `/auth/logout` | Function | Clears the session cookie. |
| `/auth/mock` | Function | Fake session. Only when `AUTH_ALLOW_MOCK=1`. 404 otherwise. |
| `/api/me` | Function | `{ configured, mock, user, capabilities }`. |

`next` must be a same-origin path. `//evil` is rejected.

## Cookie

`ods_session` is HttpOnly, Secure, SameSite=Lax, seven days. Payload is
HMAC-SHA256 (`v1.body.sig`) with `SESSION_SECRET` (or the GitHub client
secret if that is all you have). It holds GitHub user id, login, and a
tier snapshot. Write routes reload the current tier from D1, so the cookie
cannot preserve revoked review authority. It does **not** store the GitHub access token. Opening a
pull request later will need a separate, encrypted store.

## Secrets (not in Git)

Set on the Pages project, production and preview separately, or in
`.dev.vars` for `wrangler pages dev`:

| Name | Role |
|---|---|
| `GITHUB_CLIENT_ID` | App client id |
| `GITHUB_CLIENT_SECRET` | App client secret |
| `SESSION_SECRET` | Cookie HMAC. Use a long random string. |
| `OAUTH_REDIRECT_URI` | Optional. Defaults to this origin + `/auth/callback`. |
| `AUTH_ALLOW_MOCK` | `1` only on a laptop. Never in production. |

```bash
npx wrangler pages secret put GITHUB_CLIENT_ID --project-name=opendeadsea
npx wrangler pages secret put GITHUB_CLIENT_SECRET --project-name=opendeadsea
npx wrangler pages secret put SESSION_SECRET --project-name=opendeadsea
```

The App callback URL must be exactly `https://opendeadsea.org/auth/callback`
(no trailing slash, not `www`). Login from `www` 301s to the apex first so
the OAuth cookie and GitHub see the same host. Add
`http://127.0.0.1:8788/auth/callback` when you want local OAuth. Preview
`*.pages.dev` needs its own callback row if you test OAuth there.

Do not paste the client secret or the PEM into chat or mail.

## Local UI without secrets

Optional laptop mock cookie:

```bash
# in .dev.vars
AUTH_ALLOW_MOCK=1
SESSION_SECRET=dev-only-not-for-production
```

Then `/auth/mock?as=contributor|reviewer|editor`.

## Built vs remaining (auth only)

Built: GitHub OAuth, signed session cookie, D1 user upsert, current-tier
authorization on writes, capability flags on `/api/me`, and a mock route that
stays 404 unless `AUTH_ALLOW_MOCK=1`.

Remaining: persist an appropriately scoped user/App token only if accepted
suggestions are later opened as GitHub pull requests. The current public
suggestion and review loop does not need that token.

Do not turn Bot Fight Mode back on until the new routes are walked with
the challenge JS. It blanked the lander once against CSP.
