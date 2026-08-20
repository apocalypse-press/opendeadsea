const HEBREW_TO_PALEO = {
  א: "\u{10900}",
  ב: "\u{10901}",
  ג: "\u{10902}",
  ד: "\u{10903}",
  ה: "\u{10904}",
  ו: "\u{10905}",
  ז: "\u{10906}",
  ח: "\u{10907}",
  ט: "\u{10908}",
  י: "\u{10909}",
  כ: "\u{1090A}",
  ך: "\u{1090A}",
  ל: "\u{1090B}",
  מ: "\u{1090C}",
  ם: "\u{1090C}",
  נ: "\u{1090D}",
  ן: "\u{1090D}",
  ס: "\u{1090E}",
  ע: "\u{1090F}",
  פ: "\u{10910}",
  ף: "\u{10910}",
  צ: "\u{10911}",
  ץ: "\u{10911}",
  ק: "\u{10912}",
  ר: "\u{10913}",
  ש: "\u{10914}",
  ת: "\u{10915}",
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function wrapHints(text) {
  return String(text)
    .replace(/\(\^[^\)]*\^\)/g, (m) => m.replace(/ /g, "\u00A0"))
    .replace(/([\[\]\(\)#^׃?{}])/g, "\u200F$1");
}

function toPaleo(text) {
  return wrapHints(String(text).replace(/[\u05D0-\u05EA]/g, (ch) => HEBREW_TO_PALEO[ch] || ch));
}

function applyScript(mode) {
  document.querySelectorAll("[data-square]").forEach((el) => {
    const square = el.getAttribute("data-square") || "";
    const forcePaleo = el.getAttribute("data-force-paleo") === "1";
    if (mode === "square") {
      el.textContent = wrapHints(square);
      el.classList.remove("is-paleo");
    } else if (forcePaleo || el.closest("[data-script='paleohebrew']")) {
      el.textContent = toPaleo(square);
      el.classList.add("is-paleo");
    } else {
      el.textContent = wrapHints(square);
      el.classList.remove("is-paleo");
    }
  });
}

function renderToggle(kind) {
  const box = document.getElementById("script-toggle");
  if (!box) return;
  box.hidden = false;
  const paleoLabel = kind === "mixed" ? "Paleo for YHWH" : "Paleo-Hebrew";
  const squareLabel = "Square Hebrew";
  box.innerHTML = `<p class="script-toggle-label">Script</p>
    <div class="script-toggle-btns" role="group" aria-label="Hebrew script">
      <button type="button" data-mode="paleo" aria-pressed="true">${paleoLabel}</button>
      <button type="button" data-mode="square" aria-pressed="false">${squareLabel}</button>
    </div>`;
  box.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-mode]");
    if (!btn) return;
    const mode = btn.getAttribute("data-mode");
    box.querySelectorAll("button[data-mode]").forEach((b) => {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    applyScript(mode);
  });
}

function lineNum(line) {
  if (line && line.verse) return String(line.verse);
  const s = String((line && line.ref) || "");
  const i = s.lastIndexOf(" ");
  return i === -1 ? s : s.slice(i + 1);
}

function heInner(line, mss) {
  if (line.words && line.words.length) {
    return line.words
      .map((w) => {
        const t = w.t || "";
        const paleo = w.script === "paleo";
        return `<span class="orig-word${paleo ? " is-paleo" : ""}" data-square="${esc(t)}"${paleo ? ' data-force-paleo="1"' : ""}>${esc(paleo ? toPaleo(t) : wrapHints(t))}</span>`;
      })
      .join(" ");
  }
  const raw = line.spaced || line.text || "";
  const paleo = mss.script === "paleohebrew";
  const shown = paleo ? toPaleo(raw) : wrapHints(raw);
  return `<span class="orig-he-text${paleo ? " is-paleo" : ""}" data-square="${esc(raw)}">${esc(shown)}</span>`;
}

function applyFirstDraft(mss, pack) {
  if (!pack || !pack.lines) return mss;
  const byRef = pack.lines;
  (mss.fragments || []).forEach((frag) => {
    (frag.lines || []).forEach((line) => {
      const draft = byRef[line.ref];
      if (draft && draft.en) {
        line.en = draft.en;
        line.en_status = pack.status || "first-draft";
      }
    });
  });
  mss.translation_count = (mss.fragments || []).reduce(
    (n, frag) => n + (frag.lines || []).filter((line) => line.en).length,
    0
  );
  mss.translation_status = pack.status || "first-draft";
  mss.translation_review = pack.review || "human-pending";
  return mss;
}

function loadFirstDraft(mss) {
  if (!mss || !mss.id) return Promise.resolve(mss);
  return fetch("/data/translations/" + encodeURIComponent(mss.id) + ".json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((pack) => applyFirstDraft(mss, pack));
}

function lineHTML(line, mss) {
  const num = `<span class="orig-num" dir="ltr">${esc(lineNum(line))}</span>`;
  if (line.lacuna || (!line.text && !line.spaced && !(line.words && line.words.length))) {
    return `<li class="orig-row"><p class="orig-lacuna">${num} No letters survive on this line in the transcription.</p></li>`;
  }
  const wordsClass = line.words && line.words.length ? " orig-line-words" : "";
  const he = `<p class="orig-line${wordsClass}" lang="${esc(mss.lang || "he")}" dir="${esc(mss.dir || "rtl")}">${num}${heInner(line, mss)}</p>`;
  const en = line.en ? `<p class="orig-en" lang="en" dir="ltr">${esc(line.en)}</p>` : "";
  return `<li class="orig-row${line.en ? " has-tr" : ""}">${he}${en}</li>`;
}

function tocKind(c, mss) {
  const ch = String(c.chapter || c.short || "");
  const book = String(c.book || "");
  const id = String(c.id || "");
  if (id === "unplaced" || (!c.chapter && !c.book)) return "unplaced";
  const self = book && (book === mss.id || book === mss.label);
  if (/^f/i.test(ch) || /-f\d/i.test(id) || self) return "fragment";
  if (/^\d+$/.test(ch) && book) return "chapter";
  return "fragment";
}

function splitToc(mss) {
  const groups = { chapter: [], fragment: [], unplaced: [] };
  for (const c of mss.chapters || []) {
    groups[tocKind(c, mss)].push(c);
  }
  return groups;
}

function chapterList(mss) {
  const groups = splitToc(mss);
  const block = (title, note, items) => {
    if (!items.length) return "";
    const rows = items
      .map((c) => {
        const n = c.line_count ? `${c.line_count} line${c.line_count === 1 ? "" : "s"}` : "";
        return `<li><a href="${esc(c.path)}"><h2>${esc(c.label)}</h2><p>${esc(n)}</p></a></li>`;
      })
      .join("");
    return `<section class="jump-block">
      <h2 class="jump-heading">${esc(title)}</h2>
      <p class="jump-note">${esc(note)}</p>
      <ol class="index">${rows}</ol>
    </section>`;
  };
  return `<nav class="chapter-list" aria-label="Contents">${
    block("Bible chapters", "Places in the biblical book that survive on this manuscript.", groups.chapter) +
    block("Fragments", "Pieces that have not been placed in a biblical chapter.", groups.fragment) +
    block("Unplaced lines", "Lines with no chapter or fragment label in the transcription.", groups.unplaced)
  }</nav>`;
}

function chapterPager(mss) {
  const prev = mss.prev
    ? `<a href="${esc(mss.prev.path)}" rel="prev">Previous: ${esc(mss.prev.label)}</a>`
    : "<span></span>";
  const next = mss.next
    ? `<a href="${esc(mss.next.path)}" rel="next">Next: ${esc(mss.next.label)}</a>`
    : "<span></span>";
  if (!mss.prev && !mss.next) return "";
  return `<nav class="chapter-pager" aria-label="Adjacent chapters">${prev}${next}</nav>`;
}

function jumpChip(c, mss) {
  const kind = tocKind(c, mss);
  const label = kind === "chapter" ? c.label || c.short || c.id : c.short || c.chapter || c.id;
  if (c.id === mss.chapter_id) {
    return `<li><span aria-current="page">${esc(String(label))}</span></li>`;
  }
  return `<li><a href="${esc(c.path)}">${esc(String(label))}</a></li>`;
}

function chapterJump(mss) {
  const groups = splitToc(mss);
  const block = (title, note, items, aria) => {
    if (!items.length) return "";
    return `<section class="jump-block">
      <h2 class="jump-heading">${esc(title)}</h2>
      <p class="jump-note">${esc(note)}</p>
      <nav class="chapter-index" aria-label="${esc(aria)}"><ol>${items.map((c) => jumpChip(c, mss)).join("")}</ol></nav>
    </section>`;
  };
  return `<div class="chapter-jumps">
    ${block("Bible chapters", "Jump by the biblical chapter that survives here.", groups.chapter, "Bible chapters")}
    ${block("Fragments", "Jump by fragment. These pieces are not placed in a biblical chapter.", groups.fragment, "Fragments")}
    ${block("Unplaced lines", "Lines with no chapter or fragment label.", groups.unplaced, "Unplaced lines")}
  </div>`;
}

function boot() {
  const src = document.body.dataset.mssSrc;
  const body = document.getElementById("mss-body");
  const lede = document.getElementById("mss-lede");
  const credit = document.getElementById("mss-credit");
  if (!src || !body) return;
  fetch(src)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((mss) => loadFirstDraft(mss))
    .then((mss) => {
      document.body.dataset.script = mss.script || "";
      const bits = [];
      if (mss.name) bits.push(mss.name);
      if (mss.provenance) bits.push(mss.provenance);
      if (mss.languages && mss.languages.length) bits.push(mss.languages.join(" / "));
      if (mss.script === "paleohebrew") bits.push("paleo-Hebrew throughout");
      if (mss.script === "mixed") bits.push("square Hebrew with paleo-Hebrew for the divine name and other marked words");
      if (mss.view === "index" && mss.chapters && mss.chapters.length) {
        bits.push(`${mss.chapters.length} chapters`);
      } else if (mss.view === "chapter") {
        const n = (mss.fragments || []).reduce((acc, frag) => acc + (frag.lines || []).length, 0);
        if (n) bits.push(`${n} lines`);
      } else if (mss.line_count) {
        bits.push(`${mss.line_count} lines`);
      }
      if (mss.biblical) bits.push("biblical");
      if (mss.translation_count) {
        bits.push(
          `machine-aid first draft on ${mss.translation_count} lines; human review pending; not the edition's translation`
        );
      } else {
        bits.push("translation is not in the edition yet");
      }
      if (lede) lede.textContent = bits.join(". ") + ".";

      const links = [];
      if (mss.iaa_url) {
        links.push(`<a href="${esc(mss.iaa_url)}" target="_blank" rel="noopener noreferrer">Official photographs</a>`);
      }
      if (mss.museum_url) {
        links.push(`<a href="${esc(mss.museum_url)}" target="_blank" rel="noopener noreferrer">Museum page</a>`);
      }
      const plates = links.length ? `<p class="mss-links">${links.join(" · ")}</p>` : "";

      if (mss.wording_status === "absent") {
        body.innerHTML = `${plates}
          <div class="wording-absent">
            <p>This witness is not in the Abegg / ETCBC/dss Hebrew and Aramaic dump, so the Greek letters are not on this page yet.</p>
            ${mss.contents ? `<p>${esc(mss.contents)}</p>` : ""}
            <p>The official photographs are linked above. DJD transcriptions are not copied here.</p>
          </div>`;
      } else if (mss.view === "index" || ((mss.chapters || []).length && !(mss.fragments || []).length)) {
        body.innerHTML = `${plates}${chapterList(mss)}`;
      } else {
        const wrapClass = mss.script === "paleohebrew" ? "mss-script" : "";
        const wrapAttr = mss.script === "paleohebrew" ? ' data-script="paleohebrew"' : "";
        const frags = (mss.fragments || [])
          .map((frag) => {
            const lines = (frag.lines || []).map((line) => lineHTML(line, mss)).join("");
            const head = frag.label ? `<h2 class="frag-label">Fragment ${esc(frag.label)}</h2>` : "";
            return `<section class="frag">${head}<ol class="orig-lines">${lines}</ol></section>`;
          })
          .join("");
        const pager = mss.view === "chapter" ? chapterPager(mss) : "";
        const jump = mss.view === "chapter" ? chapterJump(mss) : "";
        body.innerHTML = `${plates}${pager}<div class="${wrapClass}"${wrapAttr}>${frags}</div>${pager}${jump}`;
        if (mss.script === "paleohebrew" || mss.script === "mixed") renderToggle(mss.script);
      }

      const srcInfo = mss.source || {};
      if (credit) {
        if (mss.wording_status === "absent") {
          credit.innerHTML = `<p>Not in <a href="https://github.com/ETCBC/dss">ETCBC/dss</a> (Abegg). Cataloged so the Greek Cave 4, Cave 7, and Nahal Hever witnesses have a home. Photographs: IAA Leon Levy library.</p>`;
        } else {
          const aid = mss.translation_count
            ? " Machine-aid English is a first draft for human review, not the edition's translation, and not a BHSA gloss."
            : " The BHSA gloss is not the English of this manuscript.";
          credit.innerHTML = `<p>Wording from <a href="${esc(srcInfo.wording_repo || "https://github.com/ETCBC/dss")}">${esc(srcInfo.wording_dataset || "ETCBC/dss")}</a> (Abegg), ${esc(srcInfo.wording_license || "CC BY-NC 4.0")}. Lexical grounding from <a href="${esc(srcInfo.lexicon_repo || "https://github.com/ETCBC/bhsa")}">${esc(srcInfo.lexicon_dataset || "ETCBC/BHSA 2021")}</a>, ${esc(srcInfo.lexicon_license || "CC BY-NC 4.0")}.${aid} Photographs stay at the libraries that published them.</p>`;
        }
      }
      if (window.odsIcons) window.odsIcons.paint();
    })
    .catch(() => {
      body.innerHTML = "<p>This manuscript could not be loaded. The catalog is the way back.</p>";
    });
}

boot();
