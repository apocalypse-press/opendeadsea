#!/usr/bin/env node
/**
 * CI gate for lexicon JSON under corpus/lexicon/.
 * Validates schema, unique ids, and that every fragment lex
 * resolves to a lexicon record in the matching language.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LEX_DIR = join(ROOT, "corpus", "lexicon");
const FRAG_DIR = join(ROOT, "corpus", "fragments");
const schema = JSON.parse(readFileSync(join(ROOT, "schema", "lexicon.schema.json"), "utf8"));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!name.endsWith(".json")) continue;
    out.push(p);
  }
  return out;
}

let failed = 0;
const lexByLang = { hebrew: new Set(), aramaic: new Set() };

for (const file of walk(LEX_DIR)) {
  const rel = relative(ROOT, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`FAIL ${rel}: invalid JSON (${err.message})`);
    failed += 1;
    continue;
  }
  if (!Array.isArray(data)) {
    console.error(`FAIL ${rel}: must be a JSON array of records`);
    failed += 1;
    continue;
  }
  const seen = new Set();
  for (const rec of data) {
    const label = rec && rec.id ? `${rel}#${rec.id}` : `${rel}#<no-id>`;
    if (!rec || typeof rec !== "object") {
      console.error(`FAIL ${label}: record must be an object`);
      failed += 1;
      continue;
    }
    const missing = (schema.required || []).filter((k) => !(k in rec));
    if (missing.length) {
      console.error(`FAIL ${label}: missing ${missing.join(", ")}`);
      failed += 1;
      continue;
    }
    const idPattern = new RegExp(schema.properties.id.pattern);
    if (!idPattern.test(rec.id)) {
      console.error(`FAIL ${label}: id must match ${schema.properties.id.pattern}`);
      failed += 1;
      continue;
    }
    if (seen.has(rec.id)) {
      console.error(`FAIL ${label}: duplicate id`);
      failed += 1;
    }
    seen.add(rec.id);
    if (rec.language && lexByLang[rec.language]) {
      lexByLang[rec.language].add(rec.id);
    }
  }
  console.log(`OK ${rel} (${data.length} records)`);
}

for (const file of walk(FRAG_DIR)) {
  const rel = relative(ROOT, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`FAIL ${rel}: invalid JSON (${err.message})`);
    failed += 1;
    continue;
  }
  const lang = data.language;
  if (!lexByLang[lang]) {
    console.error(`FAIL ${rel}: unknown fragment language ${lang}`);
    failed += 1;
    continue;
  }
  for (const tok of data.tokens || []) {
    if (tok.lex == null) continue;
    if (!lexByLang[lang].has(tok.lex)) {
      console.error(`FAIL ${rel}: lex "${tok.lex}" (token ${tok.i}) has no ${lang} lexicon record`);
      failed += 1;
    }
  }
  console.log(`LK  ${rel}: ${data.tokens ? data.tokens.length : 0} tokens cross-checked`);
}

if (failed) {
  console.error(`${failed} lexicon check(s) failed`);
  process.exit(1);
}
console.log("lexicon check passed");