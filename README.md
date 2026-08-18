# Open Dead Sea

Versioned Dead Sea Scrolls corpus. Public reading first. Gatekept community
edits through GitHub pull requests.

Spec: `docs/ARCH-DSS-2026-CF-FREE.md`.  
Repo: https://github.com/apocalypse-press/opendeadsea

## Layout

```text
site/                     Cloudflare Pages (lander now, reader later)
schema/d1.sql             Reputation and votes
schema/fragment.schema.json
corpus/fragments/         Diplomatic JSON (Git is source of truth)
.github/workflows/pr-validation.yml
CODEOWNERS                Tier 3
```

## Local

```bash
node scripts/validate-fragments.mjs
```

## Deploy

```bash
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=0008b5fcd92c808c166ce6fb25c4a12f
npx wrangler pages deploy site --project-name=opendeadsea --commit-dirty=true
```

D1:

```bash
npx wrangler d1 create opendeadsea-trust
npx wrangler d1 execute opendeadsea-trust --file=schema/d1.sql --remote
```

GitHub App registration is still manual. Do not put client secrets in this repo.
