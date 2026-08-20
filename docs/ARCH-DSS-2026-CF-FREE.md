# ARCH-DSS-2026-CF-FREE

Dead Sea Scrolls versioned corpus and gatekept community edits.
Hosting target: Cloudflare Free plus GitHub.

This file is the working copy of the specification. Implementation status
is at the bottom. Tree, imports, and cloud bindings:
`docs/CODETREE-AND-CLOUD.md`.

## User tiers

| Tier | Name | Auth | Permissions |
|---|---|---|---|
| 0 | Public reader | None | Read consensus text and translations. Follow outbound links to official plate viewers. Export. View public PR history. |
| 1 | Contributor | GitHub OAuth | Open an edit request (GitHub PR under the user). Comment. Earn +10 per merged PR, +2 per accepted comment. |
| 2 | Peer reviewer | GitHub OAuth plus reputation above 500 or academic verification | Vote on PRs. Trigger preview builds. Two Tier 2 approvals merge a Tier 1 PR. |
| 3 | Maintainer | SSH key listed in CODEOWNERS | Emergency hotfix, trust override, write to `main`, academic verification. |

## Edit pipeline

1. Contributor clicks Suggest Edit on a line or token.
2. GitHub App user-to-server token opens a PR under that user. PR body carries reputation, change summary, fragment ids.
3. `pr-validation.yml` checks fragment JSON schema, posts a trust badge, posts a diff preview, applies anti-abuse checks.
4. Quorum (2x Tier 2 or 1x Tier 3) merges. Actions rebuild Pages.

No Cloudflare Worker is required to create the PR.

## Trust storage

Cloudflare D1 only. Schema: `schema/d1.sql`. Corpus text stays in Git.

## Official plates

We do **not** host multi-spectral or other gated imagery. Rights sit with
the IAA, the Shrine of the Book, and the libraries that published the
plates.

Each fragment record may include a `viewers` array of outbound `https`
links (label, url, optional note). The reader UI must open those in a
new browsing context and must never hotlink or proxy the image bytes.

Schema: `schema/fragment.schema.json` field `viewers`.

## Lexicon and lemma IDs

Canonical lemma ID is the **academic morph code**: the SBL-style
consonantal transliteration of the lexeme (`qol`, `qara`, `YHWH`).
Strong's numbers (`H6963`) and Goodrick-Kohlenberger numbers are
concordance keys, not the scholarly lemma — they may appear **only as
optional metadata** (`strongs`), never as the primary id.

Gloss from **BDB 1906** (public domain) keyed to that lexeme, not to a
number. For Aramaic tokens, Jastrow 1903 (public domain) plus an
outbound CAL link. Do not ingest HALOT, DCH, Cook, or CAL.

Optional machine alias: ETCBC `lex` transcription (`>MR[`) when joining
Text-Fabric / BHSA. That encoding is a computational convention, not a
church numbering. Abegg-derived DSS *values* in `~/dss` remain CC BY-NC
4.0 and are not copied into this repo.

Token fields: `t` is the surface form; `lex` is the lemma (academic
morph code). Lexicon records may carry optional `strongs` metadata.

## Implementation status (2026-08-18)

Public site: `https://opendeadsea.org/`. Repo:
`https://github.com/apocalypse-press/opendeadsea`. Pages project
`opendeadsea`. D1 `opendeadsea-trust`. Zone
`0f224b96eb513c9e884f0934e225d0cc`.

Furniture is live. Sign-in, votes, and the corpus are not.

### Built

