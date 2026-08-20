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

function ensureLexicon() {
  if (window.odsLexicon) return window.odsLexicon.load();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/lexicon.js";
    script.onload = () => window.odsLexicon.load().then(resolve, reject);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function bindWordLookup(root, mss) {
  if (!root || root.dataset.lexBound) return;
  root.dataset.lexBound = "1";
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button.orig-word");
    if (!btn) return;
    const raw = btn.getAttribute("data-lex") || btn.getAttribute("data-form") || "";
    ensureLexicon()
      .then(() => {
        const rec = window.odsLexicon.resolve(raw, mss && (mss.lang || mss.languages));
        location.href = window.odsLexicon.href(rec || raw);
      })
      .catch(() => {
        location.href = "/lex/?q=" + encodeURIComponent(raw);
      });
  });
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
        const lex = w.lex || "";
        return `<button type="button" class="orig-word${paleo ? " is-paleo" : ""}" data-square="${esc(t)}" data-form="${esc(t)}"${lex ? ` data-lex="${esc(lex)}"` : ""}${paleo ? ' data-force-paleo="1"' : ""} aria-label="Look up lemma">${esc(paleo ? toPaleo(t) : wrapHints(t))}</button>`;
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
  const names = [mss.id];
  if (mss.label) {
    const slug = String(mss.label).replace(/\//g, "-");
    if (slug && names.indexOf(slug) === -1) names.push(slug);
  }
  const tryNext = (i) => {
    if (i >= names.length) return Promise.resolve(mss);
    return fetch("/data/translations/" + encodeURIComponent(names[i]) + ".json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((pack) => (pack ? applyFirstDraft(mss, pack) : tryNext(i + 1)));
  };
  return tryNext(0);
}

function ensureQueue() {
  if (window.odsQueue) return Promise.resolve(window.odsQueue);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/queue.js";
    script.onload = () => resolve(window.odsQueue);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadQueue(mss) {
  if (!mss) return Promise.resolve(mss);
  return ensureQueue()
    .then((api) => api.load([mss]))
    .then(() => mss)
    .catch(() => {
      mss.queue = mss.queue || "none";
      return mss;
    });
}

function lineHTML(line, mss) {
  const num = `<span class="orig-num" dir="ltr">${esc(lineNum(line))}</span>`;
  const ref = line.ref || "";
  if (line.lacuna || (!line.text && !line.spaced && !(line.words && line.words.length))) {
    return `<li class="orig-row" data-ref="${esc(ref)}"><p class="orig-lacuna">${num} No letters survive on this line in the transcription.</p></li>`;
  }
  const wordsClass = line.words && line.words.length ? " orig-line-words" : "";
  const he = `<p class="orig-line${wordsClass}" lang="${esc(mss.lang || "he")}" dir="${esc(mss.dir || "rtl")}">${num}${heInner(line, mss)}</p>`;
  const en = line.en ? `<p class="orig-en" lang="en" dir="ltr">${esc(line.en)}</p>` : "";
  const book = line.book || mss.book || "";
  const chapter = line.chapter || mss.chapter || "";
  const verse = line.verse || "";
  const tools = `<div class="line-tools">
    <button type="button" class="line-tool" data-line-act="comment" data-ref="${esc(ref)}">Comment</button>
    <button type="button" class="line-tool" data-line-act="suggest" data-ref="${esc(ref)}">Suggest</button>
    ${book && chapter && verse ? `<button type="button" class="line-tool" data-line-act="diagram" data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(verse)}" hidden>Diagram</button>` : ""}
    <span class="line-mark" data-line-mark="${esc(ref)}" hidden></span>
  </div>`;
  return `<li class="orig-row${line.en ? " has-tr" : ""}" data-ref="${esc(ref)}" data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(verse)}">${he}${en}${tools}</li>`;
}

