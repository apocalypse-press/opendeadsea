# ARCH-DSS-2026-CF-FREE

Dead Sea Scrolls versioned corpus and gatekept community edits.
Hosting target: Cloudflare Free plus GitHub.

This file is the working copy of the specification. Implementation status
is at the bottom.

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

Do **not** use Strong's numbers (`H559`, `G3056`) or Goodrick-Kohlenberger
numbers. Those are Protestant concordance keys, not the scholarly lemma.

Canonical lemma ID is the **consonantal lexeme in Unicode Hebrew or
Aramaic** (`אמר`, `מלך`). That is how BDB, HALOT, and the SBL Handbook
organize the language. Gloss from **BDB 1906** (public domain) keyed to
that lexeme, not to a number. For Aramaic tokens, Jastrow 1903 (public
domain) plus an outbound CAL link. Do not ingest HALOT, DCH, Cook, or CAL.

Optional machine alias: ETCBC `lex` transcription (`>MR[`) when joining
Text-Fabric / BHSA. That encoding is a computational convention, not a
church numbering. Abegg-derived DSS *values* in `~/dss` remain CC BY-NC
4.0 and are not copied into this repo.

Token fields: `t` is the surface form; `lex` is the lemma. Never `strongs`.

## Implementation status

- [x] Coming-soon lander on Cloudflare Pages
- [x] D1 schema
- [x] Fragment JSON schema and CI validator
- [x] Lemma IDs are Unicode lexemes, not Strong's
- [x] CODEOWNERS stub
- [ ] GitHub App registration and OAuth
- [ ] D1 wired to CI for live reputation comments
- [ ] Side-by-side editor
- [ ] Reader UI for `viewers` outbound plate links
- [ ] Academic verification workflow
