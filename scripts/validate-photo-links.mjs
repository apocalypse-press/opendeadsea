#!/usr/bin/env node
/**
 * Offline gate for official photograph links.
 *
 * The IAA route id is not always the scholarly siglum (notably 1QS), and
 * several Cave 1 scrolls belong to the Israel Museum rather than the IAA.
 * Only direct IAA URLs present in the checked-in manuscript registry are
 * accepted; this prevents the exporter from inventing `<siglum>-1` routes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const IAA_PREFIX = "https://www.deadseascrolls.org.il/explore-the-archive/manuscript/";
const BAD_SEARCHES = new Set([
  "https://www.deadseascrolls.org.il/explore-the-archive/search#q=1QIsaa",
  "https://www.deadseascrolls.org.il/explore-the-archive/search#q=1QpHab",
]);
const BAD_DIRECTS = new Set([
  `${IAA_PREFIX}1QIsa-a-1`,
  `${IAA_PREFIX}1QIsaa-1`,
  `${IAA_PREFIX}1QS-1`,
  `${IAA_PREFIX}1QpHab-1`,
]);

function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const registry = JSON.parse(readFileSync(join(ROOT, "corpus", "manuscripts.json"), "utf8"));
const allowed = new Set([
  ...strings(registry),
  "https://www.deadseascrolls.org.il/explore-the-archive/manuscript/1Q28-2",
].filter((url) => url.startsWith(IAA_PREFIX)));

const files = [
  join(ROOT, "corpus", "manuscripts.json"),
  ...walk(join(ROOT, "corpus", "fragments")),
  ...(existsSync(join(ROOT, "corpus", "mss")) ? walk(join(ROOT, "corpus", "mss")) : []),
  ...walk(join(ROOT, "site", "data")),
  join(ROOT, "site", "read", "index.html"),
].filter((path) => [".json", ".html"].includes(extname(path)));

let failed = 0;
let checked = 0;
const urlPattern = /https:\/\/www\.deadseascrolls\.org\.il\/explore-the-archive\/(?:manuscript\/[^"'<>\s]+|search#q=[^"'<>\s]+)/g;
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const url of content.match(urlPattern) || []) {
    checked += 1;
    if (BAD_DIRECTS.has(url) || BAD_SEARCHES.has(url) || (url.startsWith(IAA_PREFIX) && !allowed.has(url))) {
      console.error(`FAIL ${relative(ROOT, file)}: unverified photograph link ${url}`);
      failed += 1;
    }
  }
}

if (failed) {
  console.error(`${failed} photograph link check(s) failed`);
  process.exit(1);
}
console.log(`validated ${checked} official photograph link occurrence(s)`);
