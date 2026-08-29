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

## Public edit pipeline

1. A reader clicks **Improve translation** on one machine-draft line.
2. GitHub OAuth identifies the contributor; the suggestion is saved to D1.
3. Editors comment and review it in the public desk.
4. An accepted suggestion is applied to the Git translation pack, validated,
   committed, and deployed.

The first three steps are live. Step four is currently a maintainer operation.
A GitHub App/PR bridge is optional later automation, not a dependency of the
public correction loop.

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

## Implementation status (2026-08-29)

Public site: `https://opendeadsea.org/`. Repo:
`https://github.com/apocalypse-press/opendeadsea`. Pages project
`opendeadsea`. D1 `opendeadsea-trust`. Zone
`0f224b96eb513c9e884f0934e225d0cc`.

The reading corpus, machine drafts, GitHub sign-in, and D1-backed public
suggestion desk are live. The public workflow is deliberately simple:
read a line, choose **Improve translation**, sign in, submit better English,
and follow its review.

### Built

| Area | What exists | Honest limit |
|---|---|---|
| DNS / host | `opendeadsea.org` on Cloudflare, apex/`www` proxied to Pages | No origin VPS |
| Lander | Direct reading and contribution path at `/` | No claim that machine English is checked |
| Reading site | Catalog, manuscript/chapter pages, works, community texts, fuzzy alias/reference search, lexeme, proposals, account, history | 1,027 catalog records; original wording from ETCBC/dss |
| Translation drafts | 896 complete packs, referenced by 900 catalog records where split catalog entries share a pack | Machine drafts remain clearly labeled and open for line correction; 127 records lack a publishable pack |
| Suggestion form | One-click **Improve translation** beside each draft line; optional note | Saves to D1 before showing success; no browser-only ghost proposal |
| OAuth routes | `/auth/login`, `/callback`, `/logout`, `/auth/mock` (off), `/api/me` | GitHub OAuth live. Access token is discarded after identity lookup. |
| Trust and desk | D1 users, proposals, comments, votes, approvals, and public events | Production preview personas disabled; write authorization reloads current D1 tier |
| Corpus contract | `schema/fragment.schema.json`, `schema/lexicon.schema.json`, `schema/manuscript.schema.json`, `schema/translation.schema.json`, `schema/translation-queue.schema.json`, `corpus/search-metadata.json`, `scripts/validate-*.mjs` | Original-language wording from ETCBC/dss. First-draft English packs plus catalog queue buckets. Sources: `docs/SOURCES.md`. |
| Translation queue | No translation, machine draft, human checked, pending approval | Only complete public packs are actionable; partial/rejected Explorer work stays unpublished |
| Desk | `/account/`, `/review/`, `/proposal/`, `/history/` | D1 is authoritative. Accepted suggestions are not yet folded automatically into a translation pack/Git release. |
| Sentence diagram | Public Diagram control, with no sign-in required, when a Macula parent tree exists. | MT/WLC syntax, not the Qumran line. No button when parent links are missing (Isaiah and some latter prophets) or for Greek NT. |
| Lemma rule | Academic morph code (`id` in `corpus/lexicon/`) is the primary key. Hebrew/Aramaic words link to `/lex/?q=`; copy controls are separate for original and English text. Strong's is a public-domain lookup, never the key. CAL is outbound for Aramaic. | Full BDB 1906 / Jastrow 1903 ingestion still open |
| Plates | Outbound `https` viewers only. CSP does not allow remote images. | No hosted plates |
| License posture | ETCBC/dss and BHSA 2021 are explicitly attributed under CC BY-NC 4.0 | Noncommercial terms apply to the public corpus and derived machine drafts |
| Governance stub | `CODEOWNERS` (`@elcafe7`). `pr-validation.yml` schema-checks fragments and posts a stub trust comment. | Comment does not read D1 |
| Docs | `docs/AUTH.md`, `docs/github-app-setup.md`, `docs/UI-TEMPLATES.md` | This file is the spec + ledger |

### Remaining

1. **Adoption and review.** Invite interested readers to correct machine drafts one line at a time. Human throughput, not more generation, is the immediate bottleneck.
2. **Accepted-change release path.** Give editors one boring, auditable command that applies an approved D1 suggestion to a translation pack, validates it, and prepares a commit.
3. **Clean release manifest.** Bind generated corpus/pages, source versions, hashes, and deployment to a named Git commit.
4. **GitHub PR bridge (optional).** Add this only if contribution volume makes D1-to-Git handoff burdensome; the public suggestion loop does not depend on it.
5. **Lexica.** Full BDB 1906 and Jastrow 1903 keyed to academic morph codes. Strong's stays optional metadata.

Out of scope until someone says otherwise: hosting plates, ingesting Abegg/BHSA values, Bot Fight Mode on the new routes (CSP already broke the lander once), DNSSEC, mail on this zone.
