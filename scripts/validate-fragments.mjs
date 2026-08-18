#!/usr/bin/env node
/**
 * CI gate for fragment JSON under corpus/fragments/.
 * Validates schema, unique token indices, and required fields.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = join(ROOT, "corpus", "fragments");
const schema = JSON.parse(readFileSync(join(ROOT, "schema", "fragment.schema.json"), "utf8"));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

const files = walk(DIR);
let failed = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`FAIL ${rel}: invalid JSON (${err.message})`);
    failed += 1;
    continue;
  }
  const missing = (schema.required || []).filter((k) => !(k in data));
  if (missing.length) {
    console.error(`FAIL ${rel}: missing ${missing.join(", ")}`);
    failed += 1;
    continue;
  }
  if (!Array.isArray(data.tokens) || data.tokens.length < 1) {
    console.error(`FAIL ${rel}: tokens must be a non-empty array`);
    failed += 1;
    continue;
  }
  const seen = new Set();
  let bad = false;
  for (const tok of data.tokens) {
    if (typeof tok.i !== "number" || typeof tok.t !== "string" || tok.t.length < 1) {
      console.error(`FAIL ${rel}: token missing i/t`);
      bad = true;
      break;
    }
    if (seen.has(tok.i)) {
      console.error(`FAIL ${rel}: duplicate token index ${tok.i}`);
      bad = true;
      break;
    }
    seen.add(tok.i);
  }
  if (Array.isArray(data.viewers)) {
    for (const v of data.viewers) {
      if (!v || typeof v.label !== "string" || typeof v.url !== "string" || !v.url.startsWith("https://")) {
        console.error(`FAIL ${rel}: viewer needs label and https url`);
        bad = true;
        break;
      }
    }
  }
  if (bad) {
    failed += 1;
    continue;
  }
  console.log(`OK ${rel} (${data.tokens.length} tokens)`);
}

if (failed) {
  console.error(`${failed} fragment file(s) failed`);
  process.exit(1);
}
console.log(`validated ${files.length} fragment file(s)`);
