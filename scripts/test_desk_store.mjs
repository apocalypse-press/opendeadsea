const memory = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
};
globalThis.window = globalThis;
globalThis.dispatchEvent = () => {};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init && init.detail;
  }
};

let failProposal = false;
globalThis.fetch = async (url, options = {}) => {
  if (url === "/data/desk-seed.json") {
    return new Response(JSON.stringify({ proposals: [{ id: "seed-only" }], comments: [], events: [] }));
  }
  if (url === "/api/desk") {
    return new Response(JSON.stringify({ proposals: [], comments: [], events: [], git: [], source: "d1" }));
  }
  if (url === "/api/proposals" && options.method === "POST") {
    if (failProposal) {
      return new Response(JSON.stringify({ error: "Save failed" }), { status: 503 });
    }
    const body = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        proposal: {
          ...body,
          id: "p_server",
          author_user_id: "42",
          author_login: "reader42",
          status: "open",
          votes: [],
          created_at: "2026-08-28T12:00:00Z",
          updated_at: "2026-08-28T12:00:00Z",
        },
      }),
      { status: 201 },
    );
  }
  throw new Error(`unexpected fetch ${url}`);
};

await import("../site/js/desk-store.js");
await window.odsDesk.load();
if (window.odsDesk.snapshot().proposals.length !== 0) {
  throw new Error("sample/local proposal leaked into an authoritative D1 desk");
}

const user = { id: "42", login: "reader42" };
const proposal = await window.odsDesk.addProposal(user, {
  mss_id: "1Qisaa",
  line_ref: "1QIsaa 1:1",
  current_form: "Old draft",
  proposed_form: "Better draft",
  reason: "",
});
if (proposal.id !== "p_server") throw new Error("browser replaced the server proposal id");
if (!window.odsDesk.getProposal("p_server")) throw new Error("saved proposal missing from desk cache");

failProposal = true;
let rejected = false;
try {
  await window.odsDesk.addProposal(user, {
    mss_id: "1Qisaa",
    proposed_form: "Unsaved draft",
  });
} catch (error) {
  rejected = error.message === "Save failed";
}
if (!rejected) throw new Error("failed API write was shown as saved");
if (window.odsDesk.snapshot().proposals.some((row) => row.proposed_form === "Unsaved draft")) {
  throw new Error("failed proposal leaked into the local desk");
}

console.log("desk store: pass");
