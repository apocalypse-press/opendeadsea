# Open Dead Sea

Public Dead Sea Scrolls transcription and machine-draft translation workspace.
Reading is open; GitHub sign-in is used only to suggest and review improvements.

Spec and built-vs-remaining ledger: `docs/ARCH-DSS-2026-CF-FREE.md`.  
Repo: https://github.com/apocalypse-press/opendeadsea  
Site: https://opendeadsea.org/

## Current state (2026-08-29)

Built: 1,027-manuscript catalog, original-language reading pages, 900 complete
machine-draft packs referenced by 904 catalog records, GitHub OAuth, D1-backed
public suggestions/comments/review, source links, and deterministic validators.
The remaining 123 catalog records have no published translation pack: 97
retain planned/error/invalid machine lines, and 26 Greek witnesses lack source
wording in the current corpus.

Remaining: sustained human review, accepted-translation release tooling, the
GitHub PR bridge, and full BDB/Jastrow ingestion.

First-draft machine-aid English is staged for manuscripts whose Explorer
drafts are complete: `python3 scripts/export_first_drafts.py`. An optional,
explicit Explorer recovery-publication overlay can replace only exact
hash-bound failed rows that passed the provider-free recovery audit; any drift
fails the export. Those packs are for human review, not the edition. The catalog then buckets every
manuscript as no translation, machine draft, human checked, or needs help
(`python3 scripts/export_translation_queue.py`). Partial/rejected Explorer work
stays unpublished and therefore remains in no translation.

The signed-in desk (`/account/`) stores translation suggestions, comments,
reviews, and approvals in D1. GitHub OAuth is live. Git history is shown on
`/history/`; turning an accepted suggestion into a GitHub PR remains separate
work.

## Layout

```text
site/                     Cloudflare Pages (lander + page templates)
functions/                GitHub OAuth + D1 suggestion/review API
schema/                   D1 and corpus contracts
corpus/mss/               Canonical generated manuscript records
corpus/translations/      Machine-draft packs and public queue
corpus/search-metadata.json  Canonical book aliases and named-scroll metadata
corpus/fragments/         Diplomatic JSON contract fixtures
site/m/                   Exact generated manuscript/chapter presentation
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
node scripts/validate-manuscripts.mjs
node scripts/validate-photo-links.mjs
node scripts/validate-search-metadata.mjs
node scripts/validate-translations.mjs
node scripts/validate-translation-queue.mjs
node scripts/test_search.mjs
node scripts/test_session.mjs
node scripts/test_review_api.mjs
node scripts/test_desk_store.mjs
node scripts/test_diagram.mjs
```

## Deploy

```bash
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=0008b5fcd92c808c166ce6fb25c4a12f
# Run from a clean repository root so Wrangler also compiles /functions.
sha="$(git rev-parse HEAD)"
npx wrangler pages deploy site --project-name=opendeadsea --branch=main \
  --commit-hash="$sha" --commit-message="$(git log -1 --pretty=%s)" \
  --commit-dirty=false
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