function ensureDiagram() {
  if (window.odsDiagram) return Promise.resolve(window.odsDiagram);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/diagram.js";
    script.onload = () => resolve(window.odsDiagram);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function ensureDeskStore() {
  if (window.odsDesk) return Promise.resolve(window.odsDesk);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/desk-store.js";
    script.onload = () => resolve(window.odsDesk);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function lineCurrent(row) {
  const words = Array.from(row.querySelectorAll(".orig-word"))
    .map((b) => b.textContent)
    .join(" ");
  if (words.trim()) return words.trim();
  const t = row.querySelector(".orig-he-text");
  return t ? t.textContent.trim() : "";
}

function paintDiagramButtons() {
  if (!window.odsDiagram) return;
  const buttons = Array.from(document.querySelectorAll("[data-line-act='diagram']"));
  buttons.forEach((btn) => {
    const book = btn.getAttribute("data-book") || "";
    const chapter = btn.getAttribute("data-chapter") || "";
    const verse = btn.getAttribute("data-verse") || "";
    if (!book || !chapter || !verse) {
      btn.hidden = true;
      return;
    }
    window.odsDiagram.has(book, chapter, verse).then((ok) => {
      btn.hidden = !ok;
    });
  });
}

function paintLineMarks(mss) {
  if (!window.odsDesk) return;
  document.querySelectorAll("[data-line-mark]").forEach((el) => {
    const ref = el.getAttribute("data-line-mark") || "";
    const comments = window.odsDesk.commentsFor("mss", mss.id, ref);
    const proposals = window.odsDesk.proposalsFor(mss.id, ref);
    const n = comments.length + proposals.length;
    if (!n) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = `${n} on this line`;
  });
}

function ensureRail() {
  let rail = document.getElementById("mss-rail");
  if (rail) return rail;
  const body = document.getElementById("mss-body");
  if (!body || !body.parentNode) return null;
  let wrap = document.getElementById("mss-work");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "mss-work";
    wrap.className = "mss-work";
    body.parentNode.insertBefore(wrap, body);
    wrap.appendChild(body);
  }
  rail = document.createElement("aside");
  rail.id = "mss-rail";
  rail.className = "mss-rail";
  rail.setAttribute("aria-label", "Line review");
  wrap.appendChild(rail);
  return rail;
}

function closeRows() {
  document.querySelectorAll(".orig-row.is-open").forEach((row) => row.classList.remove("is-open"));
}

function renderRail(mss, row, mode) {
  const rail = ensureRail();
  if (!rail) return;
  const session = window.odsSession && window.odsSession.last;
  const user = session && session.user;
  const cap = (session && session.capabilities) || {};
  if (!user) {
    rail.innerHTML = `<p class="hint">Sign in to comment or propose a reading. GitHub sign-in waits on the App. Open the desk to preview a role.</p><p><a class="btn btn-secondary" href="/account/">Open the desk</a></p>`;
    return;
  }
  const ref = (row && row.getAttribute("data-ref")) || "";
  const current = row ? lineCurrent(row) : "";
  const comments = window.odsDesk.commentsFor("mss", mss.id, ref);
  const proposals = window.odsDesk.proposalsFor(mss.id, ref);
  if (mode === "diagram") {
    const book = (row && row.getAttribute("data-book")) || mss.book || "";
    const chapter = (row && row.getAttribute("data-chapter")) || mss.chapter || "";
    const verse = (row && row.getAttribute("data-verse")) || "";
    rail.innerHTML = `<p class="rail-kicker">${esc(mss.label || mss.id)}</p>
      <h2>Sentence diagram</h2>
      <p class="hint">${book && chapter && verse ? esc(book + " " + chapter + ":" + verse) : "This line has no biblical verse."}.</p>
      <p class="hint" id="diag-status">Loading the Bibla Lingua tree.</p>
      <div id="diag-body"></div>
      <p class="actions"><button class="btn btn-ghost" type="button" data-line-act="comment">Back to comment</button></p>`;
    if (!book || !chapter || !verse) {
      const st = document.getElementById("diag-status");
      if (st) st.textContent = "This line is not placed in a biblical verse, so there is no Macula tree to open.";
      return;
    }
    ensureDiagram()
      .then((api) => api.get(book, chapter, verse))
      .then((rec) => {
        const body = document.getElementById("diag-body");
        const st = document.getElementById("diag-status");
        if (st) st.hidden = true;
        if (body) {
          const html = rec && rec.shape === "tree" ? window.odsDiagram.render(rec) : "";
          body.innerHTML = html || `<p class="hint">No reliable syntax tree for this verse, so the auto diagram is not offered.</p>`;
        }
      })
      .catch(() => {
        const st = document.getElementById("diag-status");
        if (st) st.textContent = "The diagram could not be loaded.";
      });
    return;
  }

  const composer =
    mode === "suggest"
      ? `<form id="rail-form" class="composer">
          <div class="field">
            <span class="label">Current</span>
            <p class="rail-current" lang="${esc(mss.lang || "he")}" dir="${esc(mss.dir || "rtl")}">${esc(current || "(none)")}</p>
          </div>
          <div class="field">
            <label for="rail-reading">Proposed reading</label>
            <input id="rail-reading" lang="${esc(mss.lang || "he")}" dir="${esc(mss.dir || "rtl")}" required maxlength="80" autocomplete="off">
          </div>
          <div class="field">
            <label for="rail-reason">Reason</label>
            <textarea id="rail-reason" required maxlength="2000"></textarea>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit">Propose this reading</button>
            <button class="btn btn-ghost" type="button" data-line-act="comment">Comment instead</button>
          </div>
          <p class="hint" id="rail-status" role="status"></p>
        </form>`
      : `<form id="rail-form" class="composer">
          <div class="field">
            <label for="rail-comment">Comment${ref ? " on " + esc(ref) : ""}</label>
            <textarea id="rail-comment" required maxlength="2000"></textarea>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit"${cap.suggest ? "" : " disabled"}>Post comment</button>
            <button class="btn btn-ghost" type="button" data-line-act="suggest"${cap.suggest ? "" : " hidden"}>Suggest a reading</button>
          </div>
          <p class="hint" id="rail-status" role="status"></p>
        </form>`;
  const thread = comments
    .map((c) => `<li><p class="thread-meta">${esc(c.author_login)} · ${esc(String(c.created_at || "").slice(0, 10))}</p><p>${esc(c.body)}</p></li>`)
    .join("");
  const props = proposals
    .map(
      (p) =>
        `<li><a href="/proposal/?id=${esc(p.id)}">${esc(window.odsDesk.statusLabel(p.status))} · ${esc(p.proposed_form)}</a></li>`,
    )
    .join("");
  rail.innerHTML = `
    <p class="rail-kicker">${esc(mss.label || mss.id)}</p>
    <h2>${mode === "suggest" ? "Propose a reading" : "Comment"}</h2>
    <p class="hint">${ref ? esc(ref) : "This line"}.</p>
    ${composer}
    ${props ? `<h3>Proposed readings</h3><ul class="rail-list">${props}</ul>` : ""}
    ${thread ? `<h3>Thread</h3><ol class="thread">${thread}</ol>` : `<p class="hint">No comments on this line yet. A comment appears in every signed-in person's queue.</p>`}`;
  if (window.odsIcons) window.odsIcons.paint();
  const form = document.getElementById("rail-form");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const status = document.getElementById("rail-status");
      if (mode === "suggest") {
        const reading = (document.getElementById("rail-reading") || {}).value || "";
        const reason = (document.getElementById("rail-reason") || {}).value || "";
        if (!reading.trim()) {
          if (status) status.textContent = "Enter the reading you are proposing.";
          return;
        }
        if (reason.trim().length < 12) {
          if (status) status.textContent = "Give a short reason. A dozen characters is enough to start.";
          return;
        }
        window.odsDesk
          .addProposal(user, {
            mss_id: mss.id,
            mss_label: mss.label || mss.id,
            line_ref: ref,
            current_form: current,
            proposed_form: reading.trim(),
            reason: reason.trim(),
          })
          .then((rec) => {
            location.href = "/proposal/?id=" + encodeURIComponent(rec.id);
          });
        return;
      }
      const text = (document.getElementById("rail-comment") || {}).value || "";
      if (text.trim().length < 12) {
        if (status) status.textContent = "Give a short comment. A dozen characters is enough to start.";
        return;
      }
      window.odsDesk
        .addComment(user, { target_type: "mss", target_id: mss.id, line_ref: ref, body: text.trim() })
        .then(() => {
          paintLineMarks(mss);
          renderRail(mss, row, "comment");
        });
    });
  }
}

