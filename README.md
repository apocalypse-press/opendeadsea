# Open Dead Sea

Versioned Dead Sea Scrolls corpus. Public reading first. Gatekept community
edits through GitHub pull requests.

Spec and built-vs-remaining ledger: `docs/ARCH-DSS-2026-CF-FREE.md`.  
Code tree, imports, and Cloudflare/GitHub bindings: `docs/CODETREE-AND-CLOUD.md`.  
Repo: https://github.com/apocalypse-press/opendeadsea  
Site: https://opendeadsea.org/

## Built vs remaining (2026-08-18)

Built: lander, page templates, OAuth *routes*, D1 *schema*, fragment
schema + CI, academic morph codes, outbound plate links, CODEOWNERS stub.

Not built: PR-from-edit, live reputation in CI, full BDB/Jastrow ingestion,
votes/quorum, academic verification, edition translations (human-reviewed).

First-draft machine-aid English is staged for manuscripts whose Explorer
drafts are complete: `python3 scripts/export_first_drafts.py`. Those packs
are for human review, not the edition. The catalog then buckets every
manuscript as no translation, AI translation, human sign off, or human
edit recommended (`python3 scripts/export_translation_queue.py`).

Next human step: confirm the App is installed on this repo only. Next
machine step after secrets: `docs/AUTH.md`.

## Layout

```text
site/                     Cloudflare Pages (lander + page templates)
functions/                GitHub OAuth + /api/me (inert without secrets)
schema/d1.sql             Reputation and votes
schema/fragment.schema.json
corpus/fragments/         Diplomatic JSON (Git is source of truth)
docs/AUTH.md              How to drop App secrets later
docs/UI-TEMPLATES.md      Page kinds
docs/CODETREE-AND-CLOUD.md  Imports + Cloudflare/GitHub map
.github/workflows/pr-validation.yml
CODEOWNERS                Tier 3
```

## Checks

```bash
node scripts/validate-fragments.mjs
node scripts/validate-lexicon.mjs
node scripts/validate-translations.mjs
node scripts/validate-translation-queue.mjs
```

## Deploy

```bash
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=0008b5fcd92c808c166ce6fb25c4a12f
# Deploy from the repo root so /functions ship with site/.
npx wrangler pages deploy --project-name=opendeadsea --commit-dirty=true
```

Local:

```bash
npx wrangler pages dev
```

GitHub App setup is still manual (`docs/github-app-setup.md`). OAuth
wiring is documented in `docs/AUTH.md`. Do not put client secrets in
this repo.

D1:

```bash
npx wrangler d1 create opendeadsea-trust
npx wrangler d1 execute opendeadsea-trust --file=schema/d1.sql --remote
```


