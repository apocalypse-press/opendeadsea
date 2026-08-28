const BOOKS_SRC = "/data/works/bible.json";
const COVERAGE_SRC = "/data/works/coverage.json";
const MSS_SRC = "/data/manuscripts.json";

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function verseChapter(v) {
  const m = String(v).match(/^(\d+)\s*:/);
  return m ? Number(m[1]) : null;
}

function mssTitle(m, fallback) {
  if (!m) return fallback;
  return m.name && m.name !== m.label ? `${m.label} · ${m.name}` : m.label || fallback;
}

function chapterHref(m, bookId, ch) {
  const base = (m && m.path) || (m ? `/m/${encodeURIComponent(m.id)}/` : "#");
  if (!m || !m.chapter_count || !ch) return base;
  if (m.chapter_bare) return `${base}${ch}/`;
  return `${base}${String(bookId).toLowerCase()}-${ch}/`;
}

function readState() {
  const params = new URLSearchParams(location.search);
  const ch = params.get("ch");
  return {
    q: (params.get("q") || "").trim(),
    book: params.get("book") || "",
    view: params.get("view") === "chapter" ? "chapter" : "mss",
    ch: ch ? Number(ch) : null,
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.book) params.set("book", state.book);
  if (state.view === "chapter") params.set("view", "chapter");
  if (state.view === "chapter" && state.ch) params.set("ch", String(state.ch));
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

function indexCoverage(bible, coverage, mss) {
  const mssById = new Map();
  for (const m of mss) {
    mssById.set(m.id, m);
    if (m.label) {
      const prev = mssById.get(m.label);
      if (!prev || (m.biblical && !prev.biblical)) mssById.set(m.label, m);
    }
  }
  const byBook = new Map();
  for (const b of bible.books) {
    byBook.set(b.id, { book: b, witnesses: [], chapters: new Map() });
  }
  for (const row of coverage) {
    const m = mssById.get(row.scroll);
    for (const bk of row.books || []) {
      const slot = byBook.get(bk.book);
      if (!slot) continue;
      const verses = bk.verses || [];
      slot.witnesses.push({ scroll: row.scroll, m, verses });
      for (const v of verses) {
        const ch = verseChapter(v);
        if (ch == null) continue;
        if (!slot.chapters.has(ch)) slot.chapters.set(ch, []);
        const list = slot.chapters.get(ch);
        let rec = list.find((item) => item.scroll === row.scroll);
        if (!rec) {
          rec = { scroll: row.scroll, m, verses: [] };
          list.push(rec);
        }
        rec.verses.push(v);
      }
    }
  }
  return bible.books
    .map((b) => byBook.get(b.id))
    .filter((slot) => slot && slot.witnesses.length);
}

function mssRow(item, bookId, ch) {
  const title = mssTitle(item.m, item.scroll);
  const href = ch ? chapterHref(item.m, bookId, ch) : (item.m && item.m.path) || `/m/${encodeURIComponent(item.scroll)}/`;
  const site = item.m && item.m.site ? item.m.site : "";
  const n = item.verses.length;
  const ranges = ch ? item.verses.join("; ") : `${n} verse range${n === 1 ? "" : "s"}`;
  const meta = [site, ranges].filter(Boolean).join(" · ");
  return `<li>
    <a href="${esc(href)}">
      <h2>${esc(title)}</h2>
      <p>${esc(meta)}</p>
    </a>
  </li>`;
}

function panelHTML(slot, view, selectedCh) {
  const bookId = slot.book.id;
  if (view !== "chapter") {
    const items = slot.witnesses
      .slice()
      .sort((a, b) => mssTitle(a.m, a.scroll).localeCompare(mssTitle(b.m, b.scroll), "en", { numeric: true }));
    return `<ul class="index">${items.map((item) => mssRow(item, bookId, null)).join("")}</ul>`;
  }
  const chapters = [...slot.chapters.keys()].sort((a, b) => a - b);
  if (!chapters.length) return "<p>No chapter numbers are marked on the surviving lines.</p>";
  const ch = chapters.includes(selectedCh) ? selectedCh : chapters[0];
  const chips = chapters
    .map((n) => {
      const count = slot.chapters.get(n).length;
      const on = n === ch;
      return `<button type="button" data-ch="${n}" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(slot.book.name)} ${n}, ${count} manuscript${count === 1 ? "" : "s"}">${n}</button>`;
    })
    .join("");
  const wits = (slot.chapters.get(ch) || [])
    .slice()
    .sort((a, b) => mssTitle(a.m, a.scroll).localeCompare(mssTitle(b.m, b.scroll), "en", { numeric: true }));
  return `<div class="facet-row chapter-chips" role="group" aria-label="${esc(slot.book.name)} chapters">${chips}</div>
    <h3 class="chapter-heading">${esc(slot.book.name)} ${ch} <span class="count">${wits.length} manuscript${wits.length === 1 ? "" : "s"}</span></h3>
    <ul class="index">${wits.map((item) => mssRow(item, bookId, ch)).join("")}</ul>`;
}

function bookHTML(slot) {
  const nCh = slot.chapters.size;
  const nMs = slot.witnesses.length;
  return `<details class="book" data-book="${esc(slot.book.id)}">
    <summary><strong>${esc(slot.book.name)}</strong> <span class="count">${nMs} manuscript${nMs === 1 ? "" : "s"} · ${nCh} chapter${nCh === 1 ? "" : "s"}</span></summary>
    <div class="book-body">
      <div class="facet-row" role="group" aria-label="Browse ${esc(slot.book.name)}">
        <button type="button" data-view="mss" aria-pressed="true">Manuscripts</button>
        <button type="button" data-view="chapter" aria-pressed="false">Chapters</button>
      </div>
      <div class="book-panel"></div>
    </div>
  </details>`;
}

function fillBook(details, slot, state) {
  const view = state.book === slot.book.id ? state.view : "mss";
  const ch = state.book === slot.book.id ? state.ch : null;
  details.querySelectorAll("button[data-view]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-view") === view ? "true" : "false");
  });
  const panel = details.querySelector(".book-panel");
  if (panel) panel.innerHTML = panelHTML(slot, view, ch);
}

