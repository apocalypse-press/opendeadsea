#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WORK_QUEUE = join(ROOT, "corpus", "translation-work-queue.json");
const CATALOG = join(ROOT, "corpus", "manuscripts.json");
const PUBLIC_QUEUE = join(ROOT, "corpus", "translations", "queue.json");
const SCHEMA = join(ROOT, "schema", "translation-work-queue.schema.json");
const SHA256 = /^[0-9a-f]{64}$/;
const STATUSES = ["planned", "invalid", "error"];

let failed = 0;
function fail(message) {
  console.error(`FAIL ${message}`);
  failed += 1;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return createHash("sha256").update(JSON.stringify(sortDeep(value)), "utf8").digest("hex");
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const payload = JSON.parse(readFileSync(WORK_QUEUE, "utf8"));
const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const publicQueue = JSON.parse(readFileSync(PUBLIC_QUEUE, "utf8"));
const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));

for (const key of schema.required || []) {
  if (!(key in payload)) fail(`work queue missing ${key}`);
}
if (payload.queue_version !== "opendeadsea-untranslated-source-work-queue-v1") {
  fail("unexpected work-queue version");
}
if (!String(payload.authorization || "").includes("cannot call a provider")) {
  fail("work queue lacks its provider-free non-authorization boundary");
}
if (!String(payload.authorization || "").includes("unfreeze")) {
  fail("work queue lacks its production-freeze boundary");
}
if (payload.source?.catalog_path !== "corpus/manuscripts.json") fail("catalog path drift");
if (payload.source?.public_queue_path !== "corpus/translations/queue.json") fail("public queue path drift");
if (payload.source?.catalog_sha256 !== fileSha256(CATALOG)) fail("catalog file hash drift");
if (payload.source?.public_queue_sha256 !== fileSha256(PUBLIC_QUEUE)) fail("public queue file hash drift");

const queueMaterial = { ...payload };
delete queueMaterial.queue_sha256;
if (!SHA256.test(String(payload.queue_sha256 || ""))) fail("queue_sha256 shape");
if (payload.queue_sha256 !== canonicalSha256(queueMaterial)) fail("queue_sha256 mismatch");

const catalogById = new Map(catalog.map((record) => [record.id, record]));
const untranslatedIds = new Set(
  catalog.filter((record) => publicQueue.manuscripts?.[record.id]?.queue === "none").map((record) => record.id),
);
const coveredIds = new Set();
const lineIds = new Set();
const statusTotals = Object.fromEntries(STATUSES.map((status) => [status, 0]));
const languageTotals = {};
let queuedLines = 0;

