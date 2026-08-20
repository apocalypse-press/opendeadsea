(function (root) {
  const INDEX = "/data/diagrams/index.json";
  const cache = {};
  let index = null;

  const ODS_TO_MACULA = {
    Gen: "GEN",
    Ex: "EXO",
    Exod: "EXO",
    Lev: "LEV",
    Num: "NUM",
    Deut: "DEU",
    Josh: "JOS",
    Judg: "JDG",
    Ruth: "RUT",
    "1Sam": "1SA",
    "2Sam": "2SA",
    "1Kgs": "1KI",
    "2Kgs": "2KI",
    "1Chr": "1CH",
    "2Chr": "2CH",
    Ezra: "EZR",
    Neh: "NEH",
    Esth: "EST",
    Job: "JOB",
    Ps: "PSA",
    Prov: "PRO",
    Eccl: "ECC",
    Song: "SNG",
    Isa: "ISA",
    Is: "ISA",
    Jer: "JER",
    Lam: "LAM",
    Ezek: "EZK",
    Dan: "DAN",
    Hos: "HOS",
    Joel: "JOL",
    Amos: "AMO",
    Obad: "OBA",
    Jonah: "JON",
    Mic: "MIC",
    Nah: "NAM",
    Hab: "HAB",
    Zeph: "ZEP",
    Hag: "HAG",
    Zech: "ZEC",
    Mal: "MAL",
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function maculaBook(ods) {
    if (!ods) return "";
    const raw = String(ods);
    return ODS_TO_MACULA[raw] || ODS_TO_MACULA[raw.replace(/\.$/, "")] || raw.toUpperCase();
  }

  function verseKey(chapter, verse) {
    return String(chapter) + "." + String(verse);
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetch(INDEX)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        index = data || { books: {} };
        return index;
      })
      .catch(() => {
        index = { books: {} };
        return index;
      });
  }

  function loadBook(book) {
    if (cache[book]) return cache[book];
    cache[book] = fetch("/data/diagrams/" + encodeURIComponent(book) + ".json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    return cache[book];
  }

  function has(book, chapter, verse) {
    return loadIndex().then((idx) => {
      const mac = maculaBook(book);
      const list = (idx.books && idx.books[mac]) || [];
      return list.indexOf(verseKey(chapter, verse)) !== -1;
    });
  }

  function get(book, chapter, verse) {
    const mac = maculaBook(book);
    const key = verseKey(chapter, verse);
    return loadIndex().then((idx) => {
      const list = (idx.books && idx.books[mac]) || [];
      if (list.indexOf(key) === -1) return null;
      return loadBook(mac).then((pack) => {
        const rec = pack[key] || null;
        if (!rec || rec.shape !== "tree") return null;
        return rec;
      });
    });
  }

  function nodeHTML(node) {
    const word = node.text
      ? `<span class="diag-word" lang="he" dir="rtl">${esc(node.text)}</span>`
      : "";
    const gloss = node.gloss ? `<span class="diag-gloss">${esc(node.gloss)}</span>` : "";
    const role = node.role ? `<span class="diag-role">${esc(node.role)}</span>` : "";
    const n = node.n ? `<span class="diag-n">${esc(String(node.n))}</span>` : "";
    const kids = (node.children || []).map(nodeHTML).join("");
    const body = kids ? `<ol>${kids}</ol>` : "";
    const meta = [node.label || "", role, gloss].filter(Boolean).join(" ");
    return `<li>
      <div class="diag-line">${n}${word}<span class="diag-meta">${meta}</span></div>
      ${body}
    </li>`;
  }

  function render(rec) {
    if (!rec || !rec.tree || rec.shape !== "tree") {
      return "";
    }
    const linear = (rec.linear || [])
      .map((w) => `<span class="diag-chip" title="${esc(w.gloss || "")}"><b lang="he" dir="rtl">${esc(w.text)}</b> ${esc(w.n || "")}</span>`)
      .join("");
    const shape = "Macula syntax tree";
    return `<p class="hint">${esc(rec.authorization || "")}</p>
      <p class="diag-linear">${linear}</p>
      <p class="hint">${esc(shape)}. ${esc(rec.book || "")} ${esc(String(rec.chapter))}:${esc(String(rec.verse))}.</p>
      <ol class="diag-tree">${nodeHTML(rec.tree)}</ol>
      <p class="hint">${esc(rec.source || "Macula via Bibla Lingua")}.</p>`;
  }

  root.odsDiagram = { maculaBook, has, get, render };
})(window);
