globalThis.window = globalThis;
let requests = 0;
globalThis.fetch = async (url) => {
  if (url !== "/data/diagrams/index.json") throw new Error(`unexpected fetch ${url}`);
  requests += 1;
  await new Promise((resolve) => setTimeout(resolve, 5));
  return new Response(JSON.stringify({ books: { ISA: ["40.3"] } }));
};

await import("../site/js/diagram.js");
const results = await Promise.all(
  Array.from({ length: 30 }, () => window.odsDiagram.has("Isa", 40, 3)),
);
if (results.some((value) => value !== true)) throw new Error("diagram index lookup failed");
if (requests !== 1) throw new Error(`diagram index fetched ${requests} times`);

console.log("diagram index cache: pass");