for (const record of payload.records || []) {
  const label = `record ${record.catalog_id || "?"}`;
  const catalogRecord = catalogById.get(record.catalog_id);
  if (!catalogRecord) fail(`${label}: unknown catalog ID`);
  if (!untranslatedIds.has(record.catalog_id)) fail(`${label}: public queue is not none`);
  if (coveredIds.has(record.catalog_id)) fail(`${label}: duplicate catalog ID`);
  coveredIds.add(record.catalog_id);
  if (record.label !== catalogRecord?.label || record.path !== catalogRecord?.path) {
    fail(`${label}: catalog identity drift`);
  }
  if (record.lines_with_text !== Number(catalogRecord?.lines_with_text || 0)) {
    fail(`${label}: lines_with_text drift`);
  }
  const recordMaterial = { ...record };
  delete recordMaterial.record_sha256;
  if (!SHA256.test(String(record.record_sha256 || ""))) fail(`${label}: record_sha256 shape`);
  if (record.record_sha256 !== canonicalSha256(recordMaterial)) fail(`${label}: record_sha256 mismatch`);
  if (record.queue_line_count !== (record.items || []).length || record.queue_line_count < 1) {
    fail(`${label}: queue line count mismatch`);
  }
  const localStatuses = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const item of record.items || []) {
    const itemLabel = `${label} line ${item.line_id || "?"}`;
    if (lineIds.has(item.line_id)) fail(`${itemLabel}: duplicate line ID`);
    lineIds.add(item.line_id);
    queuedLines += 1;
    if (item.scroll_label !== record.label) fail(`${itemLabel}: scroll label differs from record`);
    if (item.source_available !== true || Number(item.word_count) < 1) {
      fail(`${itemLabel}: source availability contract`);
    }
    for (const key of ["source_hash", "source_evidence_sha256", "cohort_item_sha256", "queue_item_sha256"]) {
      if (!SHA256.test(String(item[key] || ""))) fail(`${itemLabel}: ${key} shape`);
    }
    if (!STATUSES.includes(item.prior_status)) fail(`${itemLabel}: unresolved status`);
    else {
      localStatuses[item.prior_status] += 1;
      statusTotals[item.prior_status] += 1;
    }
    const itemMaterial = { ...item };
    delete itemMaterial.queue_item_sha256;
    if (item.queue_item_sha256 !== canonicalSha256(itemMaterial)) fail(`${itemLabel}: queue item hash mismatch`);
    languageTotals[item.source_languages] = (languageTotals[item.source_languages] || 0) + 1;
  }
  for (const status of STATUSES) {
    if (record.prior_status_counts?.[status] !== localStatuses[status]) {
      fail(`${label}: ${status} count mismatch`);
    }
  }
  const allStatusCount = Object.values(record.prior_status_counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (record.detached_line_count !== allStatusCount) fail(`${label}: detached line count mismatch`);
}

for (const record of payload.excluded_records || []) {
  const label = `excluded ${record.catalog_id || "?"}`;
  const catalogRecord = catalogById.get(record.catalog_id);
  if (!catalogRecord) fail(`${label}: unknown catalog ID`);
  if (!untranslatedIds.has(record.catalog_id)) fail(`${label}: public queue is not none`);
  if (coveredIds.has(record.catalog_id)) fail(`${label}: duplicate catalog ID`);
  coveredIds.add(record.catalog_id);
  if (record.label !== catalogRecord?.label || record.path !== catalogRecord?.path) {
    fail(`${label}: catalog identity drift`);
  }
  if (record.lines_with_text !== 0 || Number(catalogRecord?.lines_with_text || 0) !== 0) {
    fail(`${label}: excluded record has catalog source wording`);
  }
  if (record.reason !== "no_source_wording_in_current_corpus") fail(`${label}: exclusion reason`);
  if (record.disposition !== "source_acquisition_required") fail(`${label}: exclusion disposition`);
}

for (const id of untranslatedIds) if (!coveredIds.has(id)) fail(`untranslated catalog ID ${id} is uncovered`);
for (const id of coveredIds) if (!untranslatedIds.has(id)) fail(`covered catalog ID ${id} is not untranslated`);

const summary = payload.summary || {};
if (summary.catalog_records !== catalog.length) fail("summary catalog_records");
if (summary.untranslated_records !== untranslatedIds.size) fail("summary untranslated_records");
if (summary.eligible_records !== (payload.records || []).length) fail("summary eligible_records");
if (summary.excluded_records !== (payload.excluded_records || []).length) fail("summary excluded_records");
if (summary.eligible_records + summary.excluded_records !== summary.untranslated_records) {
  fail("summary eligible/excluded coverage");
}
if (summary.queued_lines !== queuedLines) fail("summary queued_lines");
for (const status of STATUSES) {
  if (summary.prior_statuses?.[status] !== statusTotals[status]) fail(`summary prior_statuses.${status}`);
}
if (JSON.stringify(sortDeep(summary.source_languages || {})) !== JSON.stringify(sortDeep(languageTotals))) {
  fail("summary source_languages");
}

console.log(
  `OK translation work queue (${summary.eligible_records} source-backed records / ${summary.queued_lines} lines; ${summary.excluded_records} no-source exclusions)`,
);
if (failed) {
  console.error(`${failed} translation-work-queue check(s) failed`);
  process.exit(1);
}
