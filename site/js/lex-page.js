function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function langLabel(language) {
  if (language === "aramaic") return "Aramaic";
  if (language === "hebrew") return "Hebrew";
  return language || "";
}

function recordHTML(rec) {
  const dir = rec.language === "aramaic" || rec.language === "hebrew" ? "rtl" : "ltr";
  const lang = rec.language === "aramaic" ? "arc" : "he";
  const strongs = (rec.strongs || [])
    .map((code) => {
      const url = window.odsLexicon.strongsUrl(code);
      if (!url) return esc(code);
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(code)}</a>`;
    })
    .join(" · ");
  const cal = window.odsLexicon.calUrl(rec);
  const lookups = [];
  if (cal) {
    lookups.push(
      `<a href="${esc(cal)}" target="_blank" rel="noopener noreferrer"><svg class="ico" data-i="external-link"></svg>CAL</a>`
    );
  }
  (rec.strongs || []).forEach((code) => {
    const url = window.odsLexicon.strongsUrl(code);
    if (url) {
      lookups.push(
        `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><svg class="ico" data-i="external-link"></svg>Strong ${esc(code)}</a>`
      );
    }
  });
  const glossLabel = rec.language === "aramaic" ? "Jastrow 1903 (seed)" : "BDB 1906 (seed)";
  return `
    <p class="page-kicker">Lexeme</p>
    <h1 class="lex-head" lang="${lang}" dir="${dir}">${esc(rec.form)}</h1>
    <p class="lede">The scholarly key is the academic morph code <strong>${esc(rec.id)}</strong>. Strong's numbers, when present, are metadata for a public-domain lookup. They are not the lemma.</p>
    <ul class="meta-list">
      <li><span class="k">Lemma</span><span><code>${esc(rec.id)}</code></span></li>
      <li><span class="k">Language</span><span>${esc(langLabel(rec.language))}</span></li>
      ${rec.pos ? `<li><span class="k">Class</span><span>${esc(rec.pos)}</span></li>` : ""}
      <li><span class="k">${esc(glossLabel)}</span><span>${esc(rec.gloss)}</span></li>
      ${strongs ? `<li><span class="k">Strong's</span><span>${strongs}</span></li>` : ""}
    </ul>
    ${
      lookups.length
        ? `<p class="mss-links">${lookups.join(" · ")}</p>`
        : ""
    }
    ${rec.notes ? `<p>${esc(rec.notes)}</p>` : ""}
    <p class="hint">HALOT and DCH are not ingested. A BHSA gloss is not the English of a Qumran line.</p>
  `;
}

function browseHTML(records, query) {
  const hebrew = records.filter((r) => r.language === "hebrew");
  const aramaic = records.filter((r) => r.language === "aramaic");
  let heading = "Seeded public-domain lemmas. The academic morph code is the address of each page.";
  if (query && !records.length) {
    heading = `No lexicon record for <code>${esc(query)}</code>. The academic morph code is the key. Try qol, YHWH, or malka, or browse below.`;
  } else if (query) {
    heading = `Matches for <code>${esc(query)}</code>.`;
  }
  function list(rows) {
    if (!rows.length) return "<p>None in this language yet.</p>";
    return `<ul class="index">${rows
      .map(
        (rec) => `<li>
        <a href="${esc(window.odsLexicon.href(rec))}">
          <h3 lang="${rec.language === "aramaic" ? "arc" : "he"}" dir="rtl">${esc(rec.form)}</h3>
          <p><code>${esc(rec.id)}</code> · ${esc(rec.gloss)}</p>
          <span class="badge">${esc(langLabel(rec.language))}</span>
        </a>
      </li>`
      )
      .join("")}</ul>`;
  }
  return `
    <p class="page-kicker">Lexicon</p>
    <h1>Look up a lemma</h1>
    <p class="lede">${heading}</p>
    <h2>Hebrew</h2>
    ${list(hebrew)}
    <h2>Aramaic</h2>
    ${list(aramaic)}
  `;
}

function boot() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const input = document.getElementById("lex-q");
  const body = document.getElementById("lex-body");
  const crumbs = document.getElementById("lex-crumb-current");
  if (input) input.value = q;
  if (!body || !window.odsLexicon) return;
  window.odsLexicon.load().then((records) => {
    const rec = q ? window.odsLexicon.resolve(q) : null;
    if (rec) {
      document.title = rec.id + ". Open Dead Sea.";
      if (crumbs) crumbs.textContent = rec.form;
      body.innerHTML = recordHTML(rec);
    } else {
      document.title = "Lexeme. Open Dead Sea.";
      if (crumbs) crumbs.textContent = q || "Lexicon";
      const filtered = q ? window.odsLexicon.search(q) : records;
      body.innerHTML = browseHTML(filtered, rec ? "" : q);
    }
    if (window.odsIcons) window.odsIcons.paint();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
