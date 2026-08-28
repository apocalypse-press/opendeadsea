# Original-language sources

The Hebrew, Aramaic, and (rare) Greek wording on Open Dead Sea is not
composed here. It is imported from the local DSS Explorer database
(`~/dss-explorer/data/dss.sqlite3`), which itself is a read-only
flattening of two public Text-Fabric repositories. Both must be credited
on every manuscript page and on `/about/`.

Translations are not in this edition yet. Do not treat BHSA glosses as
English of a Qumran line.

## 1. Wording: ETCBC/dss

| | |
|---|---|
| Repo | https://github.com/ETCBC/dss |
| Dataset | Text-Fabric `dss` v2.0 |
| Commit imported here | `2403d16654984fc5567a5bd263086d9ad2a7a1dd` |
| License | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |
| What we take | Diplomatic transcription (`lines.text`): Hebrew, Aramaic, and a handful of Greek letters, with the editorial marks of the source |
| What we do not take (yet) | Translations, plates, BHSA glosses as English |

The transcriptions and morphological tagging were supplied by
**Martin G. Abegg, Jr.** and converted to Text-Fabric by the CACCHT
project (Jarod Jacobs, Martijn Naaijer, Dirk Roorda, Robert Rezetko,
Oliver Glanz, Willem van Peursen) at the Eep Talstra Centre for Bible
and Computer.

The wording primarily reflects the Discoveries in the Judaean Desert
series. Full upstream notes: ETCBC/dss `docs/about.md`,
`DSSB-Read me first`, and `QUMRAN - Read me first`.

Local checkout used by the importer: `~/dss-explorer/vendor/dss`
(same remote as `~/dss`).

Explorer import: `scripts/import_corpus.py` reads `vendor/dss/tf/2.0`
into SQLite. Open Dead Sea export: `scripts/export_orig_lang.py` reads
that SQLite and writes `corpus/mss/<siglum>.json`.

## 2. Lexical grounding: ETCBC/BHSA 2021

| | |
|---|---|
| Repo | https://github.com/ETCBC/bhsa |
| Dataset | Text-Fabric `bhsa` 2021 (`lex_utf8`, `voc_lex_utf8`, `gloss`) |
| License | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |
| What it is | Context-free Biblical Hebrew lexeme and gloss features |
| How explorer uses it | Lemma/gloss aids, and (upstream) morphological extras that Martijn Naaijer trained on BHSA and applied to DSS |
| What Open Dead Sea shows today | Credit only. Glosses are not printed as the English of a manuscript line |

Attribution: Eep Talstra Centre for Bible and Computer and the
contributors named by that repository.

Local files: `~/dss-explorer/vendor/bhsa-lexicon/`.

## License posture

Both corpora are **non-commercial**. This site is a 501(c)(3) public
edition: research, education, and private study. Do not reuse the
wording commercially without permission from the upstream rights
holders.

Required notice, short form (every manuscript page):

> Wording: ETCBC/dss (Abegg), CC BY-NC 4.0.
> Lexical grounding: ETCBC/BHSA 2021, CC BY-NC 4.0.

## Paleo-Hebrew

Eleven biblical manuscripts are paleo-Hebrew throughout. Abegg stores
their letters as square Unicode Hebrew; this site displays them in
**Noto Sans Phoenician** (SIL OFL 1.1, `site/fonts/`) by mapping Hebrew
consonants to the Unicode Phoenician block. A toggle on the manuscript
page restores square Hebrew.

| Siglum | Familiar name |
|---|---|
| 1Q3 | 1QpaleoLev-Num |
| 2Q5 | 2QpaleoLev |
| 4Q11 | 4QpaleoGen-Exod a |
| 4Q12 | 4QpaleoGen m |
| 4Q22 | 4QpaleoExod m |
| 4Q45 | 4QpaleoDeut r |
| 4Q46 | 4QpaleoDeut s |
| 4Q101 | 4QpaleoJob c |
| 6Q1 | 6QpaleoGen |
| 6Q2 | 6QpaleoLev |
| 11Q1 | 11QpaleoLev a |

Other manuscripts (about 57 in this dump) use paleo-Hebrew **selectively**,
almost always for the Tetragrammaton. Those words are tagged
`script=paleohebrew` in Explorer. The page shows paleo only on those
words; a toggle flattens them to square Hebrew if the reader wants.

## Greek witnesses not in Abegg

ETCBC/dss does not include Cave 4 LXX papyri, Cave 7, or 8HevXIIgr.
They are cataloged from IAA plate pages (`corpus/extra-mss.json`) so
they have a home. **DJD transcriptions are not copied.** Wording on
those pages is absent until a licensed Greek source is added.

## Not sources of the wording

- Leon Levy Dead Sea Scrolls Digital Library (IAA): outbound photographs only. All rights reserved there.
- Israel Museum Digital Dead Sea Scrolls: outbound featured-scroll pages only.
- BDB 1906 and Jastrow 1903: planned public-domain glosses for this site, not the Qumran transcription.
- BHSA glosses are lexical grounding, not the English of a Qumran line.

## Sentence diagrams (logged-in)

Bibla Lingua Macula Hebrew trees for biblical verses that survive in the
catalog. The diagram is the Masoretic (WLC) syntax of that verse, not the
Qumran diplomatic line.

```sh
python3 scripts/export_diagrams.py
```

Writes `site/data/diagrams/<BOOK>.json`. The manuscript rail's Diagram
control is shown only when a real Macula parent tree exists. Verses without
parent links are not offered. It is not the Qumran diplomatic line.

## First-draft English (machine-aid)

Manuscripts whose DSS Explorer detached drafts are complete (every unique
line `valid`; nothing left but human review) are staged as first drafts:

```sh
python3 scripts/export_first_drafts.py
```

Writes `corpus/translations/<siglum>.json` and a served copy under
`site/data/translations/`. The manuscript page loads that pack and shows
`line.en` as a first draft. It is not the edition translation. Incomplete
manuscripts (planned, error, or invalid leftovers) are held back.

## Translation queue (catalog buckets)

Every catalog manuscript is in one public queue bucket:

| Bucket | Key | How it is assigned |
|---|---|---|
| No translation | `none` | No complete public draft pack. Partial or rejected machine work stays private. |
| Machine draft | `ai` | A complete first-draft pack is on the site and open for correction. |
| Human checked | `signoff` | Maintainer override after a person checks the English. |
| Needs help | `edit` | Maintainer override for a published pack that should be corrected before signoff. |

```sh
python3 scripts/export_translation_queue.py
```

Writes `corpus/translations/queue.json` and `site/data/translations/queue.json`.
The catalog facet reads that file. To mark a manuscript human checked or to
flag a published machine pack for focused help, edit
`corpus/translation-queue-overrides.json` and re-run the exporter. Do not
put overrides under `corpus/translations/` (`export_first_drafts.py`
deletes that directory).

## Regenerating wording

```sh
python3 scripts/export_orig_lang.py
```

Needs the Explorer SQLite at `~/dss-explorer/data/dss.sqlite3`. Writes
`corpus/manuscripts.json`, `corpus/mss/*.json`, copies under `site/data/`,
and a page at `site/m/<siglum>/index.html` for every scroll.
