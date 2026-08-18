# ARCH-DSS-2026-CF-FREE

Dead Sea Scrolls versioned corpus and gatekept community edits.
Hosting target: Cloudflare Free plus GitHub.

This file is the working copy of the specification. Implementation status
is at the bottom.

## User tiers

| Tier | Name | Auth | Permissions |
|---|---|---|---|
| 0 | Public reader | None | Read consensus text, translations, images. Export. View public PR history. |
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

Cloudflare D1 only. Schema: `schema/d1.sql`. Corpus text stays in Git. Images stay in R2 (not provisioned yet).

## Implementation status

- [x] Coming-soon lander on Cloudflare Pages
- [x] D1 schema
- [x] Fragment JSON schema and CI validator
- [x] CODEOWNERS stub
- [ ] GitHub App registration and OAuth
- [ ] D1 wired to CI for live reputation comments
- [ ] Side-by-side editor
- [ ] Visual alignment overlays
- [ ] R2 image bucket
- [ ] Academic verification workflow
