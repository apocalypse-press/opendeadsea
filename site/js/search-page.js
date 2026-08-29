function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fetchJSON(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  });
}

function renderItems(results, items) {
  if (!items.length) {
    results.hidden = true;
    results.innerHTML = "";
    return;
  }
  results.hidden = false;
  results.innerHTML = items
    .map(
      (item) => `<li>
        <a href="${esc(item.href)}">
          <h2${item.lang ? ` lang="${esc(item.lang)}" dir="${esc(item.dir || "rtl")}"` : ""}>${esc(item.title)}</h2>
          <p>${esc(item.blurb)}</p>
          <span class="badge">${esc(item.kind)}</span>
        </a>
      </li>`
    )
    .join("");
}

function boot() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const input = document.getElementById("q");
  const results = document.getElementById("results");
  const empty = document.getElementById("search-empty");
  const note = document.getElementById("search-note");
  if (input) input.value = q;
  if (!results) return;
  if (!q) {
    results.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  Promise.all([
    fetchJSON("/data/search-metadata.json"),
    fetchJSON("/data/manuscripts.json"),
    fetchJSON("/data/works/coverage.json"),
    fetchJSON("/data/translations/queue.json").catch(() => ({})),
    window.odsLexicon ? window.odsLexicon.load() : Promise.resolve([]),
  ])
    .then(([metadata, catalog, coverage, queue]) => {
      const found = window.odsSearch.search(q, { metadata, catalog, coverage, queue });
      const items = found.results.slice();
      const hrefs = new Set(items.map((item) => item.href));
      const lexiconHits = window.odsLexicon ? window.odsLexicon.search(q) : [];
      lexiconHits.slice(0, 12).forEach((record) => {
        const href = window.odsLexicon.href(record);
        if (hrefs.has(href)) return;
        items.push({
          href,
          title: record.form,
          blurb: `${record.id} · ${record.gloss}`,
          kind: record.language === "aramaic" ? "Aramaic lemma" : "Hebrew lemma",
          dir: "rtl",
          lang: record.language === "aramaic" ? "arc" : "he",
        });
      });

      if (found.note && note) {
        note.hidden = false;
        note.classList.toggle("search-note-warn", found.note.tone === "warn");
        note.innerHTML = `<svg class="ico" data-i="info"></svg><p>${esc(found.note.text)}</p>`;
      } else if (note) {
        note.hidden = true;
      }
      if (items.length) {
        if (empty) empty.hidden = true;
        renderItems(results, items);
      } else {
        renderItems(results, []);
        if (empty) {
          empty.hidden = false;
          empty.querySelector("div").innerHTML =
            "<p>No manuscript, Bible reference, common scroll name, or seeded lemma matched. Try a shorter title or catalog label.</p>";
        }
      }
      if (window.odsIcons) window.odsIcons.paint();
    })
    .catch(() => {
      renderItems(results, []);
      if (empty) {
        empty.hidden = false;
        empty.querySelector("div").innerHTML = "<p>Search data could not be loaded. Please try again.</p>";
      }
    });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
