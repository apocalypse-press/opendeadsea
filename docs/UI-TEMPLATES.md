# Page templates

Inner pages share one chrome: skip link, ODS mark, catalog / works / search /
about, sign-in slot, footer. Tokens live in `site/tokens.css`. App
furniture is `site/app.css`. Lucide icons are the sprite in
`site/js/icons.js`. The distressed ODS wordmark is the favicon set at
the site root (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`) and the `.mark-glyph` in the header.

The lander at `/` stays the coming-soon public face. Templates are linked
from its footer and from `/preview/`.

| Kind | Path | Job |
|---|---|---|
| Lander | `/` | Promise of the edition. No app chrome. |
| Template index | `/preview/` | Map of every page kind. |
| Catalog | `/catalog/` | Manuscript list. Translation-queue chips: no translation, AI translation, human sign off, human edit recommended. Each row opens `/m/<siglum>/`. |
| Manuscript | `/m/<siglum>/` | Official IAA-style siglum page. Original-language wording from ETCBC/dss. Biblical scrolls with chapters open a hub, then `/m/<siglum>/<chapter>/`. |
| Reader | `/read/` | One line. Select a token. Outbound plate link. |
| Work | `/work/` | Biblical books. Open a book, then manuscripts or a chapter with every copy that still has it. |
| Community | `/community/` | Qumran community texts: commentaries, liturgies, and other Yahad works, then the copies. |
| Lexeme | `/lex/` | Academic morph code (SBL consonantal transliteration). Strong's shown as metadata, never as the key. |
| Search | `/search/` | Find a line, lemma, or manuscript. |
| Suggest edit | `/edit/` | Contributor form. Posts a desk proposal. Hidden until `capabilities.suggest`. |
| Proposal | `/proposal/?id=` | Current vs proposed, comments, reviewer votes, editor approval. |
| Review queue | `/review/` | Signed-in queue of comments and proposed readings. |
| Desk | `/account/` | Logged-in dashboard: queue, your proposals, git and site history. Preview a role until GitHub OAuth is live. |
| History | `/history/` | Git commits from the public repo plus the site's comment and approval record. |
| Sign in | `/signin/` | GitHub OAuth start. |
| About | `/about/` | Method, tiers, the two Hebrew sources. |
| Missing | `/404.html` | Honest miss. |

Preview a role from the bar on template pages. That is not a session.
Real `/api/me` wins when a cookie exists.

These pages are furniture. Catalog rows besides 1QIsa-a, works other
than the Isaiah sample, search hits, proposal votes, and account
reputation are placeholder copy. They exist so the chrome and the
capability gates can be judged before the corpus and OAuth secrets
exist. Built vs remaining: `docs/ARCH-DSS-2026-CF-FREE.md`.

Copy rules: no emoji, no em dash, no Strong's ids, no hosted plates.
