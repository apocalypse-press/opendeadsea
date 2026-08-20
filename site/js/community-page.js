const SOURCE = "/data/manuscripts.json";
const QUEUE_SRC = "/data/translations/queue.json";

const CATS = [
  { key: "commentary", label: "Commentaries" },
  { key: "liturgy", label: "Liturgies" },
  { key: "other", label: "Other community texts" },
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function mssTitle(m) {
  return m.name && m.name !== m.label ? `${m.label} · ${m.name}` : m.label;
}

function readState() {
  const params = new URLSearchParams(location.search);
  return {
    q: (params.get("q") || "").trim(),
    cat: params.get("cat") || "",
    comp: params.get("comp") || "",
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.cat) params.set("cat", state.cat);
  if (state.comp) params.set("comp", state.comp);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

function groupCompositions(mss) {
  const byCat = new Map(CATS.map((c) => [c.key, new Map()]));
  for (const m of mss) {
    if (!m.community || !m.composition) continue;
    const cat = byCat.get(m.community);
    if (!cat) continue;
    if (!cat.has(m.composition)) cat.set(m.composition, []);
    cat.get(m.composition).push(m);
  }
  return CATS.map((c) => {
    const comps = [...(byCat.get(c.key) || [])].map(([name, copies]) => ({
      name,
      copies: copies.slice().sort((a, b) => mssTitle(a).localeCompare(mssTitle(b), "en", { numeric: true })),
    }));
    comps.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return { ...c, compositions: comps, n: comps.reduce((acc, x) => acc + x.copies.length, 0) };
  }).filter((c) => c.compositions.length);
}

function mssRow(m) {
  const href = m.path || `/m/${encodeURIComponent(m.id)}/`;
  const meta = [m.site, (m.languages || []).join(" / "), m.line_count ? `${m.line_count} lines` : ""]
    .filter(Boolean)
    .join(" · ");
  const badge = window.odsQueue ? window.odsQueue.badgeHTML(m.queue || "none") : "";
  return `<li>
    <a href="${esc(href)}">
      <h2>${esc(mssTitle(m))}</h2>
      <p>${esc(meta)}</p>
      ${badge}
    </a>
  </li>`;
}

function compHTML(comp, open) {
  const n = comp.copies.length;
  return `<details class="book" data-comp="${esc(comp.name)}"${open ? " open" : ""}>
    <summary><strong>${esc(comp.name)}</strong> <span class="count">${n} manuscript${n === 1 ? "" : "s"}</span></summary>
    <div class="book-body"><ul class="index">${comp.copies.map(mssRow).join("")}</ul></div>
  </details>`;
}

function boot() {
  const list = document.getElementById("community");
  const ledger = document.getElementById("community-ledger");
  const catsBox = document.getElementById("facet-cat");
  const input = document.getElementById("community-q");
  const form = document.querySelector(".community-find");
  if (!list) return;
  Promise.all([
    fetch(SOURCE).then((r) => r.json()),
    fetch(QUEUE_SRC)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ])
    .then(([mss, queue]) => {
      if (window.odsQueue) window.odsQueue.join(mss, queue);
      const grouped = groupCompositions(mss);
      const state = readState();
      if (input) input.value = state.q;
      const paint = () => {
        writeState(state);
        const q = state.q.toLowerCase();
        const cats = grouped
          .filter((c) => !state.cat || c.key === state.cat)
          .map((c) => {
            const compositions = q
              ? c.compositions.filter(
                  (comp) =>
                    comp.name.toLowerCase().includes(q) ||
                    comp.copies.some((m) => mssTitle(m).toLowerCase().includes(q)),
                )
              : c.compositions;
            return { ...c, compositions };
          })
          .filter((c) => c.compositions.length);
        if (catsBox) {
          catsBox.innerHTML = [{ key: "", label: "All" }]
            .concat(grouped.map((c) => ({ key: c.key, label: `${c.label}` })))
            .map(
              (c) =>
                `<button type="button" data-cat="${esc(c.key)}" aria-pressed="${(state.cat || "") === c.key ? "true" : "false"}">${esc(c.label)}</button>`,
            )
            .join("");
        }
        list.innerHTML = cats
          .map((c) => {
            const inner = c.compositions.map((comp) => compHTML(comp, state.comp === comp.name)).join("");
            return `<section class="mss-group"><h3>${esc(c.label)} <span class="count">${c.compositions.length}</span></h3>${inner}</section>`;
          })
          .join("");
        if (ledger) {
          const nComp = cats.reduce((n, c) => n + c.compositions.length, 0);
          const nMss = cats.reduce((n, c) => n + c.compositions.reduce((a, x) => a + x.copies.length, 0), 0);
          ledger.textContent = `${nComp} works · ${nMss} manuscripts`;
        }
      };
      paint();
      if (form) form.addEventListener("submit", (ev) => ev.preventDefault());
      if (input) {
        input.addEventListener("input", () => {
          state.q = input.value.trim();
          paint();
        });
      }
      document.addEventListener("click", (ev) => {
        const catBtn = ev.target.closest("button[data-cat]");
        if (catBtn && catBtn.closest("#facet-cat")) {
          state.cat = catBtn.getAttribute("data-cat") || "";
          state.comp = "";
          paint();
        }
      });
      list.addEventListener(
        "toggle",
        (ev) => {
          const details = ev.target;
          if (!(details instanceof HTMLDetailsElement) || !details.hasAttribute("data-comp")) return;
          if (details.open) {
            state.comp = details.getAttribute("data-comp") || "";
            writeState(state);
          } else if (state.comp === details.getAttribute("data-comp")) {
            state.comp = "";
            writeState(state);
          }
        },
        true,
      );
    })
    .catch(() => {
      list.innerHTML = "<p>Could not load the community texts.</p>";
    });
}

boot();
