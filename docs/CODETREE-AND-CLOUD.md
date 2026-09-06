# Code tree, dependencies, and cloud

Operational map for the Open Dead Sea release as of 2026-09-06. Product
status and remaining work live in `docs/ARCH-DSS-2026-CF-FREE.md`.

There is no application package or npm runtime. Pages Functions are plain
ES modules, the browser loads static JavaScript, and Python/Node scripts build
and validate the checked-in corpus. Wrangler is used only for Pages/D1 work.

## Repository tree

```text
opendeadsea/
  corpus/                         Canonical, versioned publication data
    mss/                          1,027 manuscript records
    works/                        Biblical work/coverage indexes
    translations/                Complete machine-aid first-draft packs
    translation-work-queue.json  Provider-free unpublished source-work plan
    lexicon/                      Seed Hebrew/Aramaic lemma records
    fragments/                    Small diplomatic fragment contract fixtures
    manuscripts.json             Catalog index
    extra-mss.json                Curated records absent from ETCBC/dss
    iaa-names.json                IAA identity and plate-page metadata

  site/                           Cloudflare Pages static output
    m/                            Generated manuscript/chapter routes
    work/                         Works index and generated work routes
    data/mss/                     Served copy of corpus/mss
    data/works/                   Served copy of corpus/works
    data/translations/            Served translation packs and queue
    data/manuscripts.json         Served catalog index
    js/mss-page.js                Manuscript reader and line correction links
    js/edit.js                    Translation suggestion form
    js/desk-store.js              D1 API client; server results are authoritative
    js/desk-pages.js              Account/review/proposal/history views
    js/session.js                 GET /api/me and capability gates
    index.html, catalog/, search/, about/, signin/
    account/, review/, proposal/, history/, community/, lex/

  functions/                      Cloudflare Pages Functions
    auth/                         GitHub login, callback, logout; local mock
    api/me.js                     Current public session
    api/desk.js                   D1 desk plus Git history
    api/proposals.js              Authenticated proposal creation
    api/comments.js               Authenticated comments
    api/proposals/[id]/vote.js    Current-tier reviewer vote
    api/proposals/[id]/approve.js Current-tier maintainer approval
    api/history.js                Public Git/D1 event history
    _lib/                         HTTP, session, GitHub, D1 and review helpers
    _middleware.js                Canonical www redirect

  scripts/
    export_orig_lang.py           Explorer DB -> corpus/mss + site pages/data
    export_first_drafts.py        Complete detached drafts -> translation packs
    export_translation_queue.py   Catalog-wide publication queue
    export_translation_work_queue.py  Hash-bound unpublished source queue
    export_diagrams.py            Available syntax diagrams
    validate-*.mjs                Deterministic corpus/release gates
    test_*.mjs, test_*.py         Session, API, desk, diagram, queue checks

  schema/                         JSON contracts and D1 schema
  .github/workflows/              Pull-request validation
  wrangler.toml                   Pages output, compatibility date, D1 binding
```

The generated `corpus/mss/` and `site/data/mss/` trees are byte-identical;
the same invariant holds for `corpus/works/` and `site/data/works/`. Both
copies are committed because Git is the release source while Pages serves only
`site/`. Generated `site/m/` and `site/work/` routes are committed so a clone
contains the exact deployed presentation without needing the external Explorer
database.

## Data lineage

```text
~/dss-explorer/data/dss.sqlite3
  -> scripts/export_orig_lang.py
  -> corpus/manuscripts.json + corpus/mss/ + corpus/works/
  -> site/data/manuscripts.json + site/data/mss/ + site/data/works/
  -> site/m/ + site/work/

~/dss-explorer/reviews/*-detached-drafts.json
~/dss-explorer/reviews/dss-command-a-03-2025-recovery-publication-overlay.json
  -> scripts/detached_draft_sources.py (fail-closed provenance merge)
  -> scripts/export_first_drafts.py
  -> corpus/translations/ + site/data/translations/
  -> scripts/export_translation_queue.py
  -> corpus/translations/queue.json + served copy

corpus/manuscripts.json + corpus/translations/queue.json
~/dss-explorer/reviews/*-detached-drafts.json
~/dss-explorer/data/dss.sqlite3
  -> scripts/export_translation_work_queue.py (current source/hash checks)
  -> corpus/translation-work-queue.json (internal planning only; not served)
```

