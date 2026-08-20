/* Shared Hebrew / Aramaic lexicon. Academic morph code is the primary id. */
(function (root) {
  const HEBREW_SRC = "/data/lexicon/hebrew.json";
  const ARAMAIC_SRC = "/data/lexicon/aramaic.json";
  let records = null;

  function stripMarks(value) {
    return String(value || "")
      .replace(/[\[\]\(\)#^׃?{}ε]/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function langKey(raw) {
    const s = String(raw || "").toLowerCase();
    if (s === "arc" || s === "aramaic") return "aramaic";
    if (s === "he" || s === "hebrew") return "hebrew";
    return "";
  }

  function load() {
    if (records) return Promise.resolve(records);
    return Promise.all([
      fetch(HEBREW_SRC).then((r) => (r.ok ? r.json() : [])),
      fetch(ARAMAIC_SRC).then((r) => (r.ok ? r.json() : [])),
    ]).then(([hebrew, aramaic]) => {
      records = []
        .concat(Array.isArray(hebrew) ? hebrew : [])
        .concat(Array.isArray(aramaic) ? aramaic : []);
      return records;
    });
  }

  function all() {
    return records || [];
  }

  function byId(id) {
    if (!id) return null;
    const exact = all().find((rec) => rec.id === id);
    if (exact) return exact;
    const lower = String(id).toLowerCase();
    return all().find((rec) => rec.id.toLowerCase() === lower) || null;
  }

  function byForm(form, language) {
    const needle = stripMarks(form);
    if (!needle) return null;
    const lang = langKey(language);
    const pool = lang ? all().filter((rec) => rec.language === lang) : all();
    const exact = pool.find((rec) => stripMarks(rec.form) === needle);
    if (exact) return exact;
    let best = null;
    pool.forEach((rec) => {
      const formStrip = stripMarks(rec.form);
      if (!formStrip || formStrip.length < 2) return;
      if (needle.endsWith(formStrip) && (!best || formStrip.length > stripMarks(best.form).length)) {
        best = rec;
      }
    });
    return best;
  }

  function resolve(query, language) {
    const q = String(query || "").trim();
    if (!q) return null;
    return byId(q) || byForm(q, language);
  }

  function href(query) {
    const rec = typeof query === "object" && query ? query : resolve(query);
    const id = rec ? rec.id : String(query || "").trim();
    return "/lex/?q=" + encodeURIComponent(id);
  }

  function strongsUrl(code) {
    const id = String(code || "").toLowerCase();
    if (!/^[hg][0-9]{4,5}$/.test(id)) return "";
    return "https://www.blueletterbible.org/lexicon/" + id + "/kjv/";
  }

  function calUrl(rec) {
    if (!rec || rec.language !== "aramaic") return "";
    const form = stripMarks(rec.form) || rec.id;
    return "https://cal.huc.edu/oneentry.php?lemma=" + encodeURIComponent(form) + "&cits=all";
  }

  function search(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return all().slice();
    return all().filter((rec) => {
      const hay = [rec.id, rec.form, rec.gloss, rec.pos, ...(rec.strongs || [])]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1 || stripMarks(rec.form).indexOf(stripMarks(query)) !== -1;
    });
  }

  root.odsLexicon = {
    load,
    all,
    byId,
    byForm,
    resolve,
    href,
    strongsUrl,
    calUrl,
    search,
    stripMarks,
    langKey,
  };
})(window);
