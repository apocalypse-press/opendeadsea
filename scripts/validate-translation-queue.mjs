#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const QUEUE = join(ROOT, "corpus", "translations", "queue.json");
const SITE = join(ROOT, "site", "data", "translations", "queue.json");
const CATALOG = join(ROOT, "corpus", "manuscripts.json");
const OVERRIDES = join(ROOT, "corpus", "translation-queue-overrides.json");
const schema = JSON.parse(readFileSync(join(ROOT, "schema", "translation-queue.schema.json"), "utf8"));
const packIndex = JSON.parse(readFileSync(join(ROOT, "corpus", "translations", "index.json"), "utf8"));

let failed = 0;
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

const payload = JSON.parse(readFileSync(QUEUE, "utf8"));
const site = JSON.parse(readFileSync(SITE, "utf8"));
const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const overrides = JSON.parse(readFileSync(OVERRIDES, "utf8"));
const keys = new Set((schema.properties.default.enum || []));

if (JSON.stringify(payload) !== JSON.stringify(site)) {
  fail("site/data/translations/queue.json drifted from corpus copy");
}
for (const k of schema.required) if (!(k in payload)) fail(`queue.json: missing ${k}`);
if (payload.default !== "none") fail("queue.json: default must be none");
const bucketKeys = (payload.buckets || []).map((b) => b.key);
if (bucketKeys.join(",") !== "none,ai,signoff,edit") fail("queue.json: buckets order");

const catalogIds = new Set(catalog.map((m) => m.id));
const packIds = new Set((packIndex.manuscripts || []).map((m) => m.id));
const rows = payload.manuscripts || {};
for (const id of catalogIds) {
  if (!rows[id]) fail(`queue.json: missing catalog id ${id}`);
}
for (const id of Object.keys(rows)) {
  if (!catalogIds.has(id)) fail(`queue.json: unknown id ${id}`);
  const rec = rows[id];
  if (!keys.has(rec.queue)) fail(`queue.json#${id}: bad queue`);
  if (rec.source !== "derived" && rec.source !== "override") fail(`queue.json#${id}: bad source`);
  if (rec.pack && !rec.pack_id) fail(`queue.json#${id}: pack has no pack_id`);
  if (!rec.pack && rec.pack_id) fail(`queue.json#${id}: pack_id set while pack is false`);
  if (rec.pack_id && !packIds.has(rec.pack_id)) fail(`queue.json#${id}: missing pack ${rec.pack_id}`);
  if ((rec.queue === "ai" || rec.queue === "signoff" || rec.queue === "edit") && !rec.pack_id) {
    fail(`queue.json#${id}: ${rec.queue} queue has no published pack`);
  }
}

const counted = { none: 0, ai: 0, signoff: 0, edit: 0 };
for (const rec of Object.values(rows)) counted[rec.queue] += 1;
for (const key of keys) {
  if (counted[key] !== payload.counts[key]) {
    fail(`queue.json: counts.${key} ${payload.counts[key]} != ${counted[key]}`);
  }
}
if (payload.manuscript_count !== catalog.length) {
  fail(`queue.json: manuscript_count ${payload.manuscript_count} != ${catalog.length}`);
}

for (const [id, rec] of Object.entries(overrides.overrides || {})) {
  if (!catalogIds.has(id)) fail(`overrides: unknown id ${id}`);
  if (!keys.has(rec.queue)) fail(`overrides#${id}: bad queue`);
  if (!rows[id] || rows[id].source !== "override" || rows[id].queue !== rec.queue) {
    fail(`queue.json#${id}: override not applied`);
  }
}

console.log(
  `OK translation queue (${catalog.length} manuscripts; none=${counted.none} ai=${counted.ai} signoff=${counted.signoff} edit=${counted.edit})`,
);
if (failed) {
  console.error(`${failed} translation-queue check(s) failed`);
  process.exit(1);
}
