function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function boot() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const input = document.getElementById("q");
  const results = document.getElementById("results");
  const empty = document.getElementById("search-empty");
  if (input) input.value = q;
  if (!results) return;
  if (!q) {
    results.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  const load = window.odsLexicon ? window.odsLexicon.load() : Promise.resolve([]);
  load.then((records) => {
    const hits = window.odsLexicon ? window.odsLexicon.search(q) : records;
    const items = [];
    if (q.toLowerCase() === "isaiah" || q.indexOf("1QIsa") !== -1 || q.indexOf("קול") !== -1) {
      items.push({
        href: "/read/",
        title: "1QIsa-a, Isaiah 40:3-5",
        blurb: "Sample diplomatic line.",
        kind: "Line",
      });
    }
    hits.slice(0, 20).forEach((rec) => {
      items.push({
        href: window.odsLexicon.href(rec),
        title: rec.form,
        blurb: rec.id + " · " + rec.gloss,
        kind: rec.language === "aramaic" ? "Aramaic lemma" : "Hebrew lemma",
        dir: "rtl",
        lang: rec.language === "aramaic" ? "arc" : "he",
      });
    });
    if (!items.length) {
      results.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.querySelector("div").innerHTML =
          "<p>No seeded lemma matched. Try an academic morph code such as qol, YHWH, or malka.</p>";
      }
      return;
    }
    if (empty) empty.hidden = true;
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
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