| Area | What exists | Honest limit |
|---|---|---|
| DNS / host | `opendeadsea.org` on Cloudflare, apex/`www` proxied to Pages | No origin VPS |
| Lander | Coming-soon copy at `/` | Editing is not open |
| Page templates | Catalog, reader, work, lexeme, search, edit, proposal, review, account, sign-in, about, 404, `/preview/` | Sample / placeholder copy. Role bar is `sessionStorage`, not a session. |
| Reader | Token select, lemma link, outbound `viewers` (Leon Levy) | One diplomatic fragment: `1QIsa-a` Isaiah 40:3-5 (MT-collated) |
| Edit form | Gated by `capabilities.suggest`. Validates reading + reason. | Does not open a GitHub PR |
| OAuth routes | `/auth/login`, `/callback`, `/logout`, `/auth/mock` (off), `/api/me` | No App secrets. Login 302s to `oauth-pending`. Session cookie code is ready. Access token is not stored. |
| Trust schema | `schema/d1.sql` applied to D1. Login will upsert `users` when secrets exist. | No live rows from real sign-ins. `pr_votes` unused. |
| Corpus contract | `schema/fragment.schema.json`, `schema/lexicon.schema.json`, `schema/manuscript.schema.json`, `schema/translation.schema.json`, `schema/translation-queue.schema.json`, `scripts/validate-*.mjs` | Original-language wording from ETCBC/dss. First-draft English packs plus catalog queue buckets. Sources: `docs/SOURCES.md`. |
| Translation queue | Catalog chips and row badges from `site/data/translations/queue.json` | Human sign off is empty until `corpus/translation-queue-overrides.json` is set. Machine English is not the edition. |
| Desk | `/account/` queue, manuscript comment/suggest rail, `/proposal/` votes, `/history/` | GitHub App is still missing, so the loop runs on preview roles plus localStorage. D1 tables exist for when a real session writes. Two reviewer votes mark a proposal ready. An editor records approval. Not a GitHub merge yet. |
| Sentence diagram | Signed-in Diagram control only when a Macula parent tree exists. | MT/WLC syntax, not the Qumran line. No button when parent links are missing (Isaiah and some latter prophets) or for Greek NT. |
| Lemma rule | Academic morph code (`id` in `corpus/lexicon/`) is the primary key. `/lex/?q=` looks up the seeded Hebrew and Aramaic packs. Strong's is a public-domain lookup, never the key. CAL is outbound for Aramaic. | Full BDB 1906 / Jastrow 1903 ingestion still open |
| Plates | Outbound `https` viewers only. CSP does not allow remote images. | No hosted plates |
| License posture | Abegg ETCBC/dss and BHSA 2021 named as NC sources. Values not copied here. | Do not ingest those values until NC is accepted in writing |
| Governance stub | `CODEOWNERS` (`@elcafe7`). `pr-validation.yml` schema-checks fragments and posts a stub trust comment. | Comment does not read D1 |
| Docs | `docs/AUTH.md`, `docs/github-app-setup.md`, `docs/UI-TEMPLATES.md` | This file is the spec + ledger |

### Remaining

Do these in order. Later rows assume the earlier ones.

1. **GitHub App (human).** Create `Open Dead Sea` on `apocalypse-press`, install on this repo only. Hand-holding: `docs/github-app-setup.md`. Send back App ID, Client ID, slug, install confirmation. Never mail the client secret or PEM.
2. **Wrangler secrets.** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET` on the Pages project. Then `/auth/login` starts real GitHub OAuth. `docs/AUTH.md`.
3. **Store the user-to-server token** (encrypted). Needed before Suggest Edit can open a PR under the signed-in user. Cookie must not hold the GitHub token.
4. **Open a PR from `/edit/`.** Fragment id, token index, proposed form, reason, reputation in the PR body. Still no Worker required for the create step once the App token exists.
5. **D1 in CI.** Replace the stub trust comment with live `reputation_score` / `tier_level`. Anti-abuse checks beyond the schema validator.
6. **Translations** on the manuscript pages (machine aids). Original language is already on `/m/<siglum>/` from ETCBC/dss. Do not print BHSA glosses as the English of a line.
7. **Side-by-side editor.** Current vs proposed is live on `/proposal/?id=`. Still not a token-level fragment editor, and it does not open a GitHub PR.
8. **Votes.** Desk votes persist locally (and to D1 `proposal_votes` when a session exists). Two Tier 2 approvals mark `ready`. Tier 3 records `approved`. GitHub merge and Pages rebuild are still remaining.
9. **Lexica (full ingest).** Seeded Hebrew (Isaiah 40:3-5) and Aramaic lemmas are wired. Remaining: full BDB 1906 and Jastrow 1903 keyed to the academic morph code. Strong's stays metadata. No HALOT, no DCH.
10. **Academic verification.** Tier 3 write path. Reputation 500 or this flag promotes Tier 2.
11. **Translations** in the reader (machine aids, NC inherited if they ride on Abegg text).
12. **Export** of consensus text for readers (no account).

Out of scope until someone says otherwise: hosting plates, ingesting Abegg/BHSA values, Bot Fight Mode on the new routes (CSP already broke the lander once), DNSSEC, mail on this zone.
