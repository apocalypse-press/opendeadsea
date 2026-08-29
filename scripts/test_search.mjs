#!/usr/bin/env node
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const context = {};
context.globalThis = context;
vm.runInNewContext(readFileSync(`${root}/site/js/search-core.js`, "utf8"), context);
const data = {
  metadata: JSON.parse(readFileSync(`${root}/site/data/search-metadata.json`, "utf8")),
  catalog: JSON.parse(readFileSync(`${root}/site/data/manuscripts.json`, "utf8")),
  coverage: JSON.parse(readFileSync(`${root}/site/data/works/coverage.json`, "utf8")),
  queue: JSON.parse(readFileSync(`${root}/site/data/translations/queue.json`, "utf8")),
};

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

for (const query of ["Isaiah 1", "isa 1", "isaah 1", "is.1"]) {
  const result = context.odsSearch.search(query, data);
  assert(result.reference?.book?.id === "Is" && result.reference.chapter === 1, `${query} did not parse as Isaiah 1`);
  assert(result.results.some((item) => item.href === "/m/1Qisaa/1/"), `${query} omitted 1Qisaa chapter link`);
  assert(result.note?.tone === "info" && /6 manuscript witnesses/.test(result.note.text), `${query} has wrong coverage note`);
}

const missing = context.odsSearch.search("Jeremiah 1", data);
assert(missing.reference?.book?.id === "Jer", "Jeremiah 1 was not recognized");
assert(missing.note?.tone === "warn" && /No manuscript/.test(missing.note.text), "Jeremiah 1 needs a no-witness notice");

const absentBook = context.odsSearch.search("Esther 1", data);
assert(absentBook.reference?.book?.id === "Esth", "Esther 1 was not recognized");
assert(absentBook.note?.tone === "warn", "Esther 1 needs a no-witness notice");

for (const [query, expected] of [
  ["manual of discipline", "1QS"],
  ["copper scrol", "3Q15"],
  ["great isiah scroll", "1Qisaa"],
]) {
  const result = context.odsSearch.search(query, data);
  assert(result.results[0]?.href === `/m/${expected}/`, `${query} did not rank ${expected} first`);
}

console.log("OK search aliases, fuzziness, references, chapter coverage, and direct witness links");
