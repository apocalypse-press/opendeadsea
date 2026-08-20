#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = join(ROOT, "corpus", "translations");
const schema = JSON.parse(readFileSync(join(ROOT, "schema", "translation.schema.json"), "utf8"));
let failed = 0;
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

const files = readdirSync(DIR).filter(
  (name) => name.endsWith(".json") && name !== "index.json" && name !== "queue.json",
);
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8"));
if (index.status !== "first-draft") fail("index.json: status must be first-draft");
if (index.manuscript_count !== files.length) {
  fail(`index.json: manuscript_count ${index.manuscript_count} != ${files.length} packs`);
}

for (const name of files) {
  const pack = JSON.parse(readFileSync(join(DIR, name), "utf8"));
  const label = `translations/${name}`;
  for (const k of schema.required) if (!(k in pack)) fail(`${label}: missing ${k}`);
  if (pack.status !== "first-draft") fail(`${label}: status`);
  if (pack.review !== "human-pending") fail(`${label}: review`);
  if (pack.id + ".json" !== name) fail(`${label}: id/filename mismatch`);
  const n = Object.keys(pack.lines || {}).length;
  if (pack.line_count && pack.line_count !== n) fail(`${label}: line_count ${pack.line_count} != ${n}`);
  if (n < 1) fail(`${label}: empty`);
}

console.log(`OK first-draft packs (${files.length})`);
if (failed) {
  console.error(`${failed} translation check(s) failed`);
  process.exit(1);
}