function boot() {
  const list = document.getElementById("works");
  const ledger = document.getElementById("works-ledger");
  const input = document.getElementById("works-q");
  const form = document.querySelector(".works-find");
  if (!list) return;
  Promise.all([fetch(BOOKS_SRC).then((r) => r.json()), fetch(COVERAGE_SRC).then((r) => r.json()), fetch(MSS_SRC).then((r) => r.json())])
    .then(([bible, coverage, mss]) => {
      const index = indexCoverage(bible, coverage, mss);
      const state = readState();
      if (input) input.value = state.q;
      if (!state.book && index.length) {
        /* keep closed until chosen */
      }
      const slotsById = new Map(index.map((slot) => [slot.book.id, slot]));
      const paintList = () => {
        const q = state.q.toLowerCase();
        const shown = q
          ? index.filter((slot) => `${slot.book.id} ${slot.book.name}`.toLowerCase().includes(q))
          : index;
        list.innerHTML = shown.map((slot) => bookHTML(slot)).join("");
        if (ledger) {
          ledger.textContent = `${shown.length} biblical work${shown.length === 1 ? "" : "s"} · ${index.reduce((n, s) => n + s.witnesses.length, 0)} manuscript attestations`;
        }
        if (state.book) {
          const el = list.querySelector(`details[data-book="${CSS.escape(state.book)}"]`);
          const slot = slotsById.get(state.book);
          if (el && slot) {
            el.open = true;
            fillBook(el, slot, state);
          }
        }
        writeState(state);
      };
      paintList();

      if (form) form.addEventListener("submit", (ev) => ev.preventDefault());
      if (input) {
        input.addEventListener("input", () => {
          state.q = input.value.trim();
          paintList();
        });
      }
      list.addEventListener(
        "toggle",
        (ev) => {
          const details = ev.target;
          if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("book")) return;
          const id = details.getAttribute("data-book") || "";
          const slot = slotsById.get(id);
          if (details.open) {
            state.book = id;
            if (slot) fillBook(details, slot, state);
            writeState(state);
          } else if (state.book === id) {
            state.book = "";
            state.ch = null;
            writeState(state);
          }
        },
        true,
      );
      list.addEventListener("click", (ev) => {
        const viewBtn = ev.target.closest("button[data-view]");
        const chBtn = ev.target.closest("button[data-ch]");
        const details = ev.target.closest("details.book");
        if (!details) return;
        const id = details.getAttribute("data-book") || "";
        const slot = slotsById.get(id);
        if (!slot) return;
        state.book = id;
        if (viewBtn) {
          state.view = viewBtn.getAttribute("data-view") === "chapter" ? "chapter" : "mss";
          if (state.view === "mss") state.ch = null;
          fillBook(details, slot, state);
          writeState(state);
        } else if (chBtn) {
          state.view = "chapter";
          state.ch = Number(chBtn.getAttribute("data-ch"));
          fillBook(details, slot, state);
          writeState(state);
        }
      });
    })
    .catch(() => {
      list.innerHTML = "<p>Could not load the works page.</p>";
    });
}

boot();
