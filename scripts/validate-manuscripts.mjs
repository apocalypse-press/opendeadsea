#!/usr/bin/env node
/**
 * CI gate for the manuscript registry (corpus/manuscripts.json)
 * and bible works coverage (corpus/works/).
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MSS = join(ROOT, "corpus", "manuscripts.json");
const BIBLE = join(ROOT, "corpus", "works", "bible.json");
const COVERAGE = join(ROOT, "corpus", "works", "coverage.json");
const schema = JSON.parse(readFileSync(join(ROOT, "schema", "manuscript.schema.json"), "utf8"));

let failed = 0;
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

const mss = JSON.parse(readFileSync(MSS, "utf8"));
const idPattern = new RegExp(schema.properties.id.pattern);
const ids = new Set();
for (const rec of mss) {
  const label = rec && rec.id ? `manuscripts.json#${rec.id}` : "manuscripts.json#<no-id>";
  if (!rec || typeof rec !== "object") { fail(`${label}: record must be an object`); continue; }
  for (const k of schema.required) if (!(k in rec)) fail(`${label}: missing ${k}`);
  if (rec.id && !idPattern.test(rec.id)) fail(`${label}: bad id`);
  if (!rec.path || !String(rec.path).startsWith("/m/")) fail(`${label}: missing path`);
  if (!rec.label) fail(`${label}: missing official label`);
  if (ids.has(rec.id)) fail(`${label}: duplicate id`);
  ids.add(rec.id);
}
console.log(`OK manuscripts.json (${mss.length} records)`);

const bible = JSON.parse(readFileSync(BIBLE, "utf8"));
for (const b of bible.books) {
  if (!b.id || !b.name || !Array.isArray(b.verses)) fail(`bible.json book missing fields`);
}
console.log(`OK bible.json (${bible.books.length} books)`);

const coverage = JSON.parse(readFileSync(COVERAGE, "utf8"));
const covScrolls = new Set(coverage.map((c) => c.scroll));
const regScrolls = new Set();
for (const m of mss) {
  if (m.id) regScrolls.add(m.id.toLowerCase());
  if (m.label) regScrolls.add(m.label.toLowerCase());
}
for (const s of covScrolls) {
  if (!regScrolls.has(String(s).toLowerCase())) fail(`coverage.json scroll ${s} missing from manuscripts.json`);
}
console.log(`OK coverage.json (${coverage.length} scrolls with biblical lines)`);

if (failed) {
  console.error(`${failed} manuscript check(s) failed`);
  process.exit(1);
}
console.log("manuscript check passed");