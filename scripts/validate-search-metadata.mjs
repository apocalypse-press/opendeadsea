#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const corpusPath = join(ROOT, "corpus", "search-metadata.json");
const sitePath = join(ROOT, "site", "data", "search-metadata.json");
const corpusBlob = readFileSync(corpusPath, "utf8");
const siteBlob = readFileSync(sitePath, "utf8");
const metadata = JSON.parse(corpusBlob);
const catalog = JSON.parse(readFileSync(join(ROOT, "corpus", "manuscripts.json"), "utf8"));
const coverage = JSON.parse(readFileSync(join(ROOT, "corpus", "works", "coverage.json"), "utf8"));
let failed = 0;

function fail(message) {
  failed += 1;
  console.error(`FAIL ${message}`);
}

if (corpusBlob !== siteBlob) fail("corpus and site search metadata differ; run scripts/export_search_metadata.py");
if (metadata.version !== 1) fail("search metadata version must be 1");
if (!Array.isArray(metadata.books) || metadata.books.length !== 39) fail("books must contain the 39 common English Hebrew-Bible divisions");

const bookIds = new Set();
for (const book of metadata.books || []) {
  if (!book.id || !book.name) fail("every book needs id and name");
  if (!Number.isInteger(book.chapters) || book.chapters < 1) fail(`${book.id || "book"} has invalid chapter count`);
  if (!Array.isArray(book.aliases) || !book.aliases.length) fail(`${book.id || "book"} needs aliases`);
  if (bookIds.has(String(book.id).toLowerCase())) fail(`duplicate book id ${book.id}`);
  bookIds.add(String(book.id).toLowerCase());
}

const catalogByKey = new Map();
for (const manuscript of catalog) {
  catalogByKey.set(String(manuscript.id).toLowerCase(), manuscript);
  catalogByKey.set(String(manuscript.label || "").toLowerCase(), manuscript);
}
for (const [key, record] of Object.entries(metadata.scrolls || {})) {
  const manuscript = catalogByKey.get(key.toLowerCase());
  if (!manuscript) {
    fail(`scroll metadata key ${key} does not resolve to a catalog id or label`);
    continue;
  }
  if (!Array.isArray(record.aliases) || !record.aliases.length) fail(`${key} needs aliases`);
  if (!record.summary) fail(`${key} needs a search summary`);
  if (JSON.stringify(manuscript.aliases || []) !== JSON.stringify(record.aliases || [])) fail(`${key} aliases not exported to catalog`);
  if (manuscript.search_summary !== record.summary) fail(`${key} summary not exported to catalog`);
}

for (const witness of coverage) {
  for (const book of witness.books || []) {
    if (!bookIds.has(String(book.book).toLowerCase())) fail(`coverage book ${book.book} is absent from search metadata`);
  }
}

if (failed) {
  console.error(`${failed} search-metadata check(s) failed`);
  process.exit(1);
}
console.log(`OK search metadata (${metadata.books.length} books; ${Object.keys(metadata.scrolls || {}).length} named scrolls)`);
