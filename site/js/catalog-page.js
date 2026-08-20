const SOURCE = "/data/manuscripts.json";
const QUEUE_SRC = "/data/translations/queue.json";

const SITE_ORDER = [
  "cave-1",
  "cave-2",
  "cave-3",
  "cave-4",
  "cave-5",
  "cave-6",
  "cave-7",
  "cave-8",
  "cave-9",
  "cave-10",
  "cave-11",
  "masada",
  "hever",
  "murabbaat",
  "seelim",
  "genizah",
  "other",
];

const SITE_CHIP = {
  "cave-1": "Cave 1",
  "cave-2": "Cave 2",
  "cave-3": "Cave 3",
  "cave-4": "Cave 4",
  "cave-5": "Cave 5",
  "cave-6": "Cave 6",
  "cave-7": "Cave 7",
  "cave-8": "Cave 8",
  "cave-9": "Cave 9",
  "cave-10": "Cave 10",
  "cave-11": "Cave 11",
  masada: "Masada",
  hever: "Nahal Hever",
  murabbaat: "Murabbaat",
  seelim: "Nahal Seelim",
  genizah: "Genizah",
  other: "Other",
};

const LANG_CHIPS = [
  { key: "hebrew", label: "Hebrew", kind: "lang" },
  { key: "aramaic", label: "Aramaic", kind: "lang" },
  { key: "greek", label: "Greek", kind: "lang" },
  { key: "paleo", label: "Paleo-Hebrew", kind: "script" },
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function queueBadge(m) {
  if (window.odsQueue) return window.odsQueue.badgeHTML(m.queue || "none");
  return `<span class="badge">${esc(m.queue || "none")}</span>`;
}

function row(m) {
  const meta = [];
  if (m.name) meta.push(m.name);
  if (m.languages && m.languages.length) meta.push(m.languages.join(" / "));
  if (m.script === "paleohebrew") meta.push("paleo-Hebrew");
  if (m.script === "mixed") meta.push("paleo-Hebrew for the divine name");
  if (m.script === "greek" && m.wording_status === "absent") meta.push("Greek; wording not in Abegg");
  if (m.chapter_count) meta.push(`${m.chapter_count} chapter${m.chapter_count === 1 ? "" : "s"}`);
  if (m.line_count) meta.push(`${m.line_count} line${m.line_count === 1 ? "" : "s"}`);
  if (m.biblical) meta.push("biblical");
  const href = m.path || `/m/${encodeURIComponent(m.id)}/`;
  return `<li>
    <a href="${esc(href)}">
      <h2>${esc(m.label)}${m.name ? ` <span class="mss-name">· ${esc(m.name)}</span>` : ""}</h2>
      <p>${esc(meta.join(" · "))}</p>
      ${queueBadge(m)}
    </a>
  </li>`;
}

function readState() {
  const params = new URLSearchParams(location.search);
  const langs = params.getAll("lang");
  const scripts = params.getAll("script");
  return {
    q: (params.get("q") || "").trim(),
    site: params.get("site") || "",
    queue: params.get("queue") || "",
    langs,
    scripts,
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.site) params.set("site", state.site);
  if (state.queue) params.set("queue", state.queue);
  for (const lang of state.langs) params.append("lang", lang);
  for (const script of state.scripts) params.append("script", script);
  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, "", url);
}

function matches(m, state) {
  if (state.q) {
    const q = state.q.toLowerCase();
    const compact = q.replace(/[\s·._-]+/g, "");
    const hay = [m.id, m.label, m.name, m.iaa_short, m.site].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q) && !hay.replace(/[\s·._-]+/g, "").includes(compact)) return false;
  }
  if (state.site && m.site_key !== state.site) return false;
  if (state.queue && (m.queue || "none") !== state.queue) return false;
  const needLang = state.langs || [];
  const needScript = state.scripts || [];
  if (needLang.length || needScript.length) {
    const langs = m.lang_keys || [];
    const scripts = m.script_keys || [];
    const langHit = needLang.some((k) => langs.includes(k));
    const scriptHit = needScript.some((k) => scripts.includes(k));
    if (!langHit && !scriptHit) return false;
  }
  return true;
}

function siteHeading(key, sample) {
  if (sample && sample.site) return sample.site;
  return SITE_CHIP[key] || key;
}