Original-language wording is derived from the pinned ETCBC/dss commit recorded
in `scripts/export_orig_lang.py`; license and attribution are in
`docs/SOURCES.md`. Translation packs retain their model, prompt, source-commit,
source-hash, and review status. Recovered rows are accepted only through the
explicit overlay after its result, plan, artifact, row, and corpus hashes are
rechecked. Partial or rejected Explorer drafts are not
published as editable English.

## Browser and edge flows

Reading is anonymous. A manuscript route loads its JSON record, optional
translation pack, translation queue, and `/api/me`. A machine-draft line links
to `/edit/` with only that line's reference and current English. The contributor
signs in with GitHub, submits replacement English, and receives the proposal ID
returned by D1 before the browser shows success.

```text
GET /m/<id>/<chapter>/
  -> static HTML + /js/mss-page.js
  -> /data/mss/<id>.json
  -> /data/translations/<pack>.json + queue.json
  -> GET /api/me

POST /api/proposals
  -> signed session -> current D1 user/tier
  -> proposals + edition_events insert
  -> 201 with server-issued proposal id
  -> /proposal/?id=<id>
```

Review writes reload the current D1 user instead of trusting the tier snapshot
in the cookie. Production ignores preview personas and `/auth/mock` unless
`AUTH_ALLOW_MOCK=1` is deliberately set in a non-production environment.

GitHub OAuth uses a signed ten-minute state cookie and a signed seven-day
session cookie. The GitHub access token is discarded after identity lookup.
No OAuth token or corpus data is stored in the browser.

## Cloud objects

| Object | Name | Role |
|---|---|---|
| Zone | `opendeadsea.org` | Cloudflare authoritative DNS and custom domain |
| Pages project | `opendeadsea` | `site/` assets plus compiled `functions/` |
| D1 database | `opendeadsea-trust`, binding `DB` | Users, suggestions, comments, reviews, events |
| GitHub repository | `apocalypse-press/opendeadsea` | Release source and validation history |
| GitHub OAuth app | Open Dead Sea | Login identity only |
| GitHub App | Not required/currently absent | Optional future D1-to-PR bridge |

Cloudflare Pages is a Direct Upload project. Wrangler must run from the
repository root: current Cloudflare behavior uploads `site/` and compiles the
sibling `functions/` directory. Dashboard drag-and-drop must not be used because
it does not compile Pages Functions.

## Bindings and secrets

| Name | Kind | Use |
|---|---|---|
| `DB` | D1 binding | Session user, desk, proposals, comments, review |
| `GITHUB_CLIENT_ID` | Pages secret | OAuth authorization/callback |
| `GITHUB_CLIENT_SECRET` | Pages secret | OAuth token exchange |
| `SESSION_SECRET` | Pages secret | OAuth state and session HMAC |
| `OAUTH_REDIRECT_URI` | Optional variable | Defaults to origin `/auth/callback` |
| `AUTH_ALLOW_MOCK` | Local/preview variable | Must remain unset in production |

`.dev.vars` and `.env*` are ignored. `.dev.vars.example` contains names and
placeholders only. Secrets never belong in Git, deployment arguments, docs, or
browser JavaScript.

## Release procedure

From a clean `main` checkout:

```bash
python3 scripts/test_translation_queue.py
node scripts/validate-fragments.mjs
node scripts/validate-lexicon.mjs
node scripts/validate-manuscripts.mjs
node scripts/validate-photo-links.mjs
node scripts/validate-search-metadata.mjs
node scripts/validate-translations.mjs
node scripts/validate-translation-queue.mjs
node scripts/validate-translation-work-queue.mjs
node scripts/test_search.mjs
node scripts/test_session.mjs
node scripts/test_review_api.mjs
node scripts/test_desk_store.mjs
node scripts/test_diagram.mjs

sha="$(git rev-parse HEAD)"
npx wrangler pages deploy site --project-name=opendeadsea --branch=main \
  --commit-hash="$sha" --commit-message="$(git log -1 --pretty=%s)" \
  --commit-dirty=false
```

The deployment record binds the published asset/function bundle to the exact
Git commit. The custom domain and deployment URL are then checked for OAuth
redirects, anonymous write rejection, D1 desk source, catalog/queue counts,
translation rendering, split-manuscript pack aliases, and static asset hashes.

## Boundaries

- Photographs remain outbound links to their publishing institutions. No plate
  image is hosted, proxied, or hotlinked.
- Corpus text and generated pages live in Git/Pages; contributor state lives in
  D1; identity is GitHub OAuth.
- Accepted D1 suggestions are not yet applied automatically to Git. That is the
  remaining editorial release step.
- The GitHub App and automatic PR bridge are optional later automation.
- DNS, mail records, and DNSSEC are outside this deployment.