function bindDesk(mss, root) {
  if (!root || root.dataset.deskBound) return;
  root.dataset.deskBound = "1";
  ensureRail();
  const open = (mode, row) => {
    closeRows();
    if (row) {
      row.classList.add("is-open");
      row.scrollIntoView({ block: "nearest" });
    }
    renderRail(mss, row, mode);
  };
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-line-act]");
    if (!btn) return;
    const row = btn.closest(".orig-row");
    open(btn.getAttribute("data-line-act") || "comment", row);
  });
  const wanted = new URLSearchParams(location.search).get("line");
  if (wanted) {
    const row = root.querySelector(`.orig-row[data-ref="${wanted}"]`);
    if (row) open("comment", row);
  }
}

function paintMssHistory(mss, credit) {
  if (!credit || !window.odsDesk) return;
  const events = (window.odsDesk.snapshot().events || []).filter((e) => e.mss_id === mss.id).slice(0, 6);
  const git = (window.odsDesk.snapshot().git || []).filter((g) => {
    const hay = String(g.message || "");
    return hay.indexOf(mss.id) !== -1 || hay.indexOf(mss.label || "") !== -1;
  }).slice(0, 6);
  if (!events.length && !git.length) {
    const box = document.createElement("p");
    box.innerHTML = `Edition history: <a href="/history/">git and the site record</a>.`;
    credit.appendChild(box);
    return;
  }
  const items = git
    .map((g) => `<li><a href="${esc(g.href)}" target="_blank" rel="noopener noreferrer">${esc(g.message)}</a> · ${esc(g.short)}</li>`)
    .concat(events.map((e) => `<li><a href="${esc(e.href || "/history/")}">${esc(e.title)}</a></li>`));
  const box = document.createElement("div");
  box.className = "mss-history";
  box.innerHTML = `<h2>Edition history</h2><ul>${items.join("")}</ul><p><a href="/history/">Full history</a></p>`;
  credit.appendChild(box);
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
    .then((mss) => loadQueue(mss))
    .then((mss) => ensureDeskStore().then((api) => api.load().then(() => mss)).catch(() => mss))
    .then((mss) => ensureDiagram().then(() => mss).catch(() => mss))
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
      if (window.odsQueue) {
        bits.push(window.odsQueue.lede(mss.queue || "none", mss.translation_count || 0));
      } else if (mss.translation_count) {
        bits.push(
          `machine-aid first draft on ${mss.translation_count} lines; human review pending; not the edition's translation`
        );
      } else {
        bits.push("No translation in the edition yet");
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
        bindWordLookup(body, mss);
        paintLineMarks(mss);
        paintDiagramButtons();
        bindDesk(mss, body);
      }

      const srcInfo = mss.source || {};
      if (credit) {
        if (mss.wording_status === "absent") {
          credit.innerHTML = `<p>Not in <a href="https://github.com/ETCBC/dss">ETCBC/dss</a> (Abegg). Cataloged so the Greek Cave 4, Cave 7, and Nahal Hever witnesses have a home. Photographs: IAA Leon Levy library.</p>`;
        } else {
          const aid = mss.queue === "signoff"
            ? " English on this page has a human sign off. It is still not a BHSA gloss."
            : mss.queue === "edit"
              ? " Human edit is recommended. Machine-aid English here is not ready to sign off, and it is not a BHSA gloss."
              : mss.translation_count
                ? " Machine-aid English is a first draft for human review, not the edition's translation, and not a BHSA gloss."
                : " The BHSA gloss is not the English of this manuscript.";
          credit.innerHTML = `<p>Wording from <a href="${esc(srcInfo.wording_repo || "https://github.com/ETCBC/dss")}">${esc(srcInfo.wording_dataset || "ETCBC/dss")}</a> (Abegg), ${esc(srcInfo.wording_license || "CC BY-NC 4.0")}. Lexical grounding from <a href="${esc(srcInfo.lexicon_repo || "https://github.com/ETCBC/bhsa")}">${esc(srcInfo.lexicon_dataset || "ETCBC/BHSA 2021")}</a>, ${esc(srcInfo.lexicon_license || "CC BY-NC 4.0")}.${aid} Photographs stay at the libraries that published them.</p>`;
        }
      }
      paintMssHistory(mss, credit);
      if (window.odsIcons) window.odsIcons.paint();
    })
    .catch(() => {
      body.innerHTML = "<p>This manuscript could not be loaded. The catalog is the way back.</p>";
    });
}

boot();
