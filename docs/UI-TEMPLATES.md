# Page templates

Inner pages share one chrome: skip link, ODS mark, catalog / works / search /
about, sign-in slot, footer. Tokens live in `site/tokens.css`. App
furniture is `site/app.css`. Lucide icons are the sprite in
`site/js/icons.js`. The distressed ODS wordmark is the favicon set at
the site root (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`) and the `.mark-glyph` in the header.

The lander at `/` sends readers directly to machine drafts and the catalog.
`/preview/` remains an internal map of page kinds, not part of the public flow.

| Kind | Path | Job |
|---|---|---|
| Lander | `/` | Promise of the edition. No app chrome. |
| Template index | `/preview/` | Map of every page kind. |
| Catalog | `/catalog/` | Manuscript list. Translation-queue chips: no translation, machine draft, human checked, needs help. Each row opens `/m/<siglum>/`. |
| Manuscript | `/m/<siglum>/` | Official IAA-style siglum page. Original-language wording from ETCBC/dss. Biblical scrolls with chapters open a hub, then `/m/<siglum>/<chapter>/`. |
| Reader | `/read/` | One line. Select a token. Outbound plate link. |
| Work | `/work/` | Biblical books. Open a book, then manuscripts or a chapter with every copy that still has it. |
| Community | `/community/` | Qumran community texts: commentaries, liturgies, and other Yahad works, then the copies. |
| Lexeme | `/lex/` | Academic morph code (SBL consonantal transliteration). Strong's shown as metadata, never as the key. |
| Search | `/search/` | Fuzzy manuscript/common-name, lemma, and Bible chapter lookup with fragmentary-coverage notices. |
| Suggest translation | `/edit/` | Contributor form. Posts a D1-backed public translation suggestion. |
| Proposal | `/proposal/?id=` | Current draft vs suggested translation, comments, review, editor approval. |
| Review queue | `/review/` | Public translation suggestions and discussion. |
| Desk | `/account/` | Logged-in dashboard: queue, your suggestions, git and site history. |
| History | `/history/` | Git commits from the public repo plus the site's comment and approval record. |
| Sign in | `/signin/` | GitHub OAuth start. |
| About | `/about/` | Method, tiers, the two Hebrew sources. |
| Missing | `/404.html` | Honest miss. |

Preview personas work only when the local API explicitly reports
`AUTH_ALLOW_MOCK=1`. Production ignores old preview state. Built vs remaining:
`docs/ARCH-DSS-2026-CF-FREE.md`.

Copy rules: no emoji, no em dash, no Strong's ids, no hosted plates.