function renderChips(state, mss) {
  const present = new Set(mss.map((m) => m.site_key).filter(Boolean));
  const siteBox = document.getElementById("facet-site");
  const langBox = document.getElementById("facet-lang");
  const queueBox = document.getElementById("facet-queue");
  const buckets = window.odsQueue ? window.odsQueue.BUCKETS : [];
  if (queueBox) {
    const counts = new Map();
    for (const m of mss) {
      const key = m.queue || "none";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    queueBox.innerHTML = buckets
      .map((b) => {
        const n = counts.get(b.key) || 0;
        const on = state.queue === b.key;
        return `<button type="button" data-queue="${esc(b.key)}" aria-pressed="${on ? "true" : "false"}">${esc(b.label)} <span class="count">${n}</span></button>`;
      })
      .join("");
  }
  if (siteBox) {
    const drilled = Boolean(state.site || state.q || state.queue);
    siteBox.hidden = !drilled;
    const sites = (drilled ? [{ key: "", label: "Locations" }] : []).concat(
      SITE_ORDER.filter((k) => present.has(k)).map((k) => ({ key: k, label: SITE_CHIP[k] })),
    );
    siteBox.innerHTML = sites
      .map(
        (s) =>
          `<button type="button" data-site="${esc(s.key)}" aria-pressed="${(state.site || "") === s.key ? "true" : "false"}">${esc(s.label)}</button>`,
      )
      .join("");
  }
  if (langBox) {
    langBox.hidden = !state.site && !state.q && !state.queue;
    langBox.innerHTML = LANG_CHIPS.map((c) => {
      const on = c.kind === "script" ? state.scripts.includes(c.key) : state.langs.includes(c.key);
      return `<button type="button" data-${c.kind}="${esc(c.key)}" aria-pressed="${on ? "true" : "false"}">${esc(c.label)}</button>`;
    }).join("");
  }
}

function renderList(state, mss) {
  const list = document.getElementById("catalog");
  const empty = document.getElementById("catalog-empty");
  const ledger = document.getElementById("catalog-ledger");
  if (!list) return;
  const landing = !state.site && !state.q && !state.queue;
  if (landing) {
    if (empty) empty.hidden = true;
    const counts = new Map();
    for (const m of mss) {
      const key = m.site_key || "other";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const cards = SITE_ORDER.filter((k) => counts.has(k))
      .map((key) => {
        const n = counts.get(key);
        const sample = mss.find((m) => m.site_key === key);
        const title = siteHeading(key, sample);
        return `<li><a href="?site=${esc(key)}"><h2>${esc(title)}</h2><p>${n} manuscript${n === 1 ? "" : "s"}</p></a></li>`;
      })
      .join("");
    list.innerHTML = `<nav class="site-index" aria-label="Find spots"><ul class="index">${cards}</ul></nav>`;
    if (ledger) {
      ledger.textContent = `${mss.length} manuscripts across ${counts.size} sites. Filter the translation queue or open a location.`;
    }
    return;
  }

  const hits = mss.filter((m) => matches(m, state));
  const withText = hits.filter((m) => (m.lines_with_text || 0) > 0).length;
  if (ledger) {
    const bucket = window.odsQueue && state.queue ? window.odsQueue.rec(state.queue).label : "";
    const queueBit = bucket ? ` · ${bucket}` : "";
    ledger.textContent = `${hits.length} manuscript${hits.length === 1 ? "" : "s"} · ${withText} with original-language wording${queueBit}`;
  }
  if (!hits.length) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  if (state.q) {
    const sorted = hits.slice().sort((a, b) => String(a.label).localeCompare(String(b.label), "en", { numeric: true }));
    list.innerHTML = `<section class="mss-group"><h3>Matches <span class="count">${sorted.length}</span></h3><ul class="index">${sorted.map(row).join("")}</ul></section>`;
    return;
  }

  const groups = new Map();
  for (const m of hits) {
    const key = m.site_key || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const order = SITE_ORDER.filter((k) => groups.has(k)).concat([...groups.keys()].filter((k) => !SITE_ORDER.includes(k)));
  list.innerHTML = order
    .map((key) => {
      const items = groups.get(key);
      items.sort((a, b) => String(a.label).localeCompare(String(b.label), "en", { numeric: true }));
      return `<section class="mss-group"><h3>${esc(siteHeading(key, items[0]))} <span class="count">${items.length} manuscript${items.length === 1 ? "" : "s"}</span></h3><ul class="index">${items.map(row).join("")}</ul></section>`;
    })
    .join("");
}

function boot() {
  const list = document.getElementById("catalog");
  if (!list) return;
  const form = document.querySelector(".catalog-find");
  const input = document.getElementById("catalog-q");
  Promise.all([
    fetch(SOURCE).then((r) => r.json()),
    fetch(QUEUE_SRC)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ])
    .then(([mss, queue]) => {
      if (window.odsQueue) window.odsQueue.join(mss, queue);
      const state = readState();
      if (input) input.value = state.q;
      const paint = () => {
        writeState(state);
        renderChips(state, mss);
        renderList(state, mss);
      };
      paint();

      if (form) {
        form.addEventListener("submit", (ev) => ev.preventDefault());
      }
      if (input) {
        input.addEventListener("input", () => {
          state.q = input.value.trim();
          paint();
        });
      }
      document.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-site], button[data-lang], button[data-script], button[data-queue]");
        if (!btn) return;
        if (btn.hasAttribute("data-site")) {
          state.site = btn.getAttribute("data-site") || "";
        } else if (btn.hasAttribute("data-queue")) {
          const key = btn.getAttribute("data-queue") || "";
          state.queue = state.queue === key ? "" : key;
        } else if (btn.hasAttribute("data-lang")) {
          const key = btn.getAttribute("data-lang");
          const i = state.langs.indexOf(key);
          if (i >= 0) state.langs.splice(i, 1);
          else state.langs.push(key);
        } else if (btn.hasAttribute("data-script")) {
          const key = btn.getAttribute("data-script");
          const i = state.scripts.indexOf(key);
          if (i >= 0) state.scripts.splice(i, 1);
          else state.scripts.push(key);
        }
        paint();
      });
    })
    .catch(() => {
      list.innerHTML = "<p>Could not load the catalog.</p>";
    });
}

boot();
